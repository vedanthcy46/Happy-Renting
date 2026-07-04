require('dotenv').config();
const mongoose = require('mongoose');
const billingServiceV2 = require('./services/billingServiceV2');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    console.log('Testing Admin getSummaryMetrics...');
    const adminMetrics = await billingServiceV2.getSummaryMetrics(null, {});
    console.log('Admin Metrics:', adminMetrics);

    // Let's also test for an owner
    const User = require('./models/User');
    const owner = await User.findOne({ role: 'owner' });
    if (owner) {
      console.log('Testing Owner getSummaryMetrics...');
      const ownerMetrics = await billingServiceV2.getSummaryMetrics(owner._id, {});
      console.log('Owner Metrics:', ownerMetrics);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
