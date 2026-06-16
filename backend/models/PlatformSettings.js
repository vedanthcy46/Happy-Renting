'use strict';

const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema(
  {
    subscriptionEnabled: {
      type: Boolean,
      default: false
    },
    monthlySubscription: {
      type: Number,
      default: 299,
      min: [0, 'Subscription fee cannot be negative']
    },
    commissionEnabled: {
      type: Boolean,
      default: false
    },
    commissionPercentage: {
      type: Number,
      default: 2,
      min: [0, 'Commission percentage cannot be negative'],
      max: [100, 'Commission percentage cannot exceed 100']
    },
    gatewayFeeDeductionEnabled: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      }
    }
  }
);

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
