'use strict';

const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema(
  {
    name: {
      type     : String,
      required : [true, 'Property name is required'],
      trim     : true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    address: {
      type     : String,
      required : [true, 'Address is required'],
      trim     : true,
      maxlength: [200, 'Address cannot exceed 200 characters'],
    },
    city: {
      type : String,
      trim : true,
      maxlength: [60, 'City cannot exceed 60 characters'],
    },
    ownerId: {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'User',
      required : [true, 'Owner is required'],
    },
    isActive: {
      type   : Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

propertySchema.index({ ownerId: 1 });

module.exports = mongoose.model('Property', propertySchema);
