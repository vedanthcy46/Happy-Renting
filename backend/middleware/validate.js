'use strict';

const { validationResult } = require('express-validator');

/**
 * validate
 * Collects express-validator errors and returns a 422 with field-level detail.
 * Must be placed AFTER your validation chain array in the route definition.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed. Please check your input.',
      errors : errors.array().map(({ param, msg }) => ({ field: param, message: msg })),
    });
  }
  next();
};

module.exports = validate;
