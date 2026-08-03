'use strict';

const router = require('express').Router();
const {
  getExpenses,
  getRecurringExpenses,
  getExpenseSummary,
  createExpense,
  updateExpense,
  deleteExpense,
  expenseValidation,
} = require('../controllers/expenseController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(authenticate);
router.use(authorize('owner'));

router.get('/', getExpenses);
router.get('/recurring', getRecurringExpenses);
router.get('/summary', getExpenseSummary);
router.post('/', expenseValidation, validate, createExpense);
router.patch('/:id', updateExpense);
router.delete('/:id', deleteExpense);

module.exports = router;
