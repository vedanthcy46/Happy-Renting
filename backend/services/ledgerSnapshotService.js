'use strict';

const crypto = require('crypto');
const LedgerSnapshot = require('../models/LedgerSnapshot');
const Tenant = require('../models/Tenant');
const logger = require('../config/logger');

/**
 * Generate SHA-256 checksum for a snapshot state
 */
const generateChecksum = (tenantId, asOfMonth, ledgerVersion, balances) => {
  const payload = `${tenantId}:${asOfMonth}:${ledgerVersion}:${balances.totalPaid}:${balances.totalRent}:${balances.advanceBalance}:${balances.remainingAmount}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
};

/**
 * Create a new LedgerSnapshot for a given month
 */
const createSnapshot = async (tenantId, asOfMonth, balances, session = null) => {
  const tenant = await Tenant.findById(tenantId).session(session);
  if (!tenant) throw new Error('Tenant not found for snapshot');

  const checksum = generateChecksum(tenantId, asOfMonth, tenant.ledgerVersion, balances);

  const snapshot = await LedgerSnapshot.create([{
    tenantId,
    ledgerVersion: tenant.ledgerVersion,
    asOfMonth,
    balances,
    checksum
  }], { session });

  // Retention policy: Keep last 5 snapshots
  const snapshots = await LedgerSnapshot.find({ tenantId })
    .sort({ createdAt: -1 })
    .session(session);

  if (snapshots.length > 5) {
    const toDelete = snapshots.slice(5).map(s => s._id);
    await LedgerSnapshot.deleteMany({ _id: { $in: toDelete } }).session(session);
  }

  logger.info(`[LEDGER SNAPSHOT] Created snapshot for tenant=${tenantId} month=${asOfMonth} v=${tenant.ledgerVersion}`);
  return snapshot[0];
};

/**
 * Load the latest valid snapshot prior to or exactly matching the affectedMonth.
 * Validates checksum to prevent poisoning.
 */
const loadSnapshot = async (tenantId, affectedMonth) => {
  // Find the most recent snapshot that is <= affectedMonth
  const snapshot = await LedgerSnapshot.findOne({ 
    tenantId, 
    asOfMonth: { $lte: affectedMonth } 
  }).sort({ asOfMonth: -1 });

  if (!snapshot) {
    return null; // No snapshot found, start from beginning
  }

  // Validate Checksum
  const expectedChecksum = generateChecksum(
    tenantId, 
    snapshot.asOfMonth, 
    snapshot.ledgerVersion, 
    snapshot.balances
  );

  if (snapshot.checksum !== expectedChecksum) {
    logger.error(`[LEDGER SNAPSHOT CORRUPTED] Checksum mismatch for tenant=${tenantId} snapshotId=${snapshot._id}`);
    throw new Error('LedgerSafetyError: Snapshot checksum mismatch. Ledger corruption detected.');
  }

  return snapshot;
};

module.exports = {
  createSnapshot,
  loadSnapshot,
  generateChecksum
};
