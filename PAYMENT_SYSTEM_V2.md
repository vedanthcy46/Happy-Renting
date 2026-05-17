# Payment System Refactoring (V2) - Ledger-Based Architecture

## Overview

This document describes the new ledger-based payment system for Happy Renting that replaces the immutable monthly payment model.

**Key Change**: From one payment record per month → Multiple transactions per month under a monthly rent record.

---

## Problems Solved

### Previous Architecture Issues
1. ❌ **Immutable monthly records** - Cannot edit payments once created
2. ❌ **One transaction per month** - Cannot add multiple partial payments
3. ❌ **Blocking duplicate month entries** - Cannot add to existing payments
4. ❌ **Poor cash payment support** - Manual entries treated differently
5. ❌ **No transaction history** - History gets overwritten on updates
6. ❌ **Status update failures** - "Payment already exists for this month"

### New Architecture Advantages
1. ✅ **Editable rent records** - Update notes, flags, amounts
2. ✅ **Multiple transactions** - Add unlimited transactions per month
3. ✅ **Proper ledger** - Immutable transaction history
4. ✅ **Cash payments** - First-class support for manual cash entries
5. ✅ **Audit trail** - Complete transaction history preserved
6. ✅ **Flexible workflow** - Partial payments, multiple methods, adjustments

---

## Architecture

### Two New Models

#### 1. **MonthlyRentRecord**
Represents the monthly rent obligation.

```javascript
{
  tenantId,           // Reference to tenant
  month: "2026-05",   // Billing month
  totalRent: 5000,    // What's due this month
  totalPaid: 3000,    // Sum of all transactions
  remainingAmount: 2000,  // Auto-calculated
  status: "partial",  // pending | partial | paid | overdue
  dueDate,           // When is rent due?
  notes,             // Admin notes about this month
  reminderSent,      // Has reminder been sent?
  advanceBalance,    // Overpayment carried forward
}
```

**Key Features:**
- One record per tenant per month (unique constraint)
- Status auto-calculated based on amounts
- Editable for owner/admin
- Remaini Amount recalculated on save

#### 2. **PaymentTransaction**
Represents individual payment transactions.

```javascript
{
  rentRecordId,      // Which month's rent?
  tenantId,          // Quick tenant lookup
  ownerId,           // Quick owner lookup
  amount: 2000,      // How much paid?
  paymentMethod: "cash",  // cash | upi | bank_transfer | cheque | other
  transactionId,     // UPI ref, bank transfer ID, etc.
  paymentDate,       // When was it paid?
  note,              // "Paid via UPI", "Cash collected", etc.
  proofImage,        // Screenshot/receipt URL
  recordedBy,        // Who recorded this?
  status: "completed",  // completed | reversed | failed
}
```

**Key Features:**
- Immutable once created (for audit)
- Can be reversed (creates history, doesn't delete)
- Multiple per rent record
- Tracks who recorded it
- Supports proof images

---

## API Endpoints

### Base URL: `/api/v2/payments`

### Monthly Rent Records

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List rent records |
| GET | `/:rentRecordId` | Get record with transactions |
| POST | `/` | Create rent record |
| PATCH | `/:rentRecordId` | Update rent record |

### Payment Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/:rentRecordId/transactions` | Add payment transaction |
| DELETE | `/transactions/:transactionId` | Reverse transaction |

### Summaries

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/summary/metrics` | Get dashboard metrics |
| GET | `/history/transactions` | Get transaction timeline |

---

## Usage Examples

### Example 1: Generate Monthly Bill

```bash
POST /api/v2/payments
{
  "tenantId": "507f1f77bcf86cd799439011",
  "month": "2026-05",
  "totalRent": 5000
}
```

Response:
```json
{
  "success": true,
  "rentRecord": {
    "_id": "507f...",
    "month": "2026-05",
    "totalRent": 5000,
    "totalPaid": 0,
    "remainingAmount": 5000,
    "status": "pending",
    "dueDate": "2026-05-05"
  }
}
```

### Example 2: Tenant Makes Partial Cash Payment

```bash
POST /api/v2/payments/507f.../transactions
{
  "amount": 2000,
  "paymentMethod": "cash",
  "note": "Collected from tenant in person",
  "paymentDate": "2026-05-02"
}
```

Response:
```json
{
  "success": true,
  "transaction": {
    "_id": "507f...",
    "amount": 2000,
    "paymentMethod": "cash",
    "status": "completed",
    "paymentDate": "2026-05-02T00:00:00Z"
  },
  "rentRecord": {
    "totalPaid": 2000,
    "remainingAmount": 3000,
    "status": "partial"
  }
}
```

### Example 3: Add UPI Payment (After Cash)

```bash
POST /api/v2/payments/507f.../transactions
{
  "amount": 2000,
  "paymentMethod": "upi",
  "transactionId": "202605021234567",
  "note": "Tenant paid via PhonePe",
  "paymentDate": "2026-05-04"
}
```

Response:
```json
{
  "success": true,
  "transaction": { ... },
  "rentRecord": {
    "totalPaid": 4000,
    "remainingAmount": 1000,
    "status": "partial"
  }
}
```

### Example 4: Final Payment - Rent Fully Paid

```bash
POST /api/v2/payments/507f.../transactions
{
  "amount": 1000,
  "paymentMethod": "bank_transfer",
  "transactionId": "NEFT123456789",
  "paymentDate": "2026-05-10"
}
```

Response:
```json
{
  "success": true,
  "rentRecord": {
    "totalPaid": 5000,
    "remainingAmount": 0,
    "status": "paid",        // Auto-marked as paid!
    "paidOnDate": "2026-05-10T00:00:00Z"
  }
}
```

### Example 5: View Full Payment Record with History

```bash
GET /api/v2/payments/507f...
```

Response:
```json
{
  "success": true,
  "rentRecord": {
    "_id": "507f...",
    "month": "2026-05",
    "totalRent": 5000,
    "totalPaid": 5000,
    "remainingAmount": 0,
    "status": "paid",
    "dueDate": "2026-05-05",
    "paidOnDate": "2026-05-10"
  },
  "transactions": [
    {
      "_id": "txn001",
      "amount": 2000,
      "paymentMethod": "cash",
      "paymentDate": "2026-05-02",
      "note": "Collected from tenant in person",
      "recordedBy": { "name": "Owner Name" }
    },
    {
      "_id": "txn002",
      "amount": 2000,
      "paymentMethod": "upi",
      "transactionId": "202605021234567",
      "paymentDate": "2026-05-04",
      "recordedBy": { "name": "Owner Name" }
    },
    {
      "_id": "txn003",
      "amount": 1000,
      "paymentMethod": "bank_transfer",
      "transactionId": "NEFT123456789",
      "paymentDate": "2026-05-10",
      "recordedBy": { "name": "Owner Name" }
    }
  ]
}
```

### Example 6: Reverse a Transaction (Refund)

```bash
DELETE /api/v2/payments/transactions/txn002
{
  "reason": "Duplicate transaction - already counted in bank transfer"
}
```

Response:
```json
{
  "success": true,
  "transaction": {
    "_id": "txn002",
    "status": "reversed",
    "statusReason": "Duplicate transaction - already counted in bank transfer"
  },
  "rentRecord": {
    "totalPaid": 3000,     // Reduced by reversed amount
    "remainingAmount": 2000,
    "status": "partial"
  }
}
```

### Example 7: Dashboard Metrics

```bash
GET /api/v2/payments/summary/metrics
```

Response:
```json
{
  "success": true,
  "metrics": {
    "totalDue": 45000,
    "totalCollected": 35000,
    "totalOutstanding": 10000,
    "paidCount": 8,
    "partialCount": 3,
    "pendingCount": 2,
    "overdueCount": 1
  }
}
```

---

## Business Logic

### Status Calculation (Automatic)

Statuses are calculated automatically before saving:

```
IF remainingAmount == 0
  → status = "paid"
  → paidOnDate = now

IF remainingAmount > 0 AND totalPaid > 0
  → status = "partial"

IF dueDate < now AND remainingAmount > 0
  → status = "overdue"

IF totalPaid == 0
  → status = "pending"
```

### Preventing Overpayment

The system allows overpayment to support:
- Advance payments
- Adjustments
- Tenant credit balance

However, single transaction cannot exceed remaining amount for safety.

### Cash Payment Workflow

1. Owner records payment immediately
2. System creates transaction & updates rent record
3. Tenant receives email confirmation
4. No need for pending verification

### Partial Payment Workflow

1. Tenant pays ₹2000 via UPI
   - Transaction created
   - Rent record updated: `totalPaid=2000, status=partial`
   - Tenant notified

2. Tenant pays ₹3000 cash later
   - Another transaction created (same month)
   - Rent record updated: `totalPaid=5000, status=paid`
   - Tenant notified again

---

## Migration Strategy

### Phase 1: Dual System
- Both V1 (old `/api/payments`) and V2 (`/api/v2/payments`) run simultaneously
- Frontend can migrate gradually
- No forced cutover

### Phase 2: Data Migration (Optional)
- Script to migrate old payment records to new format
- Create MonthlyRentRecord for each Payment
- Create single PaymentTransaction for each completed payment

### Phase 3: Deprecation
- Mark V1 endpoints as deprecated
- Encourage migration to V2
- Eventually sunset V1

---

## Security Rules

### Role-Based Access

**Owner:**
- Can only see their own properties' payments
- Can add transactions to their tenants
- Can update their rent records
- Cannot edit tenant information

**Tenant:**
- Can see their own rent records & transactions
- Can view transaction history
- Cannot edit rent amounts (read-only)

**Super Admin:**
- Can see all payments across platform
- Can manage all transactions
- Full audit access

### Data Validation

- Amounts must be positive
- Payment methods must be valid
- Month format enforced (YYYY-MM)
- MongoIDs validated
- No negative remaining amounts

---

## Audit Trail

Every action is logged:

| Action | Logged Data |
|--------|-------------|
| Add transaction | who, amount, method, timestamp, note |
| Update rent record | who, what changed, timestamp |
| Reverse transaction | who, reason, original amount, timestamp |
| Send reminder | who sent it, timestamp |

Access via: `GET /api/activity-logs?entityId=...`

---

## Real-World Scenarios

### Scenario 1: Tenant Pays Late

```
May 1st: ₹5000 due
May 5th: Due date passes → status = "overdue"
May 15th: Tenant pays ₹5000 → status = "paid"
```

Timeline in system:
```
RentRecord:
  month: "2026-05"
  totalRent: 5000
  status: overdue → paid
  paidOnDate: 2026-05-15

Transactions:
  1. cash ₹5000 @ 2026-05-15
```

### Scenario 2: Partial Payments Over Month

```
May 2nd:  Cash ₹2000 → partial
May 5th:  UPI ₹1500 → partial
May 10th: Cheque ₹1500 → paid
```

Timeline:
```
Transactions:
  1. cash ₹2000 @ 2026-05-02
  2. upi ₹1500 @ 2026-05-05
  3. cheque ₹1500 @ 2026-05-10

RentRecord:
  totalPaid: 5000 (sum of all)
  status: paid
```

### Scenario 3: Overpayment / Advance

```
June: Tenant pays ₹6000 for ₹5000 rent
System: Creates ₹1000 credit
```

Options:
- Carry forward to next month
- Store as `advanceBalance`
- Auto-adjust next month's rent

### Scenario 4: Rent Correction Mid-Month

```
May 15th: Owner realizes rent was ₹4500, not ₹5000
Action: Update rent record totalRent = 4500
Result: Automatic recalculation of remaining amount
```

Before:
```
totalRent: 5000
totalPaid: 3000
remainingAmount: 2000
```

After:
```
totalRent: 4500
totalPaid: 3000
remainingAmount: 1500
status: partial
```

---

## Testing Checklist

```
✅ Create monthly rent record
✅ Add first payment transaction
✅ Add second payment (same month)
✅ View full payment history
✅ Verify status auto-calculation
✅ Reverse a transaction
✅ View updated balances
✅ Check transaction immutability
✅ Test role-based access
✅ Test overpayment handling
✅ Test email notifications
✅ Test audit logging
✅ Test with cash payments
✅ Test with online payments
✅ Test mixed payment methods
✅ Test overdue calculation
✅ Test partial to paid flow
```

---

## Troubleshooting

### Issue: Remaining Amount is Negative
**Cause**: Data corruption or bug
**Fix**: Manually update totalRent in rent record
**Prevention**: Amount validation in controller

### Issue: Transaction Not Appearing
**Cause**: Owner-Tenant mismatch
**Fix**: Verify ownerId matches request user
**Solution**: Frontend should pre-validate

### Issue: Email Not Sent
**Cause**: Invalid email address or Resend API issue
**Fix**: Check logs for email service errors
**Solution**: Resend email manually from admin panel

---

## Performance Considerations

### Indexes
- `{ tenantId: 1, month: 1 }` - Finding rent records
- `{ ownerId: 1 }` - Owner queries
- `{ rentRecordId: 1 }` - Transaction lookups
- `{ transactionId: 1 }` - Duplicate prevention

### Lazy Billing
- Automatically generates bills when owner views payments
- Updates overdue status on view
- No separate cron job needed (but cron can still run)

### Query Optimization
- Lean queries for list endpoints
- Populate only needed fields
- Pagination can be added if needed

---

## Future Enhancements

1. **Receipt Generation**: PDF receipts for each transaction
2. **Payment Plans**: Allow split payments over multiple months
3. **Automatic Reminders**: Send due reminders before dueDate
4. **Smart Ledger**: Track security deposits, advances separately
5. **Analytics**: Payment trends, collection rates, etc.
6. **Webhooks**: Third-party integrations for payments
7. **Multi-Currency**: Support for different currencies
8. **Subscription Billing**: Recurring payment automation

---

## Support & Questions

For issues or questions about the new payment system, refer to:
- API Documentation: `/api/v2/payments` endpoints
- Controller: `backend/controllers/paymentControllerV2.js`
- Models: `backend/models/MonthlyRentRecord.js`, `PaymentTransaction.js`
- Services: `backend/services/paymentServiceV2.js`, `billingServiceV2.js`
