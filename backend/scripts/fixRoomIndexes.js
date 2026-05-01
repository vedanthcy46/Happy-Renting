'use strict';

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const Room = require('../models/Room');

const fixIndexes = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');

    console.log('Dropping old unique index on Room model...');
    // The index name is usually propertyId_1_roomNumber_1
    try {
      await Room.collection.dropIndex('propertyId_1_roomNumber_1');
      console.log('Successfully dropped old index.');
    } catch (e) {
      if (e.codeName === 'IndexNotFound') {
        console.log('Index propertyId_1_roomNumber_1 not found, it might have a different name.');
        // List indexes to find it
        const indexes = await Room.collection.indexes();
        console.log('Available indexes:', JSON.stringify(indexes, null, 2));
      } else {
        throw e;
      }
    }

    console.log('Re-syncing indexes from schema...');
    await Room.syncIndexes();
    console.log('Index synchronization complete.');

    process.exit(0);
  } catch (err) {
    console.error('Error fixing indexes:', err);
    process.exit(1);
  }
};

fixIndexes();
