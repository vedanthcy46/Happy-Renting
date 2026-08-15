'use strict';

const aiService = require('../services/aiService');
const entitlementService = require('../services/entitlementService');
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
 *  - AI usage is enforced server-side via the entitlement service: Free users
 *    (owners and each tenant) get a monthly prompt allowance that is consumed
 *    here. Tenants inherit the plan of the owner they belong to.
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

    // ── Entitlement gate (server-side, cannot be bypassed from the client) ──
    const gate = await entitlementService.canUseAI(req.user, workspace);
    if (!gate.ok) {
      logger.info('[AI] Free prompt limit reached — user=' + req.user._id + ' workspace=' + workspace);
      return res.status(403).json({
        success: false,
        message: 'You have used your free AI prompts for this month.',
        code: 'AI_LIMIT_REACHED',
        entitlement: gate.entitlement,
      });
    }

    const result = await aiService.chat({
      user: req.user,
      workspace,
      language,
      history: [...history, { role: 'user', content: message }],
    });

    // Consume one prompt only after a successful reply (do not charge failed
    // requests or hard LLM outages that fell back to the offline responder).
    await entitlementService.recordAIUsage(req.user, workspace);

    return res.status(200).json({ success: true, ...result, entitlement: gate.entitlement });
  } catch (err) {
    logger.error('[AI] chat failed: ' + err.message);
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * GET /api/ai/entitlement
 * Returns the current AI entitlement (plan, used, remaining) so the mobile/web
 * UI can show "2 free prompts remaining" or the premium state without guessing.
 */
const getEntitlement = async (req, res, next) => {
  try {
    const workspace = req.query.workspace === 'owner' ? 'owner' : 'tenant';
    const entitlement = await entitlementService.getAIEntitlement(req.user, workspace);
    return res.status(200).json({ success: true, entitlement });
  } catch (err) {
    logger.error('[AI] entitlement failed: ' + err.message);
    next(err);
  }
};

module.exports = { sendMessage, getEntitlement };