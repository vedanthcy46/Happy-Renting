'use strict';

const EventEmitter = require('events');
const logger = require('../config/logger');
// const emailService = require('./emailService');

class EventBus extends EventEmitter {}
const eventBus = new EventBus();

// Listeners
eventBus.on('ledger_rebuild_completed', async (payload) => {
  try {
    logger.info(`[EVENT BUS] Processing ledger_rebuild_completed for tenant=${payload.tenantId}`);
    // A real implementation would fetch necessary data and queue an email or SMS
    // Example: await emailService.sendLedgerUpdateEmail(payload.tenantId, payload.changes);
  } catch (error) {
    // Non-blocking error logging
    logger.error(`[EVENT BUS ERROR] Failed to process ledger_rebuild_completed: ${error.message}`);
  }
});

eventBus.on('payment_received', async (payload) => {
  try {
    logger.info(`[EVENT BUS] Processing payment_received for payment=${payload.paymentId}`);
    // Example: await emailService.sendPaymentReceivedEmail(payload.paymentId);
  } catch (error) {
    logger.error(`[EVENT BUS ERROR] Failed to process payment_received: ${error.message}`);
  }
});

const publishEvent = (eventName, payload) => {
  // Emit async to truly decouple from the calling thread
  setImmediate(() => {
    eventBus.emit(eventName, payload);
  });
};

module.exports = {
  publishEvent
};
