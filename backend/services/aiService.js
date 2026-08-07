'use strict';

/**
 * aiService
 * ------------------------------------------------------------------
 * Context-aware "Property Management Copilot" for Happy Renting.
 * 1. The LLM never touches the database directly.
 * 2. The server resolves the current workspace and gives the LLM only a fixed
 *    set of "tools". The LLM picks tools; it never free-forms data access.
 * 3. Every tool is executed against the backend scoped by the authenticated
 *    user (owner isolation / tenancy) - never by what the user typed.
 * 4. Tools are filtered by the active workspace, so a tenant literally cannot
 *    request owner-only data.
 *
 * Supports two LLM providers:
 *   - "groq"   : OpenAI-compatible chat completions API (function calling).
 *   - "gemini" : Google Gemini REST API (function declarations).
 * If both GEMINI_API_KEY and GROQ_API_KEY are set, the two providers are
 * swapped at runtime based on availability: if the active provider fails with
 * a rate-limit / network / 5xx error, the request falls back to the other one.
 * Set AI_PROVIDER=gemini|groq to prefer one provider over the other.
 */

const mongoose = require('mongoose');
const logger   = require('../config/logger');

const Tenant             = require('../models/Tenant');
const Room               = require('../models/Room');
const Property           = require('../models/Property');
const MonthlyRentRecord  = require('../models/MonthlyRentRecord');
const PaymentTransaction = require('../models/PaymentTransaction');
const Complaint          = require('../models/Complaint');
const Expense            = require('../models/Expense');
const Notification       = require('../models/Notification');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const PROVIDER_ORDER = ['gemini', 'groq'];
const MAX_TOOL_ROUNDS = 6;

/* ---------- helpers ---------- */
function monthKey(date) {
  const d = date || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
// POST-PAID billing: a rent bill for a given month is generated on the 1st of
// the NEXT month. So the currently-due "current month" bill is always the
// previous calendar month (year-aware).
function billingMonthKey(date) {
  const d = date || new Date();
  let y = d.getFullYear();
  let m = d.getMonth() - 1; // 0-11 index of the previous calendar month
  if (m < 0) { m = 11; y--; }
  return y + '-' + String(m + 1).padStart(2, '0');
}
function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}
async function getPropertyIds(ownerId) {
  const props = await Property.find({ ownerId: ownerId }).select('_id').lean();
  return props.map(function (p) { return p._id; });
}

/* ---------- Tool metadata (LLM-facing). `allow` gates by workspace. ---------- */
const TOOLS = [
  {
    name: 'get_workspace_context',
    description: 'Return a compact summary of the current session: workspace, role, current month, and the scope this user is allowed to query. Use for any greeting or "what can you do" question.',
    allow: ['tenant', 'owner'],
    schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  // Tenant
  {
    name: 'get_my_tenancy',
    description: 'Return the caller profile, property, room, monthly rent, security deposit and join date. Only the caller own tenancy.',
    allow: ['tenant'],
    schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_my_current_rent',
    description: 'Return the current month rent for the caller: amount due, paid, remaining, status (paid/pending/partial/overdue/overpaid) and due date.',
    allow: ['tenant'],
    schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_my_rent_history',
    description: 'Return recent rent records (month, due, paid, remaining, status) to answer "have I paid <month>?" or receipt history questions.',
    allow: ['tenant'],
    schema: { type: 'object', properties: { months: { type: 'number' } }, additionalProperties: false },
  },
  {
    name: 'get_my_payments',
    description: 'Return the caller most recent collection receipts (amount, method, month, date, status).',
    allow: ['tenant'],
    schema: { type: 'object', properties: { limit: { type: 'number' } }, additionalProperties: false },
  },
  {
    name: 'get_my_complaints',
    description: 'Return the caller own complaints (title, category, priority, status, date).',
    allow: ['tenant'],
    schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_my_notifications',
    description: 'Return recent in-app notifications addressed to the caller.',
    allow: ['tenant'],
    schema: { type: 'object', properties: { limit: { type: 'number' } }, additionalProperties: false },
  },
  {
    name: 'raise_complaint',
    description: 'Create a maintenance complaint for the caller. Args: title, description, priority (low|medium|high|urgent), category (plumbing|electrical|appliance|cleaning|noise|pest|security|structural|other). Property, room and owner are attached automatically.',
    allow: ['tenant'],
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        category: { type: 'string', enum: ['plumbing', 'electrical', 'appliance', 'cleaning', 'noise', 'pest', 'security', 'structural', 'other'] },
      },
      required: ['title', 'description'],
      additionalProperties: false,
    },
  },
  // Owner
  {
    name: 'get_owner_metrics',
    description: 'Return the owner headline metrics: collected this month, pending rent, overdue bill count, occupancy rate and open complaints.',
    allow: ['owner'],
    schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_pending_rent',
    description: 'Return the tenants with unpaid or partial rent for the current month: name, room, property, due and remaining amounts.',
    allow: ['owner'],
    schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_property_income',
    description: 'Return income collected by each property for a month (default current) so you can tell which property earns the most.',
    allow: ['owner'],
    schema: { type: 'object', properties: { month: { type: 'string', description: 'YYYY-MM' } }, additionalProperties: false },
  },
  {
    name: 'get_owner_complaints',
    description: 'Return complaints across the owner properties, with optional status filter (pending, in-progress, resolved, rejected).',
    allow: ['owner'],
    schema: { type: 'object', properties: { status: { type: 'string' } }, additionalProperties: false },
  },
  {
    name: 'get_expenses_summary',
    description: 'Return expenses for a month (default current), grouped by category with totals.',
    allow: ['owner'],
    schema: { type: 'object', properties: { month: { type: 'string', description: 'YYYY-MM' } }, additionalProperties: false },
  },
  {
    name: 'get_active_tenants',
    description: 'Return the owner active tenants with room, property and monthly rent.',
    allow: ['owner'],
    schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_property_occupancy',
    description: 'Return each property with total rooms, occupied rooms, vacant rooms and occupancy rate.',
    allow: ['owner'],
    schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'draft_rent_reminder',
    description: 'Draft ready-to-send rent reminder messages, one per pending tenant, for the current month. Returns text only - nothing is sent.',
    allow: ['owner'],
    schema: { type: 'object', properties: {}, additionalProperties: false },
  },

  // Phase 3 - Analytics (owner)
  {
    name: 'get_revenue_trend',
    description: 'Return rent collections and pending amounts month over month for the last N months (default 6), so you can see revenue trends and compare periods.',
    allow: ['owner'],
    schema: { type: 'object', properties: { months: { type: 'number' } }, additionalProperties: false },
  },
  {
    name: 'get_monthly_report',
    description: 'Return a full summary for a given month (default current): income collected, expenses, net, number of pending tenants and amount, occupancy, new tenants, and complaint stats. Use for "monthly business report" questions.',
    allow: ['owner'],
    schema: { type: 'object', properties: { month: { type: 'string', description: 'YYYY-MM' } }, additionalProperties: false },
  },
  {
    name: 'get_vacancy_analysis',
    description: 'Return rooms that are currently vacant with the number of days they have been vacant and the last rent, so you can recommend reducing rent for long vacancies.',
    allow: ['owner'],
    schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_payment_behavior',
    description: 'Return a payment-behavior overview for each active tenant: number of paid records, overdue/late instances, and who pays on time vs late. Use for "who pays late regularly".',
    allow: ['owner'],
    schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_recommendations',
    description: 'Return data-driven recommendations for the owner based on vacancies, pending rent, occupancy and collection efficiency. Use when the user asks "what should I improve" or equivalent.',
    allow: ['owner'],
    schema: { type: 'object', properties: {}, additionalProperties: false },
  },

  // Phase 4 - Automation (owner)
  {
    name: 'send_rent_reminders',
    description: 'Send automatic rent reminders (in-app notification + push) to every tenant who still has pending rent for the current month. This really sends notifications. Returns how many reminders were sent. Ask for confirmation or be careful before calling.',
    allow: ['owner'],
    schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'send_monthly_report',
    description: 'Generate and email the monthly business report PDF to the owner for a given month (default current). The PDF includes income, expenses, net, pending rent, occupancy, new tenants and complaints. This actually emails the owner. Confirm before calling.',
    allow: ['owner'],
    schema: { type: 'object', properties: { month: { type: 'string', description: 'YYYY-MM' } }, additionalProperties: false },
  },
];

function buildSystemPrompt(user, workspace, language) {
  const scope = workspace === 'owner'
    ? 'You are the analytical copilot for the OWNER workspace of Happy Renting, a property management app. You understand the owner properties, tenants, income, expenses, complaints, occupancy and collections. You answer business questions, produce summaries and draft reminders.'
    : 'You are the copilot for a TENANT on Happy Renting, a property management app. You help the tenant understand their own rent, due dates, receipts, payments, complaints and notifications - always about their own tenancy only.';
  const langName = (function () {
    const map = { en: 'English', kn: 'Kannada (ಕನ್ನಡ)', hi: 'Hindi (हिन्दी)', ta: 'Tamil (தமிழ்)', te: 'Telugu (తెలుగు)', ml: 'Malayalam (മലയാളം)' };
    return map[language] || 'English';
  })();
  return [
    scope,
    '',
    'CURRENT WORKSPACE: ' + workspace.toUpperCase() + ' (roles: ' + (user.roles || [user.role]).join(', ') + ')',
    'TODAY (calendar month): ' + monthKey(),
    'CURRENT BILLING PERIOD: ' + billingMonthKey(),
    '',
    'LANGUAGE: Respond to the user in ' + langName + '. Always reply in the same language the user writes in, preferring this language. Keep numbers as they are and keep property names, room numbers and addresses untranslated.',
    '',
    'BILLING MODE: This app uses POST-PAID billing. A rent bill for a month is generated on the 1st of the NEXT month. So the bill that is currently due (the "current month" rent) is always for the PREVIOUS calendar month, e.g. on ' + fmtDate(new Date()) + ' the due bill is for month "' + billingMonthKey() + '". When a user asks "have I paid rent this month", interpret "this month" as the CURRENT BILLING PERIOD, not the calendar month today.',
    '',
    'You are a context-aware copilot, not a generic chatbot. Rules:',
    '1. Only answer using the data returned by the tools you call. Never invent amounts, dates, statuses, names or URLs.',
    '2. For each question pick the ONE best tool, call it via function calling, then explain the result concisely.',
    '3. Lead with the key figure (a short framed line or bold), then a brief human explanation. Currency in Rupees, e.g. Rs.12,000.',
    '4. If a tool returns no data, say so honestly and suggest one next step.',
    '5. If the user asks for data outside the tools available in this workspace, politely say it is not available in the current workspace and suggest what they can do instead.',
    '6. When you performed an action (e.g. raised a complaint), confirm what was registered and what happens next. Never claim something was sent unless the tool result says so.',
    '7. Keep answers concise but complete. A little markdown bold is fine.',
    '8. Before calling an ACTION tool that sends anything (e.g. send_rent_reminders), first confirm with the user what you are about to do and how many recipients it affects. Never fire a send tool without an explicit user request.',
  ].join('\n');
}

/* ---------- Tool Executor (every result scoped by the authenticated user) ---------- */
async function executor(toolName, args, ctx) {
  const { user, owner, tenant } = ctx;
  const oid = owner && /^[a-f\d]{24}$/i.test(String(owner))
    ? new mongoose.Types.ObjectId(owner)
    : null;

  switch (toolName) {
    case 'get_workspace_context': {
      return {
        workspace: owner ? 'owner' : 'tenant',
        role: user.role,
        roles: user.roles,
        currentMonth: billingMonthKey(),
        calendarMonth: monthKey(),
        billingMode: 'postpaid',
        scope: owner ? 'ownerId=' + owner : 'tenantId=' + (tenant ? String(tenant._id) : 'none'),
      };
    }

    // tenant
    case 'get_my_tenancy': {
      if (!tenant) return { found: false };
      const t = await Tenant.findById(tenant._id)
        .populate('roomId', 'roomNumber floor monthlyRent securityDeposit')
        .populate('propertyId', 'name address city')
        .lean();
      return {
        found: true,
        property: t.propertyId ? { name: t.propertyId.name, address: t.propertyId.address } : null,
        room: t.roomId ? { number: t.roomId.roomNumber, monthlyRent: t.roomId.monthlyRent, deposit: t.roomId.securityDeposit } : null,
        joinDate: fmtDate(tenant.joinDate),
        status: tenant.status,
      };
    }

    case 'get_my_current_rent': {
      if (!tenant) return { found: false };
      const billingMonth = billingMonthKey();
      const rec = await MonthlyRentRecord.findOne({ tenantId: tenant._id, month: billingMonth }).lean();
      if (!rec) return { found: false, message: 'No rent record generated yet for ' + billingMonth + '.' };
      return {
        found: true,
        billingPeriod: billingMonth,
        month: rec.month,
        due: rec.totalRent,
        paid: rec.totalPaid,
        remaining: rec.remainingAmount,
        status: rec.status,
        dueDate: fmtDate(rec.dueDate),
        paidOn: fmtDate(rec.paidOnDate),
      };
    }

    case 'get_my_rent_history': {
      if (!tenant) return { found: false };
      const n = Math.min(Math.max(Number(args.months) || 6, 1), 24);
      const recs = await MonthlyRentRecord.find({ tenantId: tenant._id }).sort({ month: -1 }).limit(n)
        .select('month totalRent totalPaid remainingAmount status paidOnDate').lean();
      return {
        found: recs.length > 0,
        currentMonth: billingMonthKey(),
        records: recs.map(function (r) {
          return { month: r.month, due: r.totalRent, paid: r.totalPaid, remaining: r.remainingAmount, status: r.status, paidOn: fmtDate(r.paidOnDate) };
        }),
      };
    }

    case 'get_my_payments': {
      if (!tenant) return { found: false };
      const n = Math.min(Math.max(Number(args.limit) || 10, 1), 50);
      const txns = await PaymentTransaction.find({ tenantId: tenant._id }).sort({ paymentDate: -1 }).limit(n)
        .select('amount paymentMethod paymentDate status').lean();
      return {
        found: txns.length > 0,
        receipts: txns.map(function (t) {
          return { amount: t.amount, method: t.paymentMethod, date: fmtDate(t.paymentDate), status: t.status };
        }),
      };
    }

    case 'get_my_complaints': {
      if (!tenant) return { found: false };
      const list = await Complaint.find({ tenantId: tenant._id }).sort({ createdAt: -1 })
        .select('title category priority status createdAt').lean();
      return {
        found: list.length > 0,
        complaints: list.map(function (c) {
          return { title: c.title, category: c.category, priority: c.priority, status: c.status, date: fmtDate(c.createdAt) };
        }),
      };
    }

    case 'get_my_notifications': {
      const n = Math.min(Math.max(Number(args.limit) || 5, 1), 20);
      const list = await Notification.find({ userId: user._id }).sort({ createdAt: -1 }).limit(n)
        .select('title message read createdAt').lean();
      return {
        found: list.length > 0,
        notifications: list.map(function (n) {
          return { title: n.title, message: n.message, read: n.read, date: fmtDate(n.createdAt) };
        }),
      };
    }

    case 'raise_complaint': {
      if (!tenant) return { error: 'Not an active tenancy for this user.', executed: false };
      const active = await Tenant.findOne({ userId: user._id, status: 'active' }).lean();
      if (!active) return { error: 'You must be an active tenant to raise a complaint.', executed: false };
      const complaint = await Complaint.create({
        title: String(args.title || '').trim(),
        description: String(args.description || '').trim(),
        priority: args.priority || 'medium',
        category: args.category || 'other',
        tenantId: active._id,
        ownerId: active.ownerId,
        propertyId: active.propertyId,
        roomId: active.roomId,
      });
      try {
        const notificationService = require('./notificationService');
        notificationService.sendPushNotification({
          userId: active.ownerId, i18nKey: 'complaint.new.title', i18nBodyKey: 'complaint.new.body',
          i18nVars: { title: complaint.title },
          type: 'complaint_raised', data: { complaintId: complaint._id },
        }).catch(function () {});
      } catch (e) { logger.error('[AI] owner push failed: ' + e.message); }
      logger.info('[AI COMPLAINT] id=' + complaint._id + ' tenant=' + active._id);
      return { success: true, complaintId: String(complaint._id), title: complaint.title, status: 'pending', message: 'Complaint registered successfully.' };
    }

    // owner
    case 'get_owner_metrics': {
      if (!oid) return { error: 'No owner context.' };
      const cur = billingMonthKey();
      const records = await MonthlyRentRecord.find({ ownerId: oid, month: cur }).select('totalRent totalPaid remainingAmount status').lean();
      const pending = records.filter(function (r) { return r.remainingAmount > 0; });
      const collectedAgg = await PaymentTransaction.aggregate([
        { $match: { ownerId: oid, status: 'completed', amount: { $gt: 0 }, paymentDate: { $gte: startOfMonth() } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      const propertyIds = await getPropertyIds(owner);
      const occAgg = await Room.aggregate([
        { $match: { propertyId: { $in: propertyIds }, isActive: true } },
        { $group: { _id: null, total: { $sum: 1 }, occupied: { $sum: { $cond: [{ $gt: ['$currentOccupancy', 0] }, 1, 0] } } } },
      ]);
      const occ = occAgg[0] || { total: 0, occupied: 0 };
      const occupancyRate = occ.total > 0 ? Number(((occ.occupied / occ.total) * 100).toFixed(1)) : 0;
      const openComplaints = await Complaint.countDocuments({ propertyId: { $in: propertyIds }, status: { $in: ['open', 'in_progress', 'pending', 'in-progress'] } });
      return {
        month: cur,
        collectedThisMonth: collectedAgg[0] ? collectedAgg[0].total : 0,
        pendingRent: pending.reduce(function (a, r) { return a + r.remainingAmount; }, 0),
        pendingTenants: pending.length,
        overdue: records.filter(function (r) { return r.status === 'overdue'; }).length,
        occupancy: { occupiedRooms: occ.occupied, totalRooms: occ.total, occupancyRate: occupancyRate },
        openComplaints: openComplaints,
      };
    }

    case 'get_pending_rent': {
      if (!oid) return { error: 'No owner context.' };
      const cur = billingMonthKey();
      const recs = await MonthlyRentRecord.find({ ownerId: oid, month: cur, remainingAmount: { $gt: 0 } }).lean();
      const rows = [];
      for (const r of recs) {
        var t = await Tenant.findById(r.tenantId).populate({ path: 'userId', select: 'name' })
          .populate({ path: 'roomId', select: 'roomNumber' })
          .populate({ path: 'propertyId', select: 'name' }).lean();
        rows.push({
          tenantName: t && t.userId ? t.userId.name : 'Unknown',
          room: t && t.roomId ? t.roomId.roomNumber : null,
          property: t && t.propertyId ? t.propertyId.name : null,
          due: r.totalRent,
          remaining: r.remainingAmount,
          status: r.status,
        });
      }
      return { month: cur, count: rows.length, tenants: rows };
    }

    case 'get_property_income': {
      if (!oid) return { error: 'No owner context.' };
      const targetMonth = args.month || billingMonthKey();
      const [y, m] = targetMonth.split('-').map(Number);
      const rangeStart = new Date(y, m - 1, 1);
      const rangeEnd = new Date(y, m, 1);
      const agg = await PaymentTransaction.aggregate([
        { $match: { ownerId: oid, status: 'completed', amount: { $gt: 0 }, paymentDate: { $gte: rangeStart, $lt: rangeEnd } } },
        { $group: { _id: '$propertyId', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
      ]);
      const out = [];
      for (const row of agg) {
        const p = await Property.findById(row._id).select('name').lean();
        out.push({ property: p ? p.name : 'Unknown', income: row.total });
      }
      return { month: targetMonth, total: out.reduce(function (a, r) { return a + r.income; }, 0), properties: out };
    }

    case 'get_owner_complaints': {
      if (!oid) return { error: 'No owner context.' };
      const propertyIds = await getPropertyIds(owner);
      const filter = { propertyId: { $in: propertyIds } };
      if (args.status) filter.status = args.status;
      const list = await Complaint.find(filter).sort({ createdAt: -1 }).limit(50)
        .populate({ path: 'propertyId', select: 'name' })
        .populate({ path: 'roomId', select: 'roomNumber' })
        .populate({ path: 'tenantId', select: 'userId', populate: { path: 'userId', select: 'name' } })
        .lean();
      return {
        count: list.length,
        complaints: list.map(function (c) {
          return { title: c.title, status: c.status, priority: c.priority, tenant: c.tenantId ? c.tenantId.userId : null, property: c.propertyId ? c.propertyId.name : null, room: c.roomId ? c.roomId.roomNumber : null, date: fmtDate(c.createdAt) };
        }),
      };
    }

    case 'get_expenses_summary': {
      if (!oid) return { ok: 'No owner context.' };
      const targetMonth = args.month || billingMonthKey();
      const agg = await Expense.aggregate([
        { $match: { ownerId: oid, month: targetMonth } },
        { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]);
      const total = agg.reduce(function (a, r) { return a + r.total; }, 0);
      return {
        month: targetMonth,
        total: total,
        byCategory: agg.map(function (r) { return { category: r._id, total: r.total, count: r.count }; }),
      };
    }

    case 'get_active_tenants': {
      if (!oid) return { ok: 'No owner context.' };
      const list = await Tenant.find({ ownerId: oid, status: 'active' })
        .populate('roomId', 'roomNumber monthlyRent')
        .populate('propertyId', 'name')
        .populate({ path: 'userId', select: 'name' })
        .lean();
      return {
        count: list.length,
        tenants: list.map(function (t) {
          return { name: t.userId ? t.userId.name : null, room: t.roomId ? t.roomId.roomNumber : null, property: t.propertyId ? t.propertyId.name : null, rent: t.roomId ? t.roomId.monthlyRent : null };
        }),
      };
    }

    case 'get_property_occupancy': {
      if (!oid) return { ok: 'No owner context.' };
      const propertyIds = await getPropertyIds(owner);
      const props = await Property.find({ _id: { $in: propertyIds } }).select('name').lean();
      const rooms = await Room.find({ propertyId: { $in: propertyIds }, isActive: true })
        .select('propertyId currentOccupancy').lean();
      return {
        properties: props.map(function (p) {
          const r = rooms.filter(function (x) { return String(x.propertyId) === String(p._id); });
          const total = r.length;
          const occupied = r.filter(function (x) { return x.currentOccupancy > 0; }).length;
          return { property: p.name, totalRooms: total, occupied: occupied, vacantRooms: total - occupied, occupancyRate: total ? Number(((occupied / total) * 100).toFixed(1)) : 0 };
        }),
      };
    }

    case 'draft_rent_reminder': {
      if (!oid) return { ok: 'No owner context.' };
      const cur = billingMonthKey();
      const recs = await MonthlyRentRecord.find({ ownerId: oid, month: cur, remainingAmount: { $gt: 0 } }).lean();
      const messages = [];
      for (const r of recs) {
        var t = await Tenant.findById(r.tenantId)
          .populate({ path: 'userId', select: 'name phone' })
          .populate({ path: 'roomId', select: 'roomNumber' })
          .lean();
        const name = t && t.userId ? t.userId.name : 'Tenant';
        const roomNum = t && t.roomId ? t.roomId.roomNumber : '';
        const text = 'Dear ' + name + ' (Room ' + roomNum + '), your rent for ' + cur + ' of Rs.' + r.remainingAmount + ' is still pending. Kindly pay at the earliest. - Happy Renting';
        const phone = (t && t.userId && t.userId.phone) ? t.userId.phone : (t && t.phone ? t.phone : '');
        const waLink = phone ? 'https://wa.me/' + phone.replace(/\D/g, '') + '?text=' + encodeURIComponent(text) : null;
        messages.push({ tenantName: name, room: roomNum, remaining: r.remainingAmount, message: text, waLink: waLink });
      }
      return { month: cur, count: messages.length, messages: messages };
    }

    /* ── Phase 3: Analytics ─────────────────────────────────── */
    case 'get_revenue_trend': {
      if (!oid) return { error: 'No owner context.' };
      const n = Math.min(Math.max(Number(args.months) || 6, 2), 12);
      const rows = [];
      // Base the trend on the post-paid BILLING period (previous calendar month).
      const base = new Date();
      base.setMonth(base.getMonth() - 1);
      const curY = base.getFullYear(), curM = base.getMonth();
      for (let i = n - 1; i >= 0; i--) {
        const d = new Date(curY, curM - i, 1);
        const mKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const collectedAgg = await PaymentTransaction.aggregate([
          { $match: { ownerId: oid, status: 'completed', amount: { $gt: 0 }, paymentDate: { $gte: start, $lt: end } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        const pendingRecords = await MonthlyRentRecord.find({ ownerId: oid, month: mKey, remainingAmount: { $gt: 0 } })
          .select('remainingAmount').lean();
        const pending = pendingRecords.reduce(function (a, r) { return a + r.remainingAmount; }, 0);
        rows.push({
          month: mKey,
          collected: collectedAgg[0] ? collectedAgg[0].total : 0,
          pending: pending,
          pendingTenants: pendingRecords.length,
        });
      }
      return { months: rows };
    }

    case 'get_monthly_report': {
      if (!oid) return { ok: 'No owner context.' };
      const m = args.month || billingMonthKey();
      const [y, mo] = m.split('-').map(Number);
      const start = new Date(y, mo - 1, 1);
      const end = new Date(y, mo, 1);

      const incomeAgg = await PaymentTransaction.aggregate([
        { $match: { ownerId: oid, status: 'completed', amount: { $gt: 0 }, paymentDate: { $gte: start, $lt: end } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      const income = incomeAgg[0] ? incomeAgg[0].total : 0;

      const expenseAgg = await Expense.aggregate([
        { $match: { ownerId: oid, month: m } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      const expenses = expenseAgg[0] ? expenseAgg[0].total : 0;

      const records = await MonthlyRentRecord.find({ ownerId: oid, month: m }).select('remainingAmount status').lean();
      const pendingList = records.filter(function (r) { return r.remainingAmount > 0; });
      const pending = pendingList.reduce(function (a, r) { return a + r.remainingAmount; }, 0);

      const newTenants = await Tenant.countDocuments({ ownerId: oid, joinDate: { $gte: start, $lt: end } });

      const propertyIds = await getPropertyIds(owner);
      const occAgg = await Room.aggregate([
        { $match: { propertyId: { $in: propertyIds }, isActive: true } },
        { $group: { _id: null, total: { $sum: 1 }, occupied: { $sum: { $cond: [{ $gt: ['$currentOccupancy', 0] }, 1, 0] } } } },
      ]);
      const occ = occAgg[0] || { total: 0, occupied: 0 };
      const occupancyRate = occ.total > 0 ? Number(((occ.occupied / occ.total) * 100).toFixed(1)) : 0;

      const complaints = await Complaint.find({ propertyId: { $in: propertyIds }, createdAt: { $gte: start, $lt: end } })
        .select('status').lean();
      const open = complaints.filter(function (c) { return c.status !== 'resolved' && c.status !== 'rejected'; }).length;

      return {
        month: m,
        income: income,
        expenses: expenses,
        net: income - expenses,
        pendingRent: pending,
        pendingTenants: pendingList.length,
        fullyPaid: records.length - pendingList.length,
        occupancyRate: occupancyRate,
        occupiedRooms: occ.occupied,
        totalRooms: occ.total,
        newTenants: newTenants,
        complaintsRaised: complaints.length,
        complaintsOpen: open,
      };
    }

    case 'get_vacancy_analysis': {
      if (!oid) return { ok: 'No owner context.' };
      const propertyIds = await getPropertyIds(owner);
      const props = await Property.find({ _id: { $in: propertyIds } }).select('name').lean();
      const rooms = await Room.find({ propertyId: { $in: propertyIds }, isActive: true })
        .select('propertyId currentOccupancy monthlyRent roomNumber').lean();
      // most recent tenant exit / rent record per room to estimate days vacant
      const TODAY = Date.now();
      const vacant = [];
      for (const room of rooms) {
        if (room.currentOccupancy > 0) continue;
        const lastTenant = await Tenant.findOne({ roomId: room._id, status: 'vacated' })
          .sort({ exitDate: -1 }).select('exitDate').lean();
        const lastRent = await MonthlyRentRecord.findOne({ roomId: room._id }).sort({ month: -1 }).select('month totalRent').lean();
        let vacantDays = null;
        if (lastTenant && lastTenant.exitDate) {
          vacantDays = Math.max(0, Math.floor((TODAY - new Date(lastTenant.exitDate).getTime()) / 86400000));
        }
        const prop = props.find(function (p) { return String(p._id) === String(room.propertyId); });
        vacant.push({
          property: prop ? prop.name : 'Unknown',
          room: room.roomNumber,
          monthlyRent: lastRent ? lastRent.totalRent : room.monthlyRent,
          vacantDays: vacantDays,
          lastMonths: lastRent ? lastRent.month : null,
        });
      }
      return {
        count: vacant.length,
        recommendation: 'Consider reducing rent or improving listing for rooms vacant > 60 days.',
        vacant: vacant,
      };
    }

    case 'get_payment_behavior': {
      if (!oid) return { ok: 'No owner context.' };
      const tenants = await Tenant.find({ ownerId: oid, status: 'active' })
        .populate({ path: 'userId', select: 'name' })
        .populate({ path: 'roomId', select: 'roomNumber' })
        .lean();
      const out = [];
      for (const t of tenants) {
        const recs = await MonthlyRentRecord.find({ tenantId: t._id }).select('status remainingAmount month').lean();
        const paid = recs.filter(function (r) { return r.status === 'paid'; }).length;
        const late = recs.filter(function (r) { return r.status === 'overdue'; }).length;
        const pending = recs.filter(function (r) { return r.remainingAmount > 0; }).length;
        out.push({
          tenant: t.userId ? t.userId.name : 'Unknown',
          room: t.roomId ? t.roomId.roomNumber : null,
          records: recs.length,
          paidOnTime: paid,
          lateOrOverdue: late,
          hasPending: pending > 0,
          onTimePct: recs.length ? Number(((paid / recs.length) * 100).toFixed(0)) : 0,
        });
      }
      return { count: out.length, tenants: out };
    }

    case 'get_recommendations': {
      if (!oid) return { ok: 'No owner context.' };
      const recs = [];
      // Vacancy
      const propertyIds = await getPropertyIds(owner);
      const rooms = await Room.find({ propertyId: { $in: propertyIds }, isActive: true })
        .select('propertyId currentOccupancy roomNumber monthlyRent').lean();
      const vacantLong = [];
      for (const room of rooms) {
        if (room.currentOccupancy > 0) continue;
        const lastTenant = await Tenant.findOne({ roomId: room._id, status: 'vacated' })
          .sort({ exitDate: -1 }).select('exitDate').lean();
        const days = lastTenant && lastTenant.exitDate
          ? Math.max(0, Math.floor((Date.now() - new Date(lastTenant.exitDate).getTime()) / 86400000)) : null;
        if (days !== null && days >= 60) vacantLong.push({ room: room.roomNumber, days: days });
      }
      if (vacantLong.length) recs.push({ priority: 'high', topic: 'Vacancy', recommendation: vacantLong.length + ' room(s) have been vacant for 60+ days. Consider reducing rent by ~5% or improving the listing.', detail: vacantLong });

      // Pending rent
      const cur = billingMonthKey();
      const pendingCount = await MonthlyRentRecord.countDocuments({ ownerId: oid, month: cur, remainingAmount: { $gt: 0 } });
      if (pendingCount > 0) recs.push({ priority: 'medium', topic: 'Collections', recommendation: pendingCount + ' tenant(s) still owe rent for ' + cur + '. Send reminders to recover pending rent faster.' });

      return { recommendationList: recs };
    }

    /* ── Phase 4: Automation ────────────────────────────────── */
    case 'send_rent_reminders': {
      if (!oid) return { ok: 'No owner context.' };
      const cur = billingMonthKey();
      const recs = await MonthlyRentRecord.find({ ownerId: oid, month: cur, remainingAmount: { $gt: 0 } })
        .populate({ path: 'tenantId', select: 'userId' }).lean();
      const sent = [];
      for (const r of recs) {
        const t = r.tenantId;
        const userId = t && t.userId ? t.userId : null;
        if (!userId) continue;
        try {
          const notificationService = require('./notificationService');
          await notificationService.sendPushNotification({
            userId: userId,
            i18nKey: 'reminder.rentReminder.title',
            i18nBodyKey: 'reminder.rentReminder.body',
            i18nVars: { amount: r.remainingAmount, month: r.month },
            type: 'rent_reminder',
            data: { rentRecordId: String(r._id), month: r.month },
          });
          sent.push({ tenantId: String(userId), amount: r.remainingAmount });
        } catch (e) {
          logger.error('[AI] reminder send failed for ' + userId + ': ' + e.message);
        }
      }
      logger.info('[AI AUTOMATION] Rent reminders sent to ' + sent.length + ' tenant(s).');
      return { month: cur, sent: sent.length, details: sent.length > 0 ? sent : [] };
    }

    case 'send_monthly_report': {
      if (!oid) return { error: 'No owner context.' };
      const m = args.month || billingMonthKey();
      const monthlyReportService = require('./monthlyReportService');
      const res = await monthlyReportService.emailMonthlyReport(owner, m);
      return { month: m, emailedTo: res.emailedTo || null, skipped: res.skipped || null };
    }

    default:
      return { error: 'Tool "' + toolName + '" not implemented.' };
  }
}

/* -------------------- pipeline helpers -------------------- */
function allowedToolsFor(workspace) {
  return TOOLS.filter(function (t) { return t.allow.indexOf(workspace) !== -1; });
}
function toolSchemas(list) {
  return list.map(function (t) {
    return {
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: {
          type: 'object',
          properties: t.schema.properties || {},
          required: t.schema.required || [],
          additionalProperties: false,
        },
      },
    };
  });
}

async function groqChat(messages, tools) {
  const payload = { model: GROQ_MODEL, messages: messages, temperature: 0.3, max_tokens: 1024 };
  if (tools && tools.length) payload.tools = tools;
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.GROQ_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    logger.error('[AI] Groq error ' + res.status + ': ' + text);
    const err = new Error('The AI service is temporarily unavailable.');
    err.statusCode = res.status || 502;
    throw err;
  }
  const data = text ? JSON.parse(text) : {};
  const choice = data.choices && data.choices[0];
  const msg = choice && choice.message;
  return {
    content: msg && msg.content ? msg.content : null,
    tool_calls: (msg && msg.tool_calls) || [],
  };
}

/* ---------- Gemini (Google) provider ---------- */

function jsonInterp(v) {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (e) { return {}; }
}

// OpenAPI-style schemas (used by OpenAI/Groq) contain keys that the Gemini
// function declaration format does not recognise (e.g. "additionalProperties").
// Recursively strip the unsupported keys so the payload validates.
function sanitizeGeminiSchema(node) {
  if (Array.isArray(node)) return node.map(sanitizeGeminiSchema);
  if (node && typeof node === 'object') {
    const out = {};
    for (const key of Object.keys(node)) {
      if (key === 'additionalProperties') continue;
      if (key === 'required' && Array.isArray(node[key]) && node[key].length === 0) continue;
      out[key] = sanitizeGeminiSchema(node[key]);
    }
    return out;
  }
  return node;
}

// Convert the normalized OpenAI-style message list into Gemini contents.
// System messages become the systemInstruction; tool results become
// functionResponse parts (role "user"); assistant function calls become
// functionCall parts (role "model").
function toGeminiContents(messages) {
  const contents = [];
  for (const m of messages) {
    if (!m || m.role === 'system') continue;

    if (m.role === 'tool') {
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: m.name || 'unknown_tool', response: jsonInterp(m.content) } }],
      });
      continue;
    }

    if (m.role === 'assistant') {
      const parts = [];
      if (m.content) parts.push({ text: m.content });
      for (const tc of (m.tool_calls || [])) {
        if (tc.function) {
          parts.push({ functionCall: { name: tc.function.name, args: jsonInterp(tc.function.arguments) } });
        }
      }
      if (parts.length) contents.push({ role: 'model', parts: parts });
      continue;
    }

    if (m.content) contents.push({ role: 'user', parts: [{ text: m.content }] });
  }
  return contents;
}

async function geminiChat(messages, schemas) {
  const body = {
    contents: toGeminiContents(messages),
    generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
  };

  const system = messages.find(function (m) { return m.role === 'system'; });
  if (system && system.content) {
    body.systemInstruction = { parts: [{ text: system.content }] };
  }

  if (schemas && schemas.length) {
    body.tools = [{
      functionDeclarations: schemas.map(function (s) {
        return {
          name: s.function.name,
          description: s.function.description,
          parameters: sanitizeGeminiSchema(s.function.parameters),
        };
      }),
    }];
  }

  const url = GEMINI_API_URL + '/' + encodeURIComponent(GEMINI_MODEL)
    + ':generateContent?key=' + encodeURIComponent(process.env.GEMINI_API_KEY);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    logger.error('[AI] Gemini error ' + res.status + ': ' + text);
    const err = new Error('The AI service is temporarily unavailable.');
    err.statusCode = res.status || 502;
    throw err;
  }

  const data = text ? JSON.parse(text) : {};
  const candidate = data.candidates && data.candidates[0];
  const content = candidate && candidate.content;
  if (!content) return { content: null, tool_calls: [] };

  let outText = null;
  const tool_calls = [];
  for (const p of (content.parts || [])) {
    if (p.functionCall) {
      tool_calls.push({
        id: 'call_' + Math.random().toString(36).slice(2, 12),
        type: 'function',
        function: {
          name: p.functionCall.name,
          arguments: p.functionCall.args ? JSON.stringify(p.functionCall.args) : '{}',
        },
      });
    } else if (p.text) {
      outText = outText === null ? p.text : outText + p.text;
    }
  }
  return { content: outText, tool_calls: tool_calls };
}

/* ---------- provider selection & fallback ---------- */

function providerModel(provider) {
  return provider === 'gemini' ? GEMINI_MODEL : GROQ_MODEL;
}

// Which providers are configured (with keys), preferred provider first.
function enabledProviderOrder() {
  const preferred = String(process.env.AI_PROVIDER || '').trim().toLowerCase();
  const order = PROVIDER_ORDER.slice();
  if (preferred === 'gemini' || preferred === 'groq') {
    order.sort(function (a, b) {
      if (a === preferred) return -1;
      if (b === preferred) return 1;
      return 0;
    });
  }
  return order.filter(function (p) {
    return p === 'gemini' ? !!process.env.GEMINI_API_KEY : !!process.env.GROQ_API_KEY;
  });
}

function isRetriable(err) {
  const s = err.statusCode || err.status || 0;
  if (s === 429 || (s >= 500 && s <= 599)) return true;
  if (err.isNetwork) return true;
  return false;
}

async function chatWithProvider(provider, messages, schemas) {
  if (provider === 'gemini') return geminiChat(messages, schemas);
  return groqChat(messages, schemas);
}

// Call the active provider, falling back to the next configured provider when
// the request fails with a rate-limit / network / 5xx error.
async function chatWithFallback(messages, schemas) {
  const providers = enabledProviderOrder();
  let lastErr = null;
  for (const provider of providers) {
    try {
      const msg = await chatWithProvider(provider, messages, schemas);
      return { msg: msg, provider: provider };
    } catch (err) {
      lastErr = err;
      logger.warn('[AI] provider "' + provider + '" failed (' + (err.statusCode || err.status || 'network') + '): ' + err.message + ' - falling back.');
      if (!isRetriable(err)) throw err;
    }
  }
  const err = lastErr || new Error('All AI providers are currently unavailable.');
  err.statusCode = 503;
  throw err;
}

/* ---------- offline (rule-based) responder ----------
 * Used when every AI provider is unavailable (rate-limited, unreachable, or no
 * key is configured). It answers common questions directly from the user's own
 * data by calling the same workspace-scoped executor. It NEVER sends anything
 * and NEVER writes to the database - it is read-only and safe to run. */
async function offlineRespondent(workspace, user, tenant, owner, text) {
  const t = String(text || '').toLowerCase();
  const offlineNote = '\n\n_AI providers are temporarily unreachable, so this is read directly from your account._';
  const run = async (tool, args) => {
    try { return await executor(tool, args || {}, { user: user, owner: owner, tenant: tenant }); }
    catch (e) { logger.error('[AI] offline tool ' + tool + ' failed: ' + e.message); return { error: 'Could not read your data right now.' }; }
  };

  // Blocked action intents: never auto-fire anything while offline.
  if (/(send|fire)\b/.test(t) && /remind/.test(t)) {
    return 'I cannot send rent reminders right now because all AI providers are temporarily unreachable, and I never send anything without confirmation anyway. Retry in a moment or send reminders manually from the app.' + offlineNote;
  }
  if (/(send|email|mail)\b/.test(t) && /report/.test(t)) {
    return 'I cannot email the monthly report right now because all AI providers are temporarily unreachable. Retry in a moment when the assistant is back online.' + offlineNote;
  }
  if (/(raise|file|new|create|register)\b/.test(t) && /(complaint|request|issue|repair)/.test(t)) {
    return 'I can only raise complaints through the live assistant, which is temporarily unreachable. Please use the Complaints screen in the app, or retry shortly.' + offlineNote;
  }

  if (/(what can you do|capabilities|who are you|how (do|does) you work|assist|hello|hi\b|hey\b)/.test(t)) {
    if (workspace === 'owner') {
      return [
        '**Here\u2019s how I can help you right now (owner):**',
        '• Business overview: collections, pending rent, occupancy.',
        '• Who owes rent this month and how much.',
        '• Complaints, expenses, tenants and occupancy/vacancy.',
        '• Revenue trends, monthly reports and recommendations.',
        '',
      ].join('\n') + offlineNote;
    }
    return [
      '**Here\u2019s how I can help you right now (tenant):**',
      '• Current rent: how much you owe and its status.',
      '• Payment history and receipts.',
      '• Your complaints and their status.',
      '• Your room, tenancy and deposit details.',
      '• Recent notifications.',
      '',
    ].join('\n') + offlineNote;
  }

  let tool = null;
  let args = {};
  const intents = (workspace === 'owner')
    ? [
        [/overview|summary|metrics|dashboard|how am i|headline|collect|pending rent/i, 'get_owner_metrics', {}],
        [/owes|pending|unpaid|not paid|outstanding/i, 'get_pending_rent', {}],
        [/remind|draft/i, 'draft_rent_reminder', {}],
        [/complaint/i, 'get_owner_complaints', {}],
        [/expense|spend|cost/i, 'get_expenses_summary', {}],
        [/vacan|empty room|long empty/i, 'get_vacancy_analysis', {}],
        [/occup/i, 'get_property_occupancy', {}],
        [/trend|month over month/i, 'get_revenue_trend', {}],
        [/report|monthly|statement/i, 'get_monthly_report', {}],
        [/late|on time|behavior|pays/i, 'get_payment_behavior', {}],
        [/improve|recommend|suggest|should i/i, 'get_recommendations', {}],
        [/which property|income|earning|collected/i, 'get_property_income', {}],
        [/tenant|who are my/i, 'get_active_tenants', {}],
        [/overview|summary|metrics|dashboard|how am i|headline/i, 'get_owner_metrics', {}],
      ]
    : [
        [/rent|pay|amount|due|paid|bill|balance/i, 'get_my_current_rent', {}],
        [/history|receipt|record|months/i, 'get_my_rent_history', {}],
        [/payment/i, 'get_my_payments', { limit: 5 }],
        [/complaint|request|issue/i, 'get_my_complaints', {}],
        [/notification/i, 'get_my_notifications', { limit: 5 }],
        [/room|tenancy|deposit|property/i, 'get_my_tenancy', {}],
        [/rent|get|status|current/i, 'get_my_current_rent', {}],
      ];

  for (const [re, name, a] of intents) {
    if (re.test(t)) { tool = name; args = a || {}; break; }
  }
  if (!tool) tool = workspace === 'owner' ? 'get_owner_metrics' : 'get_my_current_rent';

  const data = await run(tool, args);
  const d = data || {};
  const money = (n) => (Number(n) || 0).toLocaleString('en-IN');
  const pct = (n) => (isNaN(Number(n)) ? 0 : Number(n)) + '%';

  let body = '';
  switch (tool) {
    case 'get_owner_metrics':
      body = [
        '**Business overview (' + d.month + '):**',
        '• Collected this month: **Rs.' + money(d.collectedThisMonth) + '**',
        '• Pending rent: **Rs.' + money(d.pendingRent) + '** across ' + (d.pendingTenants || 0) + ' tenant(s).',
        '• Overdue bills: ' + (d.overdue || 0),
        '• Occupancy: ' + pct(d.occupancy && d.occupancy.occupancyRate) + ' (' + (d.occupancy ? d.occupancy.occupiedRooms : 0) + '/' + (d.occupancy ? d.occupancy.totalRooms : 0) + ' rooms).',
        '• Open complaints: ' + (d.openComplaints || 0),
      ].join('\n');
      break;
    case 'get_pending_rent':
      body = (d.tenants && d.tenants.length)
        ? '**' + d.count + ' tenant(s) owe rent for ' + d.month + ':**\n' + d.tenants.map(function (x) {
          return '• ' + (x.tenantName || 'Unknown') + (x.room ? ' (Room ' + x.room + ')' : '') + ' — ' + 'Rs.' + money(x.remaining) + ' of Rs.' + money(x.due);
        }).join('\n')
        : '**No pending rent** for ' + d.month + '. Everyone has paid.';
      break;
    case 'get_property_income':
      body = (d.properties && d.properties.length)
        ? '**Income by property (' + d.month + '), total Rs.' + money(d.total) + ':**\n' + d.properties.map(function (x) {
          return '• ' + x.property + ': **Rs.' + money(x.income) + '**';
        }).join('\n')
        : 'No completed payments recorded for ' + d.month + '.';
      break;
    case 'get_owner_complaints':
      body = (d.complaints && d.complaints.length)
        ? '**' + d.count + ' complaint(s):**\n' + d.complaints.map(function (x) {
          return '• ' + x.title + ' — ' + (x.status || '') + (x.priority ? ' (' + x.priority + ')' : '');
        }).join('\n')
        : 'No complaints match that.';
      break;
    case 'get_expenses_summary':
      body = (d.byCategory && d.byCategory.length)
        ? '**Expenses for ' + d.month + ', total Rs.' + money(d.total) + ':**\n' + d.byCategory.map(function (x) {
          return '• ' + x.category + ': Rs.' + money(x.total) + ' (' + x.count + ')';
        }).join('\n')
        : 'No expenses recorded for ' + d.month + '.';
      break;
    case 'get_vacancy_analysis':
      body = (d.vacant && d.vacant.length)
        ? '**' + d.count + ' vacant room(s):**\n' + d.vacant.map(function (x) {
          return '• ' + x.property + ' Room ' + x.room + ' — ' + (x.vacantDays === null ? 'vacant' : x.vacantDays + ' days');
        }).join('\n') + '\n\n' + (d.recommendation || '')
        : 'No vacant rooms right now.';
      break;
    case 'get_property_occupancy':
      body = (d.properties && d.properties.length)
        ? '**Occupancy by property:**\n' + d.properties.map(function (x) {
          return '• ' + x.property + ': ' + pct(x.occupancyRate) + ' (' + x.occupied + '/' + x.totalRooms + ' occupied)';
        }).join('\n')
        : 'No active properties.';
      break;
    case 'get_revenue_trend':
      body = (d.months && d.months.length)
        ? '**Collections by month:**\n' + d.months.map(function (x) {
          return '• ' + x.month + ': Rs.' + money(x.collected) + (x.pending ? ' (pending Rs.' + money(x.pending) + ')' : '');
        }).join('\n')
        : 'No data yet.';
      break;
    case 'get_monthly_report':
      body = [
        '**Business report for ' + d.month + ':**',
        '• Income: **Rs.' + money(d.income) + '**',
        '• Expenses: Rs.' + money(d.expenses),
        '• Net: Rs.' + money(d.net),
        '• Pending rent: Rs.' + money(d.pendingRent) + ' (' + (d.pendingTenants || 0) + ' tenant(s))',
        '• Occupancy: ' + pct(d.occupancyRate) + ' (' + d.occupiedRooms + '/' + d.totalRooms + ')',
        '• New tenants: ' + (d.newTenants || 0) + ' • Complaints: ' + (d.complaintsRaised || 0) + ' (' + (d.complaintsOpen || 0) + ' open)',
      ].join('\n');
      break;
    case 'get_payment_behavior':
      body = (d.tenants && d.tenants.length)
        ? '**Payment behavior:**\n' + d.tenants.map(function (x) {
          return '• ' + x.tenant + (x.room ? ' (Room ' + x.room + ')' : '') + ' — on time ' + pct(x.onTimePct) + ' (' + (x.paidOnTime || 0) + ' paid, ' + (x.lateOrOverdue || 0) + ' late)';
        }).join('\n')
        : 'No active tenants.';
      break;
    case 'get_recommendations':
      body = (d.recommendationList && d.recommendationList.length)
        ? '**Recommendations:**\n' + d.recommendationList.map(function (x) {
          return '• [' + (x.priority || 'info').toUpperCase() + '] ' + x.topic + ': ' + x.recommendation;
        }).join('\n')
        : 'Everything looks on track — no recommendations right now.';
      break;
    case 'draft_rent_reminder':
      body = (d.messages && d.messages.length)
        ? 'Draft reminder for ' + d.count + ' tenant(s) for ' + d.month + ' — <raw>nothing was sent</raw>.\n' + d.messages.map(function (x) {
          return '• ' + (x.tenantName || '') + ': ' + x.message;
        }).join('\n')
        : 'No pending rent to remind about for ' + d.month + '.';
      break;

    // Tenant tools
    case 'get_my_current_rent':
      body = d.found
        ? '**' + d.billingPeriod + ' rent:**\n• Due: **Rs.' + money(d.due) + '**\n• Paid: Rs.' + money(d.paid) + '\n• Remaining: Rs.' + money(d.remaining) + '\n• Status: ' + (d.status || '—') + (d.dueDate ? '\n• Due by: ' + d.dueDate : '')
        : (d.message || 'No rent record found for the current period.');
      break;
    case 'get_my_rent_history':
      body = (d.records && d.records.length)
        ? '**Recent months:**\n' + d.records.map(function (x) {
          return '• ' + x.month + ': Rs.' + money(x.due) + ' — ' + (x.status === 'paid' ? 'paid Rs.' + money(x.paid) : 'pending Rs.' + money(x.remaining)) + ' (' + (x.status || '—') + ')';
        }).join('\n')
        : 'No rent history yet.';
      break;
    case 'get_my_payments':
      body = (d.receipts && d.receipts.length)
        ? '**Recent receipts:**\n' + d.receipts.map(function (x) {
          return '• Rs.' + money(x.amount) + ' via ' + (x.method || '—') + ' — ' + (x.status || '') + (x.date ? ' (' + x.date + ')' : '');
        }).join('\n')
        : 'No payments recorded yet.';
      break;
    case 'get_my_complaints':
      body = (d.complaints && d.complaints.length)
        ? '**Your complaints:**\n' + d.complaints.map(function (x) {
          return '• ' + x.title + ' — ' + (x.status || '') + (x.priority ? ' (' + x.priority + ')' : '');
        }).join('\n')
        : 'You have no complaints yet.';
      break;
    case 'get_my_notifications':
      body = (d.notifications && d.notifications.length)
        ? '**Recent notifications:**\n' + d.notifications.map(function (x) {
          return '• ' + (x.title || '') + ': ' + (x.message || '');
        }).join('\n')
        : 'You have no notifications yet.';
      break;
    case 'get_my_tenancy':
      body = d.found
        ? '**Your tenancy:**\n' + (d.property ? '• Property: ' + d.property.name : '') + (d.room ? '\n• Room: ' + (d.room.number || '') + ' — Rs.' + money(d.room.monthlyRent) + '/month' : '') + (d.room && d.room.deposit ? '\n• Deposit: Rs.' + money(d.room.deposit) : '') + (d.joinDate ? '\n• Joined: ' + d.joinDate : '') + '\n• Status: ' + (d.status || '—')
        : 'You don\u2019t have an active tenancy on record.';
      break;
    default:
      body = 'I couldn\u2019t find a match for that offline. Try asking about your rent, payments, complaints or notifications.';
  }

  if (!body) body = 'I couldn\u2019t answer that offline. Please retry when the assistant is back online.';
  return body + offlineNote;
}

/* ------------------- public entrypoint ------------------- */
function resolveWorkspace(user, requested) {
  const roles = user.roles && user.roles.length ? user.roles : [user.role];
  const canOwner = roles.indexOf('owner') !== -1 || roles.indexOf('superadmin') !== -1;
  if (requested === 'owner' && canOwner) return 'owner';
  if (requested === 'tenant') return 'tenant';
  return canOwner ? 'owner' : 'tenant';
}

async function chat({ user, workspace, history, language }) {
  const providerOrder = enabledProviderOrder();
  const activeWorkspace = resolveWorkspace(user, workspace);
  const allowed = allowedToolsFor(activeWorkspace);
  const schemas = toolSchemas(allowed);

  const i18n = require('./i18n');
  const activeLanguage = i18n.normalizeLanguage(language || (user && user.preferredLanguage));

  const tenant = activeWorkspace === 'owner'
    ? null
    : await Tenant.findOne({ userId: user._id }).sort({ createdAt: -1 }).lean();
  const owner = activeWorkspace === 'owner'
    ? (user.role === 'owner' ? user._id : user.ownerId || null)
    : null;

  // Last user utterance - used by the offline rule responder.
  let lastUserText = '';
  if (Array.isArray(history)) {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i] && history[i].role === 'user' && typeof history[i].content === 'string') {
        lastUserText = history[i].content;
        break;
      }
    }
  }

  // No provider configured at all -> rule-based responder only.
  if (providerOrder.length === 0) {
    logger.warn('[AI] No AI provider configured - using offline rule responder.');
    const reply = await offlineRespondent(activeWorkspace, user, tenant, owner, lastUserText);
    return { reply: reply, workspace: activeWorkspace, provider: 'offline', model: 'rule-based', offline: true };
  }

  const messages = [{ role: 'system', content: buildSystemPrompt(user, activeWorkspace, activeLanguage) }];
  if (Array.isArray(history)) {
    for (const m of history) {
      if (m && m.role && typeof m.content === 'string') {
        messages.push({ role: m.role, content: m.content });
      }
    }
  }

  let final = null;
  let usedProvider = providerOrder[0];
  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const result = await chatWithFallback(messages, schemas);
      const msg = result.msg;
      usedProvider = result.provider;
      if (!msg) { final = 'No response.'; break; }

      messages.push({ role: 'assistant', content: msg.content, tool_calls: (msg.tool_calls || []).length ? msg.tool_calls : undefined });

      const calls = msg.tool_calls || [];
      if (!calls.length) { final = msg.content || ''; break; }

      for (const call of calls) {
        if (call.type !== 'function') continue;
        const toolName = call.function && call.function.name;
        const meta = allowed.find(function (t) { return t.name === toolName; });
        let args = {};
        try { args = call.function.arguments ? JSON.parse(call.function.arguments) : {}; } catch (e) { args = {}; }

        let content;
        if (!meta) {
          content = 'Tool "' + toolName + '" is not allowed in the ' + activeWorkspace + ' workspace. Explain politely that it is not available to them here.';
        } else {
          try {
            content = JSON.stringify(await executor(toolName, args, { user: user, owner: owner, tenant: tenant }));
          } catch (e) {
            logger.error('[AI] tool ' + toolName + ' failed: ' + e.message);
            content = JSON.stringify({ error: 'Could not complete that request right now.' });
          }
        }
        messages.push({ role: 'tool', name: toolName, tool_call_id: call.id, content: content });
      }
    }
  } catch (err) {
    // Every provider is down (rate-limited / unreachable / 5xx). Serve the
    // question from the user's real data via the offline rule responder.
    logger.warn('[AI] All AI providers unavailable (' + err.message + ') - falling back to offline rule responder.');
    const reply = await offlineRespondent(activeWorkspace, user, tenant, owner, lastUserText);
    return { reply: reply, workspace: activeWorkspace, provider: 'offline', model: 'rule-based', offline: true };
  }

  return {
    reply: final || 'Sorry, I could not produce a helpful answer. Please try rephrasing.',
    workspace: activeWorkspace,
    provider: usedProvider,
    model: providerModel(usedProvider),
  };
}

module.exports = { chat, resolveWorkspace, tools: TOOLS, providers: PROVIDER_ORDER, model: GROQ_MODEL };