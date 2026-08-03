'use strict';

const createConcurrencyLimiter = ({ maxConcurrent = 50, logger = console } = {}) => {
  let active = 0;
  let queueDepth = 0;

  return (req, res, next) => {
    if (active >= maxConcurrent) {
      queueDepth += 1;
      logger.warn?.(`[CONCURRENCY] Rejected request due to overload. Active=${active} Queue=${queueDepth}`);
      res.status(429).json({ success: false, message: 'Too many requests. Please try again shortly.' });
      return;
    }

    active += 1;
    const finish = () => {
      active -= 1;
      if (active < maxConcurrent) {
        queueDepth = Math.max(0, queueDepth - 1);
      }
    };

    res.on('finish', finish);
    res.on('close', finish);
    next();
  };
};

module.exports = { createConcurrencyLimiter };
