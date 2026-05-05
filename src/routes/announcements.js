const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validatePagination } = require('../constants/school');
const { announcements } = require('../data/repositories');

const router = express.Router();

// Public fetch (optionally filter audience) with active window + pagination
router.get('/', async (req, res) => {
  const { page, limit, skip } = validatePagination(req.query);

  const { items, total } = await announcements.listActive({
    audience: req.query.audience,
    limit,
    offset: skip,
  });

  res.json({ data: items, page, limit, total });
});

router.post(
  '/',
  requireAuth,
  requireRole('admin', 'teacher'),
  [
    body('title').isString().trim().notEmpty(),
    body('body').isString().trim().notEmpty(),
    body('audience').optional().isIn(['public', 'parents', 'students', 'staff']),
    body('startDate').optional().isISO8601(),
    body('endDate').optional().isISO8601()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const item = await announcements.create(req.body);
    return res.status(201).json(item);
  }
);

router.patch(
  '/:id',
  requireAuth,
  requireRole('admin', 'teacher'),
  [
    body('title').optional().isString().trim(),
    body('body').optional().isString().trim(),
    body('audience').optional().isIn(['public', 'parents', 'students', 'staff']),
    body('active').optional().isBoolean()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const item = await announcements.update(req.params.id, req.body);
    if (!item) return res.status(404).json({ message: 'Announcement not found' });
    return res.json(item);
  }
);

router.post(
  '/:id/deactivate',
  requireAuth,
  requireRole('admin', 'teacher'),
  async (req, res) => {
    const item = await announcements.update(req.params.id, { active: false });
    if (!item) return res.status(404).json({ message: 'Announcement not found' });
    return res.json(item);
  }
);

// Allow admins to permanently delete an announcement
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const item = await announcements.delete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Announcement not found' });
    return res.json({ message: 'Announcement deleted' });
  } catch (err) {
    console.error('Error deleting announcement', err);
    return res.status(500).json({ message: 'Server error' });
  }
});
module.exports = router;
