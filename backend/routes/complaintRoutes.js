'use strict';

const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getComplaints, createComplaint, updateComplaint } = require('../controllers/complaintController');

router.use(authenticate);

router.get('/', getComplaints);
router.post('/', authorize('tenant'), createComplaint);
router.patch('/:id', authorize('owner', 'superadmin'), updateComplaint);

module.exports = router;
