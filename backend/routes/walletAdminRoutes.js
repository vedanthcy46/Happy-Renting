'use strict';

const router = require('express').Router();
const walletController = require('../controllers/walletController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Superadmin & Admin routes
router.get('/wallets', authorize('superadmin', 'admin'), walletController.adminGetWallets);
router.get('/wallets/:ownerId', authorize('superadmin', 'admin'), walletController.adminGetWalletDetail);
router.get('/withdrawals', authorize('superadmin', 'admin'), walletController.adminGetWithdrawals);
router.patch('/withdrawals/:id/approve', authorize('superadmin', 'admin'), walletController.adminApproveWithdrawal);
router.patch('/withdrawals/:id/reject', authorize('superadmin', 'admin'), walletController.adminRejectWithdrawal);
router.post('/withdrawals/:id/generate-qr', authorize('superadmin', 'admin'), walletController.adminGenerateQrCode);
router.get('/platform-revenue', authorize('superadmin', 'admin'), walletController.adminGetPlatformRevenue);

// Superadmin only routes
router.post('/wallets/:ownerId/rebuild', authorize('superadmin'), walletController.adminRebuildWallet);
router.patch('/withdrawals/:id/complete', authorize('superadmin'), walletController.adminCompleteWithdrawal);
router.get('/settings', authorize('superadmin'), walletController.adminGetSettings);
router.patch('/settings', authorize('superadmin'), walletController.adminUpdateSettings);

module.exports = router;
