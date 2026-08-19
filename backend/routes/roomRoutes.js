'use strict';

const router = require('express').Router();
const {
  getRooms, getRoom, createRoom, updateRoom, deleteRoom, updateBedStatus,
  roomValidation, bedStatusValidation,
} = require('../controllers/roomController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(authenticate);

router.get ('/',     getRooms);
router.get ('/:id',  getRoom);
router.post('/',     authorize('superadmin', 'owner'), roomValidation, validate, createRoom);
router.patch('/:id', authorize('superadmin', 'owner'), roomValidation, validate, updateRoom);
router.delete('/:id',authorize('superadmin', 'owner'), deleteRoom);
router.patch('/:id/beds/:bedId', authorize('superadmin', 'owner'), bedStatusValidation, validate, updateBedStatus);

module.exports = router;
