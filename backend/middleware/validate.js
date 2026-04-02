const { validationResult } = require('express-validator');

module.exports = function runValidations(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMsg = errors.array().map(e => e.msg).join(', ');
    return res.status(400).json({ success: false, errors: errors.array(), message: errorMsg });
  }
  return next();
};
