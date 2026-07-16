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
      enum: ['billing', 'maintenance', 'system', 'lifecycle', 'alert', 'rent_due', 'rent_paid', 'overdue', 'payment_received', 'bill_generated', 'payment_verified', 'payment_rejected', 'general', 'complaint_raised', 'complaint_resolved', 'complaint_comment', 'deletion_requested', 'deletion_approved', 'deletion_rejected', 'deletion_completed', 'tenant_move_out', 'payment_proof_uploaded', 'login_alert', 'new_tenant', 'rent_reminder', 'rent_overdue'],
      default: 'alert'
    },
    read: {
      type: Boolean,
      default: false
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
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
// Auto-delete notifications after 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
