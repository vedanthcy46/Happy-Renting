'use strict';

const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    title: {
      type     : String,
      required : [true, 'Title is required'],
      trim     : true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type     : String,
      required : [true, 'Description is required'],
      trim     : true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    tenantId: {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Tenant',
      required : [true, 'Tenant reference is required'],
    },
    ownerId: {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'User',
      required : [true, 'Owner reference is required'],
    },
    propertyId: {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Property',
      required : [true, 'Property reference is required'],
    },
    roomId: {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Room',
      required : [true, 'Room reference is required'],
    },
    status: {
      type    : String,
      enum    : ['pending', 'in-progress', 'resolved', 'rejected'],
      default : 'pending',
    },
    priority: {
      type    : String,
      enum    : ['low', 'medium', 'high', 'urgent'],
      default : 'medium',
    },
    resolutionNotes: {
      type     : String,
      trim     : true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    resolvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

complaintSchema.index({ tenantId: 1 });
complaintSchema.index({ ownerId: 1 });
complaintSchema.index({ propertyId: 1 });
complaintSchema.index({ status: 1 });

module.exports = mongoose.model('Complaint', complaintSchema);
