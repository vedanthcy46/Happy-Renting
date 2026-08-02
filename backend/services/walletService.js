'use strict';

const mongoose = require('mongoose');
const OwnerWallet = require('../models/OwnerWallet');
const WalletTransaction = require('../models/WalletTransaction');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const PlatformSettings = require('../models/PlatformSettings');
const PaymentTransaction = require('../models/PaymentTransaction');
const SettlementAuditLog = require('../models/SettlementAuditLog');
const Notification = require('../models/Notification');
const emailService = require('./emailService');
const User = require('../models/User');
const logger = require('../config/logger');

/**
 * Helper to run work in a transaction if supported, or fall back to non-transactional
 * execution on standalone MongoDB local development.
 */
const withTransaction = async (workFn) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await workFn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    const isTransError =
      error.message.includes('replica set') ||
      error.message.includes('Transaction numbers') ||
      error.code === 20 ||
      error.codeName === 'IllegalOperation';
    if (isTransError) {
      logger.warn(
        '[WALLET] MongoDB transactions not supported by deployment. Falling back to non-transactional execution.'
      );
      session.endSession();
      return await workFn(null);
    }
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Get platform settings or create a default settings document if none exists.
 */
const getPlatformSettings = async (session = null) => {
  let settings = await PlatformSettings.findOne({}).session(session);
  if (!settings) {
    settings = await PlatformSettings.create(
      [
        {
          subscriptionEnabled: false,
          monthlySubscription: 299,
          commissionEnabled: false,
          commissionPercentage: 2,
          gatewayFeeDeductionEnabled: false
        }
      ],
      { session }
    );
    settings = settings[0];
  }
  return settings;
};

/**
 * Update platform settings document.
 */
const updatePlatformSettings = async (settingsData) => {
  return await withTransaction(async (session) => {
    let settings = await PlatformSettings.findOne({}).session(session);
    if (!settings) {
      settings = new PlatformSettings(settingsData);
    } else {
      Object.assign(settings, settingsData);
    }
    await settings.save({ session });
    return settings;
  });
};

/**
 * Helper to fetch or create an OwnerWallet document.
 */
const getOrCreateWallet = async (ownerId, session = null) => {
  let wallet = await OwnerWallet.findOne({ ownerId }).session(session);
  if (!wallet) {
    try {
      wallet = await OwnerWallet.create(
        [
          {
            ownerId,
            availableBalance: 0,
            pendingBalance: 0,
            totalReceived: 0,
            totalWithdrawn: 0,
            totalGatewayCharges: 0,
            totalSubscriptionFees: 0,
            status: 'active'
          }
        ],
        { session }
      );
      wallet = wallet[0];
    } catch (err) {
      // Handle race condition on duplicate key for ownerId
      if (err.code === 11000) {
        wallet = await OwnerWallet.findOne({ ownerId }).session(session);
      } else {
        throw err;
      }
    }
  }
  return wallet;
};

/**
 * Calculate Cashfree MDR fee and GST on fee.
 * MDR is 1.95%. GST is 18% of the MDR fee.
 */
const calculateGatewayFee = (grossAmount) => {
  const mdrFee = Math.round(grossAmount * 0.0195 * 100) / 100;
  const gstOnFee = Math.round(mdrFee * 0.18 * 100) / 100;
  const totalGatewayFee = Math.round((mdrFee + gstOnFee) * 100) / 100;
  const netSettlementAmount = Math.round((grossAmount - totalGatewayFee) * 100) / 100;
  return {
    grossAmount,
    mdrFee,
    gstOnFee,
    totalGatewayFee,
    netSettlementAmount
  };
};

/**
 * Credits the owner wallet when a Cashfree transaction is successfully processed.
 */
const creditWalletOnPayment = async (paymentTransactionId, session = null) => {
  const creditFn = async (txSession) => {
    // 1. Fetch transaction
    const payTx = await PaymentTransaction.findById(paymentTransactionId).session(txSession);
    if (!payTx) {
      throw new Error(`Payment transaction ${paymentTransactionId} not found`);
    }

    // Only process cashfree online gateway payments
    if (payTx.paymentGateway !== 'cashfree') {
      logger.info(`[WALLET] Skipped wallet credit for non-gateway transaction=${paymentTransactionId}`);
      return null;
    }

    // Check if wallet transaction already exists for this payment transaction to prevent duplicate credits
    const existingWalletTx = await WalletTransaction.findOne({
      paymentTransactionId: payTx._id
    }).session(txSession);

    if (existingWalletTx) {
      logger.info(`[WALLET] Transaction=${paymentTransactionId} already credited in wallet. Skipping.`);
      return existingWalletTx;
    }

    const grossAmount = payTx.amount;

    // 2. Fetch platform settings
    const settings = await getPlatformSettings(txSession);

    // 3. Calculate fees
    const feeInfo = calculateGatewayFee(grossAmount);

    let gatewayFeeDeducted = 0;
    if (settings.gatewayFeeDeductionEnabled) {
      gatewayFeeDeducted = feeInfo.totalGatewayFee;
    }

    let platformFeeDeducted = 0;
    if (settings.commissionEnabled) {
      platformFeeDeducted = Math.round(grossAmount * (settings.commissionPercentage / 100) * 100) / 100;
    }

    const netAmount = Math.round((grossAmount - gatewayFeeDeducted - platformFeeDeducted) * 100) / 100;

    // 4. Fetch/Create wallet
    const wallet = await getOrCreateWallet(payTx.ownerId, txSession);
    if (wallet.status !== 'active') {
      throw new Error(`Owner wallet is ${wallet.status}. Cannot credit funds.`);
    }

    const balanceBefore = wallet.availableBalance;
    const balanceAfter = Math.round((balanceBefore + netAmount) * 100) / 100;

    // Update wallet balances
    wallet.availableBalance = balanceAfter;
    wallet.totalReceived = Math.round((wallet.totalReceived + grossAmount) * 100) / 100;
    wallet.totalGatewayCharges = Math.round((wallet.totalGatewayCharges + feeInfo.totalGatewayFee) * 100) / 100;
    await wallet.save({ session: txSession });

    // Create wallet transaction ledger entry
    const remarks = `Rent payment credited. Gross: ₹${grossAmount}` +
      (gatewayFeeDeducted > 0 ? `, Gateway fee deducted: ₹${gatewayFeeDeducted}` : '') +
      (platformFeeDeducted > 0 ? `, Platform commission deducted: ₹${platformFeeDeducted}` : '');

    const walletTx = await WalletTransaction.create(
      [
        {
          ownerId: payTx.ownerId,
          tenantId: payTx.tenantId,
          rentRecordId: payTx.rentRecordId,
          paymentTransactionId: payTx._id,
          grossAmount,
          gatewayFee: feeInfo.totalGatewayFee,
          platformFee: platformFeeDeducted,
          netAmount,
          balanceBefore,
          balanceAfter,
          type: 'rent_received',
          remarks,
          createdBy: payTx.ownerId
        }
      ],
      { session: txSession }
    );

    logger.info(
      `[WALLET] Credited owner=${payTx.ownerId} with netAmount=₹${netAmount} (gross=₹${grossAmount}) for paymentTx=${payTx._id}`
    );
    return walletTx[0];
  };

  if (session) {
    return await creditFn(session);
  } else {
    return await withTransaction(creditFn);
  }
};

/**
 * Requests a withdrawal from available wallet balance.
 */
const requestWithdrawal = async (ownerId, amount, bankDetails, session = null) => {
  const withdrawFn = async (txSession) => {
    const withdrawAmount = Number(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      throw new Error('Withdrawal amount must be a positive number');
    }

    // 1. Fetch wallet
    const wallet = await getOrCreateWallet(ownerId, txSession);
    if (wallet.status !== 'active') {
      throw new Error(`Owner wallet is ${wallet.status}. Cannot request withdrawal.`);
    }

    if (wallet.availableBalance < withdrawAmount) {
      throw new Error(`Insufficient wallet balance. Available: ₹${wallet.availableBalance}, Requested: ₹${withdrawAmount}`);
    }

    const balanceBefore = wallet.availableBalance;
    const balanceAfter = Math.round((balanceBefore - withdrawAmount) * 100) / 100;

    // 2. Deduct available balance and add to pending balance
    wallet.availableBalance = balanceAfter;
    wallet.pendingBalance = Math.round((wallet.pendingBalance + withdrawAmount) * 100) / 100;
    await wallet.save({ session: txSession });

    // 3. Create WithdrawalRequest
    const request = await WithdrawalRequest.create(
      [
        {
          ownerId,
          amount: withdrawAmount,
          bankAccountNumber: bankDetails.bankAccountNumber,
          ifscCode: bankDetails.ifscCode,
          accountHolderName: bankDetails.accountHolderName,
          status: 'pending'
        }
      ],
      { session: txSession }
    );

    // 4. Create WalletTransaction ledger entry (status is pending)
    const walletTx = await WalletTransaction.create(
      [
        {
          ownerId,
          grossAmount: withdrawAmount,
          gatewayFee: 0,
          platformFee: 0,
          netAmount: -withdrawAmount,
          balanceBefore,
          balanceAfter,
          type: 'withdrawal',
          remarks: `Withdrawal request submitted for ₹${withdrawAmount}`,
          createdBy: ownerId
        }
      ],
      { session: txSession }
    );

    logger.info(
      `[WALLET] Withdrawal requested owner=${ownerId} amount=₹${withdrawAmount} requestId=${request[0]._id}`
    );
    return { request: request[0], walletTx: walletTx[0] };
  };

  if (session) {
    return await withdrawFn(session);
  } else {
    return await withTransaction(withdrawFn);
  }
};

/**
 * Process withdrawal request (approve, reject, or complete manual settlement).
 */
const processWithdrawal = async (requestId, action, details = {}, adminId, session = null) => {
  const processFn = async (txSession) => {
    const request = await WithdrawalRequest.findById(requestId).session(txSession);
    if (!request) {
      throw new Error(`Withdrawal request ${requestId} not found`);
    }

    if (action === 'approve') {
      if (request.status !== 'pending') {
        throw new Error(`Cannot approve request in ${request.status} status`);
      }
      request.status = 'approved';
      request.processedAt = new Date();
      request.processedBy = adminId;
      await request.save({ session: txSession });
      logger.info(`[WALLET] Withdrawal approved requestId=${requestId} by admin=${adminId}`);
      return request;
    }

    if (action === 'reject') {
      if (!['pending', 'approved', 'processing', 'qr_generated'].includes(request.status)) {
        throw new Error(`Cannot reject request in ${request.status} status`);
      }

      const oldStatus = request.status;
      const wallet = await getOrCreateWallet(request.ownerId, txSession);
      const balanceBefore = wallet.availableBalance;
      const balanceAfter = Math.round((balanceBefore + request.amount) * 100) / 100;

      // Restore wallet balances
      wallet.availableBalance = balanceAfter;
      wallet.pendingBalance = Math.max(0, Math.round((wallet.pendingBalance - request.amount) * 100) / 100);
      await wallet.save({ session: txSession });

      // Update request status
      request.status = 'rejected';
      request.rejectionReason = details.rejectionReason || 'Rejected by administrator';
      request.processedAt = new Date();
      request.processedBy = adminId;
      await request.save({ session: txSession });

      // Create ledger reversal transaction
      await WalletTransaction.create(
        [
          {
            ownerId: request.ownerId,
            withdrawalId: request._id,
            grossAmount: request.amount,
            gatewayFee: 0,
            platformFee: 0,
            netAmount: request.amount,
            balanceBefore,
            balanceAfter,
            type: 'reversal',
            remarks: `Withdrawal rejected: ${request.rejectionReason}`,
            createdBy: adminId
          }
        ],
        { session: txSession }
      );

      // Create Audit Log
      await SettlementAuditLog.create(
        [
          {
            withdrawalId: request._id,
            ownerId: request.ownerId,
            adminId,
            action: 'settlement_rejected',
            oldStatus,
            newStatus: 'rejected',
            ipAddress: details.ipAddress || null
          }
        ],
        { session: txSession }
      );

      // Create Notification
      await Notification.create(
        [
          {
            userId: request.ownerId,
            title: 'Withdrawal Request Rejected',
            message: `Your withdrawal request of ₹${request.amount} has been rejected. Reason: ${request.rejectionReason}`,
            type: 'alert'
          }
        ],
        { session: txSession }
      );

      logger.info(`[WALLET] Withdrawal rejected requestId=${requestId} by admin=${adminId}. Balance refunded.`);
      return request;
    }

    if (action === 'complete') {
      // Allow transition from approved, processing, qr_generated, or directly from pending for phase 1 manual settlement
      if (!['pending', 'approved', 'processing', 'qr_generated'].includes(request.status)) {
        throw new Error(`Cannot complete request in ${request.status} status`);
      }

      const utr = details.utrNumber ? details.utrNumber.trim() : '';
      if (!utr || utr.length < 10 || utr.length > 30) {
        throw new Error('UTR number must be between 10 and 30 characters');
      }

      const method = details.settlementMethod || 'upi_qr';
      if (!['upi_qr', 'upi_manual', 'bank_transfer', 'cash'].includes(method)) {
        throw new Error(`Invalid settlement method: ${method}`);
      }

      const wallet = await getOrCreateWallet(request.ownerId, txSession);

      // Deduct from pending balance, add to totalWithdrawn
      wallet.pendingBalance = Math.max(0, Math.round((wallet.pendingBalance - request.amount) * 100) / 100);
      wallet.totalWithdrawn = Math.round((wallet.totalWithdrawn + request.amount) * 100) / 100;
      wallet.lastSettlementDate = new Date();
      await wallet.save({ session: txSession });

      const oldStatus = request.status;

      // Update request details
      request.status = 'completed';
      request.processedAt = new Date();
      request.processedBy = adminId;
      request.utrNumber = utr;
      request.settlementMethod = method;
      request.paidAt = new Date();
      request.paidBy = adminId;
      request.remarks = details.remarks || 'Settled manually by admin';
      request.settlementDetails = {
        transferType: method === 'upi_qr' || method === 'upi_manual' ? 'upi' : 'bank_transfer',
        referenceNumber: utr,
        note: details.remarks || 'Settled manually by admin'
      };
      await request.save({ session: txSession });

      // Create ledger settlement transaction (marks the completion of withdrawal)
      await WalletTransaction.create(
        [
          {
            ownerId: request.ownerId,
            withdrawalId: request._id,
            grossAmount: request.amount,
            gatewayFee: 0,
            platformFee: 0,
            netAmount: -request.amount,
            balanceBefore: wallet.availableBalance, // Available balance was already adjusted during withdrawal request
            balanceAfter: wallet.availableBalance,
            type: 'settlement',
            remarks: `Manual settlement completed via ${method.toUpperCase()}. Ref: ${utr}`,
            createdBy: adminId
          }
        ],
        { session: txSession }
      );

      // Create Audit Log
      await SettlementAuditLog.create(
        [
          {
            withdrawalId: request._id,
            ownerId: request.ownerId,
            adminId,
            action: 'settlement_completed',
            oldStatus,
            newStatus: 'completed',
            ipAddress: details.ipAddress || null
          }
        ],
        { session: txSession }
      );

      // Create Notification
      await Notification.create(
        [
          {
            userId: request.ownerId,
            title: 'Withdrawal Request Settled',
            message: `Your withdrawal request of ₹${request.amount} has been completed. UTR: ${utr}`,
            type: 'billing'
          }
        ],
        { session: txSession }
      );

      // Send Email
      const owner = await User.findById(request.ownerId).session(txSession);
      if (owner) {
        await emailService.sendWithdrawalSettledEmail(owner, request.amount, utr, new Date());
      }

      logger.info(`[WALLET] Withdrawal completed/settled requestId=${requestId} by admin=${adminId}`);
      return request;
    }

    throw new Error(`Invalid withdrawal process action: ${action}`);
  };

  if (session) {
    return await processFn(session);
  } else {
    return await withTransaction(processFn);
  }
};

/**
 * Rebuild owner wallet completely from the WalletTransaction ledger log.
 * Provides self-healing in case of corruption.
 */
const rebuildOwnerWallet = async (ownerId, session = null) => {
  const rebuildFn = async (txSession) => {
    const txs = await WalletTransaction.find({ ownerId }).sort({ createdAt: 1 }).session(txSession);

    let availableBalance = 0;
    let pendingBalance = 0;
    let totalReceived = 0;
    let totalWithdrawn = 0;
    let totalGatewayCharges = 0;
    let totalSubscriptionFees = 0;

    for (const tx of txs) {
      // Fix/Recalculate balanceBefore on the transaction to keep history consistent
      tx.balanceBefore = availableBalance;

      if (tx.type === 'rent_received') {
        availableBalance = Math.round((availableBalance + tx.netAmount) * 100) / 100;
        totalReceived = Math.round((totalReceived + tx.grossAmount) * 100) / 100;
        totalGatewayCharges = Math.round((totalGatewayCharges + tx.gatewayFee) * 100) / 100;
      } else if (tx.type === 'withdrawal') {
        availableBalance = Math.round((availableBalance - tx.grossAmount) * 100) / 100;
        pendingBalance = Math.round((pendingBalance + tx.grossAmount) * 100) / 100;
      } else if (tx.type === 'settlement') {
        pendingBalance = Math.max(0, Math.round((pendingBalance - tx.grossAmount) * 100) / 100);
        totalWithdrawn = Math.round((totalWithdrawn + tx.grossAmount) * 100) / 100;
      } else if (tx.type === 'reversal') {
        if (tx.remarks && tx.remarks.includes('Withdrawal rejected')) {
          availableBalance = Math.round((availableBalance + tx.grossAmount) * 100) / 100;
          pendingBalance = Math.max(0, Math.round((pendingBalance - tx.grossAmount) * 100) / 100);
        } else {
          // Rent payment reversal
          availableBalance = Math.round((availableBalance - tx.netAmount) * 100) / 100;
        }
      } else if (tx.type === 'subscription_fee') {
        availableBalance = Math.round((availableBalance - tx.netAmount) * 100) / 100;
        totalSubscriptionFees = Math.round((totalSubscriptionFees + tx.netAmount) * 100) / 100;
      } else if (tx.type === 'adjustment') {
        availableBalance = Math.round((availableBalance + tx.netAmount) * 100) / 100;
      }

      tx.balanceAfter = availableBalance;
      await tx.save({ session: txSession });
    }

    // Force balances to not be negative
    availableBalance = Math.max(0, availableBalance);
    pendingBalance = Math.max(0, pendingBalance);

    // Save final rebuilt wallet state
    const wallet = await OwnerWallet.findOneAndUpdate(
      { ownerId },
      {
        $set: {
          availableBalance,
          pendingBalance,
          totalReceived,
          totalWithdrawn,
          totalGatewayCharges,
          totalSubscriptionFees
        }
      },
      { session: txSession, returnDocument: 'after', upsert: true }
    );

    logger.info(`[WALLET] Rebuilt owner wallet for ownerId=${ownerId} successfully.`);
    return wallet;
  };

  if (session) {
    return await rebuildFn(session);
  } else {
    return await withTransaction(rebuildFn);
  }
};

/**
 * Charges active owners their monthly subscription fee if enabled.
 * Designed to be triggered by a daily cron job.
 */
const chargeMonthlySubscriptions = async () => {
  return await withTransaction(async (session) => {
    const settings = await getPlatformSettings(session);
    if (!settings.subscriptionEnabled) {
      logger.info('[WALLET] Subscription billing disabled. Skipping monthly charging.');
      return;
    }

    const subscriptionFee = settings.monthlySubscription;
    if (subscriptionFee <= 0) return;

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    // Find all active wallets
    const wallets = await OwnerWallet.find({ status: 'active' }).populate('ownerId').session(session);
    const systemId = new mongoose.Types.ObjectId(); // Mock system user ID

    let chargeCount = 0;
    for (const wallet of wallets) {
      // Only charge if owner is active
      if (wallet.ownerId && wallet.ownerId.isActive === false) continue;
      
      const actualOwnerId = wallet.ownerId._id || wallet.ownerId;

      // Check if already charged for current calendar month
      const alreadyCharged = await WalletTransaction.findOne({
        ownerId: actualOwnerId,
        type: 'subscription_fee',
        createdAt: { $gte: currentMonthStart }
      }).session(session);

      if (alreadyCharged) continue;

      // Charge only if owner has sufficient balance to prevent negative balances (as per spec)
      if (wallet.availableBalance >= subscriptionFee) {
        const balanceBefore = wallet.availableBalance;
        const balanceAfter = Math.round((balanceBefore - subscriptionFee) * 100) / 100;

        wallet.availableBalance = balanceAfter;
        wallet.totalSubscriptionFees = Math.round((wallet.totalSubscriptionFees + subscriptionFee) * 100) / 100;
        await wallet.save({ session });

        await WalletTransaction.create(
          [
            {
              ownerId: actualOwnerId,
              grossAmount: subscriptionFee,
              gatewayFee: 0,
              platformFee: 0,
              netAmount: subscriptionFee, // records absolute subscription amount deducted
              balanceBefore,
              balanceAfter,
              type: 'subscription_fee',
              remarks: `Monthly platform subscription charged`,
              createdBy: systemId
            }
          ],
          { session }
        );
        chargeCount++;
      } else {
        logger.warn(
          `[WALLET] Skipped subscription charge for owner=${actualOwnerId} due to insufficient balance (₹${wallet.availableBalance})`
        );
      }
    }

    logger.info(`[WALLET] Subscription charging complete. Processed ${chargeCount} wallets.`);
  });
};


/**
 * Generate UPI QR code for a withdrawal request and transition status.
 */
const generateWithdrawalQr = async (requestId, adminId, ipAddress, session = null) => {
  const qrFn = async (txSession) => {
    const request = await WithdrawalRequest.findById(requestId).session(txSession);
    if (!request) {
      throw new Error(`Withdrawal request ${requestId} not found`);
    }

    if (!['pending', 'approved', 'processing', 'qr_generated'].includes(request.status)) {
      throw new Error(`Cannot generate QR code for request in ${request.status} status`);
    }

    const owner = await User.findById(request.ownerId).session(txSession);
    if (!owner) {
      throw new Error(`Owner/Landlord not found for withdrawal request`);
    }

    const upiId = (owner.upiDetails && owner.upiDetails.upiId) || owner.upiId;
    if (!upiId) {
      throw new Error('Landlord does not have a registered UPI ID for settlement');
    }

    const ownerName = (owner.upiDetails && owner.upiDetails.upiName) || owner.name || 'Owner';
    const amount = request.amount;
    const withdrawalIdStr = request._id.toString();

    // Construct UPI URI
    const encodedName = encodeURIComponent(ownerName);
    const encodedNote = encodeURIComponent(`Happy Renting Settlement ${withdrawalIdStr}`);
    const upiUri = `upi://pay?pa=${upiId}&pn=${encodedName}&am=${amount}&cu=INR&tn=${encodedNote}`;

    const QRCode = require('qrcode');
    const qrCodeDataUrl = await QRCode.toDataURL(upiUri);

    const oldStatus = request.status;

    // Update request status
    request.status = 'qr_generated';
    request.qrGeneratedAt = new Date();
    request.qrGeneratedBy = adminId;
    await request.save({ session: txSession });

    // Create Audit Log
    await SettlementAuditLog.create(
      [
        {
          withdrawalId: request._id,
          ownerId: request.ownerId,
          adminId,
          action: 'qr_generated',
          oldStatus,
          newStatus: 'qr_generated',
          ipAddress
        }
      ],
      { session: txSession }
    );

    logger.info(`[WALLET] UPI QR generated for withdrawal requestId=${requestId} by admin=${adminId}`);

    return {
      request,
      qrCodeDataUrl,
      upiUri,
      upiId,
      ownerName
    };
  };

  if (session) {
    return await qrFn(session);
  } else {
    return await withTransaction(qrFn);
  }
};

module.exports = {
  getPlatformSettings,
  updatePlatformSettings,
  getOrCreateWallet,
  creditWalletOnPayment,
  requestWithdrawal,
  processWithdrawal,
  generateWithdrawalQr,
  rebuildOwnerWallet,
  chargeMonthlySubscriptions,
  calculateGatewayFee
};
