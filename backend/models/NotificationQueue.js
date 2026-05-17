'use strict';

const mongoose = require('mongoose');

const notificationQueueSchema = new mongoose.Schema(
  {
    to: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['auth', 'reminder', 'receipt', 'report', 'alert'],
      default: 'alert',
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    errorLog: {
      type: String,
      default: null,
    },
    // Optional reference to a specific user or tenant if needed for audit logs
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    }
  },
  {
    timestamps: true,
  }
);

// Indexes for fast queue polling
notificationQueueSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('NotificationQueue', notificationQueueSchema);
