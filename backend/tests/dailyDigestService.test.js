process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 'test-key';

const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeOwnerDigestMetrics, normalizeAdminDigestMetrics } = require('../services/dailyDigestService');

test('normalizeOwnerDigestMetrics supplies reliable alert defaults', () => {
  const normalized = normalizeOwnerDigestMetrics({ pendingRent: 1200 });

  assert.equal(normalized.pendingRent, 1200);
  assert.equal(normalized.overdueTenants, 0);
  assert.equal(normalized.unverifiedPayments, 0);
  assert.equal(normalized.upcomingMoveOuts, 0);
  assert.equal(normalized.openComplaints, 0);
});

test('normalizeAdminDigestMetrics supplies reliable alert defaults and styles', () => {
  const normalized = normalizeAdminDigestMetrics({});

  assert.equal(normalized.failedPaymentsToday, 0);
  assert.equal(normalized.pendingWithdrawals, 0);
  assert.equal(normalized.queueBacklog, 0);
  assert.equal(normalized.deadLetterJobs, 0);
  assert.equal(normalized.workerHealth, 'Healthy');
  assert.equal(normalized.workerHealthStyle, 'border-green');
  assert.equal(normalized.deadLetterStyle, 'border-green');
});
