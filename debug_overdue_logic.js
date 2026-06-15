'use strict';

const mongoose = require('mongoose');
const MonthlyRentRecord = require('./backend/models/MonthlyRentRecord');
require('dotenv').config({ path: './.env' });

async function debugOverdue() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log(`Debug Date (Today): ${today.toISOString()}`);

    const records = await MonthlyRentRecord.find({
      status: { $in: ['pending', 'partial', 'overdue'] }
    }).populate('userId', 'name email').lean();

    console.log(`Found ${records.length} records with pending/partial/overdue status.`);

    records.forEach(r => {
      if (!r.dueDate) {
        console.log(`[MISSING DUE DATE] Tenant: ${r.userId?.name}, Month: ${r.month}`);
        return;
      }

      const dueDate = new Date(r.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const diffTime = today - dueDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      console.log(`---
Tenant: ${r.userId?.name} (${r.userId?.email})
Month: ${r.month}
Status: ${r.status}
Due Date: ${dueDate.toISOString()}
Diff Days: ${diffDays}
Reminder Sent: ${r.reminderSent}
Last Sent: ${r.reminderSentAt ? r.reminderSentAt.toISOString() : 'Never'}`);

      // Logic check
      const milestones = [1, 7, 15, 21, 30];
      const currentHighestMilestone = [...milestones].reverse().find(m => diffDays >= m);
      console.log(`Current Milestone: ${currentHighestMilestone || 'None'}`);
      
      if (diffDays > 0 && (r.status === 'overdue' || r.status === 'partial')) {
          if (!r.reminderSentAt) {
              console.log('>> SHOULD SEND: Never sent before');
          } else {
              const lastSent = new Date(r.reminderSentAt);
              lastSent.setHours(0, 0, 0, 0);
              const lastDiffDays = Math.floor((lastSent.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
              const lastMilestoneReached = [...milestones].reverse().find(m => lastDiffDays >= m);
              console.log(`Last Milestone Reached: ${lastMilestoneReached || 'None'}`);
              if (!lastMilestoneReached || currentHighestMilestone > lastMilestoneReached) {
                  console.log('>> SHOULD SEND: New milestone reached');
              }
          }
      }
    });

    await mongoose.connection.close();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

debugOverdue();
