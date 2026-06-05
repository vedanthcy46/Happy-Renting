const {
  calculateOccupiedDays,
  calculateProratedRent,
  calculateDueDate
} = require('./backend/utils/billingCalculationService');

// Test 1: Leap Year Proration (February 2024 has 29 days)
const leapYearJoin = new Date('2024-01-31T12:00:00Z');
const resLeap = calculateOccupiedDays('2024-02', leapYearJoin); // Month is Feb
// Since they joined on Jan 31, their occupancy in Feb is the full month
console.assert(resLeap.occupiedDays === 29, `Leap Year: Expected 29, got ${resLeap.occupiedDays}`);
console.assert(resLeap.totalDays === 29, `Leap Year: Expected 29 total days, got ${resLeap.totalDays}`);

// Test 2: Standard Year Proration (February 2026 has 28 days)
const standardYearJoin = new Date('2026-01-31T12:00:00Z');
const resStandard = calculateOccupiedDays('2026-02', standardYearJoin); 
console.assert(resStandard.occupiedDays === 28, `Standard Year: Expected 28, got ${resStandard.occupiedDays}`);
console.assert(resStandard.totalDays === 28, `Standard Year: Expected 28 total days, got ${resStandard.totalDays}`);

// Test 3: Leap Year Mid-Month Proration
const leapYearMidJoin = new Date('2024-02-15T12:00:00Z');
const resLeapMid = calculateOccupiedDays('2024-02', leapYearMidJoin);
// 29 - 15 + 1 = 15 days
console.assert(resLeapMid.occupiedDays === 15, `Leap Year Mid: Expected 15, got ${resLeapMid.occupiedDays}`);
const leapProratedRent = calculateProratedRent(6000, resLeapMid.occupiedDays, resLeapMid.totalDays);
console.assert(leapProratedRent === Math.ceil((15/29)*6000), `Leap Rent: Expected ${Math.ceil((15/29)*6000)}, got ${leapProratedRent}`);

// Test 4: Due Date
process.env.GLOBAL_RENT_DUE_DAY = '10';
const dueDate = calculateDueDate('2026-06');
console.assert(dueDate.getMonth() === 6, 'Due date should be next month (index 6 = July)');
console.assert(dueDate.getDate() === 10, 'Due date should be 10 based on GLOBAL_RENT_DUE_DAY');
process.env.GLOBAL_RENT_DUE_DAY = ''; // reset

console.log('Post-Paid Billing Logic & Leap Year Verification Passed');
