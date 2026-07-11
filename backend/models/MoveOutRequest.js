'use strict';

const mongoose = require('mongoose');

const moveOutRequestSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    requestedDate: {
      type: Date,
      required: [true, 'Requested vacate date is required'],
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [500, 'Reason cannot exceed 500 characters'],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    resolutionNotes: {
      type: String,
      trim: true,
      maxlength: [500, 'Resolution notes cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
  }
);

moveOutRequestSchema.index({ tenantId: 1 });
moveOutRequestSchema.index({ status: 1 });

module.exports = mongoose.model('MoveOutRequest', moveOutRequestSchema);
