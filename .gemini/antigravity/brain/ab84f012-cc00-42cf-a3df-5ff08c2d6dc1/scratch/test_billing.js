'use strict';

const { getDaysInMonth, calculateProratedRent, generateMonthlyBillingPeriod } = require('c:/Users/hp victus/Documents/Rent House/backend/utils/billingHelpers');

const testCases = [
  {
    name: 'March 2026 joined on 1st day (Full Month)',
    monthlyRent: 5000,
    occupiedDays: 31,
    totalDays: 31,
    expected: 5000
  },
  {
    name: 'March 2026 joined on 13th day (Prorated Join)',
    monthlyRent: 5000,
    occupiedDays: 19, // 31 - 13 + 1
    totalDays: 31,
    expected: 3065 // Math.ceil((19/31) * 5000) = 3065
  },
  {
    name: 'Feb 2026 joined on 15th day (Non-Leap Year Feb Proration)',
    monthlyRent: 10000,
    occupiedDays: 14, // 28 - 15 + 1
    totalDays: 28,
    expected: 5000
  },
  {
    name: 'Feb 2028 joined on 15th day (Leap Year Feb Proration)',
    monthlyRent: 10000,
    occupiedDays: 15, // 29 - 15 + 1
    totalDays: 29,
    expected: 5173 // Math.ceil((15/29) * 10000) = 5173
  },
  {
    name: 'March 2026 vacated mid-month on 10th (Prorated Move-Out)',
    monthlyRent: 5000,
    occupiedDays: 10,
    totalDays: 31,
    expected: 1613 // Math.ceil((10/31) * 5000) = 1613
  }
];

console.log('=== RUNNING BILLING MATH TESTS ===');
let failed = false;
for (const tc of testCases) {
  const actual = calculateProratedRent(tc.monthlyRent, tc.occupiedDays, tc.totalDays);
  const passed = actual === tc.expected;
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${tc.name}:`);
  console.log(`  Occ/Total: ${tc.occupiedDays}/${tc.totalDays} days`);
  console.log(`  Amount: Rent ₹${tc.monthlyRent} -> Expected ₹${tc.expected}, Actual ₹${actual}`);
  if (!passed) failed = true;
}

if (!failed) {
  console.log('\n✓ ALL MATHEMATICAL PRORATION FORMULAS PASS PERFECTLY!');
} else {
  console.log('\n✗ SOME TEST CASES FAILED. PLEASE VERIFY CALCULATIONS.');
}
