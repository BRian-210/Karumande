const express = require('express');
const router = express.Router();
const feeBalanceController = require('../controllers/feeBalanceController');
const { protect, authorize } = require('../middleware/auth');

// Protect all routes after this middleware
router.use(protect);
router.use(authorize('admin')); // Only admin can update fee balances

router.route('/:studentId')
    .get(feeBalanceController.getFeeBalance);

router.route('/update')
    .post(feeBalanceController.updateFeeBalance);

module.exports = router;
