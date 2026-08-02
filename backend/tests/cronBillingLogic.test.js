const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateDueDate } = require('../utils/billingCalculationService');

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
