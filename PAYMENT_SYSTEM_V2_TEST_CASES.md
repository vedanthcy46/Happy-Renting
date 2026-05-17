'use strict';

/**
 * PAYMENT_SYSTEM_V2_TEST_CASES.md
 * ─────────────────────────────────────────────────────────────────────────────
 * Comprehensive test cases for the new ledger-based payment system
 */

# Test Cases for Payment System V2

## Test Setup

### Prerequisites
- MongoDB running
- Backend server running on http://localhost:5000
- Test data: owner, tenant, property, room

### Test User Setup

```javascript
// Owner credentials
owner = {
  email: 'owner@example.com',
  password: 'password123',
  role: 'owner'
}

// Tenant credentials  
tenant = {
  email: 'tenant@example.com',
  password: 'password123',
  role: 'tenant'
}

// Admin credentials
admin = {
  email: 'admin@example.com',
  password: 'password123',
  role: 'superadmin'
}
```

---

## Test Suite 1: Monthly Rent Record Creation

### TC1.1: Create Rent Record for New Month
**Scenario**: Owner creates rent record for May 2026
**Steps**:
1. POST `/api/v2/payments`
   ```json
   {
     "tenantId": "507f1f77bcf86cd799439011",
     "month": "2026-05",
     "totalRent": 5000
   }
   ```
2. Verify response

**Expected Result**:
- Status 201
- rentRecord created with:
  - totalRent: 5000
  - totalPaid: 0
  - remainingAmount: 5000
  - status: "pending"
  - dueDate: 2026-05-05 (5th of month)

### TC1.2: Get Existing Rent Record (No Duplicate)
**Scenario**: Creating same month rent record again
**Steps**:
1. POST `/api/v2/payments` for May 2026 (second time)
2. Verify response

**Expected Result**:
- Returns existing rent record
- No duplicate created
- Status 201 (or 200 if found)

### TC1.3: Rent Record Shows Correct Due Date
**Scenario**: Verify due date calculation
**Steps**:
1. Tenant configured with `rentDueDay: 10`
2. Create rent record
3. Check dueDate

**Expected Result**:
- dueDate: 2026-05-10 (10th of the month)

---

## Test Suite 2: Single Payment Transaction

### TC2.1: Add Cash Payment
**Scenario**: Owner records cash payment from tenant
**Steps**:
1. Create rent record (May 2026, ₹5000)
2. POST `/api/v2/payments/{rentRecordId}/transactions`
   ```json
   {
     "amount": 5000,
     "paymentMethod": "cash",
     "paymentDate": "2026-05-02",
     "note": "Collected from tenant in person"
   }
   ```
3. Verify response

**Expected Result**:
- Transaction created successfully
- transaction.status: "completed"
- rentRecord.totalPaid: 5000
- rentRecord.remainingAmount: 0
- rentRecord.status: "paid" (auto-calculated)

### TC2.2: Add UPI Payment
**Scenario**: Tenant pays via UPI
**Steps**:
1. POST `/api/v2/payments/{rentRecordId}/transactions`
   ```json
   {
     "amount": 2000,
     "paymentMethod": "upi",
     "transactionId": "UPI202605021234567",
     "note": "Paid via PhonePe"
   }
   ```

**Expected Result**:
- Transaction created with transactionId stored
- transactionId can be used for duplicate prevention

### TC2.3: Add Bank Transfer Payment
**Scenario**: Payment via bank transfer
**Steps**:
1. POST `/api/v2/payments/{rentRecordId}/transactions`
   ```json
   {
     "amount": 2000,
     "paymentMethod": "bank_transfer",
     "transactionId": "NEFT202605021234567",
     "note": "NEFT received"
   }
   ```

**Expected Result**:
- Transaction recorded with NEFT ID

### TC2.4: Add Cheque Payment
**Scenario**: Cheque deposit
**Steps**:
1. POST with `paymentMethod: "cheque"`
   ```json
   {
     "amount": 2000,
     "paymentMethod": "cheque",
     "transactionId": "CHQ12345",
     "note": "Cheque #12345 deposited"
   }
   ```

**Expected Result**:
- Transaction recorded as cheque

---

## Test Suite 3: Multiple Partial Payments (Core Functionality)

### TC3.1: Three Partial Payments Same Month
**Scenario**: Tenant pays in three installments over May
**Steps**:
1. Create rent record: May 2026, ₹5000

2. First payment - Cash:
   ```
   amount: 2000, paymentMethod: cash, date: 2026-05-02
   ```

3. Check state:
   ```
   Expected: totalPaid=2000, status=partial, remainingAmount=3000
   ```

4. Second payment - UPI:
   ```
   amount: 1500, paymentMethod: upi, date: 2026-05-05
   ```

5. Check state:
   ```
   Expected: totalPaid=3500, status=partial, remainingAmount=1500
   ```

6. Third payment - Cheque:
   ```
   amount: 1500, paymentMethod: cheque, date: 2026-05-10
   ```

7. Final state check:
   ```
   Expected: totalPaid=5000, status=paid, remainingAmount=0
   ```

**Expected Result**:
- All three transactions created
- Each transaction immutable (can't edit)
- Status properly transitions: pending → partial → partial → paid
- Final status: "paid"

### TC3.2: View Full Transaction History
**Scenario**: Display all payments for the month
**Steps**:
1. GET `/api/v2/payments/{rentRecordId}`
2. Inspect transactions array

**Expected Result**:
- All 3 transactions returned
- Ordered by date (or reverse date)
- Each has correct amount and method
- Each has recordedBy information

---

## Test Suite 4: Auto-Status Calculation

### TC4.1: Status Auto-Calculation - Pending
**Scenario**: Rent record created but no payment
**Expected**:
- status: "pending"
- totalPaid: 0
- remainingAmount: totalRent

### TC4.2: Status Auto-Calculation - Partial
**Scenario**: Some payment made but not full
**Expected**:
- status: "partial"
- 0 < totalPaid < totalRent

### TC4.3: Status Auto-Calculation - Paid
**Scenario**: Exact or full payment made
**Expected**:
- status: "paid"
- totalPaid >= totalRent
- remainingAmount: 0
- paidOnDate: set to now

### TC4.4: Status Auto-Calculation - Overdue
**Scenario**: Due date passed, payment still pending
**Steps**:
1. Create May rent (dueDate: 2026-05-05)
2. Current date: 2026-05-10
3. No payment made
4. Call `billingServiceV2.updateOverduePayments()`

**Expected**:
- status: "overdue"
- totalPaid: 0

---

## Test Suite 5: Overpayment & Balance Handling

### TC5.1: Overpayment Allowed
**Scenario**: Tenant pays more than due
**Steps**:
1. Rent: ₹5000
2. Payment: ₹6000

**Expected**:
- Transaction: 6000 created
- remainingAmount: -1000 (but stored as 0 with advanceBalance: 1000)
- status: "paid"

### TC5.2: Advance Balance Tracking
**Scenario**: Tenant overpaid, carry forward to next month
**Steps**:
1. Rent May: 5000, paid: 6000 (advance: 1000)
2. Create Rent June: 5000
3. Update to use advance: 1000

**Expected**:
- June rent: 5000
- Advance applied: -1000
- Remaining: 4000

---

## Test Suite 6: Transaction Reversal

### TC6.1: Reverse Completed Transaction
**Scenario**: Owner accidentally recorded duplicate payment
**Steps**:
1. Transaction created: ₹2000 cash
2. Current state: totalPaid: 2000, status: partial
3. DELETE `/api/v2/payments/transactions/{transactionId}`
   ```json
   {
     "reason": "Duplicate entry - already counted in bank transfer"
   }
   ```

**Expected Result**:
- Transaction.status: "reversed"
- Transaction.statusReason: "Duplicate entry..."
- rentRecord.totalPaid: 0 (reduced by 2000)
- rentRecord.status: "pending" (recalculated)
- Transaction not deleted, history preserved

### TC6.2: Cannot Reverse Already Reversed
**Scenario**: Try to reverse reversed transaction
**Steps**:
1. Already reversed transaction
2. Try to DELETE again

**Expected**:
- Error 400: "Can only reverse completed transactions"

### TC6.3: Transaction History Preserved After Reversal
**Scenario**: View payment detail after reversal
**Steps**:
1. Reverse transaction
2. GET `/api/v2/payments/{rentRecordId}`
3. Check transactions array

**Expected**:
- Original transaction still visible
- status: "reversed"
- Can see what was reversed and why

---

## Test Suite 7: Role-Based Access Control

### TC7.1: Owner Can Only See Own Payments
**Scenario**: Owner A tries to see Owner B's payment
**Steps**:
1. Owner A logged in
2. GET `/api/v2/payments/{rentRecordIdBelongingToOwnerB}`

**Expected**:
- Status 403: "Access denied"

### TC7.2: Tenant Can Only See Own Payments
**Scenario**: Tenant tries to see another tenant's payment
**Steps**:
1. Tenant A logged in
2. GET `/api/v2/payments/{rentRecordBelongingToTenantB}`

**Expected**:
- Status 403: "Access denied"

### TC7.3: Admin Can See All Payments
**Scenario**: Super admin views any payment
**Steps**:
1. Admin logged in
2. GET `/api/v2/payments`
3. No filter provided

**Expected**:
- Returns all rent records (superadmin can see everything)

### TC7.4: Tenant Cannot Add Transactions
**Scenario**: Tenant tries to add payment
**Steps**:
1. Tenant logged in
2. POST `/api/v2/payments/{rentRecordId}/transactions`

**Expected**:
- Status 403 or 401: "Access denied"
- (Only owner/superadmin can add transactions)

### TC7.5: Tenant Can View but Cannot Edit
**Scenario**: Tenant views their rent record
**Steps**:
1. GET `/api/v2/payments/{rentRecordId}` (as tenant)
2. Response includes rentRecord and transactions

**Expected**:
- Status 200
- Data accessible
- Cannot POST/PATCH/DELETE

---

## Test Suite 8: Email Notifications

### TC8.1: Email Sent When Transaction Added
**Scenario**: Cash payment recorded
**Expected Emails**:
- To tenant: "Payment Received for 2026-05"
  - Shows amount paid
  - Shows remaining balance
  - Shows transaction date

### TC8.2: Email Shows Completion When Fully Paid
**Scenario**: Final payment makes rent fully paid
**Expected**:
- Email to tenant highlights "✓ Rent Fully Paid"
- Shows amount still owed: ₹0

### TC8.3: Email When Reversed
**Scenario**: Transaction reversed
**Expected**:
- Optional: Email to tenant about reversal? (Depends on business logic)

---

## Test Suite 9: Validation & Error Handling

### TC9.1: Invalid Amount Rejection
**Scenario**: Try to add transaction with 0 or negative amount
**Steps**:
1. POST with `amount: 0` or `amount: -1000`

**Expected**:
- Status 400: "Amount must be greater than 0"

### TC9.2: Invalid Payment Method
**Scenario**: Invalid payment method provided
**Steps**:
1. POST with `paymentMethod: "crypto"`

**Expected**:
- Status 400: "Invalid payment method"

### TC9.3: Invalid Month Format
**Scenario**: Wrong month format
**Steps**:
1. POST with `month: "05-2026"` (wrong order)

**Expected**:
- Status 400: "Month must be in YYYY-MM format"

### TC9.4: Invalid MongoID
**Scenario**: Invalid tenant ID format
**Steps**:
1. POST with `tenantId: "invalid123"`

**Expected**:
- Status 400: "Valid tenant ID required"

### TC9.5: Tenant Not Found
**Scenario**: Valid MongoID but tenant doesn't exist
**Steps**:
1. POST with valid ID format but non-existent tenant

**Expected**:
- Status 404: "Tenant not found"

---

## Test Suite 10: Update Rent Record

### TC10.1: Update Notes
**Scenario**: Owner adds notes to rent record
**Steps**:
1. PATCH `/api/v2/payments/{rentRecordId}`
   ```json
   {
     "notes": "Tenant requested late payment - agreed to 10th"
   }
   ```

**Expected**:
- rentRecord.notes updated
- Other fields unchanged

### TC10.2: Mark Reminder Sent
**Scenario**: Owner sends reminder, marks it
**Steps**:
1. PATCH `/api/v2/payments/{rentRecordId}`
   ```json
   {
     "reminderSent": true
   }
   ```

**Expected**:
- reminderSent: true
- reminderSentAt: set to now

### TC10.3: Update Total Rent (Increase)
**Scenario**: Mid-month rent increase
**Steps**:
1. Rent record created: totalRent: 5000
2. PATCH `/api/v2/payments/{rentRecordId}`
   ```json
   {
     "totalRent": 5500
   }
   ```

**Expected**:
- totalRent: 5500
- remainingAmount recalculated
- Example: if totalPaid: 2000, now remainingAmount: 3500

---

## Test Suite 11: Dashboard Metrics

### TC11.1: Get Summary Metrics
**Scenario**: Owner views payment dashboard
**Steps**:
1. GET `/api/v2/payments/summary/metrics`
2. Owner has 10 tenants, various payment states

**Expected Response**:
```json
{
  "totalDue": 50000,          // 10 tenants × 5000
  "totalCollected": 35000,    // Sum of all paid amounts
  "totalOutstanding": 15000,  // Difference
  "paidCount": 7,             // Rent records with status=paid
  "partialCount": 2,          // status=partial
  "pendingCount": 1,          // status=pending
  "overdueCount": 0           // status=overdue
}
```

### TC11.2: Filter Metrics by Property
**Scenario**: Get metrics for specific property only
**Steps**:
1. GET `/api/v2/payments/summary/metrics?propertyId=507f...`

**Expected**:
- Metrics only for that property's tenants
- Other properties excluded

---

## Test Suite 12: Transaction History Timeline

### TC12.1: Get All Transactions
**Scenario**: View all transactions across tenants
**Steps**:
1. GET `/api/v2/payments/history/transactions`

**Expected**:
- All transactions for owner's properties
- Sorted by paymentDate (descending)
- Each includes rentRecordId with month info

### TC12.2: Filter by Tenant
**Scenario**: Get transactions for specific tenant only
**Steps**:
1. GET `/api/v2/payments/history/transactions?tenantId=507f...`

**Expected**:
- Only that tenant's transactions
- Across all months for that tenant

### TC12.3: Filter by Rent Record
**Scenario**: Get transactions for specific month only
**Steps**:
1. GET `/api/v2/payments/history/transactions?rentRecordId=507f...`

**Expected**:
- Only transactions for that specific month
- All three payments if partial

---

## Test Suite 13: Real-World Scenarios

### Scenario 1: Tenant Joining Mid-Month

**Timeline**:
- May 1: Tenant joins mid-month (half rent: ₹2500)
- May 15: Tenant pays ₹2500
- June 1: Full rent (₹5000) created

**Test**:
1. Create May rent: ₹2500
2. Add payment: ₹2500
3. Verify status: "paid"
4. Create June rent: ₹5000 (new month, fresh)
5. Verify separate records

**Expected**:
- Two separate rent records
- May shows fully paid
- June starts fresh

### Scenario 2: Partial Payment Late in Month

**Timeline**:
- May 5: Due date passes
- May 10: Owner marks as overdue
- May 15: Tenant pays ₹3000 partial
- May 20: Tenant pays remaining ₹2000

**Test**:
1. Create May rent: ₹5000 (due 2026-05-05)
2. Call updateOverduePayments() on 2026-05-10
3. Verify status: "overdue"
4. Add transaction: ₹3000
5. Verify status: "partial" (overdue clears? or stays overdue?)
6. Add transaction: ₹2000
7. Verify status: "paid"

### Scenario 3: Multiple Tenants, Mixed Statuses

**Setup**:
- 5 tenants with May rent ₹5000 each
- Tenant A: paid full
- Tenant B: paid partial (₹2000)
- Tenant C: paid nothing (pending)
- Tenant D: paid nothing (overdue)
- Tenant E: paid extra (₹6000 - advance)

**Test**:
1. Create all rent records
2. Add appropriate transactions
3. GET `/api/v2/payments/summary/metrics`
4. Verify:
   - totalDue: 25000
   - totalCollected: 15000
   - totalOutstanding: 10000
   - paidCount: 1 (Tenant A)
   - partialCount: 2 (B and E)
   - pendingCount: 1 (C)
   - overdueCount: 1 (D)

---

## Automated Test Commands

```bash
# Run all tests
npm test -- --testNamePattern="PaymentV2"

# Run specific suite
npm test -- --testNamePattern="TC3"

# Run with verbose output
npm test -- --verbose

# Watch mode for development
npm test -- --watch --testNamePattern="PaymentV2"
```

---

## Performance Test

### Load Test: Create 100 Transactions

**Steps**:
1. Create 100 Payment records (multiple owners)
2. For each, add 3-5 transactions
3. Measure response times

**Expected**:
- API responses < 500ms
- No timeout errors
- Database indexes working

**Command**:
```bash
node scripts/performanceTest.js --transactions 100
```

---

## Checklist for Tester

- [ ] All 13 test suites passed
- [ ] No data corruption observed
- [ ] Emails send correctly
- [ ] Audit logs created
- [ ] No unhandled exceptions
- [ ] Performance acceptable
- [ ] UI responsive during operations
- [ ] Security checks passed
- [ ] Error messages clear

---

## Known Issues & Workarounds

(To be populated during testing)

1. Issue: ...
   Workaround: ...

---

## Sign-Off

- Tested by: _________
- Date: _________
- Status: ⬜ PASS / ⬜ FAIL
- Comments: _________
