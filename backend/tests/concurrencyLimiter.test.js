const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { createConcurrencyLimiter } = require('../middleware/concurrencyLimiter');

class MockRes extends EventEmitter {
  constructor() {
    super();
    this.headers = {};
    this.statusCode = 200;
    this.body = null;
    this.finished = false;
  }

  setHeader(name, value) {
    this.headers[name] = value;
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  json(payload) {
    this.body = payload;
    return this;
  }

  end() {
    this.finished = true;
    this.emit('finish');
  }
}

test('rejects requests once the concurrent limit is reached', () => {
  const limiter = createConcurrencyLimiter({ maxConcurrent: 1, logger: { warn() {} } });
  const firstRes = new MockRes();
  let nextCalls = 0;

  limiter({}, firstRes, () => {
    nextCalls += 1;
  });

  const secondRes = new MockRes();
  limiter({}, secondRes, () => {
    nextCalls += 1;
  });

  assert.strictEqual(nextCalls, 1);
  assert.strictEqual(secondRes.statusCode, 429);
  assert.strictEqual(secondRes.body.message, 'Too many requests. Please try again shortly.');

  firstRes.end();
});
