'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const emailService = require('../services/emailService');
const logger = require('../config/logger');

// We will use the user's own email for all tests to verify they are receiving them.
const TEST_EMAIL = process.env.EMAIL_USER;

const runTests = async () => {
  try {
    logger.info(`🚀 Starting Email Notification Tests...`);
    logger.info(`📧 All test emails will be sent to: ${TEST_EMAIL}`);

    // Mock Data
    const mockUser = { name: 'Test Tenant', email: TEST_EMAIL };
    const mockOwner = { name: 'Test Owner', email: TEST_EMAIL };
    const mockProperty = { name: 'Sunset Apartments', address: '123 Luxury Lane' };
    const mockRoom = { roomNumber: '101A', floor: '1st Floor' };
    const mockPayment = {
      month: 'October 2024',
      amount: 15000,
      dueDate: new Date(),
      status: 'paid',
      method: 'online',
      failureReason: 'Transaction timeout at bank.'
    };
    const mockComplaint = {
      title: 'Leaking Tap in Bathroom',
      description: 'The tap has been dripping constantly since last night, causing water waste.',
      priority: 'high'
    };

    // 1. Welcome Email
    logger.info('Sending: Welcome Email...');
    await emailService.sendWelcomeEmail(mockUser, mockProperty, mockRoom, mockOwner);

    // 2. Rent Due Reminder
    logger.info('Sending: Rent Due Reminder...');
    await emailService.sendRentDueReminder(mockUser, mockPayment, mockProperty, mockRoom, mockOwner);

    // 3. Overdue Alert
    logger.info('Sending: Overdue Alert...');
    await emailService.sendOverdueAlert(mockUser, mockPayment, mockProperty, mockRoom, mockOwner);

    // 4. Payment Submitted (To Owner)
    logger.info('Sending: Payment Proof Notification...');
    await emailService.sendPaymentProofNotification(mockOwner, mockUser, mockPayment, mockProperty, mockRoom);

    // 5. Payment Verified
    logger.info('Sending: Payment Verified Notification...');
    mockPayment.status = 'paid';
    await emailService.sendPaymentStatusNotification(mockUser, mockPayment, mockProperty, mockRoom, mockOwner);

    // 6. Payment Rejected
    logger.info('Sending: Payment Rejected Notification...');
    mockPayment.status = 'rejected';
    await emailService.sendPaymentStatusNotification(mockUser, mockPayment, mockProperty, mockRoom, mockOwner);

    // 7. Complaint Raised
    logger.info('Sending: Complaint Notification...');
    await emailService.sendComplaintNotification(mockOwner, mockUser, mockComplaint, mockProperty, mockRoom);

    // 8. Password Change Alert
    logger.info('Sending: Password Change Alert...');
    await emailService.sendPasswordChangeNotification(mockUser);

    logger.info('✅ All test emails triggered successfully. Please check your inbox!');
    process.exit(0);
  } catch (err) {
    logger.error(`❌ Test failed: ${err.message}`);
    process.exit(1);
  }
};

runTests();
