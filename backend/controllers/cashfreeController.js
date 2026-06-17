'use strict';

/**
 * cashfreeController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Production-grade Cashfree integration with:
 *   - Server-side order creation
 *   - Webhook-based verification (never trust frontend)
 *   - Status polling endpoint
 *   - Database-level idempotency
 *   - Structured logging
 */

const crypto = require('crypto');
const { Cashfree, CFEnvironment } = require('cashfree-pg');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const PaymentTransaction = require('../models/PaymentTransaction');
const paymentServiceV2 = require('../services/paymentServiceV2');
const logger = require('../config/logger');

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Initialize and return a configured Cashfree SDK instance.
 * Called fresh per-request to ensure env vars are always read at runtime.
 */
const getCashfreeInstance = () => {
  Cashfree.XClientId = process.env.CASHFREE_APP_ID;
  Cashfree.XClientSecret = process.env.CASHFREE_SECRET_KEY;
  Cashfree.XEnvironment =
    process.env.CASHFREE_ENVIRONMENT === 'PRODUCTION'
      ? CFEnvironment.PRODUCTION
      : CFEnvironment.SANDBOX;

  const cashfree = new Cashfree();
  cashfree.XClientId = process.env.CASHFREE_APP_ID;
  cashfree.XClientSecret = process.env.CASHFREE_SECRET_KEY;
  cashfree.XEnvironment =
    process.env.CASHFREE_ENVIRONMENT === 'PRODUCTION'
      ? CFEnvironment.PRODUCTION
      : CFEnvironment.SANDBOX;

  return cashfree;
};

/**
 * Verify Cashfree webhook signature.
 * https://docs.cashfree.com/docs/webhook-verify
 */
const verifyWebhookSignature = (rawBody, timestamp, signature) => {
  try {
    const secret = process.env.CASHFREE_SECRET_KEY;
    const body = `${timestamp}${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('base64');
    return expectedSignature === signature;
  } catch {
    return false;
  }
};

// ─────────────────────────────────────────────────────────────────────────
// ENDPOINT 1: Create Cashfree Order
// POST /api/v2/payments/cashfree/create-order/:rentRecordId
// ─────────────────────────────────────────────────────────────────────────

/**
 * @desc    Create a Cashfree order for a specific rent record.
 *          Stores pendingCashfreeOrderId on the rent record for tracking.
 * @access  Private (Tenant only)
 */
exports.createCashfreeOrder = async (req, res, next) => {
  try {
    const { rentRecordId } = req.params;
    const { amount, appRedirect } = req.body;

    const parsedAmount = Number(amount);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      const err = new Error('Invalid payment amount');
      err.statusCode = 400;
      return next(err);
    }

    const rentRecord = await MonthlyRentRecord.findById(rentRecordId).populate('tenantId');
    if (!rentRecord) {
      const err = new Error('Rent record not found');
      err.statusCode = 404;
      return next(err);
    }

    // Security: ensure the logged-in user is the tenant on this rent record
    // rentRecord.tenantId is the Tenant doc; Tenant.userId is the User doc
    const tenantUserId = rentRecord.tenantId?.userId?.toString() || rentRecord.userId?.toString();
    if (tenantUserId && tenantUserId !== String(req.user._id)) {
      const err = new Error('Access denied — this rent record does not belong to you');
      err.statusCode = 403;
      return next(err);
    }

    if (parsedAmount > rentRecord.remainingAmount) {
      const err = new Error(
        `Amount (₹${parsedAmount}) cannot exceed remaining balance (₹${rentRecord.remainingAmount})`
      );
      err.statusCode = 400;
      return next(err);
    }

    // Sanitize phone (Cashfree requires 10 numeric digits)
    let safePhone = (rentRecord.tenantId.phone || '9999999999').replace(/[^0-9]/g, '');
    if (safePhone.length < 10) safePhone = '9999999999';
    if (safePhone.length > 14) safePhone = safePhone.slice(-10);

    const orderId = `cf_${rentRecordId}_${Date.now()}`;

    const orderRequest = {
      order_amount: parsedAmount,
      order_currency: 'INR',
      order_id: orderId,
      customer_details: {
        customer_id: rentRecord.tenantId._id.toString(),
        customer_name: rentRecord.tenantId.name || 'Tenant',
        customer_phone: safePhone,
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payments?order_id={order_id}${appRedirect ? '&app_redirect=' + encodeURIComponent(appRedirect) : ''}`,
        notify_url: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/v2/payments/cashfree/webhook`,
      },
    };

    const cashfree = getCashfreeInstance();
    const response = await cashfree.PGCreateOrder(orderRequest);

    if (!response?.data?.payment_session_id) {
      throw new Error('Invalid response from Cashfree — missing payment_session_id');
    }

    // Store pending order on rent record so webhook can look it up
    await MonthlyRentRecord.findByIdAndUpdate(rentRecordId, {
      pendingCashfreeOrderId: orderId,
      pendingCashfreeAmount: parsedAmount,
      pendingCashfreeCreatedAt: new Date(),
    });

    logger.info(
      `[CASHFREE] Order Created — orderId=${orderId} rentRecordId=${rentRecordId} amount=₹${parsedAmount} tenant=${req.user.id}`
    );

    const cfEnv = String(process.env.CASHFREE_ENVIRONMENT || 'SANDBOX').toUpperCase();
    const isProd = cfEnv === 'PRODUCTION';
    
    // Instead of the dead V2 order URL, we point the mobile app to our own backend route
    // that safely hosts the V3 JS SDK and auto-triggers the checkout flow.
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const paymentUrl = `${baseUrl}/api/v2/payments/cashfree/checkout?session_id=${response.data.payment_session_id}&order_id=${response.data.order_id}&env=${cfEnv}&app_redirect=${encodeURIComponent(appRedirect || '')}`;

    logger.info(`[CASHFREE] Redirect URL Generated: ${paymentUrl} (Env: ${cfEnv})`);

    return res.status(200).json({
      success: true,
      orderId: response.data.order_id,
      paymentSessionId: response.data.payment_session_id,
      paymentUrl,
      amount: response.data.order_amount,
      currency: response.data.order_currency,
    });
  } catch (err) {
    let errorMessage = err.message;
    if (err.response?.data) {
      const cfError = err.response.data;
      logger.error(`[CASHFREE] Create order API error: ${JSON.stringify(cfError)}`);
      // Extract the human readable error message from Cashfree to show on the frontend
      errorMessage = cfError.message || cfError.code || 'Gateway rejected request';
      err.statusCode = err.response.status || 400;
    }
    logger.error(`[CASHFREE] Create order failed: ${errorMessage}`);
    
    // Explicitly set the error message so the global error handler sends it to the frontend
    const finalErr = new Error(`Cashfree Error: ${errorMessage}`);
    finalErr.statusCode = err.statusCode || 500;
    return next(finalErr);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// ENDPOINT 2: Poll Payment Status
// GET /api/v2/payments/cashfree/status/:orderId
// ─────────────────────────────────────────────────────────────────────────

/**
 * @desc    Frontend polls this after Cashfree checkout closes.
 *          Returns status WITHOUT creating any transaction — that's
 *          the webhook's exclusive job.
 * @access  Private (Tenant)
 */
exports.getCashfreePaymentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      const err = new Error('Order ID is required');
      err.statusCode = 400;
      return next(err);
    }

    // Check if we have already recorded a completed transaction for this order
    const existing = await PaymentTransaction.findOne({
      cashfreeOrderId: orderId,
      status: 'completed',
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        status: 'success',
        message: 'Payment verified and recorded',
        transactionId: existing._id,
      });
    }

    // Check if a failed/voided record exists
    const failed = await PaymentTransaction.findOne({
      cashfreeOrderId: orderId,
      status: { $in: ['failed', 'voided'] },
    });

    if (failed) {
      return res.status(200).json({ success: true, status: 'failed' });
    }

    // Otherwise query Cashfree directly for live status
    const cashfree = getCashfreeInstance();
    let cfOrder;
    try {
      cfOrder = await cashfree.PGFetchOrder(orderId);
    } catch (cfErr) {
      logger.warn(`[CASHFREE] Status check fetch failed: ${cfErr.message}`);
      return res.status(200).json({ success: true, status: 'pending' });
    }

    const orderStatus = cfOrder?.data?.order_status;

    if (orderStatus === 'PAID') {
      return res.status(200).json({ success: true, status: 'success' });
    } else if (['ACTIVE', 'CREATED'].includes(orderStatus)) {
      return res.status(200).json({ success: true, status: 'pending' });
    } else {
      return res.status(200).json({ success: true, status: 'failed' });
    }
  } catch (err) {
    logger.error(`[CASHFREE] Status check failed: ${err.message}`);
    err.statusCode = err.statusCode || 500;
    return next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// ENDPOINT 3: Cashfree Webhook
// POST /api/v2/payments/cashfree/webhook
// ─────────────────────────────────────────────────────────────────────────

/**
 * @desc    Receives Cashfree server-to-server payment confirmation.
 *          This is the ONLY place where PaymentTransactions are created
 *          for gateway payments. Never from the frontend.
 *
 *          IMPORTANT: This route must be registered BEFORE express.json()
 *          middleware so that req.rawBody is available for signature check.
 *
 * @access  Public (no JWT — verified by HMAC signature instead)
 */
exports.handleCashfreeWebhook = async (req, res) => {
  // Always respond 200 fast to Cashfree — prevents retries while we process
  res.status(200).json({ received: true });

  try {
    logger.info(`[CASHFREE] Webhook Received`);

    // ── Signature Verification ────────────────────────────────────────────
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];
    const rawBody = req.rawBody; // Injected by our raw body saver middleware

    if (!signature || !timestamp || !rawBody) {
      logger.warn('[CASHFREE] Webhook missing signature headers — ignoring');
      return;
    }

    const isValid = verifyWebhookSignature(rawBody, timestamp, signature);
    if (!isValid) {
      logger.warn('[CASHFREE] Webhook signature verification FAILED — ignoring');
      return;
    }

    // ── Parse Event ───────────────────────────────────────────────────────
    const event = req.body;
    const eventType = event?.type;
    const paymentData = event?.data?.payment;
    const orderData = event?.data?.order;

    if (!paymentData || !orderData) {
      logger.warn(`[CASHFREE] Webhook missing payload data — eventType=${eventType}`);
      return;
    }

    const cfOrderId = orderData.order_id;
    const cfPaymentId = paymentData.cf_payment_id?.toString();
    const paymentStatus = paymentData.payment_status;

    logger.info(
      `[CASHFREE] Webhook event=${eventType} orderId=${cfOrderId} status=${paymentStatus}`
    );

    // Only process successful payments
    if (paymentStatus !== 'SUCCESS') {
      logger.info(`[CASHFREE] Webhook skipped — non-success status: ${paymentStatus}`);
      return;
    }

    // ── Idempotency Check — DB level ──────────────────────────────────────
    const alreadyProcessed = await PaymentTransaction.findOne({
      cashfreeOrderId: cfOrderId,
    });

    if (alreadyProcessed) {
      logger.info(
        `[CASHFREE] Duplicate Webhook Ignored — orderId=${cfOrderId} existingTxn=${alreadyProcessed._id}`
      );
      return;
    }

    // ── Look up Rent Record ───────────────────────────────────────────────
    const rentRecord = await MonthlyRentRecord.findOne({
      pendingCashfreeOrderId: cfOrderId,
    }).populate('tenantId');

    if (!rentRecord) {
      logger.error(
        `[CASHFREE] Webhook — No rent record found for orderId=${cfOrderId}. Possible orphaned order.`
      );
      return;
    }

    const paidAmount = Number(paymentData.order_amount || rentRecord.pendingCashfreeAmount);

    if (!paidAmount || paidAmount <= 0) {
      logger.error(
        `[CASHFREE] Webhook — Invalid payment amount for orderId=${cfOrderId}`
      );
      return;
    }

    // ── Verify with Cashfree API (double-check) ───────────────────────────
    try {
      const cashfree = getCashfreeInstance();
      const payments = await cashfree.PGOrderFetchPayments(cfOrderId);
      const verified = (payments?.data || []).find(
        (p) => p.payment_status === 'SUCCESS' && p.cf_payment_id?.toString() === cfPaymentId
      );

      if (!verified) {
        logger.error(
          `[CASHFREE] Verification Failed — Cashfree API did not confirm orderId=${cfOrderId}`
        );
        return;
      }
    } catch (cfApiErr) {
      logger.error(
        `[CASHFREE] Verification Failed — API error for orderId=${cfOrderId}: ${cfApiErr.message}`
      );
      return;
    }

    // ── Determine payment method from Cashfree data ───────────────────────
    const cfPaymentGroup = paymentData.payment_group?.toLowerCase() || '';
    let resolvedPaymentMethod = 'other';
    if (cfPaymentGroup.includes('upi')) resolvedPaymentMethod = 'upi';
    else if (cfPaymentGroup.includes('card')) resolvedPaymentMethod = 'bank_transfer';
    else if (cfPaymentGroup.includes('net_banking')) resolvedPaymentMethod = 'bank_transfer';

    // ── Record Transaction via existing service ───────────────────────────
    // Use a system caller since this is server-triggered
    const systemCaller = { id: rentRecord.ownerId, role: 'system' };

    await paymentServiceV2.addPaymentTransaction(
      {
        rentRecordId: rentRecord._id.toString(),
        tenantId: rentRecord.tenantId._id,
        amount: paidAmount,
        paymentMethod: resolvedPaymentMethod,
        transactionType: 'gateway',
        paymentDate: new Date(paymentData.payment_completion_time || Date.now()),
        transactionId: cfPaymentId,
        note: `Paid online via Cashfree (${paymentData.payment_group || 'gateway'})`,
        recordedBy: rentRecord.ownerId,
        createdByRole: 'system',
        entrySource: 'gateway_callback',
        idempotencyKey: cfOrderId, // Backed by DB unique index on idempotencyKey
        // Gateway-specific fields (set directly after creation below)
        paymentGateway: 'cashfree',
        cashfreeOrderId: cfOrderId,
        cashfreePaymentId: cfPaymentId,
      },
      systemCaller
    );

    // ── Update gateway fields on the created transaction ──────────────────
    // paymentServiceV2 creates the transaction; we patch the gateway fields after
    const updatedTx = await PaymentTransaction.findOneAndUpdate(
      { idempotencyKey: cfOrderId },
      {
        $set: {
          paymentGateway: 'cashfree',
          cashfreeOrderId: cfOrderId,
          cashfreePaymentId: cfPaymentId,
          verifiedAt: new Date(),
          webhookPayload: event,
        },
      },
      { new: true }
    );

    // ── Credit Owner Wallet ───────────────────────────────────────────────
    if (updatedTx) {
      try {
        const walletService = require('../services/walletService');
        await walletService.creditWalletOnPayment(updatedTx._id);
        logger.info(`[CASHFREE] Credited owner wallet for orderId=${cfOrderId}`);
      } catch (walletErr) {
        logger.error(`[CASHFREE] Wallet credit failed for orderId=${cfOrderId}: ${walletErr.message}`, walletErr);
      }
    }

    // ── Clear pending order from rent record ──────────────────────────────
    await MonthlyRentRecord.findByIdAndUpdate(rentRecord._id, {
      $unset: {
        pendingCashfreeOrderId: '',
        pendingCashfreeAmount: '',
        pendingCashfreeCreatedAt: '',
      },
    });

    logger.info(
      `[CASHFREE] Payment Verified — orderId=${cfOrderId} cfPaymentId=${cfPaymentId} amount=₹${paidAmount} tenant=${rentRecord.tenantId._id}`
    );
  } catch (err) {
    // Log but do NOT let exceptions propagate — response already sent
    if (err.code === 11000) {
      logger.info(`[CASHFREE] Duplicate Webhook Ignored — race condition caught at DB level`);
    } else {
      logger.error(`[CASHFREE] Webhook processing error: ${err.message}`, err);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// ENDPOINT 4: Mobile Web Checkout Proxy
// GET /api/v2/payments/cashfree/checkout
// ─────────────────────────────────────────────────────────────────────────

/**
 * @desc    Serves a lightweight HTML page that loads Cashfree V3 SDK.
 *          Used by the mobile app's WebBrowser since Cashfree V3 has no direct URL.
 * @access  Public
 */
exports.renderMobileCheckout = (req, res) => {
  const { session_id, order_id, env, app_redirect } = req.query;

  if (!session_id) {
    return res.status(400).send('Missing session_id');
  }

  const mode = env === 'PRODUCTION' ? 'production' : 'sandbox';
  
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>Secure Payment Checkout</title>
      <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #f9fafb; margin: 0; }
        .spinner { border: 4px solid rgba(0,0,0,0.1); width: 36px; height: 36px; border-radius: 50%; border-left-color: #2196f3; animation: spin 1s linear infinite; margin-bottom: 16px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        h2 { color: #333; margin: 0; font-size: 1.2rem; }
        p { color: #666; margin-top: 8px; font-size: 0.9rem; text-align: center; padding: 0 20px; }
      </style>
    </head>
    <body>
      <div class="spinner"></div>
      <h2>Initializing Payment...</h2>
      <p>Redirecting you to Cashfree Secure Checkout. Please do not close this window.</p>
      
      <script>
        document.addEventListener('DOMContentLoaded', async () => {
          try {
            const cashfree = Cashfree({ mode: '${mode}' });
            
            // _self redirects the current tab to Cashfree's checkout.
            // When payment completes, Cashfree will redirect this tab to our return_url!
            const result = await cashfree.checkout({
              paymentSessionId: '${session_id}',
              redirectTarget: '_self'
            });
            
            // This code only runs if checkout fails to initialize or user dismisses an overlay
            if (result && result.error) {
              alert(result.error.message || 'Payment failed to load.');
              if ('${app_redirect}') {
                window.location.href = '${app_redirect}?order_id=${order_id}';
              }
            }
          } catch (err) {
            alert('Failed to initialize payment: ' + err.message);
          }
        });
      </script>
    </body>
    </html>
  `;
  res.send(html);
};
