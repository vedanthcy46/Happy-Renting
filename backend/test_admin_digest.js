require('dotenv').config();
const mongoose = require('mongoose');
const { generateAdminDigests, processDigestQueue } = require('./services/dailyDigestService');

(async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');
    
    console.log('Generating admin digests...');
    await generateAdminDigests();
    console.log('Digests generated.');

    console.log('Processing queue...');
    await processDigestQueue();
    console.log('Queue processed.');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
