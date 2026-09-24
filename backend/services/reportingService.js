'use strict';

const mongoose = require('mongoose');
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const PaymentTransaction = require('../models/PaymentTransaction');
const OwnerWallet = require('../models/OwnerWallet');
const Complaint = require('../models/Complaint');
const Room = require('../models/Room');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const LedgerJob = require('../models/LedgerJob');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const SystemHealth = require('../models/SystemHealth'); // Assuming this exists or similar

const getOwnerFinancialMetrics = async (ownerId) => {
  // Pending rent
  const pendingRentAgg = await MonthlyRentRecord.aggregate([
    { $match: { ownerId: new mongoose.Types.ObjectId(ownerId), status: { $in: ['unpaid', 'partial', 'pending', 'overdue'] } } },
    {
      $group: {
        _id: null,
        totalDue: { $sum: '$totalRent' },
        totalPaid: { $sum: '$totalPaid' },
        count: { $sum: 1 }
      }
    }
  ]);

  const pendingData = pendingRentAgg[0] || { totalDue: 0, totalPaid: 0, count: 0 };
  const pendingAmount = Math.max(0, pendingData.totalDue - pendingData.totalPaid);

  // Wallet
  const wallet = await OwnerWallet.findOne({ ownerId }).lean();

  return {
    pendingRent: pendingAmount,
    overdueBillsCount: pendingData.count,
    walletBalance: wallet?.balance || 0,
    withdrawableAmount: wallet?.withdrawableBalance || 0,
  };
};

const calculateOccupancyMetrics = ({ totalRooms, occupiedRooms }) => {
  const safeTotalRooms = Math.max(0, Number(totalRooms) || 0);
  const safeOccupiedRooms = Math.min(Math.max(0, Number(occupiedRooms) || 0), safeTotalRooms);
  const vacantRooms = Math.max(safeTotalRooms - safeOccupiedRooms, 0);
  const occupancyRate = safeTotalRooms > 0
    ? Number(((safeOccupiedRooms / safeTotalRooms) * 100).toFixed(1))
    : 0;

  return {
    totalRooms: safeTotalRooms,
    occupiedRooms: safeOccupiedRooms,
    vacantRooms,
    occupancyRate,
  };
};

const getOwnerOccupancyMetrics = async (ownerId) => {
  const Property = require('../models/Property');
  const properties = await Property.find({ ownerId }).select('_id');
  const propertyIds = properties.map(p => p._id);

  const occupancyAgg = await Room.aggregate([
    { $match: { propertyId: { $in: propertyIds }, isActive: true } },
    {
      $group: {
        _id: null,
        totalRooms: { $sum: 1 },
        occupiedRooms: {
          $sum: {
            $cond: [{ $gt: ['$currentOccupancy', 0] }, 1, 0]
          }
        }
      }
    }
  ]);

  const { totalRooms = 0, occupiedRooms = 0 } = occupancyAgg[0] || {};
  return calculateOccupancyMetrics({ totalRooms, occupiedRooms });
};

/**
 * getOwnerCollectionMetrics
 * @param {string} ownerId
 * @param {string} targetDate  - ISO date string of the END of the period (today)
 * @param {number} periodDays  - number of days to look back (default 1 = today only)
 */
const getOwnerCollectionMetrics = async (ownerId, targetDate, periodDays = 1) => {
  const tDate = new Date(targetDate);
  // End of target day
  const endOfDay = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate() + 1);
  // Start of period = endOfDay minus periodDays
  const startOfPeriod = new Date(endOfDay.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const periodAgg = await PaymentTransaction.aggregate([
    {
      $match: {
        ownerId: new mongoose.Types.ObjectId(ownerId),
        status: { $in: ['completed', 'verifying'] },
        paymentDate: { $gte: startOfPeriod, $lt: endOfDay },
        amount: { $gt: 0 },
        transactionType: { $ne: 'waiver' }
      }
    },
    { $group: { _id: null, amount: { $sum: '$amount' } } }
  ]);

  return {
    // Keep backward-compatible keys
    collectedToday: periodAgg[0]?.amount || 0,
    collectionsToday: periodAgg[0]?.amount || 0,
    collectedThisMonth: periodAgg[0]?.amount || 0,
  };
};

const getOwnerComplaintMetrics = async (ownerId) => {
  const Property = require('../models/Property');
  const properties = await Property.find({ ownerId }).select('_id');
  const propertyIds = properties.map(p => p._id);

  const openComplaints = await Complaint.countDocuments({ 
    propertyId: { $in: propertyIds },
    status: { $in: ['open', 'in_progress'] }
  });

  return {
    openComplaints
  };
};

/**
 * getOwnerAlerts
 * @param {string} ownerId
 * @param {string} targetDate  - ISO date string
 * @param {number} periodDays  - number of days to look back for payment events (default 1)
 */
const getOwnerAlerts = async (ownerId, targetDate, periodDays = 1) => {
  const tDate = new Date(targetDate);
  const endOfDay = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate() + 1);
  const startOfPeriod = new Date(endOfDay.getTime() - periodDays * 24 * 60 * 60 * 1000);

  // Overdue tenants (distinct tenants, not records)
  const overdueAgg = await MonthlyRentRecord.aggregate([
    { $match: { ownerId: new mongoose.Types.ObjectId(ownerId), status: 'overdue' } },
    { $group: { _id: '$tenantId' } },
    { $count: 'count' }
  ]);
  const overdueTenants = overdueAgg[0]?.count || 0;

  // Upcoming move-outs (within next 30 days)
  const next30Days = new Date(endOfDay);
  next30Days.setDate(next30Days.getDate() + 30);
  
  const upcomingMoveOuts = await Tenant.countDocuments({
    ownerId,
    status: 'active',
    exitDate: { $gte: endOfDay, $lte: next30Days }
  });

  // Failed payments in the period
  const failedPayments = await PaymentTransaction.countDocuments({
    ownerId,
    status: 'failed',
    paymentDate: { $gte: startOfPeriod, $lt: endOfDay }
  });

  // Unverified payments (manual) — always total pending, not time-bound
  const unverifiedPayments = await PaymentTransaction.countDocuments({
    ownerId,
    status: 'verifying'
  });

  // New tenants added in the period
  const newTenants = await Tenant.countDocuments({
    ownerId,
    createdAt: { $gte: startOfPeriod, $lt: endOfDay }
  });

  return {
    overdueTenants,
    upcomingMoveOuts,
    failedPayments,
    unverifiedPayments,
    newTenants,
  };
};

/**
 * getAdminPlatformMetrics
 * @param {string} targetDate  - ISO date string
 * @param {number} periodDays  - number of days to look back (default 1)
 */
const getAdminPlatformMetrics = async (targetDate, periodDays = 1) => {
  const tDate = new Date(targetDate);
  const endOfDay = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate() + 1);
  const startOfPeriod = new Date(endOfDay.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const totalCollectionsAgg = await PaymentTransaction.aggregate([
    {
      $match: {
        status: { $in: ['completed', 'verifying'] },
        paymentDate: { $gte: startOfPeriod, $lt: endOfDay },
        amount: { $gt: 0 }
      }
    },
    { $group: { _id: null, amount: { $sum: '$amount' } } }
  ]);

  const activeOwners = await User.countDocuments({ role: 'owner', isActive: true });
  const activeTenants = await Tenant.countDocuments({ status: 'active' });
  const newRegistrations = await User.countDocuments({ createdAt: { $gte: startOfPeriod, $lt: endOfDay } });
  const failedPayments = await PaymentTransaction.countDocuments({ status: 'failed', paymentDate: { $gte: startOfPeriod, $lt: endOfDay } });
  const pendingWithdrawals = await WithdrawalRequest.countDocuments({ status: 'pending' });

  return {
    totalCollectionsToday: totalCollectionsAgg[0]?.amount || 0,
    activeOwners,
    activeTenants,
    newRegistrationsToday: newRegistrations,
    failedPaymentsToday: failedPayments,
    pendingWithdrawals
  };
};

const getAdminSystemMetrics = async () => {
  const queueBacklog = await LedgerJob.countDocuments({ status: 'pending' });
  const deadLetterJobs = await LedgerJob.countDocuments({ status: 'failed' }); // using failed for dead letter in ledger

  return {
    queueBacklog,
    deadLetterJobs,
    workerHealth: queueBacklog < 1000 ? 'Healthy' : 'Degraded',
  };
};

module.exports = {
  calculateOccupancyMetrics,
  getOwnerFinancialMetrics,
  getOwnerOccupancyMetrics,
  getOwnerCollectionMetrics,
  getOwnerComplaintMetrics,
  getOwnerAlerts,
  getAdminPlatformMetrics,
  getAdminSystemMetrics
};

