'use strict';

const router = require('express').Router();
const { 
  login, register, getMe, changePassword, 
  verifyEmail, resendVerification,
  loginValidation, registerValidation 
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authLimiter }  = require('../middleware/rateLimiter');
const validate         = require('../middleware/validate');

// Public routes — apply strict rate limiter
router.post('/login',    authLimiter, loginValidation,    validate, login);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);

// Protected — requires auth token to create new users
router.post('/register', authenticate, registerValidation, validate, register);

// Protected — get current session user
router.get('/me', authenticate, getMe);

// Protected — change password
router.post('/change-password', authenticate, changePassword);

module.exports = router;
