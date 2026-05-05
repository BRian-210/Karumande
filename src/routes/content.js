const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireRole } = require('../middleware/auth');
const { contentBlocks } = require('../data/repositories');

const router = express.Router();

// Public fetch
router.get('/:key', async (req, res) => {
  const item = await contentBlocks.findByKey(req.params.key);
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

    const item = await contentBlocks.upsert(req.params.key, req.body.value);
    return res.json(item);
  }
);

module.exports = router;
