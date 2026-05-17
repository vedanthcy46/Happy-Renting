# Payment System V2 - API Reference

## Base URL
```
/api/v2/payments
```

## Authentication
All endpoints require:
```
Authorization: Bearer {token}
```

---

## Rent Records Endpoints

### GET /api/v2/payments
**List all rent records (with filters)**

```http
GET /api/v2/payments?month=2026-05&status=partial&tenantId=507f...&propertyId=507f...
Authorization: Bearer {token}
```

**Query Parameters:**
- `month` (string): Filter by YYYY-MM
- `status` (string): pending | partial | paid | overdue
- `tenantId` (string): MongoID
- `propertyId` (string): MongoID

**Response (200):**
```json
{
  "success": true,
  "count": 5,
  "rentRecords": [
    {
      "_id": "507f...",
      "month": "2026-05",
      "totalRent": 5000,
      "totalPaid": 3000,
      "remainingAmount": 2000,
      "status": "partial",
      "dueDate": "2026-05-05T00:00:00Z",
      "paidOnDate": null,
      "notes": "...",
      "reminderSent": false,
      "advanceBalance": 0,
      "createdAt": "2026-05-01T...",
      "updatedAt": "2026-05-03T...",
      "tenantId": { "_id": "...", "status": "active" },
      "userId": { "_id": "...", "name": "Tenant Name", "email": "tenant@..." },
      "roomId": { "_id": "...", "roomNumber": "101", "floor": "1" },
      "propertyId": { "_id": "...", "name": "Sunrise Apartments" },
      "ownerId": { "_id": "...", "name": "Owner Name" }
    }
  ]
}
```

**Permissions:**
- owner: own properties only
- tenant: own records only
- superadmin: all

**Auto-triggers:**
- Generates bills for current month
- Updates overdue status

---

### GET /api/v2/payments/:rentRecordId
**Get single rent record with all transactions**

```http
GET /api/v2/payments/507f1f77bcf86cd799439011
Authorization: Bearer {token}
```

**Response (200):**
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
    "dueDate": "2026-05-05T...",
    "paidOnDate": "2026-05-10T...",
    "notes": "...",
    "reminderSent": true,
    "advanceBalance": 0
  },
  "transactions": [
    {
      "_id": "txn001",
      "amount": 2000,
      "paymentMethod": "cash",
      "transactionId": null,
      "paymentDate": "2026-05-02T...",
      "note": "Collected in person",
      "proofImage": { "secureUrl": null, "publicId": null },
      "recordedBy": { "_id": "...", "name": "Owner Name" },
      "status": "completed",
      "createdAt": "2026-05-02T..."
    },
    {
      "_id": "txn002",
      "amount": 3000,
      "paymentMethod": "upi",
      "transactionId": "UPI202605021234567",
      "paymentDate": "2026-05-05T...",
      "note": "PhonePe",
      "recordedBy": { "_id": "...", "name": "Owner Name" },
      "status": "completed"
    }
  ]
}
```

**Errors:**
- 404: Rent record not found
- 403: Access denied

---

### POST /api/v2/payments
**Create new rent record**

```http
POST /api/v2/payments
Authorization: Bearer {token}
Content-Type: application/json

{
  "tenantId": "507f1f77bcf86cd799439011",
  "month": "2026-05",
  "totalRent": 5000,
  "notes": "Optional notes"
}
```

**Validation:**
- tenantId: valid MongoID required
- month: YYYY-MM format required
- totalRent: positive number required

**Response (201):**
```json
{
  "success": true,
  "message": "Rent record created successfully",
  "rentRecord": { ... }
}
```

**Errors:**
- 400: Validation failed
- 404: Tenant not found
- 403: Access denied

---

### PATCH /api/v2/payments/:rentRecordId
**Update rent record**

```http
PATCH /api/v2/payments/507f1f77bcf86cd799439011
Authorization: Bearer {token}
Content-Type: application/json

{
  "notes": "Payment schedule updated",
  "reminderSent": true,
  "totalRent": 5500,
  "advanceBalance": 500
}
```

**Allowed Updates:**
- notes (string, max 500 chars)
- reminderSent (boolean)
- totalRent (positive number)
- advanceBalance (positive number)

**Response (200):**
```json
{
  "success": true,
  "message": "Rent record updated successfully",
  "rentRecord": { ... }
}
```

---

## Payment Transaction Endpoints

### POST /api/v2/payments/:rentRecordId/transactions
**Add payment transaction**

```http
POST /api/v2/payments/507f1f77bcf86cd799439011/transactions
Authorization: Bearer {token}
Content-Type: application/json

{
  "amount": 2000,
  "paymentMethod": "cash",
  "paymentDate": "2026-05-02",
  "note": "Collected from tenant in person",
  "transactionId": null
}
```

**Request Body:**
- `amount` (number, required): > 0
- `paymentMethod` (string, required): cash | upi | bank_transfer | cheque | other
- `paymentDate` (ISO8601 string, optional): defaults to now
- `note` (string, optional): max 300 chars
- `transactionId` (string, optional): UPI ref, bank ID, cheque number, etc.

**Response (201):**
```json
{
  "success": true,
  "message": "Payment transaction recorded successfully",
  "transaction": {
    "_id": "txn001",
    "rentRecordId": "507f...",
    "tenantId": "507f...",
    "ownerId": "507f...",
    "propertyId": "507f...",
    "amount": 2000,
    "paymentMethod": "cash",
    "transactionId": null,
    "paymentDate": "2026-05-02T00:00:00Z",
    "note": "Collected from tenant in person",
    "proofImage": { "secureUrl": null, "publicId": null },
    "recordedBy": "507f...",
    "status": "completed",
    "statusReason": null,
    "createdAt": "2026-05-02T10:30:00Z"
  },
  "rentRecord": {
    "totalPaid": 2000,
    "remainingAmount": 3000,
    "status": "partial"
  }
}
```

**Auto-triggers:**
- Recalculates rent record totals
- Auto-updates status (pending → partial → paid)
- Sends email to tenant
- Creates audit log

**Errors:**
- 400: Amount invalid or exceeds rent
- 404: Rent record not found
- 403: Access denied (only owner/admin)

---

### DELETE /api/v2/payments/transactions/:transactionId
**Reverse/refund a transaction**

```http
DELETE /api/v2/payments/transactions/txn001
Authorization: Bearer {token}
Content-Type: application/json

{
  "reason": "Duplicate entry"
}
```

**Request Body:**
- `reason` (string, optional): Reason for reversal

**Response (200):**
```json
{
  "success": true,
  "message": "Payment transaction reversed successfully",
  "transaction": {
    "_id": "txn001",
    "status": "reversed",
    "statusReason": "Duplicate entry"
  },
  "rentRecord": {
    "totalPaid": 0,
    "remainingAmount": 5000,
    "status": "pending"
  }
}
```

**Behavior:**
- Sets status to "reversed" (not deleted)
- Reduces rentRecord.totalPaid
- Recalculates status
- Preserves history

**Errors:**
- 400: Cannot reverse non-completed transaction
- 404: Transaction not found
- 403: Access denied (only owner/admin)

---

## Dashboard & Summary Endpoints

### GET /api/v2/payments/summary/metrics
**Get payment metrics for dashboard**

```http
GET /api/v2/payments/summary/metrics?propertyId=507f...
Authorization: Bearer {token}
```

**Query Parameters:**
- `propertyId` (string, optional): Filter by property

**Response (200):**
```json
{
  "success": true,
  "metrics": {
    "totalDue": 50000,
    "totalCollected": 35000,
    "totalOutstanding": 15000,
    "paidCount": 7,
    "partialCount": 2,
    "pendingCount": 1,
    "overdueCount": 0
  }
}
```

**Permissions:**
- owner: own properties only
- superadmin: all

**Auto-triggers:**
- Generates bills for current month
- Updates overdue status

---

### GET /api/v2/payments/history/transactions
**Get transaction timeline**

```http
GET /api/v2/payments/history/transactions?tenantId=507f...&rentRecordId=507f...
Authorization: Bearer {token}
```

**Query Parameters:**
- `tenantId` (string, optional): Filter by tenant
- `rentRecordId` (string, optional): Filter by rent record
- `month` (string, optional): Not currently used (use rentRecordId instead)

**Response (200):**
```json
{
  "success": true,
  "count": 15,
  "transactions": [
    {
      "_id": "txn001",
      "amount": 2000,
      "paymentMethod": "cash",
      "transactionId": null,
      "paymentDate": "2026-05-02T...",
      "note": "...",
      "recordedBy": { "_id": "...", "name": "Owner Name" },
      "rentRecordId": {
        "_id": "507f...",
        "month": "2026-05",
        "totalRent": 5000,
        "totalPaid": 5000,
        "status": "paid"
      },
      "status": "completed"
    }
  ]
}
```

**Permissions:**
- owner: own properties only
- tenant: own transactions only
- superadmin: all

---

## Common Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success (GET, PATCH) |
| 201 | Created (POST) |
| 400 | Bad request / validation failed |
| 403 | Access denied (authorization issue) |
| 404 | Not found |
| 500 | Server error |

---

## Common Response Wrapper

**Success:**
```json
{
  "success": true,
  "message": "Optional message",
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error description"
}
```

---

## Status Values

### Rent Record Status
- `pending`: No payment made yet
- `partial`: Some payment made, balance remaining
- `paid`: Fully paid (remainingAmount = 0)
- `overdue`: Due date passed, balance remaining

### Transaction Status
- `completed`: Transaction processed successfully
- `reversed`: Transaction reversed/refunded
- `failed`: Transaction failed (rare, for future use)

---

## Validation Rules

### Amount
- Must be > 0
- No decimal places beyond 2 (₹1000.50 OK, ₹1000.555 rejected)
- No negative values

### Payment Method
- `cash` - Physical cash collected by owner
- `upi` - Digital wallet (PhonePe, Google Pay, etc.)
- `bank_transfer` - Bank/NEFT transfer
- `cheque` - Cheque deposit
- `other` - Other methods

### Month Format
- Format: `YYYY-MM`
- Example: `2026-05`
- Invalid: `05-2026`, `2026-5`, `2026/05`

### Transaction ID
- Optional identifier for payment proof
- Examples:
  - UPI: `UPI202605021234567`
  - Bank: `NEFT202605021234567`
  - Cheque: `CHQ12345`

---

## Example cURL Commands

### List rent records
```bash
curl -X GET 'http://localhost:5000/api/v2/payments?status=partial' \
  -H 'Authorization: Bearer {token}'
```

### Get single rent record with transactions
```bash
curl -X GET 'http://localhost:5000/api/v2/payments/507f...' \
  -H 'Authorization: Bearer {token}'
```

### Create rent record
```bash
curl -X POST 'http://localhost:5000/api/v2/payments' \
  -H 'Authorization: Bearer {token}' \
  -H 'Content-Type: application/json' \
  -d '{
    "tenantId": "507f...",
    "month": "2026-05",
    "totalRent": 5000
  }'
```

### Add payment transaction
```bash
curl -X POST 'http://localhost:5000/api/v2/payments/507f.../transactions' \
  -H 'Authorization: Bearer {token}' \
  -H 'Content-Type: application/json' \
  -d '{
    "amount": 2000,
    "paymentMethod": "cash",
    "note": "Collected in person"
  }'
```

### Reverse transaction
```bash
curl -X DELETE 'http://localhost:5000/api/v2/payments/transactions/txn001' \
  -H 'Authorization: Bearer {token}' \
  -H 'Content-Type: application/json' \
  -d '{
    "reason": "Duplicate"
  }'
```

### Get metrics
```bash
curl -X GET 'http://localhost:5000/api/v2/payments/summary/metrics' \
  -H 'Authorization: Bearer {token}'
```

---

## Rate Limiting

Global rate limit: 100 requests per 15 minutes (per user)

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 404 Not Found | Check endpoint URL and ID format |
| 403 Access Denied | Verify token and user role |
| 400 Bad Request | Check request body format and validation |
| Transaction not appearing | Verify you're viewing correct rent record |
| Status not updating | Check if totals were recalculated |

---

## Endpoint Summary Table

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/payments` | List records | owner, tenant, admin |
| GET | `/payments/:id` | View record | owner, tenant, admin |
| POST | `/payments` | Create record | owner, admin |
| PATCH | `/payments/:id` | Update record | owner, admin |
| POST | `/payments/:id/transactions` | Add payment | owner, admin |
| DELETE | `/payments/transactions/:id` | Reverse payment | owner, admin |
| GET | `/payments/summary/metrics` | Metrics | owner, admin |
| GET | `/payments/history/transactions` | Timeline | owner, tenant, admin |

---

## Integration Example (JavaScript)

```javascript
// Get rent record with transactions
async function fetchRentRecord(rentRecordId) {
  const response = await fetch(`/api/v2/payments/${rentRecordId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
}

// Add payment
async function addPayment(rentRecordId, amount, method, note) {
  const response = await fetch(
    `/api/v2/payments/${rentRecordId}/transactions`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount,
        paymentMethod: method,
        note
      })
    }
  );
  return response.json();
}

// Reverse payment
async function reverseTransaction(transactionId, reason) {
  const response = await fetch(
    `/api/v2/payments/transactions/${transactionId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
    }
  );
  return response.json();
}
```

---

For detailed information, see:
- [Payment System V2 Documentation](./PAYMENT_SYSTEM_V2.md)
- [Quick Start Guide](./PAYMENT_SYSTEM_V2_QUICK_START.md)
- [Test Cases](./PAYMENT_SYSTEM_V2_TEST_CASES.md)
