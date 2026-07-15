'use strict';

const mongoose = require('mongoose');

const ownerRequestSchema = new mongoose.Schema({
  name: {
    type    : String,
    required: [true, 'Name is required'],
    trim    : true,
  },
  email: {
    type     : String,
    required : [true, 'Email is required'],
    unique   : true,
    trim     : true,
    lowercase: true,
  },
  phone: {
    type    : String,
    required: [true, 'Phone number is required'],
    unique  : true,
    trim    : true,
  },
  propertyName: {
    type: String,
    trim: true,
  },
  propertyLocation: {
    type: String,
    trim: true,
  },
  status: {
    type   : String,
    enum   : ['pending', 'approved', 'rejected', 'expired'],
    default: 'pending',
  },
  rejectionReason: {
    type: String,
    trim: true,
  },
  isPriority: {
    type   : Boolean,
    default: false,
  },
  adminNotes: [
    {
      note    : { type: String, required: true, trim: true },
      addedAt : { type: Date, default: Date.now },
      addedBy : { type: String, trim: true }, // snapshot of admin's name
    }
  ],
}, {
  timestamps: true
});

module.exports = mongoose.model('OwnerRequest', ownerRequestSchema);
