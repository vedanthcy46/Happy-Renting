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

const getOwnerCollectionMetrics = async (ownerId, targetDate) => {
  const tDate = new Date(targetDate);
  const startOfDay = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate());
  const endOfDay = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate() + 1);

  const startOfMonth = new Date(tDate.getFullYear(), tDate.getMonth(), 1);

  // Collections Today (only positive collections, exclude negative advance deductions)
  const todayAgg = await PaymentTransaction.aggregate([
    { $match: { ownerId: new mongoose.Types.ObjectId(ownerId), status: 'completed', paymentDate: { $gte: startOfDay, $lt: endOfDay }, amount: { $gt: 0 } } },
    { $group: { _id: null, amount: { $sum: '$amount' } } }
  ]);

  // Collections This Month (only positive collections)
  const monthAgg = await PaymentTransaction.aggregate([
    { $match: { ownerId: new mongoose.Types.ObjectId(ownerId), status: 'completed', paymentDate: { $gte: startOfMonth, $lt: endOfDay }, amount: { $gt: 0 } } },
    { $group: { _id: null, amount: { $sum: '$amount' } } }
  ]);

  return {
    collectedToday: todayAgg[0]?.amount || 0,
    collectedThisMonth: monthAgg[0]?.amount || 0,
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

const getOwnerAlerts = async (ownerId, targetDate) => {
  const tDate = new Date(targetDate);
  const endOfDay = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate() + 1);

  // Overdue tenants
  const overdueTenants = await MonthlyRentRecord.countDocuments({
    ownerId,
    status: 'overdue'
  });

  // Upcoming move-outs (within next 30 days)
  const next30Days = new Date(endOfDay);
  next30Days.setDate(next30Days.getDate() + 30);
  
  const upcomingMoveOuts = await Tenant.countDocuments({
    ownerId,
    status: 'active', // they are still active
    exitDate: { $gte: endOfDay, $lte: next30Days }
  });

  // Failed payments today
  const failedPayments = await PaymentTransaction.countDocuments({
    ownerId,
    status: 'failed',
    paymentDate: { $gte: tDate, $lt: endOfDay }
  });

  // Unverified payments (manual)
  const unverifiedPayments = await PaymentTransaction.countDocuments({
    ownerId,
    status: 'verifying'
  });

  return {
    overdueTenants,
    upcomingMoveOuts,
    failedPayments,
    unverifiedPayments
  };
};

const getAdminPlatformMetrics = async (targetDate) => {
  const tDate = new Date(targetDate);
  const startOfDay = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate());
  const endOfDay = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate() + 1);

  const totalCollectionsAgg = await PaymentTransaction.aggregate([
    { $match: { status: 'completed', paymentDate: { $gte: startOfDay, $lt: endOfDay }, amount: { $gt: 0 } } },
    { $group: { _id: null, amount: { $sum: '$amount' } } }
  ]);

  const activeOwners = await User.countDocuments({ role: 'owner', isActive: true });
  const activeTenants = await Tenant.countDocuments({ status: 'active' });
  const newRegistrations = await User.countDocuments({ createdAt: { $gte: startOfDay, $lt: endOfDay } });
  const failedPayments = await PaymentTransaction.countDocuments({ status: 'failed', paymentDate: { $gte: startOfDay, $lt: endOfDay } });
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
