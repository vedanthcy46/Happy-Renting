'use strict';

const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');

const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: {
      type     : String,
      required : [true, 'Name is required'],
      trim     : true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [60, 'Name cannot exceed 60 characters'],
    },
    email: {
      type      : String,
      required  : [true, 'Email is required'],
      unique    : true,
      lowercase : true,
      trim      : true,
      match     : [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type     : String,
      required : [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select   : false,  // Never returned in queries by default
    },
    role: {
      type    : String,
      enum    : ['superadmin', 'owner', 'tenant'],
      default : 'tenant',
    },
     // Multi-role support — a user can be both tenant and owner.
    // Populated from `role` on first save if empty.
    roles: {
      type    : [String],
      enum    : ['superadmin', 'owner', 'tenant'],
      default : [],
    },
    // Links a tenant or owner to the owning account
    ownerId: {
      type : mongoose.Schema.Types.ObjectId,
      ref  : 'User',
      default: null,
    },
    isActive: {
      type   : Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    mustChangePassword: {
      type   : Boolean,
      default: false,
    },
    phone: {
      type: String,
      trim: true,
    },
    // Owner payment details
    upiId: {
      type: String,
      trim: true,
    },
    upiNumber: {
      type: String,
      trim: true,
    },
    upiDetails: {
      upiId: { type: String, trim: true, default: null },
      upiName: { type: String, trim: true, default: null },
      verified: { type: Boolean, default: false },
      verifiedAt: { type: Date, default: null }
    },
    bankDetails: {
      accountHolder: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      bankName:      { type: String, trim: true },
      ifscCode:      { type: String, trim: true },
    },
    qrCodeImage: {
      secureUrl: { type: String },
      publicId : { type: String },
    },

    emailVerified: {
      type   : Boolean,
      default: false,
    },
    emailVerificationToken  : { type: String, select: false },
    emailVerificationExpires: { type: Date,   select: false },
    pendingEmail         : { type: String, trim: true, lowercase: true, select: false },
    emailChangeOtp       : { type: String, select: false },
    emailChangeOtpExpires: { type: Date,   select: false },
    passwordResetToken  : { type: String, select: false },
    passwordResetExpires: { type: Date,   select: false },
    // ── Expo Push Tokens (multi-device) ─────────────────────────────────────
    expoPushTokens: [
      {
        token:      { type: String, required: true },
        platform:   { type: String, enum: ['ios', 'android', 'web'], default: 'android' },
        deviceName: { type: String, default: null },
        lastSeenAt: { type: Date, default: Date.now },
      }
    ],

    // ── Preferences ─────────────────────────────────────────────────────────
    preferredLanguage: {
      type   : String,
      enum   : ['en', 'kn', 'hi', 'ta', 'te', 'ml'],
      default: 'en',
    },
    notificationPreferences: {
      loginAlerts: { type: Boolean, default: true },
      paymentReceivedEmails: { type: Boolean, default: true },
      overdueEmails: { type: Boolean, default: true },
      proofUploadEmails: { type: Boolean, default: true },
      settlementEmails: { type: Boolean, default: true },
      systemEmails: { type: Boolean, default: true },
      dailyDigestEmails: { type: Boolean, default: true },
      weeklyDigestEmails: { type: Boolean, default: true },
      monthlyDigestEmails: { type: Boolean, default: true },
      marketingEmails: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
    // Harden: never return password or reset tokens via .toJSON()
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ── Pre-save: hash password ────────────────────────────────────────────────
userSchema.pre('save', async function () {
  // Sync roles array from role field if roles is empty (existing users / migration)
  if (this.roles.length === 0 && this.role) {
    this.roles = [this.role];
  }
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});

// ── Instance method: compare password ─────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Index ──────────────────────────────────────────────────────────────────
// email already has unique index via { unique: true } in schema
// userSchema.index({ email: 1 });
userSchema.index({ role: 1, ownerId: 1 });

module.exports = mongoose.model('User', userSchema);
