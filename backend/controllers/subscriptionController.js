'use strict';

/**
 * subscriptionController.js
 * ------------------------------------------------------------------
 * HTTP layer for premium subscription purchases via Cashfree.
 *
 *   GET  /api/v2/subscriptions/plans        -> available plans + prices
 *   POST /api/v2/subscriptions/create-order  -> create Cashfree order
 *   GET  /api/v2/subscriptions/status/:orderId -> poll order status
 */

const SubscriptionOrder = require('../models/SubscriptionOrder');
const subscriptionService = require('../services/subscriptionService');
const cashfreeController = require('./cashfreeController');
const logger = require('../config/logger');

const PLANS = ['MONTHLY', 'ANNUAL', 'LIFETIME'];

const PLAN_LABELS = {
  MONTHLY: 'Monthly',
  ANNUAL: 'Annual',
  LIFETIME: 'Lifetime',
};

/**
 * GET /api/v2/subscriptions/plans
 * Public catalog of purchasable plans (admin-set prices).
 */
exports.getPlans = async (req, res, next) => {
  try {
    const prices = await subscriptionService.getPurchasePrices();
    const plans = PLANS.map((key) => ({
      key,
      label: PLAN_LABELS[key],
      price: prices[PLAN_LABELS[key].toLowerCase()] ?? 0,
    })).filter((p) => p.price > 0);

    return res.status(200).json({
      success: true,
      enabled: prices.enabled,
      plans,
    });
  } catch (err) {
    logger.error(`[SUBSCRIPTION] getPlans error: ${err.message}`);
    next(err);
  }
};

/**
 * POST /api/v2/subscriptions/create-order
 * Creates a Cashfree order for the requested plan and returns the checkout URL.
 * The mobile app opens paymentUrl; the webhook/status poll activates the plan.
 */
exports.createOrder = async (req, res, next) => {
  try {
    const { plan, appRedirect } = req.body;
    if (!PLANS.includes(plan)) {
      const err = new Error('Invalid subscription plan');
      err.statusCode = 400;
      return next(err);
    }

    const prices = await subscriptionService.getPurchasePrices();
    if (!prices.enabled) {
      const err = new Error('Subscription purchases are currently disabled');
      err.statusCode = 400;
      return next(err);
    }

    const amount = await subscriptionService.getPriceForPlan(plan);
    if (!amount || amount <= 0) {
      const err = new Error('This plan is not available');
      err.statusCode = 400;
      return next(err);
    }

    const owner = req.user;
    const orderId = `sub_${owner._id}_${Date.now()}`;

    // Sanitize phone (Cashfree requires 10-14 numeric digits)
    let safePhone = String(owner.phone || owner.mobile || '').replace(/[^0-9]/g, '');
    if (safePhone.length < 10) safePhone = '9999999999';
    if (safePhone.length > 14) safePhone = safePhone.slice(-10);

    const orderRequest = {
      order_amount: amount,
      order_currency: 'INR',
      order_id: orderId,
      customer_details: {
        customer_id: owner._id.toString(),
        customer_name: owner.name || 'Owner',
        customer_phone: safePhone,
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL || 'https://happyrenting.netlify.app'}/payments?order_id={order_id}${appRedirect ? '&app_redirect=' + encodeURIComponent(appRedirect) : ''}`,
        notify_url: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/v2/payments/cashfree/webhook`,
      },
    };

    const cashfree = cashfreeController.getCashfreeInstance();
    const response = await cashfree.PGCreateOrder(orderRequest);

    if (!response?.data?.payment_session_id) {
      throw new Error('Invalid response from Cashfree — missing payment_session_id');
    }

    const cfEnv = String(process.env.CASHFREE_ENVIRONMENT || 'SANDBOX').toUpperCase();
    const frontendUrl = (process.env.FRONTEND_URL || 'https://happyrenting.netlify.app').replace(/\/$/, '');
    const paymentUrl = `${frontendUrl}/cashfree-checkout?session_id=${response.data.payment_session_id}&order_id=${response.data.order_id}&env=${cfEnv}&app_redirect=${encodeURIComponent(appRedirect || '')}`;

    // Store pending order for webhook correlation
    const subscriptionOrder = await SubscriptionOrder.create({
      ownerId: owner._id,
      plan,
      amount,
      cashfreeOrderId: orderId,
      status: 'pending',
      paymentUrl,
    });

    logger.info(
      `[SUBSCRIPTION] Order Created — orderId=${orderId} plan=${plan} amount=₹${amount} owner=${owner._id}`
    );

    return res.status(200).json({
      success: true,
      orderId,
      paymentSessionId: response.data.payment_session_id,
      paymentUrl,
      amount,
      currency: response.data.order_currency,
      subscriptionOrderId: subscriptionOrder._id,
    });
  } catch (err) {
    let errorMessage = err.message;
    if (err.response?.data) {
      const cfError = err.response.data;
      logger.error(`[SUBSCRIPTION] Cashfree create order API error: ${JSON.stringify(cfError)}`);
      errorMessage = cfError.message || cfError.code || 'Gateway rejected request';
      err.statusCode = err.response.status || 400;
    }
    logger.error(`[SUBSCRIPTION] Create order failed: ${errorMessage}`);
    const finalErr = new Error(`Cashfree Error: ${errorMessage}`);
    finalErr.statusCode = err.statusCode || 500;
    return next(finalErr);
  }
};

/**
 * GET /api/v2/subscriptions/status/:orderId
 * Polls a subscription order. If paid, activates the owner's plan
 * (idempotent — a paid order never downgrades).
 */
exports.getOrderStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      const err = new Error('Order ID is required');
      err.statusCode = 400;
      return next(err);
    }

    const order = await SubscriptionOrder.findOne({
      cashfreeOrderId: orderId,
      ownerId: req.user._id,
    });

    if (!order) {
      const err = new Error('Subscription order not found');
      err.statusCode = 404;
      return next(err);
    }

    if (order.status === 'paid') {
      return res.status(200).json({
        success: true,
        status: 'success',
        plan: order.plan,
        activatedUntil: order.activatedUntil,
      });
    }

    // Admin-reversed orders stay reversed — never re-activate via status poll.
    if (order.status === 'reversed') {
      return res.status(200).json({
        success: true,
        status: 'failed',
        plan: order.plan,
        message: 'This subscription was reversed by an administrator.',
      });
    }

    // Otherwise ask Cashfree for live status
    let cfStatus = 'pending';
    try {
      const cashfree = cashfreeController.getCashfreeInstance();
      const cfOrder = await cashfree.PGFetchOrder(orderId);
      cfStatus = cfOrder?.data?.order_status;
    } catch (cfErr) {
      logger.warn(`[SUBSCRIPTION] Status fetch failed: ${cfErr.message}`);
    }

    if (cfStatus === 'PAID') {
      // Activate idempotently (webhook may have already done it)
      if (order.status !== 'paid') {
        const sub = await subscriptionService.activateSubscription(req.user._id, order.plan);
        order.status = 'paid';
        order.paidAt = new Date();
        order.activatedUntil = sub.expiresAt || null;
        await order.save();
      }
      return res.status(200).json({
        success: true,
        status: 'success',
        plan: order.plan,
        activatedUntil: order.activatedUntil,
      });
    }

    if (['ACTIVE', 'CREATED'].includes(cfStatus)) {
      return res.status(200).json({ success: true, status: 'pending' });
    }

    // Failed / expired / voided
    return res.status(200).json({ success: true, status: 'failed' });
  } catch (err) {
    logger.error(`[SUBSCRIPTION] Status check failed: ${err.message}`);
    err.statusCode = err.statusCode || 500;
    return next(err);
  }
};

/**
 * GET /api/v2/subscriptions/me
 * Current subscription snapshot for the logged-in owner.
 */
exports.getMySubscription = async (req, res, next) => {
  try {
    const user = await require('../models/User').findById(req.user._id).select('subscription').lean();
    const sub = user?.subscription || {};
    return res.status(200).json({
      success: true,
      subscription: {
        plan: sub.plan || 'FREE',
        status: sub.status || 'active',
        billingPeriod: sub.billingPeriod || null,
        purchasedAt: sub.purchasedAt || null,
        expiresAt: sub.expiresAt || null,
        lifetime: Boolean(sub.lifetime),
        entitlementVersion: sub.entitlementVersion || 1,
      },
    });
  } catch (err) {
    logger.error(`[SUBSCRIPTION] getMySubscription error: ${err.message}`);
    next(err);
  }
};

/**
 * GET /api/v2/subscriptions/admin/orders
 * Superadmin: list all subscription purchase orders (paginated), with the
 * owning user populated so admins can reverse/undo reversals.
 */
exports.adminGetOrders = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status && ['pending', 'paid', 'failed', 'voided', 'reversed'].includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (req.query.ownerId) filter.ownerId = req.query.ownerId;

    const [orders, total] = await Promise.all([
      SubscriptionOrder.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('ownerId', 'name email role'),
      SubscriptionOrder.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: orders.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      orders,
    });
  } catch (err) {
    logger.error(`[SUBSCRIPTION] adminGetOrders error: ${err.message}`);
    next(err);
  }
};

/**
 * POST /api/v2/subscriptions/admin/orders/:orderId/reverse
 * Superadmin: reverse a paid subscription — downgrades the owner to FREE and
 * marks the order reversed (idempotent; a paid order is only reversed once).
 */
exports.adminReverseOrder = async (req, res, next) => {
  try {
    const order = await SubscriptionOrder.findById(req.params.orderId);
    if (!order) {
      const err = new Error('Subscription order not found');
      err.statusCode = 404;
      return next(err);
    }
    if (order.status !== 'paid') {
      const err = new Error('Only paid subscription orders can be reversed');
      err.statusCode = 400;
      return next(err);
    }

    const reason = String(req.body.reason || '').trim() || 'Reversed by administrator';
    const sub = await subscriptionService.reverseSubscription(order.ownerId);

    order.status = 'reversed';
    order.reversedAt = new Date();
    order.reversedBy = req.user._id;
    order.reversalReason = reason;
    order.activatedUntil = sub.expiresAt || null;
    await order.save();

    logger.info(
      `[SUBSCRIPTION] Order reversed — orderId=${order.cashfreeOrderId || order._id} owner=${order.ownerId} reason="${reason}"`
    );

    return res.status(200).json({
      success: true,
      message: 'Subscription reversed. Owner downgraded to Free.',
      order,
    });
  } catch (err) {
    logger.error(`[SUBSCRIPTION] adminReverseOrder error: ${err.message}`);
    err.statusCode = err.statusCode || 500;
    next(err);
  }
};

/**
 * POST /api/v2/subscriptions/admin/orders/:orderId/undo-reversal
 * Superadmin: restore a reversed subscription — re-activates the owner's plan
 * with the originally computed expiry.
 */
exports.adminUndoReverseOrder = async (req, res, next) => {
  try {
    const order = await SubscriptionOrder.findById(req.params.orderId);
    if (!order) {
      const err = new Error('Subscription order not found');
      err.statusCode = 404;
      return next(err);
    }
    if (order.status !== 'reversed') {
      const err = new Error('Only reversed subscription orders can be restored');
      err.statusCode = 400;
      return next(err);
    }

    const sub = await subscriptionService.undoSubscriptionReversal(
      order.ownerId,
      order.plan,
      order.activatedUntil
    );

    order.status = 'paid';
    order.reversedAt = null;
    order.reversedBy = null;
    order.reversalReason = '';
    order.activatedUntil = sub.expiresAt || null;
    await order.save();

    logger.info(
      `[SUBSCRIPTION] Reversal undone — orderId=${order.cashfreeOrderId || order._id} owner=${order.ownerId} plan=${order.plan}`
    );

    return res.status(200).json({
      success: true,
      message: 'Subscription restored. Owner is back on their paid plan.',
      order,
    });
  } catch (err) {
    logger.error(`[SUBSCRIPTION] adminUndoReverseOrder error: ${err.message}`);
    err.statusCode = err.statusCode || 500;
    next(err);
  }
};
