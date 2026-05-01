'use strict';

const router = require('express').Router();
const {
  getPayments, createPayment, updatePayment, getPaymentSummary, 
  processPayment, uploadPaymentProof, paymentValidation,
} = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createUploadMiddleware } = require('../middleware/uploadMiddleware');

const upload = createUploadMiddleware('payment_proofs');

router.use(authenticate);

router.get ('/summary', authorize('superadmin', 'owner'), getPaymentSummary);
router.get ('/',        authorize('superadmin', 'owner', 'tenant'), getPayments);
router.post('/:id/pay',   authorize('tenant'), processPayment);
router.post('/:id/upload-proof', authorize('tenant'), upload.single('image'), uploadPaymentProof);
router.post('/',         authorize('superadmin', 'owner'), paymentValidation, validate, createPayment);
router.patch('/:id',     authorize('superadmin', 'owner'), updatePayment);

module.exports = router;
