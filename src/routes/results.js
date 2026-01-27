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
  if (req.query.term) filter.term = req.query.term;
  if (req.query.studentId) filter.student = req.query.studentId;

  // Support filtering by classLevel (via student's classLevel)
  if (req.query.classLevel || req.query.class) {
    const classLevel = req.query.classLevel || req.query.class;
    const studentsInClass = await Student.find({ 
      classLevel: classLevel,
      active: true 
    }).distinct('_id');
    
    if (studentsInClass.length === 0) {
      return res.json({ data: [], page, limit, total: 0 });
    }
    
    if (filter.student) {
      // If already filtering by studentId, intersect
      const existingIds = Array.isArray(filter.student.$in) ? filter.student.$in : [filter.student];
      filter.student = { $in: existingIds.filter(id => studentsInClass.includes(id)) };
    } else {
      filter.student = { $in: studentsInClass };
    }
  }

  if (req.user.role === 'parent') {
    const studentIds = await Student.find({ parent: req.user.sub }).distinct('_id');
    filter.student = filter.student ? filter.student : { $in: studentIds };
  }

  const [items, total] = await Promise.all([
    Result.find(filter).populate('student', 'name classLevel parent admissionNumber').skip(skip).limit(limit),
    Result.countDocuments(filter)
  ]);
  return res.json({ data: items, page, limit, total });
});

// GET single result by ID
router.get('/:id', requireAuth, async (req, res) => {
  const result = await Result.findById(req.params.id).populate('student', 'name classLevel parent admissionNumber');
  if (!result) {
    return res.status(404).json({ message: 'Result not found' });
  }
  
  // Parents can only view their own children's results
  if (req.user.role === 'parent') {
    const studentIds = await Student.find({ parent: req.user.sub }).distinct('_id');
    if (!studentIds.includes(result.student._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
  }
  
  return res.json(result);
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

    // Check due date for teachers (admins can always edit)
    if (req.user.role === 'teacher') {
      const ResultDueDate = require('../models/ResultDueDate');
      const now = new Date();
      
      // Check for class-level due date
      const classDueDate = await ResultDueDate.findOne({
        classLevel: student.classLevel,
        term,
        subject: null
      });
      
      // Check for subject-specific due date (if any subject matches)
      const subjectDueDates = await ResultDueDate.find({
        classLevel: student.classLevel,
        term,
        subject: { $in: subjects.map(s => s.name) }
      });
      
      const allDueDates = [classDueDate, ...subjectDueDates].filter(Boolean);
      
      for (const dueDateDoc of allDueDates) {
        if (new Date(dueDateDoc.dueDate) < now) {
          return res.status(403).json({ 
            message: `Submission deadline has passed for ${student.classLevel} - ${term}. Only admins can edit results now.` 
          });
        }
      }
    }

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

    const doc = await Result.findById(req.params.id).populate('student', 'classLevel');
    if (!doc) return res.status(404).json({ message: 'Result not found' });

    // Check due date for teachers (admins can always edit)
    if (req.user.role === 'teacher') {
      const ResultDueDate = require('../models/ResultDueDate');
      const now = new Date();
      
      // Check for class-level due date
      const classDueDate = await ResultDueDate.findOne({
        classLevel: doc.student.classLevel,
        term: doc.term,
        subject: null
      });
      
      // Check for subject-specific due date
      const subjectsToCheck = req.body.subjects ? req.body.subjects.map(s => s.name) : doc.subjects.map(s => s.name);
      const subjectDueDates = await ResultDueDate.find({
        classLevel: doc.student.classLevel,
        term: doc.term,
        subject: { $in: subjectsToCheck }
      });
      
      const allDueDates = [classDueDate, ...subjectDueDates].filter(Boolean);
      
      for (const dueDateDoc of allDueDates) {
        if (new Date(dueDateDoc.dueDate) < now) {
          return res.status(403).json({ 
            message: `Submission deadline has passed for ${doc.student.classLevel} - ${doc.term}. Only admins can edit results now.` 
          });
        }
      }
    }

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

