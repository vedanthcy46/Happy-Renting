const test = require('node:test');
const assert = require('node:assert/strict');
const { createConcurrencyGuard } = require('../utils/cronGuard');

test('skips overlapping runs while the first one is still active', async () => {
  const guard = createConcurrencyGuard('demo', { warn: () => {} });

  let activeRuns = 0;
  const first = guard.run(async () => {
    activeRuns += 1;
    await new Promise((resolve) => setTimeout(resolve, 30));
    activeRuns -= 1;
    return 'first';
  });

  const second = await guard.run(async () => 'second');
  const firstResult = await first;

  assert.strictEqual(firstResult.skipped, false);
  assert.strictEqual(firstResult.result, 'first');
  assert.strictEqual(second.skipped, true);
  assert.strictEqual(second.result, undefined);
  assert.strictEqual(activeRuns, 0);
});
