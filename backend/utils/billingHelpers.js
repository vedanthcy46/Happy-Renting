'use strict';

/**
 * billingHelpers.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Timezone-safe, leap-year-safe calendar-billing math and range generation.
 */

/**
 * getDaysInMonth(year, month)
 * Returns the total days in a month.
 * @param {number} year - e.g. 2026
 * @param {number} month - 1-indexed (1 = Jan, 12 = Dec)
 * @returns {number}
 */
const getDaysInMonth = (year, month) => {
  return new Date(year, month, 0).getDate();
};

/**
 * calculateProratedRent(monthlyRent, occupiedDays, totalDays)
 * Returns prorated rent rounded up using Math.ceil().
 * @param {number} monthlyRent
 * @param {number} occupiedDays
 * @param {number} totalDays
 * @returns {number}
 */
const calculateProratedRent = (monthlyRent, occupiedDays, totalDays) => {
  if (occupiedDays >= totalDays) return monthlyRent;
  if (occupiedDays <= 0) return 0;
  return Math.ceil((occupiedDays / totalDays) * monthlyRent);
};

/**
 * generateMonthlyBillingPeriod(monthStr)
 * Generates the start and end Date objects and metadata for a calendar month.
 * @param {string} monthStr - Format "YYYY-MM" (e.g. "2026-03")
 * @returns {{ start: Date, end: Date, totalDays: number, year: number, monthIndex: number }}
 */
const generateMonthlyBillingPeriod = (monthStr) => {
  const [yearStr, monthIndexStr] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthIndexStr, 10); // 1-indexed

  const totalDays = getDaysInMonth(year, monthIndex);
  
  // Create dates in local / system timezone safely
  const start = new Date(year, monthIndex - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex - 1, totalDays, 23, 59, 59, 999);

  return {
    start,
    end,
    totalDays,
    year,
    monthIndex
  };
};

module.exports = {
  getDaysInMonth,
  calculateProratedRent,
  generateMonthlyBillingPeriod
};
