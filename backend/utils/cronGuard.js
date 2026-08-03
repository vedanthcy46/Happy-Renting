'use strict';

const createConcurrencyGuard = (name, logger = console) => {
  let running = false;
  let lastStartedAt = null;

  return {
    async run(task) {
      if (running) {
        lastStartedAt = lastStartedAt || new Date();
        logger.warn?.(`[CRON GUARD] Skipping overlapping run for ${name}`);
        return { skipped: true, result: undefined };
      }

      running = true;
      lastStartedAt = new Date();

      try {
        const result = await task();
        return { skipped: false, result };
      } finally {
        running = false;
      }
    },
    isRunning() {
      return running;
    },
    getLastStartedAt() {
      return lastStartedAt;
    }
  };
};

module.exports = { createConcurrencyGuard };
