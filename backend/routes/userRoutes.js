'use strict';

const router = require('express').Router();
const {
  getUsers, getUser, getProfile, updateProfile, createUser, updateUser, deleteUser,
  getAdminStats, getOwnerPropertyMapping, uploadQRCode, getActivityLogs, changePassword, resetUserPassword, createUserValidation,
} = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createUploadMiddleware } = require('../middleware/uploadMiddleware');

const upload = createUploadMiddleware('owner_qr_codes');

// All user routes require authentication
router.use(authenticate);

// User profile routes (Self)
router.get ('/profile', getProfile);
router.patch('/profile', updateProfile);
router.patch('/profile/password', changePassword);

router.get ('/admin/stats',   authorize('superadmin'), getAdminStats);
router.get ('/admin/mapping', authorize('superadmin'), getOwnerPropertyMapping);
router.get ('/admin/activity-logs', authorize('superadmin'), getActivityLogs);
router.get ('/',               authorize('superadmin', 'owner'), getUsers);
router.post('/owner/upload-qr', authorize('owner'), upload.single('image'), uploadQRCode);
router.get ('/:id',            authorize('superadmin', 'owner'), getUser);
router.post('/',               authorize('superadmin', 'owner'), createUserValidation, validate, createUser);
router.patch('/:id',           authorize('superadmin', 'owner'), updateUser);
router.patch('/:id/reset-password', authorize('superadmin', 'owner'), resetUserPassword);
router.delete('/:id',          authorize('superadmin'),          deleteUser);

module.exports = router;
