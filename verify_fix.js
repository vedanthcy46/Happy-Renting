'use strict';

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const MonthlyRentRecord = require('../backend/models/MonthlyRentRecord');
const PaymentTransaction = require('../backend/models/PaymentTransaction');
const Tenant = require('../backend/models/Tenant');
const paymentServiceV2 = require('../backend/services/paymentServiceV2');
const billingServiceV2 = require('../backend/services/billingServiceV2');

async function runTest() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    // 1. Create a dummy tenant
    const tenant = await Tenant.create({
      name: 'Test Tenant',
      email: 'test@example.com',
      phone: '1234567890',
      ownerId: new mongoose.Types.ObjectId(),
      propertyId: new mongoose.Types.ObjectId(),
      roomId: new mongoose.Types.ObjectId(),
      status: 'active',
      joinDate: new Date('2024-01-01'),
    });

    console.log('Created tenant:', tenant._id);

    // 2. Create two rent records
    const record1 = await MonthlyRentRecord.create({
      tenantId: tenant._id,
      userId: new mongoose.Types.ObjectId(),
      roomId: tenant.roomId,
      propertyId: tenant.propertyId,
      ownerId: tenant.ownerId,
      month: '2024-05',
      totalRent: 1,
      rentAmountAtGeneration: 1,
      fullRentAmount: 1,
      dueDate: new Date(),
    });

    const record2 = await MonthlyRentRecord.create({
      tenantId: tenant._id,
      userId: record1.userId,
      roomId: tenant.roomId,
      propertyId: tenant.propertyId,
      ownerId: tenant.ownerId,
      month: '2024-06',
      totalRent: 1,
      rentAmountAtGeneration: 1,
      fullRentAmount: 1,
      dueDate: new Date(),
    });

    console.log('Created rent records for 2024-05 and 2024-06');

    // 3. Add overpayment to May
    console.log('Adding 100rs payment to May...');
    await paymentServiceV2.addPaymentTransaction({
      rentRecordId: record1._id,
      tenantId: tenant._id,
      amount: 100,
      paymentMethod: 'cash',
      transactionType: 'cash',
    }, { id: record1.ownerId, role: 'owner' });

    // 4. Check records
    const updated1 = await MonthlyRentRecord.findById(record1._id);
    const updated2 = await MonthlyRentRecord.findById(record2._id);

    console.log('After payment and auto-apply:');
    console.log(`May: totalPaid=${updated1.totalPaid}, advanceBalance=${updated1.advanceBalance}, status=${updated1.status}`);
    console.log(`June: totalPaid=${updated2.totalPaid}, advanceBalance=${updated2.advanceBalance}, status=${updated2.status}`);

    // Total should be 100
    const totalSum = updated1.totalPaid + updated2.totalPaid;
    console.log(`Sum of totalPaid across all records: ${totalSum}`);

    if (totalSum === 100) {
      console.log('SUCCESS: Total income is consistent!');
    } else {
      console.log(`FAILURE: Total income is ${totalSum}, expected 100`);
    }

    // 5. Check summary metrics
    const metrics = await billingServiceV2.getSummaryMetrics(tenant.ownerId);
    console.log('Summary Metrics:', metrics);
    
    if (metrics.totalCollected === 100) {
      console.log('SUCCESS: Summary Metrics totalCollected is correct!');
    } else {
      console.log(`FAILURE: Summary Metrics totalCollected is ${metrics.totalCollected}, expected 100`);
    }

    // Cleanup
    await MonthlyRentRecord.deleteMany({ tenantId: tenant._id });
    await PaymentTransaction.deleteMany({ tenantId: tenant._id });
    await Tenant.findByIdAndDelete(tenant._id);
    console.log('Cleaned up test data');

    await mongoose.disconnect();
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

runTest();
