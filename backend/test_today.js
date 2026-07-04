require('dotenv').config();
const mongoose = require('mongoose');
const PaymentTransaction = require('./models/PaymentTransaction');
const reportingService = require('./services/reportingService');
const User = require('./models/User');
const Tenant = require('./models/Tenant');
const MonthlyRentRecord = require('./models/MonthlyRentRecord');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const owner = await User.findOne({ role: 'owner' });
    const tenant = await Tenant.findOne({ ownerId: owner._id });
    const record = await MonthlyRentRecord.findOne({ ownerId: owner._id });
    
    // Create a transaction TODAY
    const tx = await PaymentTransaction.create({
      rentRecordId: record._id,
      tenantId: tenant._id,
      ownerId: owner._id,
      propertyId: record.propertyId,
      amount: 1000,
      paymentMethod: 'cash',
      transactionType: 'cash',
      recordedBy: owner._id,
      status: 'completed',
      paymentDate: new Date()
    });

    console.log('Created new tx today:', tx._id);

    const metrics = await reportingService.getOwnerCollectionMetrics(owner._id, new Date().toISOString().split('T')[0]);
    console.log('Owner Collection Metrics:', metrics);

    await PaymentTransaction.deleteOne({ _id: tx._id });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
