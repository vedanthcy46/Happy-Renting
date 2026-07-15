'use strict';

const mongoose = require('mongoose');

const processedWebhookSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
    },
    processedAt: {
      type: Date,
      default: Date.now,
      expires: 604800, // TTL index: 7 days in seconds
    },
  }
);

module.exports = mongoose.model('ProcessedWebhook', processedWebhookSchema);
