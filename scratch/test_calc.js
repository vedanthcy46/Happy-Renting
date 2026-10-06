const { calculateOccupiedDays, calculateProratedRent } = require('./backend/utils/billingCalculationService');

const joinDate = new Date('2026-10-15T00:00:00.000Z');
const exitDate = null;
const targetMonthStr = '2026-10';

const { occupiedDays, totalDays, isProrated } = calculateOccupiedDays(targetMonthStr, joinDate, exitDate);
const billedRent = isProrated ? calculateProratedRent(10000, occupiedDays, totalDays) : 10000;

console.log({ occupiedDays, totalDays, isProrated, billedRent });
