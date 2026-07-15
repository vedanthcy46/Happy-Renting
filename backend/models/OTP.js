'use strict';

const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['otp', 'verified'],
      default: 'otp',
    },
    value: {
      type: String,
      required: true, // Stores the OTP code or the verification token
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0, // TTL index: automatically delete document when expiresAt is reached
    },
  },
  {
    timestamps: true,
  }
);

otpSchema.index({ email: 1, type: 1 });

module.exports = mongoose.model('OTP', otpSchema);
