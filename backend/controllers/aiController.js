'use strict';

const aiService = require('../services/aiService');
const logger    = require('../config/logger');

/**
 * POST /api/ai/message
 * Body: { message, workspace, history }
 * `history` is an array of { role: 'user'|'assistant', content } from the
 * current session. `workspace` is the active workspace ('tenant'|'owner').
 *
 * Security:
 *  - Authenticated (JWT) via route middleware.
 *  - Workspace is validated against the user's actual roles server-side, so a
 *    tenant cannot request owner tools by spoofing the field.
 *  - All tool execution is scoped to the authenticated user.
 */
const sendMessage = async (req, res, next) => {
  try {
    const message = String(req.body.message || '').trim();
    const workspace = req.body.workspace === 'owner' ? 'owner' : 'tenant';
    const history = Array.isArray(req.body.history) ? req.body.history : [];
    const language = req.body.language || req.user.preferredLanguage || 'en';

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ success: false, message: 'Message is too long.' });
    }

    const result = await aiService.chat({
      user: req.user,
      workspace,
      language,
      history: [...history, { role: 'user', content: message }],
    });

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    logger.error('[AI] chat failed: ' + err.message);
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
};

module.exports = { sendMessage };