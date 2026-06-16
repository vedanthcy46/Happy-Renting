'use strict';

const walletService = require('../services/walletService');
const OwnerWallet = require('../models/OwnerWallet');
const WalletTransaction = require('../models/WalletTransaction');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const PlatformSettings = require('../models/PlatformSettings');
const User = require('../models/User');
const logger = require('../config/logger');

// ─────────────────────────────────────────────────────────────────────────
// OWNER ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v2/wallet
 * Returns current owner's wallet details.
 */
exports.getOwnerWallet = async (req, res, next) => {
  try {
    const ownerId = req.user._id;
    const wallet = await walletService.getOrCreateWallet(ownerId);
    return res.status(200).json({ success: true, wallet });
  } catch (err) {
    logger.error(`[WALLET CONTROLLER] getOwnerWallet error: ${err.message}`);
    next(err);
  }
};

/**
 * GET /api/v2/wallet/transactions
 * Returns current owner's wallet transactions (paginated).
 */
exports.getOwnerTransactions = async (req, res, next) => {
  try {
    const ownerId = req.user._id;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '10', 10);
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      WalletTransaction.find({ ownerId })
        .populate('tenantId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WalletTransaction.countDocuments({ ownerId })
    ]);

    return res.status(200).json({
      success: true,
      transactions,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    logger.error(`[WALLET CONTROLLER] getOwnerTransactions error: ${err.message}`);
    next(err);
  }
};

/**
 * POST /api/v2/wallet/withdraw
 * Request withdrawal of funds to bank account.
 */
exports.withdrawOwnerFunds = async (req, res, next) => {
  try {
    const ownerId = req.user._id;
    const { amount, bankAccountNumber, ifscCode, accountHolderName } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      const err = new Error('Invalid withdrawal amount');
      err.statusCode = 400;
      return next(err);
    }

    if (!bankAccountNumber || !ifscCode || !accountHolderName) {
      const err = new Error('Missing bank transfer details');
      err.statusCode = 400;
      return next(err);
    }

    const { request } = await walletService.requestWithdrawal(ownerId, amount, {
      bankAccountNumber,
      ifscCode,
      accountHolderName
    });

    return res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      withdrawalRequest: request
    });
  } catch (err) {
    logger.error(`[WALLET CONTROLLER] withdrawOwnerFunds error: ${err.message}`);
    next(err);
  }
};

/**
 * GET /api/v2/wallet/withdrawals
 * Returns current owner's withdrawal requests history.
 */
exports.getOwnerWithdrawals = async (req, res, next) => {
  try {
    const ownerId = req.user._id;
    const withdrawals = await WithdrawalRequest.find({ ownerId })
      .sort({ requestedAt: -1 })
      .lean();

    return res.status(200).json({ success: true, withdrawals });
  } catch (err) {
    logger.error(`[WALLET CONTROLLER] getOwnerWithdrawals error: ${err.message}`);
    next(err);
  }
};

/**
 * GET /api/v2/wallet/summary
 * Returns dashboard metrics/KPIs for owner's wallet.
 */
exports.getOwnerWalletSummary = async (req, res, next) => {
  try {
    const ownerId = req.user._id;
    const wallet = await walletService.getOrCreateWallet(ownerId);

    // Sum pending withdrawals (status: pending, approved, processing)
    const pendingRequests = await WithdrawalRequest.find({
      ownerId,
      status: { $in: ['pending', 'approved', 'processing'] }
    }).lean();
    const pendingWithdrawalsAmount = pendingRequests.reduce((sum, r) => sum + r.amount, 0);

    // Net earnings = Available Balance + Pending Withdrawals + Total Withdrawn
    const netEarnings = Math.round((wallet.availableBalance + pendingWithdrawalsAmount + wallet.totalWithdrawn) * 100) / 100;

    return res.status(200).json({
      success: true,
      summary: {
        availableBalance: wallet.availableBalance,
        pendingWithdrawals: pendingWithdrawalsAmount,
        totalRentCollected: wallet.totalReceived,
        totalGatewayCharges: wallet.totalGatewayCharges,
        totalWithdrawn: wallet.totalWithdrawn,
        totalSubscriptionFees: wallet.totalSubscriptionFees,
        netEarnings,
        status: wallet.status,
        lastSettlementDate: wallet.lastSettlementDate
      }
    });
  } catch (err) {
    logger.error(`[WALLET CONTROLLER] getOwnerWalletSummary error: ${err.message}`);
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// SUPERADMIN ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v2/admin/wallets
 * Returns list of all owner wallets.
 */
exports.adminGetWallets = async (req, res, next) => {
  try {
    const wallets = await OwnerWallet.find({})
      .populate('ownerId', 'name email')
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({ success: true, wallets });
  } catch (err) {
    logger.error(`[WALLET CONTROLLER] adminGetWallets error: ${err.message}`);
    next(err);
  }
};

/**
 * GET /api/v2/admin/wallets/:ownerId
 * Returns specific owner's wallet and transaction list.
 */
exports.adminGetWalletDetail = async (req, res, next) => {
  try {
    const { ownerId } = req.params;
    const wallet = await walletService.getOrCreateWallet(ownerId);
    const ownerUser = await User.findById(ownerId).select('name email').lean();

    const transactions = await WalletTransaction.find({ ownerId })
      .populate('tenantId', 'name')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const withdrawals = await WithdrawalRequest.find({ ownerId })
      .sort({ requestedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      owner: ownerUser,
      wallet,
      transactions,
      withdrawals
    });
  } catch (err) {
    logger.error(`[WALLET CONTROLLER] adminGetWalletDetail error: ${err.message}`);
    next(err);
  }
};

/**
 * POST /api/v2/admin/wallets/:ownerId/rebuild
 * Rebuilds owner's wallet from transaction ledger history.
 */
exports.adminRebuildWallet = async (req, res, next) => {
  try {
    const { ownerId } = req.params;
    const wallet = await walletService.rebuildOwnerWallet(ownerId);
    return res.status(200).json({
      success: true,
      message: 'Wallet balance rebuilt successfully from ledger history',
      wallet
    });
  } catch (err) {
    logger.error(`[WALLET CONTROLLER] adminRebuildWallet error: ${err.message}`);
    next(err);
  }
};

/**
 * GET /api/v2/admin/withdrawals
 * Returns all withdrawal requests.
 */
exports.adminGetWithdrawals = async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) {
      query.status = status;
    }

    const withdrawals = await WithdrawalRequest.find(query)
      .populate('ownerId', 'name email')
      .sort({ requestedAt: -1 })
      .lean();

    return res.status(200).json({ success: true, withdrawals });
  } catch (err) {
    logger.error(`[WALLET CONTROLLER] adminGetWithdrawals error: ${err.message}`);
    next(err);
  }
};

/**
 * PATCH /api/v2/admin/withdrawals/:id/approve
 * Approves a withdrawal request.
 */
exports.adminApproveWithdrawal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await walletService.processWithdrawal(id, 'approve', {}, req.user._id);
    return res.status(200).json({
      success: true,
      message: 'Withdrawal request approved',
      withdrawalRequest: request
    });
  } catch (err) {
    logger.error(`[WALLET CONTROLLER] adminApproveWithdrawal error: ${err.message}`);
    next(err);
  }
};

/**
 * PATCH /api/v2/admin/withdrawals/:id/reject
 * Rejects a withdrawal request and restores owner's available balance.
 */
exports.adminRejectWithdrawal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      const err = new Error('Rejection reason is required');
      err.statusCode = 400;
      return next(err);
    }

    const request = await walletService.processWithdrawal(
      id,
      'reject',
      { rejectionReason },
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Withdrawal request rejected. Funds returned to owner balance.',
      withdrawalRequest: request
    });
  } catch (err) {
    logger.error(`[WALLET CONTROLLER] adminRejectWithdrawal error: ${err.message}`);
    next(err);
  }
};

/**
 * PATCH /api/v2/admin/withdrawals/:id/complete
 * Marks a withdrawal request as completed (records manual settlement details).
 */
exports.adminCompleteWithdrawal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { transferType, referenceNumber, note } = req.body;

    if (!transferType || !referenceNumber) {
      const err = new Error('Transfer type and reference number are required for manual settlement completion');
      err.statusCode = 400;
      return next(err);
    }

    const request = await walletService.processWithdrawal(
      id,
      'complete',
      { transferType, referenceNumber, note },
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Withdrawal manual settlement completed successfully',
      withdrawalRequest: request
    });
  } catch (err) {
    logger.error(`[WALLET CONTROLLER] adminCompleteWithdrawal error: ${err.message}`);
    next(err);
  }
};

/**
 * GET /api/v2/admin/platform-revenue
 * Calculates platform revenue statistics (gateway charges, commissions, subscriptions).
 */
exports.adminGetPlatformRevenue = async (req, res, next) => {
  try {
    // 1. Total Gateway Charges (MDR + GST absorbed/deducted)
    const walletAgg = await OwnerWallet.aggregate([
      {
        $group: {
          _id: null,
          totalGatewayCharges: { $sum: '$totalGatewayCharges' },
          totalSubscriptionFees: { $sum: '$totalSubscriptionFees' }
        }
      }
    ]);

    const totalGatewayCharges = walletAgg[0]?.totalGatewayCharges || 0;
    const totalSubscriptionFees = walletAgg[0]?.totalSubscriptionFees || 0;

    // 2. Platform Commissions
    const txAgg = await WalletTransaction.aggregate([
      {
        $group: {
          _id: null,
          totalCommissions: { $sum: '$platformFee' }
        }
      }
    ]);

    const totalCommissions = txAgg[0]?.totalCommissions || 0;

    // 3. Platform configuration settings
    const settings = await walletService.getPlatformSettings();

    return res.status(200).json({
      success: true,
      revenue: {
        totalGatewayCharges,
        totalCommissions,
        totalSubscriptionFees,
        netRevenue: Math.round((totalCommissions + totalSubscriptionFees - totalGatewayCharges) * 100) / 100
      },
      settings
    });
  } catch (err) {
    logger.error(`[WALLET CONTROLLER] adminGetPlatformRevenue error: ${err.message}`);
    next(err);
  }
};

/**
 * GET /api/v2/admin/settings
 * Get platform settings.
 */
exports.adminGetSettings = async (req, res, next) => {
  try {
    const settings = await walletService.getPlatformSettings();
    return res.status(200).json({ success: true, settings });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v2/admin/settings
 * Update platform settings.
 */
exports.adminUpdateSettings = async (req, res, next) => {
  try {
    const settings = await walletService.updatePlatformSettings(req.body);
    return res.status(200).json({
      success: true,
      message: 'Platform settings updated successfully',
      settings
    });
  } catch (err) {
    next(err);
  }
};
