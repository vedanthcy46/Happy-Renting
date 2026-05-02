'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const emailService = require('../services/emailService');
const logger = require('../config/logger');

// We will use the user's own email for all tests, or a provided one
const TEST_EMAIL = process.argv[2] || process.env.EMAIL_USER || "vedanthh46@gmail.com";

const runTests = async () => {
  try {
    if (!TEST_EMAIL) {
      throw new Error('Please provide a recipient email as an argument or set EMAIL_USER in .env');
    }
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

    // 9. Owner Request - Under Review
    const mockRequest = { name: 'New Owner Candidate', email: TEST_EMAIL, phone: '+91 90000 00000', propertyName: 'Green Park Heights' };
    logger.info('Sending: Owner Request Under Review...');
    await emailService.sendRequestUnderReview(mockRequest);

    // 10. Owner Request - Approved
    logger.info('Sending: Owner Request Approved...');
    await emailService.sendRequestApproved(mockRequest, 'temp-pass-123');

    // 11. Admin Alert - New Request
    logger.info('Sending: Admin New Request Alert...');
    await emailService.sendAdminNewRequestAlert(mockRequest);

    // 12. Email Verification
    logger.info('Sending: Email Verification...');
    await emailService.sendVerificationEmail(mockUser, 'test-token-456');

    // 13. Tenant Onboarding (Credentials)
    logger.info('Sending: Tenant Onboarding (Welcome)...');
    await emailService.sendTenantWelcome(mockUser, 'TempPass123!', mockProperty, mockRoom, 'Super Admin', 'test-token-789');

    logger.info('✅ All test emails triggered successfully. Please check your inbox!');
    process.exit(0);
  } catch (err) {
    logger.error(`❌ Test failed: ${err.message}`);
    process.exit(1);
  }
};

runTests();
