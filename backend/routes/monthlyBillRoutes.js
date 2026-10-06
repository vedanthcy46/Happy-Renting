'use strict';

/**
 * monthlyBillRoutes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Routes for the invoice-layer billing system.
 *
 * Bills:
 *   GET    /api/v2/bills                          — list bills
 *   GET    /api/v2/bills/:billId                  — bill detail
 *   POST   /api/v2/bills                          — create draft bill
 *   POST   /api/v2/bills/:billId/items            — add charge item
 *   PATCH  /api/v2/bills/:billId/items/:itemId    — edit charge item
 *   DELETE /api/v2/bills/:billId/items/:itemId    — remove charge item
 *   POST   /api/v2/bills/:billId/items/:itemId/waive — waive a line item
 *   POST   /api/v2/bills/:billId/publish          — publish bill to tenant
 *   DELETE /api/v2/bills/:billId                  — delete draft bill
 *
 * Recurring Charges:
 *   GET    /api/v2/bills/recurring                — list recurring charges
 *   POST   /api/v2/bills/recurring                — create recurring charge
 *   PATCH  /api/v2/bills/recurring/:chargeId      — update recurring charge
 *   DELETE /api/v2/bills/recurring/:chargeId      — delete recurring charge
 */

const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getBills,
  getBillDetail,
  createBill,
  addBillItem,
  updateBillItem,
  removeBillItem,
  waiveBillItem,
  publishBill,
  deleteBill,
  getRecurringCharges,
  createRecurringCharge,
  updateRecurringCharge,
  deleteRecurringCharge,
} = require('../controllers/monthlyBillController');

router.use(authenticate);

// ── Recurring charges (must be before /:billId to avoid route conflict) ──────
router.get('/recurring',              authorize('superadmin', 'owner'), getRecurringCharges);
router.post('/recurring',             authorize('superadmin', 'owner'), createRecurringCharge);
router.patch('/recurring/:chargeId',  authorize('superadmin', 'owner'), updateRecurringCharge);
router.delete('/recurring/:chargeId', authorize('superadmin', 'owner'), deleteRecurringCharge);

// ── Bills ─────────────────────────────────────────────────────────────────────
router.get('/',        authorize('superadmin', 'owner', 'tenant'), getBills);
router.post('/',       authorize('superadmin', 'owner'), createBill);
router.get('/:billId', authorize('superadmin', 'owner', 'tenant'), getBillDetail);
router.delete('/:billId', authorize('superadmin', 'owner'), deleteBill);

// ── Bill items ────────────────────────────────────────────────────────────────
router.post('/:billId/items',                    authorize('superadmin', 'owner'), addBillItem);
router.patch('/:billId/items/:itemId',           authorize('superadmin', 'owner'), updateBillItem);
router.delete('/:billId/items/:itemId',          authorize('superadmin', 'owner'), removeBillItem);
router.post('/:billId/items/:itemId/waive',      authorize('superadmin', 'owner'), waiveBillItem);

// ── Publish ───────────────────────────────────────────────────────────────────
router.post('/:billId/publish', authorize('superadmin', 'owner'), publishBill);

module.exports = router;
