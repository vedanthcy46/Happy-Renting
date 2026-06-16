'use strict';

const router = require('express').Router();
const walletController = require('../controllers/walletController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('superadmin'));

router.get('/wallets', walletController.adminGetWallets);
router.get('/wallets/:ownerId', walletController.adminGetWalletDetail);
router.post('/wallets/:ownerId/rebuild', walletController.adminRebuildWallet);
router.get('/withdrawals', walletController.adminGetWithdrawals);
router.patch('/withdrawals/:id/approve', walletController.adminApproveWithdrawal);
router.patch('/withdrawals/:id/reject', walletController.adminRejectWithdrawal);
router.patch('/withdrawals/:id/complete', walletController.adminCompleteWithdrawal);
router.get('/platform-revenue', walletController.adminGetPlatformRevenue);
router.get('/settings', walletController.adminGetSettings);
router.patch('/settings', walletController.adminUpdateSettings);

module.exports = router;
