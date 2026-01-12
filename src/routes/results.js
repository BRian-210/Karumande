const express = require('express');
const { body, validationResult } = require('express-validator');
const Result = require('../models/Result');
const Student = require('../models/Student');
const { requireAuth, requireRole } = require('../middleware/auth');
const { TERMS, validatePagination } = require('../constants/school');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const { page, limit, skip } = validatePagination(req.query);
  const filter = {};
  if (req.query.class) filter.class = req.query.class;
  if (req.query.year) filter.year = Number(req.query.year);

  if (req.user.role === 'parent') {
    const studentIds = await Student.find({ parent: req.user.sub }).distinct('_id');
    filter.student = filter.student ? filter.student : { $in: studentIds };
  }

  const [items, total] = await Promise.all([
    Result.find(filter).populate('student', 'name classLevel parent').skip(skip).limit(limit),
    Result.countDocuments(filter)
  ]);
  return res.json({ data: items, page, limit, total });
});

router.post(
  '/',
  requireAuth,
  requireRole('admin', 'teacher'),
  [
    body('studentId').isString(),
    body('term').isIn(TERMS),
    body('subjects').isArray({ min: 1 }),
    body('subjects.*.name').isString().trim().notEmpty(),
    body('subjects.*.score').isNumeric()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { studentId, term, subjects, grade, comments } = req.body;
    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const total = subjects.reduce((sum, s) => sum + Number(s.score || 0), 0);

    try {
      const result = await Result.findOneAndUpdate(
        { student: studentId, term },
        { student: studentId, term, subjects, total, grade, comments },
        { new: true, upsert: true }
      );
      return res.status(201).json(result);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
);

router.patch(
  '/:id',
  requireAuth,
  requireRole('admin', 'teacher'),
  [
    body('subjects').optional().isArray(),
    body('subjects.*.name').optional().isString().trim(),
    body('subjects.*.score').optional().isNumeric()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const doc = await Result.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Result not found' });

    if (req.body.subjects) {
      doc.subjects = req.body.subjects;
      doc.total = req.body.subjects.reduce((sum, s) => sum + Number(s.score || 0), 0);
    }
    if (req.body.grade !== undefined) doc.grade = req.body.grade;
    if (req.body.comments !== undefined) doc.comments = req.body.comments;
    await doc.save();
    return res.json(doc);
  }
);

module.exports = router;

