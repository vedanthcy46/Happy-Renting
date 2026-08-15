'use strict';

const router = require('express').Router();
const { sendMessage, getEntitlement } = require('../controllers/aiController');
const { authenticate } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Tighter than the global API limiter — LLM calls are expensive.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please wait a moment before continuing.' },
});

router.use(authenticate);

router.post('/message', aiLimiter, sendMessage);
router.get('/entitlement', getEntitlement);

module.exports = router;