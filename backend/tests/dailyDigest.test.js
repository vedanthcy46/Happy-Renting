'use strict';

const mongoose = require('mongoose');
const {
  processDigestQueue,
  runDigestWatchdog,
  generateOwnerDigests,
  normalizeOwnerDigestMetrics,
  normalizeAdminDigestMetrics
} = require('../services/dailyDigestService');
const DailyDigestLog = require('../models/DailyDigestLog');
const DailyMetricsSnapshot = require('../models/DailyMetricsSnapshot');
const User = require('../models/User');

// Mock out the email service so we don't actually send emails
jest.mock('../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));

// Mock reporting service so we control the snapshots
jest.mock('../services/reportingService', () => ({
  getOwnerFinancialMetrics: jest.fn().mockResolvedValue({ pendingRent: 1000 }),
  getOwnerOccupancyMetrics: jest.fn().mockResolvedValue({ occupancyRate: 90 }),
  getOwnerCollectionMetrics: jest.fn().mockResolvedValue({ collectedToday: 500 }),
  getOwnerComplaintMetrics: jest.fn().mockResolvedValue({ openComplaints: 1 }),
  getOwnerAlerts: jest.fn().mockResolvedValue({ overdueTenants: 0 })
}));

describe('Daily Digest System', () => {
  let owner;

  beforeAll(async () => {
    // Setup DB connection (assuming mongoose.connect is handled by global setup)
    // Create a mock owner
    owner = await User.create({
      name: 'Test Owner',
      email: 'owner@test.com',
      password: 'Password123!',
      role: 'owner',
      isActive: true,
      notificationPreferences: { dailyDigestEmails: true }
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await DailyDigestLog.deleteMany({});
    await DailyMetricsSnapshot.deleteMany({});
  });

  beforeEach(async () => {
    await DailyDigestLog.deleteMany({});
    await DailyMetricsSnapshot.deleteMany({});
    jest.clearAllMocks();
  });

  it('1. Owner digest generation should be idempotent', async () => {
    // Run generation once
    await generateOwnerDigests();
    
    let logs = await DailyDigestLog.find({});
    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe('pending');
    expect(logs[0].userId.toString()).toBe(owner._id.toString());

    // Run generation twice (should not create duplicate)
    await generateOwnerDigests();
    logs = await DailyDigestLog.find({});
    expect(logs.length).toBe(1); // Still 1!
  });

  it('2. Queue processing should mark job as sent', async () => {
    await generateOwnerDigests();
    await processDigestQueue();

    const log = await DailyDigestLog.findOne({ userId: owner._id });
    expect(log.status).toBe('sent');
    expect(log.attempts).toBe(1);
    expect(log.sentAt).not.toBeNull();
  });

  it('3. Watchdog should reset stuck processing jobs', async () => {
    // Create a stuck job
    const job = await DailyDigestLog.create({
      userId: owner._id,
      role: 'owner',
      digestType: 'owner_daily',
      digestDate: '2026-06-30',
      status: 'processing',
      processingStartedAt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
    });

    await runDigestWatchdog();

    const updatedJob = await DailyDigestLog.findById(job._id);
    expect(updatedJob.status).toBe('pending');
    expect(updatedJob.processingStartedAt).toBeNull();
  });

  it('4. Watchdog should requeue failed jobs below maxAttempts', async () => {
    // Create a failed job
    const job = await DailyDigestLog.create({
      userId: owner._id,
      role: 'owner',
      digestType: 'owner_daily',
      digestDate: '2026-06-31',
      status: 'failed',
      attempts: 2,
      maxAttempts: 5
    });

    await runDigestWatchdog();

    const updatedJob = await DailyDigestLog.findById(job._id);
    expect(updatedJob.status).toBe('pending'); // Re-queued
  });

  it('5. Queue processor should mark dead_letter if maxAttempts reached', async () => {
    await DailyMetricsSnapshot.create({
      ownerId: owner._id,
      date: '2026-06-30',
      metrics: { pendingRent: 1000 }
    });

    const job = await DailyDigestLog.create({
      userId: owner._id,
      role: 'owner',
      digestType: 'owner_daily',
      digestDate: '2026-06-30',
      status: 'pending',
      attempts: 4,
      maxAttempts: 5
    });

    // Mock emailService to throw error
    require('../services/emailService').sendEmail.mockRejectedValueOnce(new Error('SMTP failure'));

    await processDigestQueue();

    const updatedJob = await DailyDigestLog.findById(job._id);
    expect(updatedJob.status).toBe('dead_letter');
    expect(updatedJob.attempts).toBe(5);
    expect(updatedJob.lastError).toBe('SMTP failure');
  });

  it('6. normalizeOwnerDigestMetrics should support both collectedToday and collectionsToday', () => {
    const normalizedFromCollected = normalizeOwnerDigestMetrics({ collectedToday: 123 });
    expect(normalizedFromCollected.collectedToday).toBe(123);
    expect(normalizedFromCollected.collectionsToday).toBe(123);

    const normalizedFromCollections = normalizeOwnerDigestMetrics({ collectionsToday: 456 });
    expect(normalizedFromCollections.collectedToday).toBe(456);
    expect(normalizedFromCollections.collectionsToday).toBe(456);
  });

  it('7. normalizeAdminDigestMetrics should support totalCollectionsToday aliasing', () => {
    const normalized = normalizeAdminDigestMetrics({ collectionsToday: 789 });
    expect(normalized.totalCollectionsToday).toBe(789);
    expect(normalized.collectionsToday).toBe(789);
  });
});
