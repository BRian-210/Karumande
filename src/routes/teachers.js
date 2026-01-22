const express = require('express');
const { body, validationResult } = require('express-validator');
const Result = require('../models/Result');
const Student = require('../models/Student');
const { requireAuth, requireRole } = require('../middleware/auth');
const { TERMS } = require('../constants/school');

const router = express.Router();

const ResultDueDate = require('../models/ResultDueDate');

// Batch submit results for a single subject for many students
router.post(
  '/results-batch',
  requireAuth,
  requireRole('admin', 'teacher'),
  [
    body('term').isIn(TERMS),
    body('subject').isString().trim().notEmpty(),
    body('results').isArray({ min: 1 }),
    body('results.*.studentId').isMongoId(),
    body('results.*.score').isNumeric(),
    body('maxScore').optional().isNumeric()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { term, subject, results, maxScore = 100 } = req.body;
    const saved = [];
    const failed = [];

    for (const r of results) {
      try {
        const student = await Student.findById(r.studentId).lean();
        if (!student) {
          failed.push({ studentId: r.studentId, message: 'Student not found' });
          continue;
        }

        let doc = await Result.findOne({ student: r.studentId, term });
        if (!doc) {
          const subj = { name: subject, score: Number(r.score || 0), maxScore: Number(maxScore || 100) };
          doc = new Result({ student: r.studentId, term, subjects: [subj], total: subj.score, grade: '' });
          await doc.save();
          saved.push({ studentId: r.studentId });
          continue;
        }

        // update or add subject
        const idx = doc.subjects.findIndex(s => s.name.toLowerCase() === subject.toLowerCase());
        if (idx >= 0) {
          doc.subjects[idx].score = Number(r.score || 0);
          doc.subjects[idx].maxScore = Number(maxScore || doc.subjects[idx].maxScore || 100);
        } else {
          doc.subjects.push({ name: subject, score: Number(r.score || 0), maxScore: Number(maxScore || 100) });
        }
        doc.total = doc.subjects.reduce((sum, s) => sum + Number(s.score || 0), 0);
        await doc.save();
        saved.push({ studentId: r.studentId });
      } catch (err) {
        failed.push({ studentId: r.studentId, message: err.message });
      }
    }

    return res.json({ saved: saved.length, failed });
  }
);

  // Create or update a due date for results submission for a class/term (optional subject)
  router.post(
    '/result-due',
    requireAuth,
    requireRole('admin', 'teacher'),
    [
      body('classLevel').isString().notEmpty(),
      body('term').isString().notEmpty(),
      body('dueDate').isISO8601().toDate(),
      body('subject').optional().isString().trim()
    ],
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { classLevel, term, subject, dueDate } = req.body;
      try {
        const filter = { classLevel, term };
        if (subject) filter.subject = subject;

        const update = { classLevel, term, subject: subject || null, dueDate, createdBy: req.user.sub };
        const doc = await ResultDueDate.findOneAndUpdate(filter, update, { upsert: true, new: true, setDefaultsOnInsert: true });
        return res.json({ message: 'Due date saved', data: doc });
      } catch (err) {
        console.error(err);
        return res.status(500).json({ message: err.message });
      }
    }
  );

  // Get due dates for a class + term (optional subject)
  router.get('/result-due', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
    const { classLevel, term, subject } = req.query;
    const q = {};
    if (classLevel) q.classLevel = classLevel;
    if (term) q.term = term;
    if (subject) q.subject = subject;
    const items = await ResultDueDate.find(q).lean();
    return res.json(items);
  });

module.exports = router;