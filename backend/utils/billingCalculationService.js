'use strict';

const logger = require('../config/logger');

/**
 * billingCalculationService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Strict mathematical boundary calculations and rule enforcements for the 
 * Calendar-Month billing system. Decouples financial math from DB orchestration.
 */

/**
 * Returns the exact number of days in the specified month (e.g. 28, 29, 30, 31).
 */
const getDaysInMonth = (year, monthIndex) => {
  return new Date(year, monthIndex + 1, 0).getDate();
};

/**
 * Calculate standard calendar Due Date (strictly the 5th of the billing month).
 * @param {string} monthStr - 'YYYY-MM'
 * @returns {Date} 
 */
const calculateDueDate = (monthStr) => {
  const [year, monthNum] = monthStr.split('-').map(Number);
  // Default to 5 if not in env
  const defaultDueDay = parseInt(process.env.GLOBAL_RENT_DUE_DAY || process.env.DEFAULT_RENT_DUE_DAY || '5', 10);
  
  // Create Date for the 5th of the billing month (monthNum - 1 because JS months are 0-11)
  return new Date(year, monthNum - 1, defaultDueDay, 12, 0, 0, 0);
};

/**
 * Calculate the exact inclusive occupied days within a target month.
 * @param {string} targetMonthStr - 'YYYY-MM'
 * @param {Date} joinDate 
 * @param {Date|null} exitDate 
 * @returns {{ occupiedDays: number, totalDays: number, isProrated: boolean }}
 */
const calculateOccupiedDays = (targetMonthStr, joinDate, exitDate = null) => {
  const [year, monthNum] = targetMonthStr.split('-').map(Number);
  const monthIndex = monthNum - 1;
  const totalDays = getDaysInMonth(year, monthIndex);
  
  const joinMonthStr = joinDate.toISOString().slice(0, 7);
  let isProrated = false;
  let occupiedDays = totalDays;

  // 1. First Month Join Proration (Inclusive: e.g. March 13 -> 31 is 19 days)
  if (targetMonthStr === joinMonthStr) {
    const joinDay = joinDate.getDate();
    if (joinDay > 1) {
      occupiedDays = totalDays - joinDay + 1;
      isProrated = true;
    }
  }

  // 2. Final Month Vacate Proration (Inclusive: e.g. exit on 15th is 15 days)
  if (exitDate) {
    const exitMonthStr = exitDate.toISOString().slice(0, 7);
    if (targetMonthStr === exitMonthStr) {
      const exitDay = exitDate.getDate();
      if (exitDay < totalDays) {
        // Handle edge case where tenant joins AND leaves in the exact same month
        if (targetMonthStr === joinMonthStr) {
          occupiedDays = Math.max(1, exitDay - joinDate.getDate() + 1);
        } else {
          occupiedDays = exitDay;
        }
        isProrated = true;
      }
    }
  }

  return { occupiedDays, totalDays, isProrated };
};

/**
 * Calculates the exact prorated rent using mathematical ceiling rounding.
 */
const calculateProratedRent = (monthlyRent, occupiedDays, totalDays) => {
  if (occupiedDays >= totalDays) return monthlyRent;
  if (occupiedDays <= 0) return 0;
  return Math.ceil((occupiedDays / totalDays) * monthlyRent);
};

/**
 * Final Settlement Reconciliation.
 * If a tenant moves out mid-month but already paid full rent, this safely
 * adjusts their totalRent and yields their overpayment as an advanceBalance.
 * @param {number} totalPaid - Amount the tenant has already paid towards this bill
 * @param {number} proratedRent - The newly calculated finalized rent
 * @returns {{ newTotalRent: number, advanceBalance: number, newStatus: string }}
 */
const calculateFinalSettlement = (totalPaid, proratedRent) => {
  if (totalPaid > proratedRent) {
    // Tenant has overpaid for the days they actually stayed
    return {
      newTotalRent: proratedRent,
      advanceBalance: totalPaid - proratedRent,
      newStatus: 'overpaid' // or 'paid' depending on standard
    };
  } else if (totalPaid === proratedRent) {
    return {
      newTotalRent: proratedRent,
      advanceBalance: 0,
      newStatus: 'paid'
    };
  } else {
    // totalPaid < proratedRent
    return {
      newTotalRent: proratedRent,
      advanceBalance: 0,
      newStatus: totalPaid > 0 ? 'partial' : 'pending' // Still owes money
    };
  }
};

module.exports = {
  getDaysInMonth,
  calculateDueDate,
  calculateOccupiedDays,
  calculateProratedRent,
  calculateFinalSettlement
};
