'use strict';

const mongoose = require('mongoose');

const coOccupantSchema = new mongoose.Schema(
  {
    tenantId: {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Tenant',
      required : [true, 'Primary tenant reference is required'],
    },
    ownerId: {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'User',
      required : [true, 'Owner reference is required'],
    },
    name: {
      type     : String,
      required : [true, 'Co-occupant name is required'],
      trim     : true,
      maxlength: [60, 'Name cannot exceed 60 characters'],
    },
    phone: {
      type     : String,
      trim     : true,
      default  : '',
    },
    idProof: {
      type     : String, // Store identifier or file reference
      trim     : true,
      default  : '',
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    }
  },
  {
    timestamps: true,
  }
);

coOccupantSchema.index({ tenantId: 1 });
coOccupantSchema.index({ ownerId: 1 });

module.exports = mongoose.model('CoOccupant', coOccupantSchema);
