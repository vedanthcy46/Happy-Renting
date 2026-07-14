'use strict';

const mongoose = require('mongoose');
const crypto = require('crypto');

const dataDeletionRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
  },
  reason: {
    type: String,
    trim: true,
    default: '',
    maxlength: [1000, 'Reason cannot exceed 1000 characters'],
  },
  role: {
    type: String,
    enum: ['superadmin', 'owner', 'tenant', 'unknown'],
    default: 'unknown',
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'pending_owner', 'owner_approved', 'owner_rejected', 'processing', 'completed', 'rejected', 'cancelled'],
    default: 'pending',
  },
  deletionToken: {
    type: String,
    select: false,
  },
  tokenExpiresAt: {
    type: Date,
    select: false,
  },
  referenceId: {
    type: String,
    unique: true,
    default: function() {
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
      const seq = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      return `HR-DEL-${datePart}-${randomPart}${seq}`;
    },
  },
  confirmedAt: {
    type: Date,
    default: null,
  },
  processedAt: {
    type: Date,
    default: null,
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  adminComment: {
    type: String,
    trim: true,
    default: '',
  },
  ownerNotified: {
    type: Boolean,
    default: false,
  },
  ownerNotificationSentAt: {
    type: Date,
    default: null,
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    default: null,
  },
  ownerActionAt: {
    type: Date,
    default: null,
  },
  scheduledDeletionAt: {
    type: Date,
    default: null,
  },
  anonymizedAt: {
    type: Date,
    default: null,
  },
  cancelledAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
  toJSON: {
    transform(_doc, ret) {
      delete ret.__v;
      return ret;
    },
  },
});

dataDeletionRequestSchema.index({ email: 1 });
dataDeletionRequestSchema.index({ status: 1 });
dataDeletionRequestSchema.index({ ownerId: 1 });

module.exports = mongoose.model('DataDeletionRequest', dataDeletionRequestSchema);
