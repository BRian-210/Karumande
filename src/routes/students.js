const express = require('express');
const { body, validationResult } = require('express-validator');
const Student = require('../models/Student');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const { CLASS_LEVELS, validatePagination } = require('../constants/school');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const { page, limit, skip } = validatePagination(req.query);
  const query = { active: true };
  if (req.user.role === 'parent') {
    query.parent = req.user.sub;
  }

  const [items, total] = await Promise.all([
    Student.find(query).populate('parent', 'name email role').skip(skip).limit(limit),
    Student.countDocuments(query)
  ]);
  return res.json({ data: items, page, limit, total });
});

router.post(
  '/',
  requireAuth,
  requireRole('admin', 'teacher'),
  [
    body('name').isString().trim().notEmpty(),
    body('classLevel').isIn(CLASS_LEVELS),
    body('parentId').optional().isString(),
    body('admissionNumber').optional().isString().trim()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, classLevel, parentId, stream, admissionNumber } = req.body;
    let parent;
    if (parentId) {
      parent = await User.findById(parentId);
      if (!parent) return res.status(404).json({ message: 'Parent not found' });
    }

    const student = await Student.create({
      name,
      classLevel,
      stream,
      admissionNumber,
      parent: parent ? parent.id : undefined
    });

    return res.status(201).json(student);
  }
);

router.patch(
  '/:id',
  requireAuth,
  requireRole('admin', 'teacher'),
  [
    body('classLevel').optional().isIn(CLASS_LEVELS),
    body('status').optional().isIn(['active', 'graduated', 'transferred']),
    body('active').optional().isBoolean()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    return res.json(student);
  }
);

router.post(
  '/:id/promote',
  requireAuth,
  requireRole('admin', 'teacher'),
  [body('nextClassLevel').isIn(CLASS_LEVELS)],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { classLevel: req.body.nextClassLevel },
      { new: true }
    );
    if (!student) return res.status(404).json({ message: 'Student not found' });
    return res.json(student);
  }
);

router.post(
  '/:id/deactivate',
  requireAuth,
  requireRole('admin', 'teacher'),
  async (req, res) => {
    const student = await Student.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    return res.json(student);
  }
);

module.exports = router;

