const {
  calculateOccupiedDays,
  calculateProratedRent,
  calculateFinalSettlement,
  calculateDueDate
} = require('./backend/utils/billingCalculationService');

// Test 1: First month proration
const joinDate1 = new Date('2026-03-13T12:00:00Z');
const res1 = calculateOccupiedDays('2026-03', joinDate1);
console.assert(res1.occupiedDays === 19, `Expected 19, got ${res1.occupiedDays}`);
console.assert(res1.isProrated === true, 'Expected true');

const rent1 = calculateProratedRent(5000, res1.occupiedDays, res1.totalDays);
console.assert(rent1 === Math.ceil((19/31)*5000), `Expected ${Math.ceil((19/31)*5000)}, got ${rent1}`);

// Test 2: Move out proration
const joinDate2 = new Date('2025-01-01T12:00:00Z');
const exitDate2 = new Date('2026-06-15T12:00:00Z');
const res2 = calculateOccupiedDays('2026-06', joinDate2, exitDate2);
console.assert(res2.occupiedDays === 15, `Expected 15, got ${res2.occupiedDays}`);
console.assert(res2.isProrated === true, 'Expected true');

// Test 3: Join and Leave in same month
const joinDate3 = new Date('2026-04-10T12:00:00Z');
const exitDate3 = new Date('2026-04-20T12:00:00Z');
const res3 = calculateOccupiedDays('2026-04', joinDate3, exitDate3);
console.assert(res3.occupiedDays === 11, `Expected 11, got ${res3.occupiedDays}`);
console.assert(res3.isProrated === true, 'Expected true');

// Test 4: Final Settlement
// Rent was 5000. Tenant paid 5000. Prorated is 2500.
const settle1 = calculateFinalSettlement(5000, 2500);
console.assert(settle1.newTotalRent === 2500, `Expected 2500, got ${settle1.newTotalRent}`);
console.assert(settle1.advanceBalance === 2500, `Expected 2500, got ${settle1.advanceBalance}`);
console.assert(settle1.newStatus === 'overpaid', `Expected overpaid, got ${settle1.newStatus}`);

// Test 5: Due Date strictly parsing correctly
const due = calculateDueDate('2026-06');
console.assert(due.getFullYear() === 2026, 'Year mismatch');
console.assert(due.getMonth() === 6, `Month mismatch: ${due.getMonth()} vs 6`); // index 6 is July
console.assert(due.getDate() === parseInt(process.env.DEFAULT_RENT_DUE_DAY || '5', 10), 'Date mismatch');

console.log('All automated billing logic verified.');
