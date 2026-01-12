const express = require('express');
const { body, validationResult } = require('express-validator');
const Student = require('../models/Student');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const { CLASS_LEVELS, validatePagination } = require('../constants/school');

const router = express.Router();

const POPULATE_PARENT = { path: 'parent', select: 'name email role' };

router.get(
  '/',
  requireAuth,
  async (req, res) => {
    const { page, limit, skip } = validatePagination(req.query);

    const query = { active: true };
    // Optional filter by class level (e.g., 'Grade 1', 'PlayGroup')
    if (req.query.classLevel) {
      // Only accept known class levels
      if (typeof req.query.classLevel === 'string') {
        query.classLevel = req.query.classLevel;
      }
    }
    if (req.user.role === 'parent') {
      query.parent = req.user.id;
    }

    const [students, total] = await Promise.all([
      Student.find(query)
        .populate(POPULATE_PARENT)
        .sort({ name: 1 }) 
        .skip(skip)
        .limit(limit)
        .lean(), 
      Student.countDocuments(query),
    ]);

    return res.json({
      data: students,
      pagination: {
        page,
        limit,
        total,
        pages: limit > 0 ? Math.ceil(total / limit) : 1,
      },
    });
  }
);
const createStudentValidation = [
  body('name').isString().trim().notEmpty().withMessage('Student name is required'),
  body('classLevel')
    .isIn(CLASS_LEVELS)
    .withMessage(`classLevel must be one of: ${CLASS_LEVELS.join(', ')}`),
  body('parentId')
    .optional()
    .isMongoId()
    .withMessage('Invalid parent ID format'),
  body('admissionNumber')
    .optional()
    .isString()
    .trim(),
  body('stream').optional().isString().trim(),
];

router.post(
  '/',
  requireAuth,
  requireRole(['admin', 'teacher']),
  createStudentValidation,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, classLevel, parentId, stream, admissionNumber } = req.body;
    let parent = null;
    if (parentId) {
      parent = await User.findOne({ _id: parentId, role: 'parent' });
      if (!parent) {
        return res.status(404).json({ message: 'Parent not found or invalid role' });
      }
    }

    const student = await Student.create({
      name: name.trim(),
      classLevel,
      stream: stream?.trim(),
      admissionNumber: admissionNumber?.trim(),
      parent: parent?._id,
    });
    await student.populate(POPULATE_PARENT);

    return res.status(201).json({
      message: 'Student created successfully',
      data: student,
    });
  }
);
const updateStudentValidation = [
  body('name').optional().isString().trim().notEmpty(),
  body('classLevel')
    .optional()
    .isIn(CLASS_LEVELS)
    .withMessage(`classLevel must be one of: ${CLASS_LEVELS.join(', ')}`),
  body('stream').optional().isString().trim(),
  body('admissionNumber').optional().isString().trim(),
  body('status')
    .optional()
    .isIn(['active', 'graduated', 'transferred']),
  body('active').optional().isBoolean(),
];

router.patch(
  '/:id',
  requireAuth,
  requireRole(['admin', 'teacher']),
  updateStudentValidation,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate(POPULATE_PARENT);

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    return res.json({
      message: 'Student updated successfully',
      data: student,
    });
  }
);
router.post(
  '/:id/promote',
  requireAuth,
  requireRole(['admin', 'teacher']),
  [body('nextClassLevel').isIn(CLASS_LEVELS).withMessage('Invalid class level')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { classLevel: req.body.nextClassLevel },
      { new: true, runValidators: true }
    ).populate(POPULATE_PARENT);

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    return res.json({
      message: 'Student promoted successfully',
      data: student,
    });
  }
);
router.post(
  '/:id/deactivate',
  requireAuth,
  requireRole(['admin', 'teacher']),
  async (req, res) => {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    ).populate(POPULATE_PARENT);

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    return res.json({
      message: 'Student deactivated successfully',
      data: student,
    });
  }
);

module.exports = router;