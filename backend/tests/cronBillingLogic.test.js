process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 'test-key';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateDueDate } = require('../utils/billingCalculationService');
const { resolveOwnerWalletOwnerId } = require('../services/walletService');

test('anchors rent due dates to the 5th of the billing month', () => {
  const dueDate = calculateDueDate('2026-08');

  assert.strictEqual(dueDate.getFullYear(), 2026);
  assert.strictEqual(dueDate.getMonth(), 7);
  assert.strictEqual(dueDate.getDate(), 5);
});

test('does not shift the due date into the following month', () => {
  const dueDate = calculateDueDate('2026-12');

  assert.strictEqual(dueDate.getFullYear(), 2026);
  assert.strictEqual(dueDate.getMonth(), 11);
  assert.strictEqual(dueDate.getDate(), 5);
});

test('skips wallets without a populated owner document during subscription charges', () => {
  const ownerId = resolveOwnerWalletOwnerId({ ownerId: null });

  assert.strictEqual(ownerId, null);
});
