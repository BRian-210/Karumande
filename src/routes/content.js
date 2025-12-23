const express = require('express');
const { body, validationResult } = require('express-validator');
const ContentBlock = require('../models/ContentBlock');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public fetch
router.get('/:key', async (req, res) => {
  const item = await ContentBlock.findOne({ key: req.params.key });
  if (!item) return res.status(404).json({ message: 'Not found' });
  return res.json(item);
});

router.put(
  '/:key',
  requireAuth,
  requireRole('admin', 'teacher'),
  [body('value').isString()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const item = await ContentBlock.findOneAndUpdate(
      { key: req.params.key },
      { key: req.params.key, value: req.body.value },
      { new: true, upsert: true }
    );
    return res.json(item);
  }
);

module.exports = router;

