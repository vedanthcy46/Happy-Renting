'use strict';

const router = require('express').Router();
const walletController = require('../controllers/walletController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('owner'));

router.get('/', walletController.getOwnerWallet);
router.get('/transactions', walletController.getOwnerTransactions);
router.post('/withdraw', walletController.withdrawOwnerFunds);
router.get('/withdrawals', walletController.getOwnerWithdrawals);
router.get('/summary', walletController.getOwnerWalletSummary);

module.exports = router;
