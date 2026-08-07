'use strict';

/**
 * monthlyReportService
 * ------------------------------------------------------------------
 * Phase 4 - "Monthly report generation". Builds a printable PDF business
 * report for an owner for a given month (income, expenses, net, pending,
 * occupancy, new tenants, complaints, per-property income) and emails it.
 *
 * Can be triggered on demand (by the AI copilot) or by a monthly cron job.
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const logger       = require('../config/logger');
const User         = require('../models/User');
const Tenant       = require('../models/Tenant');
const Room         = require('../models/Room');
const Property     = require('../models/Property');
const Expense      = require('../models/Expense');
const Complaint    = require('../models/Complaint');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const PaymentTransaction = require('../models/PaymentTransaction');
const emailService = require('./emailService');

function monthKey(date) {
  const d = date || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function inr(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN');
}
function monthLabel(m) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

/* Gathers the numbers for one owner + month (matches the AI analytics view). */
async function collectReport(ownerId, m) {
  const [y, mo] = m.split('-').map(Number);
  const start = new Date(y, mo - 1, 1);
  const end = new Date(y, mo, 1);

  const incomeAgg = await PaymentTransaction.aggregate([
    { $match: { ownerId: ownerId, status: 'completed', amount: { $gt: 0 }, paymentDate: { $gte: start, $lt: end } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const income = incomeAgg[0] ? incomeAgg[0].total : 0;

  const expenseAgg = await Expense.aggregate([
    { $match: { ownerId: ownerId, month: m } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const expenses = expenseAgg[0] ? expenseAgg[0].total : 0;

  const records = await MonthlyRentRecord.find({ ownerId: ownerId, month: m })
    .select('remainingAmount status').lean();
  const pending = records.filter(function (r) { return r.remainingAmount > 0; });
  const pendingAmount = pending.reduce(function (a, r) { return a + r.remainingAmount; }, 0);
  const fullyPaid = records.length - pending.length;

  const propertyIds = (await Property.find({ ownerId: ownerId }).select('_id').lean()).map(function (p) { return p._id; });

  const occAgg = await Room.aggregate([
    { $match: { propertyId: { $in: propertyIds }, isActive: true } },
    { $group: { _id: null, total: { $sum: 1 }, occupied: { $sum: { $cond: [{ $gt: ['$currentOccupancy', 0] }, 1, 0] } } } },
  ]);
  const occ = occAgg[0] || { total: 0, occupied: 0 };

  const newTenants = await Tenant.countDocuments({ ownerId: ownerId, status: 'active', joinDate: { $gte: start, $lt: end } });
  const complaints = await Complaint.find({ propertyId: { $in: propertyIds }, createdAt: { $gte: start, $lt: end } })
    .select('status').lean();
  const openComplaints = complaints.filter(function (c) { return c.status !== 'resolved' && c.status !== 'rejected'; }).length;

  const propIncomeAgg = await PaymentTransaction.aggregate([
    { $match: { ownerId: ownerId, status: 'completed', amount: { $gt: 0 }, paymentDate: { $gte: start, $lt: end } } },
    { $group: { _id: '$propertyId', total: { $sum: '$amount' } } },
    { $sort: { total: -1 } },
  ]);
  const propIncome = [];
  for (const row of propIncome) {
    const p = await Property.findById(row._id).select('name').lean();
    propIncome.push({ property: p ? p.name : 'Unknown', income: row.total });
  }

  return {
    month: m,
    monthLabel: monthLabel(m),
    income,
    expenses,
    net: income - expenses,
    pendingAmount,
    pendingTenants: pending.length,
    fullyPaid,
    occupancyRate: occ.total > 0 ? Number(((occ.occupied / occ.total) * 100).toFixed(1)) : 0,
    occupiedRooms: occ.occupied,
    totalRooms: occ.total,
    newTenants,
    complaintsRaised: complaints.length,
    openComplaints,
    propIncome,
  };
}

/* Build the PDF document into a Buffer. */
async function buildReportPDF(report, ownerName) {
  return new Promise(function (resolve, reject) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', function (c) { chunks.push(c); });
    doc.on('end', function () { resolve(Buffer.concat(chunks)); });
    doc.on('error', reject);

    // Header band
    doc.rect(0, 0, doc.page.width, 90).fill('#2563EB');
    doc.fillColor('#FFFFFF').fontSize(22).font('Helvetica-Bold').text('Happy Renting', 50, 24);
    doc.fontSize(12).font('Helvetica').text('Monthly Business Report', 50, 52);
    doc.text(report.monthLabel, 50, 68);

    doc.moveDown(2);

    // Owner
    doc.fillColor('#0F172A').fontSize(10).font('Helvetica').text('Owner: ' + ownerName);
    doc.text('Generated: ' + new Date().toLocaleString('en-IN'));

    doc.moveDown(1.5);
    // Summary
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827').text('Summary');
    doc.moveDown(0.3);
    const lineHeight = 16;
    doc.font('Helvetica').fontSize(11);
    summaryRows(doc, [
      ['Income (collected)', inr(report.income)],
      ['Expenses', inr(report.expenses)],
      ['Net income', inr(report.net)],
      ['Pending rent', inr(report.pendingAmount) + '  (' + report.pendingTenants + ' tenant(s))'],
      ['Occupancy', report.occupancyRate + '%  (' + report.occupiedRooms + '/' + report.totalRooms + ' rooms)'],
      ['New tenants', String(report.newTenants)],
      ['Complaints raised', String(report.complaintsRaised) + ' (' + report.openComplaints + ' open)'],
    ], lineHeight);

    doc.moveDown(1.5);
    if (report.propIncome.length) {
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827').text('Income by Property');
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(11);
      summaryRows(doc, report.propIncome.map(function (p) { return [p.property, inr(p.income)]; }), lineHeight);
    }

    doc.moveDown(1.5);
    doc.fontSize(9).fillColor('#6B7280').font('Helvetica')
      .text('This report was generated automatically by Happy Renting. Please contact support for any discrepancy.');

    doc.end();
  });
}

function summaryRows(doc, rows, lineHeight) {
  for (const [label, value] of rows) {
    doc.fillColor('#374151').text(String(label), 50);
    doc.save().text(String(value), 320);
    doc.moveDown(lineHeight / 14);
  }
}

/* Generate + email a monthly report PDF to an owner. */
async function emailMonthlyReport(ownerId, month, opts) {
  opts = opts || {};
  const m = month || monthKey();
  const owner = await User.findById(ownerId).select('name email notificationPreferences').lean();
  if (!owner) throw { statusCode: 404, message: 'Owner not found.' };
  if (!owner.email) return { skipped: 'Owner has no email address.' };

  const report = await collectReport(ownerId, m);
  const buffer = await buildReportPDF(report, owner.name || 'Owner');
  const filename = 'HappyRenting_' + m + '_Report.pdf';

  const subject = 'Happy Renting ' + report.monthLabel + ' Business Report';
  const html =
    '<h2 style="color:#2563EB;font-family:sans-serif;">Happy Renting - Monthly Report</h2>' +
    '<p style="font-family:sans-serif;color:#374151;">Dear ' + (owner.name || 'Owner') + ',</p>' +
    '<p style="font-family:sans-serif;color:#374151;">Please find attached your business report for <b>' + report.monthLabel + '</b>.</p>' +
    '<table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;">' +
    row('Income', inr(report.income)) +
    row('Expenses', inr(report.expenses)) +
    row('Net income', inr(report.net)) +
    row('Pending rent', inr(report.pendingAmount)) +
    row('Occupancy', report.occupancyRate + '%') +
    '</table>' +
    '<p style="font-family:sans-serif;color:#9CA3AF;font-size:12px;">Sent automatically by Happy Renting.</p>';

  await emailService.sendEmail(owner.email, subject, html, [
    { filename: filename, content: buffer.toString('base64'), content_type: 'application/pdf' },
  ]);

  logger.info('[MONTHLY REPORT] Emailed ' + m + ' report to ' + owner.email);
  return { emailedTo: owner.email, month: m, income: report.income, net: report.net, pending: report.pendingAmount };
}

function row(label, value) {
  return '<tr><td style="padding:4px 12px 4px 0;color:#111827;font-weight:600;">' + label + '</td>' +
    '<td style="padding:4px 0;">' + value + '</td></tr>';
}

/* Cron: email last month's report to every active owner (configurable off). */
async function runMonthlyAutomation() {
  const enabled = String(process.env.MONTHLY_REPORT_AUTOMATION_ENABLED || 'true') === 'true';
  if (!enabled) return { skipped: true };

  // Report for the previous month when running "on the 1st".
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const targetMonth = lastMonth.getFullYear() + '-' + String(lastMonth.getMonth() + 1).padStart(2, '0');

  const owners = await User.find({ role: 'owner', isActive: true }).select('_id').lean();
  let sentCount = 0;
  for (const owner of owners) {
    try {
      const res = await emailMonthlyReport(owner._id, targetMonth);
      if (res && !res.skipped) sentCount++;
    } catch (e) {
      logger.error('[MONTHLY] Failed for owner ' + owner._id + ': ' + (e.message || e));
    }
  }
  logger.info('[MONTHLY] Sent ' + sentCount + ' monthly reports for ' + targetMonth);
  return { sent: sentCount, month: targetMonth };
}

module.exports = { collectReport, buildReportPDF, emailMonthlyReport, runMonthlyAutomation, monthKey };