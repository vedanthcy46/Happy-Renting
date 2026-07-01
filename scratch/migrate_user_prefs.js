require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../backend/models/User');

const migrate = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('Updating user notification preferences...');
    const result = await User.updateMany(
      { 
        $or: [
          { 'notificationPreferences.weeklyDigestEmails': { $exists: false } },
          { 'notificationPreferences.monthlyDigestEmails': { $exists: false } }
        ]
      },
      { 
        $set: { 
          'notificationPreferences.weeklyDigestEmails': true,
          'notificationPreferences.monthlyDigestEmails': true
        } 
      }
    );
    
    console.log(`Migration complete. Modified ${result.modifiedCount} users.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

migrate();
