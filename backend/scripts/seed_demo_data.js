'use strict';

/**
 * seed_demo_data.js
 * Wipes existing test data and seeds a complete set of landlords, properties,
 * tenants, rent records, wallets, ledger transactions, and withdrawal requests.
 *
 * Run: node scripts/seed_demo_data.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Property = require('../models/Property');
const Room = require('../models/Room');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const PaymentTransaction = require('../models/PaymentTransaction');
const OwnerWallet = require('../models/OwnerWallet');
const WalletTransaction = require('../models/WalletTransaction');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const PlatformSettings = require('../models/PlatformSettings');
const walletService = require('../services/walletService');
const logger = require('../config/logger');

const seedDemoData = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/rental';
    logger.info(`Connecting to MongoDB at: ${uri}`);
    await mongoose.connect(uri);

    logger.info('--- WIPING DATA (Except Superadmins) ---');
    await User.deleteMany({ role: { $ne: 'superadmin' } });
    await Tenant.deleteMany({});
    await Property.deleteMany({});
    await Room.deleteMany({});
    await MonthlyRentRecord.deleteMany({});
    await PaymentTransaction.deleteMany({});
    await OwnerWallet.deleteMany({});
    await WalletTransaction.deleteMany({});
    await WithdrawalRequest.deleteMany({});
    await PlatformSettings.deleteMany({});

    logger.info('--- SEEDING SYSTEM CONFIG (PlatformSettings) ---');
    // Enable Monetization & Commissions by default for rich testing data
    const settings = await PlatformSettings.create({
      subscriptionEnabled: true,
      monthlySubscription: 299,
      annualSubscription: 2990,
      lifetimeSubscription: 4999,
      commissionEnabled: true,
      commissionPercentage: 2,
      gatewayFeeDeductionEnabled: true
    });
    logger.info(`Seeded settings: ${JSON.stringify(settings)}`);

    logger.info('--- SEEDING LANDLORDS (Owners) ---');
    // Landlord 1: Vedanth Owner
    const landlordA = await User.create({
      name: 'Vedanth Landlord',
      email: 'vedanth_owner@rent.com',
      password: 'Password123!',
      role: 'owner',
      isEmailVerified: true,
      upiId: 'vedanth@ybl',
      bankDetails: {
        accountNumber: '918273645012',
        ifscCode: 'HDFC0000101',
        bankName: 'HDFC Bank'
      }
    });

    // Landlord 2: Rajesh Owner
    const landlordB = await User.create({
      name: 'Rajesh Properties',
      email: 'rajesh_owner@rent.com',
      password: 'Password123!',
      role: 'owner',
      isEmailVerified: true,
      upiId: 'rajesh@okaxis',
      bankDetails: {
        accountNumber: '887766554433',
        ifscCode: 'UTIB0000202',
        bankName: 'Axis Bank'
      }
    });

    logger.info('--- SEEDING PROPERTIES ---');
    const propertyA = await Property.create({
      name: 'Sunrise Residency',
      address: 'Plot 45, Sector 12, HSR Layout, Bangalore',
      ownerId: landlordA._id
    });

    const propertyB = await Property.create({
      name: 'Greenwood Apartments',
      address: 'Avenue 5, Whitefield, Bangalore',
      ownerId: landlordB._id
    });

    logger.info('--- SEEDING ROOMS ---');
    const roomA1 = await Room.create({
      roomNumber: 'A-101',
      floor: 1,
      capacity: 1,
      monthlyRent: 8000,
      propertyId: propertyA._id,
      ownerId: landlordA._id,
      isFull: true,
      currentOccupancy: 1
    });

    const roomA2 = await Room.create({
      roomNumber: 'A-102',
      floor: 1,
      capacity: 2,
      monthlyRent: 6000,
      propertyId: propertyA._id,
      ownerId: landlordA._id,
      isFull: false,
      currentOccupancy: 1
    });

    const roomB1 = await Room.create({
      roomNumber: 'B-201',
      floor: 2,
      capacity: 1,
      monthlyRent: 12000,
      propertyId: propertyB._id,
      ownerId: landlordB._id,
      isFull: true,
      currentOccupancy: 1
    });

    logger.info('--- SEEDING TENANTS ---');
    // Tenant 1 User
    const tenantUserA1 = await User.create({
      name: 'Amit Kumar',
      email: 'amit@tenant.com',
      password: 'Password123!',
      role: 'tenant',
      isEmailVerified: true
    });
    const tenantA1 = await Tenant.create({
      userId: tenantUserA1._id,
      roomId: roomA1._id,
      propertyId: propertyA._id,
      ownerId: landlordA._id,
      name: 'Amit Kumar',
      phone: '9876543210',
      moveInDate: new Date('2026-04-10'),
      status: 'active'
    });

    // Tenant 2 User
    const tenantUserA2 = await User.create({
      name: 'Suresh Raina',
      email: 'suresh@tenant.com',
      password: 'Password123!',
      role: 'tenant',
      isEmailVerified: true
    });
    const tenantA2 = await Tenant.create({
      userId: tenantUserA2._id,
      roomId: roomA2._id,
      propertyId: propertyA._id,
      ownerId: landlordA._id,
      name: 'Suresh Raina',
      phone: '8765432109',
      moveInDate: new Date('2026-05-01'),
      status: 'active'
    });

    // Tenant 3 User
    const tenantUserB1 = await User.create({
      name: 'Vikram Singh',
      email: 'vikram@tenant.com',
      password: 'Password123!',
      role: 'tenant',
      isEmailVerified: true
    });
    const tenantB1 = await Tenant.create({
      userId: tenantUserB1._id,
      roomId: roomB1._id,
      propertyId: propertyB._id,
      ownerId: landlordB._id,
      name: 'Vikram Singh',
      phone: '7654321098',
      moveInDate: new Date('2026-05-15'),
      status: 'active'
    });

    logger.info('--- SEEDING RENT RECORDS & PAYMENTS ---');

    // --- LANDLORD A (Sunrise Residency) DATA ---
    const walletA = await walletService.getOrCreateWallet(landlordA._id);

    // June Bill - Amit Kumar (Paid)
    const rentA1_June = await MonthlyRentRecord.create({
      tenantId: tenantA1._id,
      userId: tenantUserA1._id,
      roomId: roomA1._id,
      propertyId: propertyA._id,
      ownerId: landlordA._id,
      month: '2026-06',
      totalRent: 8000,
      fullRentAmount: 8000,
      rentAmountAtGeneration: 8000,
      totalPaid: 8000,
      status: 'paid',
      dueDate: new Date('2026-06-05')
    });
    const txA1_June = await PaymentTransaction.create({
      rentRecordId: rentA1_June._id,
      tenantId: tenantA1._id,
      ownerId: landlordA._id,
      propertyId: propertyA._id,
      amount: 8000,
      paymentMethod: 'upi',
      transactionType: 'gateway',
      paymentGateway: 'cashfree',
      cashfreeOrderId: 'cf_order_amit_june',
      cashfreePaymentId: 'pay_amit_june',
      recordedBy: landlordA._id,
      status: 'completed',
      paymentDate: new Date('2026-06-04')
    });
    await walletService.creditWalletOnPayment(txA1_June._id);

    // May Bill - Amit Kumar (Paid)
    const rentA1_May = await MonthlyRentRecord.create({
      tenantId: tenantA1._id,
      userId: tenantUserA1._id,
      roomId: roomA1._id,
      propertyId: propertyA._id,
      ownerId: landlordA._id,
      month: '2026-05',
      totalRent: 8000,
      fullRentAmount: 8000,
      rentAmountAtGeneration: 8000,
      totalPaid: 8000,
      status: 'paid',
      dueDate: new Date('2026-05-05')
    });
    const txA1_May = await PaymentTransaction.create({
      rentRecordId: rentA1_May._id,
      tenantId: tenantA1._id,
      ownerId: landlordA._id,
      propertyId: propertyA._id,
      amount: 8000,
      paymentMethod: 'upi',
      transactionType: 'gateway',
      paymentGateway: 'cashfree',
      cashfreeOrderId: 'cf_order_amit_may',
      cashfreePaymentId: 'pay_amit_may',
      recordedBy: landlordA._id,
      status: 'completed',
      paymentDate: new Date('2026-05-03')
    });
    await walletService.creditWalletOnPayment(txA1_May._id);

    // June Bill - Suresh Raina (Unpaid)
    await MonthlyRentRecord.create({
      tenantId: tenantA2._id,
      userId: tenantUserA2._id,
      roomId: roomA2._id,
      propertyId: propertyA._id,
      ownerId: landlordA._id,
      month: '2026-06',
      totalRent: 6000,
      fullRentAmount: 6000,
      rentAmountAtGeneration: 6000,
      totalPaid: 0,
      status: 'pending',
      dueDate: new Date('2026-06-05')
    });


    // --- LANDLORD B (Greenwood Apartments) DATA ---
    const walletB = await walletService.getOrCreateWallet(landlordB._id);

    // June Bill - Vikram Singh (Paid)
    const rentB1_June = await MonthlyRentRecord.create({
      tenantId: tenantB1._id,
      userId: tenantUserB1._id,
      roomId: roomB1._id,
      propertyId: propertyB._id,
      ownerId: landlordB._id,
      month: '2026-06',
      totalRent: 12000,
      fullRentAmount: 12000,
      rentAmountAtGeneration: 12000,
      totalPaid: 12000,
      status: 'paid',
      dueDate: new Date('2026-06-05')
    });
    const txB1_June = await PaymentTransaction.create({
      rentRecordId: rentB1_June._id,
      tenantId: tenantB1._id,
      ownerId: landlordB._id,
      propertyId: propertyB._id,
      amount: 12000,
      paymentMethod: 'bank_transfer',
      transactionType: 'gateway',
      paymentGateway: 'cashfree',
      cashfreeOrderId: 'cf_order_vikram_june',
      cashfreePaymentId: 'pay_vikram_june',
      recordedBy: landlordB._id,
      status: 'completed',
      paymentDate: new Date('2026-06-02')
    });
    await walletService.creditWalletOnPayment(txB1_June._id);


    logger.info('--- SEEDING WITHDRAWAL REQUESTS ---');

    // Landlord A: Completed Manual Settlement
    const { request: withdrawA1 } = await walletService.requestWithdrawal(landlordA._id, 4000, {
      bankAccountNumber: landlordA.bankDetails.accountNumber,
      ifscCode: landlordA.bankDetails.ifscCode,
      accountHolderName: landlordA.name
    });
    await walletService.processWithdrawal(withdrawA1._id, 'approve', {}, landlordA._id);
    await walletService.processWithdrawal(
      withdrawA1._id,
      'complete',
      { transferType: 'neft', referenceNumber: 'N17283921820', note: 'Manual NEFT payout completed.' },
      landlordA._id
    );

    // Landlord A: Pending Settlement
    await walletService.requestWithdrawal(landlordA._id, 3000, {
      bankAccountNumber: landlordA.bankDetails.accountNumber,
      ifscCode: landlordA.bankDetails.ifscCode,
      accountHolderName: landlordA.name
    });

    // Landlord B: Pending Settlement
    await walletService.requestWithdrawal(landlordB._id, 6000, {
      bankAccountNumber: landlordB.bankDetails.accountNumber,
      ifscCode: landlordB.bankDetails.ifscCode,
      accountHolderName: landlordB.name
    });

    logger.info('--------------------------------------------');
    logger.info('✅ DEMO DUMMY DATA SEEDED SUCCESSFULLY!');
    logger.info(`    Landlord A (HDFC): ${landlordA.email} / Password123!`);
    logger.info(`    Landlord B (Axis): ${landlordB.email} / Password123!`);
    logger.info(`    Amit (Tenant A1) : ${tenantUserA1.email} / Password123!`);
    logger.info(`    Suresh (Tenant A2): ${tenantUserA2.email} / Password123!`);
    logger.info(`    Vikram (Tenant B1): ${tenantUserB1.email} / Password123!`);
    logger.info('--------------------------------------------');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    logger.error(`Seeding failed: ${err.message}`, err);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedDemoData();
