const express = require('express');
const router = express.Router();
const feeBalanceController = require('../controllers/feeBalanceController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Require authentication and admin role for these routes
router.use(requireAuth);
router.use(requireRole('admin'));

router.route('/:studentId')
    .get(feeBalanceController.getFeeBalance);

router.route('/update')
    .post(feeBalanceController.updateFeeBalance);

module.exports = router;
