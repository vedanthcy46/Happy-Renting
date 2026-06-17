'use strict';

/**
 * verify_upi_settlement.js
 * Comprehensive validation script for the Owner UPI Settlement QR System.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const OwnerWallet = require('../models/OwnerWallet');
const WalletTransaction = require('../models/WalletTransaction');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const SettlementAuditLog = require('../models/SettlementAuditLog');
const walletService = require('../services/walletService');
const logger = require('../config/logger');

const run = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/rental';
  logger.info(`Connecting to database: ${uri}`);
  await mongoose.connect(uri);

  try {
    logger.info('--- Cleaning existing wallet & settlement data ---');
    await OwnerWallet.deleteMany({});
    await WalletTransaction.deleteMany({});
    await WithdrawalRequest.deleteMany({});
    await SettlementAuditLog.deleteMany({});

    // Create / fetch mock users
    let owner = await User.findOne({ role: 'owner' });
    if (!owner) {
      owner = await User.create({
        name: 'UPI Landlord',
        email: 'upi_landlord@rent.com',
        password: 'Password123!',
        role: 'owner',
        isEmailVerified: true
      });
    }

    // Initialize mock owner's wallet with balance
    await OwnerWallet.create({
      ownerId: owner._id,
      availableBalance: 15000,
      pendingBalance: 0,
      status: 'active'
    });

    const adminId = new mongoose.Types.ObjectId();

    logger.info('--- 1. Testing QR Generation Failure for Owner without UPI ID ---');
    // Ensure UPI ID is cleared
    owner.upiId = undefined;
    owner.upiDetails = undefined;
    await owner.save();

    const { request: withdrawReq1 } = await walletService.requestWithdrawal(
      owner._id,
      5000,
      { bankAccountNumber: null, ifscCode: null, accountHolderName: null }
    );

    try {
      await walletService.generateWithdrawalQr(withdrawReq1._id, adminId, '127.0.0.1');
      throw new Error('QR generation succeeded for owner without UPI ID, but should have failed!');
    } catch (err) {
      logger.info(`Expected failure caught: ${err.message}`);
      if (!err.message.includes('UPI ID')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }

    logger.info('--- 2. Testing QR Generation Success for Owner with UPI ID ---');
    // Set UPI ID
    owner.upiId = 'owner@okaxis';
    owner.upiDetails = {
      upiId: 'owner@okaxis',
      upiName: 'UPI Landlord name',
      verified: true,
      verifiedAt: new Date()
    };
    await owner.save();

    const qrResult = await walletService.generateWithdrawalQr(withdrawReq1._id, adminId, '127.0.0.1');
    console.log('Generated QR URI:', qrResult.upiUri);
    console.log('Generated QR DataURL length:', qrResult.qrCodeDataUrl.length);

    if (!qrResult.upiUri.includes('pa=owner@okaxis')) {
      throw new Error('UPI URI is missing owner UPI ID');
    }
    if (!qrResult.upiUri.includes('am=5000')) {
      throw new Error('UPI URI is missing or has incorrect amount');
    }
    if (!qrResult.qrCodeDataUrl.startsWith('data:image/png;base64,')) {
      throw new Error('QR code data URL is not a valid base64 PNG data URL');
    }

    // Verify request status transition to qr_generated
    const requestAfterQr = await WithdrawalRequest.findById(withdrawReq1._id);
    console.log('Status after QR generation:', requestAfterQr.status);
    if (requestAfterQr.status !== 'qr_generated') {
      throw new Error(`Expected status qr_generated, but got ${requestAfterQr.status}`);
    }

    // Verify Audit Log entry for QR generation
    const qrAudit = await SettlementAuditLog.findOne({ withdrawalId: withdrawReq1._id, action: 'qr_generated' });
    console.log('Audit log for QR generation:', JSON.stringify(qrAudit, null, 2));
    if (!qrAudit || qrAudit.ipAddress !== '127.0.0.1') {
      throw new Error('QR generation audit log entry invalid or missing');
    }

    logger.info('--- 3. Testing Complete Settlement with Invalid UTR length ---');
    try {
      await walletService.processWithdrawal(
        withdrawReq1._id,
        'complete',
        { settlementMethod: 'upi_qr', utrNumber: '12345', remarks: 'Too short UTR' },
        adminId
      );
      throw new Error('Completion succeeded with short UTR, but should have failed!');
    } catch (err) {
      logger.info(`Expected failure caught for short UTR: ${err.message}`);
    }

    try {
      await walletService.processWithdrawal(
        withdrawReq1._id,
        'complete',
        { settlementMethod: 'upi_qr', utrNumber: 'a'.repeat(31), remarks: 'Too long UTR' },
        adminId
      );
      throw new Error('Completion succeeded with long UTR, but should have failed!');
    } catch (err) {
      logger.info(`Expected failure caught for long UTR: ${err.message}`);
    }

    logger.info('--- 4. Testing Complete Settlement with Valid UTR (Success) ---');
    const validUtr = 'UTR1234567890';
    const completedReq = await walletService.processWithdrawal(
      withdrawReq1._id,
      'complete',
      { settlementMethod: 'upi_qr', utrNumber: validUtr, remarks: 'QR paid via scanned UPI', ipAddress: '192.168.1.1' },
      adminId
    );

    console.log('Completed request:', JSON.stringify(completedReq, null, 2));
    if (completedReq.status !== 'completed' || completedReq.utrNumber !== validUtr || completedReq.settlementMethod !== 'upi_qr') {
      throw new Error('Settlement completion values mismatch');
    }

    // Verify wallet balance after completion
    const wallet = await OwnerWallet.findOne({ ownerId: owner._id });
    console.log('Wallet state after settlement:', JSON.stringify(wallet, null, 2));
    if (wallet.availableBalance !== 10000 || wallet.pendingBalance !== 0 || wallet.totalWithdrawn !== 5000) {
      throw new Error('Wallet balances mismatch after completion');
    }

    // Verify audit log for completion
    const completeAudit = await SettlementAuditLog.findOne({ withdrawalId: withdrawReq1._id, action: 'settlement_completed' });
    console.log('Audit log for settlement completion:', JSON.stringify(completeAudit, null, 2));
    if (!completeAudit || completeAudit.ipAddress !== '192.168.1.1' || completeAudit.oldStatus !== 'qr_generated' || completeAudit.newStatus !== 'completed') {
      throw new Error('Settlement completion audit log entry invalid or missing');
    }

    logger.info('--- 5. Testing Settlement Rejection ---');
    // Submit a new withdrawal
    const { request: withdrawReq2 } = await walletService.requestWithdrawal(
      owner._id,
      3000,
      { bankAccountNumber: null, ifscCode: null, accountHolderName: null }
    );

    // Generate QR
    await walletService.generateWithdrawalQr(withdrawReq2._id, adminId, '127.0.0.1');

    // Reject it
    const rejectedReq = await walletService.processWithdrawal(
      withdrawReq2._id,
      'reject',
      { rejectionReason: 'Scanned UPI failed, details bad', ipAddress: '192.168.1.2' },
      adminId
    );
    console.log('Rejected request:', JSON.stringify(rejectedReq, null, 2));
    if (rejectedReq.status !== 'rejected') {
      throw new Error('Rejection failed to update status to rejected');
    }

    // Verify wallet balance restored
    const walletRestored = await OwnerWallet.findOne({ ownerId: owner._id });
    console.log('Wallet state after rejection:', JSON.stringify(walletRestored, null, 2));
    if (walletRestored.availableBalance !== 10000 || walletRestored.pendingBalance !== 0) {
      throw new Error('Wallet balance not restored properly on rejection');
    }

    // Verify rejection audit log
    const rejectAudit = await SettlementAuditLog.findOne({ withdrawalId: withdrawReq2._id, action: 'settlement_rejected' });
    console.log('Audit log for rejection:', JSON.stringify(rejectAudit, null, 2));
    if (!rejectAudit || rejectAudit.ipAddress !== '192.168.1.2') {
      throw new Error('Rejection audit log entry invalid or missing');
    }

    logger.info('--------------------------------------------------');
    logger.info('ALL UPI QR SETTLEMENT ARCHITECTURE TESTS PASSED!');
    logger.info('--------------------------------------------------');

  } catch (err) {
    logger.error(`UPI QR settlement verification failed: ${err.message}`, err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

run();
