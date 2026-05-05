const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireRole } = require('../middleware/auth');
const { CLASS_LEVELS, TERMS } = require('../constants/school');
const { feeStructures } = require('../data/repositories');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const items = await feeStructures.list();
  res.json(items);
});

router.post(
  '/',
  requireAuth,
  requireRole('admin', 'teacher'),
  [
    body('classLevel').isIn(CLASS_LEVELS),
    body('term').isIn(TERMS),
    body('amount').isNumeric(),
    body('description').optional().isString().trim()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const item = await feeStructures.create(req.body);
      return res.status(201).json(item);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ message: 'Fee structure already exists for that class and term' });
      return res.status(500).json({ message: err.message });
    }
  }
);

router.patch(
  '/:id',
  requireAuth,
  requireRole('admin', 'teacher'),
  [body('amount').optional().isNumeric(), body('description').optional().isString().trim()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const item = await feeStructures.update(req.params.id, req.body);
    if (!item) return res.status(404).json({ message: 'Fee structure not found' });
    return res.json(item);
  }
);

module.exports = router;
