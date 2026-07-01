'use strict';

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['billing', 'maintenance', 'system', 'lifecycle', 'alert', 'rent_due', 'rent_paid', 'overdue', 'payment_received', 'bill_generated'],
      default: 'alert'
    },
    read: {
      type: Boolean,
      default: false
    },
    link: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true // adds createdAt and updatedAt
  }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
