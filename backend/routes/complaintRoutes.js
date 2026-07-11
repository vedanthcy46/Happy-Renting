'use strict';

const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { 
  getComplaints, 
  createComplaint, 
  updateComplaint, 
  getComplaintById, 
  addComplaintComment 
} = require('../controllers/complaintController');
const { createUploadMiddleware } = require('../middleware/uploadMiddleware');

const upload = createUploadMiddleware('complaints');

router.use(authenticate);

router.get('/', getComplaints);
router.get('/:id', getComplaintById);
router.post('/', authorize('tenant'), upload.single('image'), createComplaint);
router.post('/:id/comments', addComplaintComment);
router.patch('/:id', authorize('owner', 'superadmin'), updateComplaint);

module.exports = router;
