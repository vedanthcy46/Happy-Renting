# Payment System V2 - Quick Start Guide

## For Backend Developers

### 1. Using the New Payment Service

```javascript
const paymentServiceV2 = require('../services/paymentServiceV2');

// Create monthly rent record
const rentRecord = await paymentServiceV2.ensureMonthlyRentRecord(
  tenantId,
  "2026-05",  // YYYY-MM format
  5000,       // totalRent
  { notes: "Custom notes here" }
);

// Add payment transaction
const transaction = await paymentServiceV2.addPaymentTransaction(
  {
    rentRecordId: rentRecord._id,
    tenantId,
    amount: 2000,
    paymentMethod: "cash",
    note: "Collected in person",
    paymentDate: new Date("2026-05-02")
  },
  { id: userId, role: 'owner' }  // caller info
);

// Fetch rent record with transactions
const { rentRecord, transactions } = 
  await paymentServiceV2.getMonthlyRentRecordWithTransactions(rentRecordId);

// Update rent record (notes, flags)
const updated = await paymentServiceV2.updateMonthlyRentRecord(
  rentRecordId,
  { notes: "New notes", reminderSent: true },
  { id: userId, role: 'owner' }
);

// Reverse a transaction
const reversed = await paymentServiceV2.reverseTransaction(
  transactionId,
  "Duplicate entry",
  { id: userId, role: 'owner' }
);
```

### 2. Billing Service

```javascript
const billingServiceV2 = require('../services/billingServiceV2');

// Auto-generate monthly bills for all active tenants
await billingServiceV2.generateMonthlyBills(ownerId);

// Mark overdue payments
await billingServiceV2.updateOverduePayments(ownerId);

// Get metrics
const metrics = await billingServiceV2.getSummaryMetrics(ownerId, {
  propertyId: "..." // optional filter
});

// Returns:
// {
//   totalDue: 45000,
//   totalCollected: 35000,
//   totalOutstanding: 10000,
//   paidCount: 8,
//   partialCount: 3,
//   pendingCount: 2,
//   overdueCount: 1
// }
```

### 3. Models

```javascript
const MonthlyRentRecord = require('../models/MonthlyRentRecord');
const PaymentTransaction = require('../models/PaymentTransaction');

// Query rent records
const records = await MonthlyRentRecord.find({ ownerId, status: 'pending' });

// Query transactions
const txns = await PaymentTransaction.find({ rentRecordId });

// Populate relationships
const record = await MonthlyRentRecord.findById(id)
  .populate('tenantId')
  .populate('ownerId')
  .populate('propertyId')
  .populate('roomId');
```

---

## For Frontend Developers

### 1. Display Rent Record with Transactions

```javascript
// Fetch
const response = await axios.get(`/api/v2/payments/${rentRecordId}`, {
  headers: { Authorization: `Bearer ${token}` }
});

const { rentRecord, transactions } = response.data;

// rentRecord
{
  _id: "...",
  month: "2026-05",
  totalRent: 5000,
  totalPaid: 3500,
  remainingAmount: 1500,
  status: "partial",
  dueDate: "2026-05-05T00:00:00Z",
  paidOnDate: null,
  notes: "...",
  reminderSent: false
}

// transactions
[
  {
    _id: "txn001",
    amount: 2000,
    paymentMethod: "cash",
    transactionId: null,
    paymentDate: "2026-05-02T00:00:00Z",
    note: "Collected in person",
    recordedBy: { _id: "...", name: "Owner Name" },
    status: "completed"
  },
  {
    _id: "txn002",
    amount: 1500,
    paymentMethod: "upi",
    transactionId: "UPI202605021234567",
    paymentDate: "2026-05-05T10:30:00Z",
    note: "Tenant paid via PhonePe",
    recordedBy: { _id: "...", name: "Owner Name" },
    status: "completed"
  }
]
```

### 2. Add Payment Transaction

```javascript
// Owner adds payment
const response = await axios.post(
  `/api/v2/payments/${rentRecordId}/transactions`,
  {
    amount: 2000,
    paymentMethod: "cash",
    note: "Collected from tenant",
    paymentDate: "2026-05-02",
    transactionId: null  // optional
  },
  { headers: { Authorization: `Bearer ${token}` } }
);

const { transaction, rentRecord } = response.data;
// Display transaction added
// Update rent record display with new totals
```

### 3. Display Payment Status UI

```javascript
// Helper function
function getStatusColor(status) {
  const colors = {
    paid: 'green',
    partial: 'blue',
    pending: 'gray',
    overdue: 'red'
  };
  return colors[status];
}

function getStatusIcon(status) {
  const icons = {
    paid: '✓',
    partial: '◐',
    pending: '○',
    overdue: '!'
  };
  return icons[status];
}

// In JSX
<div className={`status-badge status-${status}`}>
  <span>{getStatusIcon(status)} {status.toUpperCase()}</span>
</div>
```

### 4. Show Payment Progress

```javascript
// Calculate percentages
const percentage = (rentRecord.totalPaid / rentRecord.totalRent) * 100;

<div className="payment-progress">
  <div className="progress-bar">
    <div className="progress" style={{ width: `${percentage}%` }}></div>
  </div>
  <p>
    ₹{rentRecord.totalPaid.toLocaleString()} / ₹{rentRecord.totalRent.toLocaleString()} paid
  </p>
  <p>Remaining: ₹{rentRecord.remainingAmount.toLocaleString()}</p>
</div>
```

### 5. Transaction Timeline

```javascript
// Sort transactions by date (descending)
const sorted = transactions.sort((a, b) => 
  new Date(b.paymentDate) - new Date(a.paymentDate)
);

// Render timeline
{sorted.map((txn) => (
  <div key={txn._id} className="transaction-item">
    <div className="txn-header">
      <span className="amount">+₹{txn.amount.toLocaleString()}</span>
      <span className="method">{txn.paymentMethod.toUpperCase()}</span>
      <span className="date">
        {new Date(txn.paymentDate).toLocaleDateString()}
      </span>
    </div>
    <div className="txn-detail">
      <p className="note">{txn.note}</p>
      {txn.transactionId && (
        <p className="ref-id">Ref: {txn.transactionId}</p>
      )}
      <p className="recorded-by">Recorded by: {txn.recordedBy.name}</p>
    </div>
  </div>
))}
```

### 6. Reverse Transaction (Admin)

```javascript
async function reverseTransaction(transactionId) {
  try {
    const response = await axios.delete(
      `/api/v2/payments/transactions/${transactionId}`,
      {
        data: { reason: "Duplicate entry - already counted in bank transfer" },
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    // Update UI
    showToast("Transaction reversed successfully", "success");
    refreshPaymentData();
  } catch (error) {
    showToast("Failed to reverse transaction", "error");
  }
}
```

### 7. Dashboard Metrics

```javascript
// Fetch
const response = await axios.get('/api/v2/payments/summary/metrics', {
  headers: { Authorization: `Bearer ${token}` }
});

const metrics = response.data.metrics;

// Display
<div className="metrics-grid">
  <div className="metric">
    <h3>Total Due</h3>
    <p>₹{metrics.totalDue.toLocaleString()}</p>
  </div>
  <div className="metric">
    <h3>Collected</h3>
    <p>₹{metrics.totalCollected.toLocaleString()}</p>
  </div>
  <div className="metric">
    <h3>Outstanding</h3>
    <p>₹{metrics.totalOutstanding.toLocaleString()}</p>
  </div>
  <div className="metric">
    <h3>Paid Months</h3>
    <p>{metrics.paidCount}</p>
  </div>
  <div className="metric">
    <h3>Partial Payments</h3>
    <p>{metrics.partialCount}</p>
  </div>
  <div className="metric alert">
    <h3>Overdue</h3>
    <p>{metrics.overdueCount}</p>
  </div>
</div>
```

---

## Migration Checklist for Frontend

### Payment Pages to Update

- [ ] Payments Dashboard
  - [ ] Add link to V2 endpoints
  - [ ] Display metrics from V2 API
  - [ ] Show transaction history

- [ ] Payment Detail Page
  - [ ] Fetch from `/api/v2/payments/:rentRecordId`
  - [ ] Display rent record info
  - [ ] Display transaction timeline
  - [ ] Add "Record Payment" button

- [ ] Tenant Payment Page
  - [ ] Show remaining balance
  - [ ] Display payment history (read-only for tenant)
  - [ ] Show due date and status

- [ ] Owner Add Payment Form
  - [ ] Convert to new endpoint
  - [ ] Add paymentMethod dropdown
  - [ ] Optional transaction ID field
  - [ ] Optional proof image upload
  - [ ] Show real-time balance update

### Common Issues & Fixes

**Issue**: 404 on `/api/v2/payments`
- **Fix**: Ensure routes are properly imported in server.js
- **Check**: `backend/server.js` line ~110

**Issue**: Field names different
- **Old**: `payment.amount`, `payment.method`
- **New**: `transaction.amount`, `transaction.paymentMethod`
- **Also**: `rentRecord.totalPaid`, `rentRecord.remainingAmount`

**Issue**: Status values different
- **Old**: `paid`, `pending`, `partial`, `processing`, `failed`
- **New**: `paid`, `pending`, `partial`, `overdue` (transaction: `completed`, `reversed`, `failed`)

**Issue**: Authorization errors
- **Check**: User role is included in request headers
- **Verify**: Owner can only see own properties

---

## API Response Examples

### GET /api/v2/payments (List)
```json
{
  "success": true,
  "count": 5,
  "rentRecords": [
    {
      "_id": "507f...",
      "month": "2026-05",
      "totalRent": 5000,
      "totalPaid": 3500,
      "remainingAmount": 1500,
      "status": "partial",
      "dueDate": "2026-05-05T00:00:00Z",
      "tenantId": { "_id": "...", "status": "active" },
      "userId": { "_id": "...", "name": "Tenant Name" },
      "roomId": { "_id": "...", "roomNumber": "101" },
      "propertyId": { "_id": "...", "name": "Sunrise Apartments" }
    }
  ]
}
```

### POST /api/v2/payments/:rentRecordId/transactions
```json
{
  "success": true,
  "message": "Payment transaction recorded successfully",
  "transaction": {
    "_id": "507f...",
    "amount": 2000,
    "paymentMethod": "cash",
    "paymentDate": "2026-05-02T00:00:00Z",
    "note": "Collected in person",
    "recordedBy": { "_id": "...", "name": "Owner Name" },
    "status": "completed"
  },
  "rentRecord": {
    "totalPaid": 3500,
    "remainingAmount": 1500,
    "status": "partial"
  }
}
```

---

## Environment Variables

No new environment variables needed. V2 uses same config as V1.

---

## Rollback Plan

If issues occur:

1. **Minor issues**: Keep V1 running, fix V2, redeploy
2. **Major issues**: Disable V2 route, revert to V1
3. **Data issues**: Restore from MongoDB backup

V1 and V2 can coexist indefinitely.

---

## Performance Notes

- V2 uses indexed queries for fast lookups
- Lean queries for list endpoints
- Minimal populate operations
- Should perform better than V1 with many transactions
- No N+1 query problems

---

## Support

For issues:
1. Check logs: `docker logs <container>`
2. Check database: Connect to MongoDB
3. Verify indexes created: `db.monthlyrentrecords.getIndexes()`
4. Ask for help in team chat
