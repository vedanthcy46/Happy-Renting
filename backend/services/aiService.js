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
 * Uses the OpenAI-compatible chat completions API exposed by Groq.
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
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const MAX_TOOL_ROUNDS = 6;

/* ---------- helpers ---------- */
function monthKey(date) {
  const d = date || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
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
    description: 'Draft ready-to-send rent reminder messages, one per pending tenant, for the current month. Returns message text only - nothing is sent.',
    allow: ['owner'],
    schema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

function buildSystemPrompt(user, workspace) {
  const scope = workspace === 'owner'
    ? 'You are the analytical copilot for the OWNER workspace of Happy Renting, a property management app. You understand the owner properties, tenants, income, expenses, complaints, occupancy and collections. You answer business questions, produce summaries and draft reminders.'
    : 'You are the copilot for a TENANT on Happy Renting, a property management app. You help the tenant understand their own rent, due dates, receipts, payments, complaints and notifications - always about their own tenancy only.';
  return [
    scope,
    '',
    'CURRENT WORKSPACE: ' + workspace.toUpperCase() + ' (roles: ' + (user.roles || [user.role]).join(', ') + ')',
    'CURRENT MONTH: ' + monthKey(),
    '',
    'You are a context-aware copilot, not a generic chatbot. Rules:',
    '1. Only answer using the data returned by the tools you call. Never invent amounts, dates, statuses, names or URLs.',
    '2. For each question pick the ONE best tool, call it via function calling, then explain the result concisely.',
    '3. Lead with the key figure (a short framed line or bold), then a brief human explanation. Currency in Rupees, e.g. Rs.12,000.',
    '4. If a tool returns no data, say so honestly and suggest one next step.',
    '5. If the user asks for data outside the tools available in this workspace, politely say it is not available in the current workspace and suggest what they can do instead.',
    '6. When you performed an action (e.g. raised a complaint), confirm what was registered and what happens next. Never claim something was sent unless the tool result says so.',
    '7. Keep answers concise but complete. A little markdown bold is fine.',
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
        currentMonth: monthKey(),
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
      const rec = await MonthlyRentRecord.findOne({ tenantId: tenant._id, month: monthKey() }).lean();
      if (!rec) return { found: false, message: 'No rent record generated yet for ' + monthKey() + '.' };
      return {
        found: true,
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
        currentMonth: monthKey(),
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
        .select('title body read createdAt').lean();
      return {
        found: list.length > 0,
        notifications: list.map(function (n) {
          return { title: n.title, body: n.body, read: n.read, date: fmtDate(n.createdAt) };
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
          userId: active.ownerId, title: 'New Complaint', body: complaint.title,
          type: 'complaint_raised', data: { complaintId: complaint._id },
        }).catch(function () {});
      } catch (e) { logger.error('[AI] owner push failed: ' + e.message); }
      logger.info('[AI COMPLAINT] id=' + complaint._id + ' tenant=' + active._id);
      return { success: true, complaintId: String(complaint._id), title: complaint.title, status: 'pending', message: 'Complaint registered successfully.' };
    }

    // owner
    case 'get_owner_metrics': {
      if (!oid) return { error: 'No owner context.' };
      const cur = monthKey();
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
      const cur = monthKey();
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
      const targetMonth = args.month || monthKey();
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
      const targetMonth = args.month || monthKey();
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
      const cur = monthKey();
      const recs = await MonthlyRentRecord.find({ ownerId: oid, month: cur, remainingAmount: { $gt: 0 } }).lean();
      const messages = [];
      for (const r of recs) {
        var t = await Tenant.findById(r.tenantId).populate({ path: 'userId', select: 'name' }).lean();
        messages.push('Dear ' + (t && t.userId ? t.userId.name : 'Tenant') + ', your rent for ' + cur + ' is pending. Please pay Rs.' + r.remainingAmount + ' at the earliest. - Happy Renting');
      }
      return { month: cur, count: messages.length, messages: messages };
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
  const payload = { model: DEFAULT_MODEL, messages: messages, temperature: 0.3, max_tokens: 1024 };
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
    err.statusCode = 502;
    throw err;
  }
  return text ? JSON.parse(text) : {};
}

/* ------------------- public entrypoint ------------------- */
function resolveWorkspace(user, requested) {
  const roles = user.roles && user.roles.length ? user.roles : [user.role];
  const canOwner = roles.indexOf('owner') !== -1 || roles.indexOf('superadmin') !== -1;
  if (requested === 'owner' && canOwner) return 'owner';
  if (requested === 'tenant') return 'tenant';
  return canOwner ? 'owner' : 'tenant';
}

async function chat({ user, workspace, history }) {
  if (!process.env.GROQ_API_KEY) {
    const err = new Error('GROQ_API_KEY is not configured on the server.');
    err.statusCode = 503;
    throw err;
  }

  const activeWorkspace = resolveWorkspace(user, workspace);
  const allowed = allowedToolsFor(activeWorkspace);
  const schemas = toolSchemas(allowed);

  const tenant = activeWorkspace === 'owner'
    ? null
    : await Tenant.findOne({ userId: user._id }).sort({ createdAt: -1 }).lean();
  const owner = activeWorkspace === 'owner'
    ? (user.role === 'owner' ? user._id : user.ownerId || null)
    : null;

  const messages = [{ role: 'system', content: buildSystemPrompt(user, activeWorkspace) }];
  if (Array.isArray(history)) {
    for (const m of history) {
      if (m && m.role && typeof m.content === 'string') {
        messages.push({ role: m.role, content: m.content });
      }
    }
  }

  let final = null;
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const data = await groqChat(messages, schemas);
    const choice = data.choices && data.choices[0];
    const msg = choice && choice.message;
    if (!msg) { final = 'No response.'; break; }

    messages.push({ role: 'assistant', content: msg.content || null, tool_calls: msg.tool_calls || undefined });

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
      messages.push({ role: 'tool', tool_call_id: call.id, content: content });
    }
  }

  return {
    reply: final || 'Sorry, I could not produce a helpful answer. Please try rephrasing.',
    workspace: activeWorkspace,
    model: DEFAULT_MODEL,
  };
}

module.exports = { chat, resolveWorkspace, tools: TOOLS, model: DEFAULT_MODEL };