const express = require('express');
const { body, validationResult } = require('express-validator');
const Announcement = require('../models/Announcement');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validatePagination } = require('../constants/school');

const router = express.Router();

// Public fetch (optionally filter audience) with active window + pagination
router.get('/', async (req, res) => {
  const { page, limit, skip } = validatePagination(req.query);
  const now = new Date();
  const filter = {
    active: true,
    $and: [
      { $or: [{ startDate: { $lte: now } }, { startDate: { $exists: false } }, { startDate: null }] },
      { $or: [{ endDate: { $gte: now } }, { endDate: { $exists: false } }, { endDate: null }] }
    ]
  };
  if (req.query.audience) filter.audience = req.query.audience;

  const [items, total] = await Promise.all([
    Announcement.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Announcement.countDocuments(filter)
  ]);
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

    const item = await Announcement.create(req.body);
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

    const item = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ message: 'Announcement not found' });
    return res.json(item);
  }
);

router.post(
  '/:id/deactivate',
  requireAuth,
  requireRole('admin', 'teacher'),
  async (req, res) => {
    const item = await Announcement.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!item) return res.status(404).json({ message: 'Announcement not found' });
    return res.json(item);
  }
);

module.exports = router;

