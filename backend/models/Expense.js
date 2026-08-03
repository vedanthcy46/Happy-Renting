'use strict';

const mongoose = require('mongoose');

const EXPENSE_CATEGORIES = [
  'maintenance',
  'electricity',
  'water',
  'society',
  'repairs',
  'cleaning',
  'internet',
  'misc',
];

const expenseSchema = new mongoose.Schema(
  {
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
    category: {
      type    : String,
      enum    : EXPENSE_CATEGORIES,
      required: [true, 'Category is required'],
    },
    title: {
      type     : String,
      trim     : true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
      default  : '',
    },
    amount: {
      type    : Number,
      required: [true, 'Amount is required'],
      min     : [0.01, 'Amount must be greater than zero'],
    },
    // Format: "YYYY-MM" e.g. "2024-05"
    month: {
      type    : String,
      required: [true, 'Month is required'],
      match   : [/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be in YYYY-MM format'],
    },
    // Recurring monthly expense — re-suggested each month to speed up logging
    isRecurring: {
      type   : Boolean,
      default: false,
    },
    notes: {
      type     : String,
      trim     : true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    expenseDate: {
      type   : Date,
      default: Date.now,
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

expenseSchema.index({ ownerId: 1, month: 1 });
expenseSchema.index({ propertyId: 1, month: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
module.exports.EXPENSE_CATEGORIES = EXPENSE_CATEGORIES;