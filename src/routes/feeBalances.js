const express = require('express');
const router = express.Router();
const feeBalanceController = require('../controllers/feeBalanceController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Attach auth middleware per-route to avoid issues with Router.use
router.route('/:studentId')
    .get(requireAuth, requireRole('admin'), feeBalanceController.getFeeBalance);

router.route('/update')
    .post(requireAuth, requireRole('admin'), feeBalanceController.updateFeeBalance);

module.exports = router;
