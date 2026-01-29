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
    
    // Check due date for teachers (admins can always edit)
    if (req.user.role === 'teacher') {
      const ResultDueDate = require('../models/ResultDueDate');
      const now = new Date();
      
      // Get first student to check class level
      const firstStudent = await Student.findById(results[0]?.studentId).lean();
      if (!firstStudent) {
        return res.status(400).json({ message: 'Invalid student ID' });
      }
      
      // Check for global due dates (applies to all classes)
      const globalDueDate = await ResultDueDate.findOne({
        classLevel: null,
        term,
        subject: null
      });
      
      const globalSubjectDueDate = await ResultDueDate.findOne({
        classLevel: null,
        term,
        subject: subject
      });
      
      // Check for class-level due date
      const classDueDate = await ResultDueDate.findOne({
        classLevel: firstStudent.classLevel,
        term,
        subject: null
      });
      
      // Check for subject-specific due date
      const subjectDueDate = await ResultDueDate.findOne({
        classLevel: firstStudent.classLevel,
        term,
        subject: subject
      });
      
      if (globalDueDate && new Date(globalDueDate.dueDate) < now) {
        return res.status(403).json({ 
          message: `Submission deadline has passed for all classes - ${term}. Only admins can edit results now.` 
        });
      }
      
      if (classDueDate && new Date(classDueDate.dueDate) < now) {
        return res.status(403).json({ 
          message: `Submission deadline has passed for ${firstStudent.classLevel} - ${term}. Only admins can edit results now.` 
        });
      }
      
      if (globalSubjectDueDate && new Date(globalSubjectDueDate.dueDate) < now) {
        return res.status(403).json({ 
          message: `Submission deadline has passed for ${subject} in all classes - ${term}. Only admins can edit results now.` 
        });
      }
      
      if (subjectDueDate && new Date(subjectDueDate.dueDate) < now) {
        return res.status(403).json({ 
          message: `Submission deadline has passed for ${subject} in ${firstStudent.classLevel} - ${term}. Only admins can edit results now.` 
        });
      }
    }
    
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

// Marksheet-style bulk submit: many subjects per student for a class + term
router.post(
  '/results-grid',
  requireAuth,
  requireRole('admin', 'teacher'),
  [
    body('classLevel').isString().trim().notEmpty(),
    body('term').isIn(TERMS),
    body('results').isArray({ min: 1 }),
    body('results.*.studentId').isMongoId(),
    body('results.*.subjects').isArray({ min: 1 }),
    body('results.*.subjects.*.name').isString().trim().notEmpty(),
    body('results.*.subjects.*.score').isNumeric(),
    body('results.*.subjects.*.maxScore').optional().isNumeric()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { classLevel, term, results } = req.body;
    const now = new Date();

    // Enforce due dates for teachers (admins can always edit)
    if (req.user.role === 'teacher') {
      // Check for global due dates (applies to all classes)
      const globalDueDate = await ResultDueDate.findOne({ classLevel: null, term, subject: null }).lean();
      if (globalDueDate && new Date(globalDueDate.dueDate) < now) {
        return res.status(403).json({
          message: `Submission deadline has passed for all classes - ${term}. Only admins can edit results now.`
        });
      }

      // Check for class-specific due dates
      const classDueDate = await ResultDueDate.findOne({ classLevel, term, subject: null }).lean();
      if (classDueDate && new Date(classDueDate.dueDate) < now) {
        return res.status(403).json({
          message: `Submission deadline has passed for ${classLevel} - ${term}. Only admins can edit results now.`
        });
      }

      // Check for global subject-specific due dates
      const allSubjects = new Set();
      results.forEach(r => (r.subjects || []).forEach(s => allSubjects.add(s.name)));
      const globalSubjectDueDates = await ResultDueDate.find({
        classLevel: null,
        term,
        subject: { $in: Array.from(allSubjects) }
      }).lean();

      // Check for class-specific subject due dates
      const classSubjectDueDates = await ResultDueDate.find({
        classLevel,
        term,
        subject: { $in: Array.from(allSubjects) }
      }).lean();

      const allSubjectDueDates = [...globalSubjectDueDates, ...classSubjectDueDates];
      const locked = allSubjectDueDates.filter(dd => new Date(dd.dueDate) < now).map(dd => dd.subject);
      if (locked.length > 0) {
        return res.status(403).json({
          message: `Submission deadline has passed for subject(s): ${locked.join(', ')}. Only admins can edit these now.`
        });
      }
    }

    const saved = [];
    const failed = [];

    for (const r of results) {
      try {
        const student = await Student.findById(r.studentId).lean();
        if (!student) {
          failed.push({ studentId: r.studentId, message: 'Student not found' });
          continue;
        }
        // Safety: ensure student belongs to classLevel
        if (student.classLevel !== classLevel) {
          failed.push({ studentId: r.studentId, message: `Student not in class ${classLevel}` });
          continue;
        }

        let doc = await Result.findOne({ student: r.studentId, term });
        if (!doc) {
          doc = new Result({ student: r.studentId, term, subjects: [], total: 0, grade: '' });
        }

        // Upsert each subject into doc.subjects
        for (const subj of r.subjects) {
          const idx = doc.subjects.findIndex(s => s.name.toLowerCase() === String(subj.name).toLowerCase());
          const score = Number(subj.score || 0);
          const maxScore = Number(subj.maxScore || 100);
          if (idx >= 0) {
            doc.subjects[idx].score = score;
            doc.subjects[idx].maxScore = maxScore;
          } else {
            doc.subjects.push({ name: String(subj.name), score, maxScore });
          }
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
      body('classLevel').optional().isString().trim(),
      body('term').isString().notEmpty(),
      body('dueDate').isISO8601().toDate(),
      body('subject').optional().isString().trim()
    ],
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { classLevel, term, subject, dueDate } = req.body;
      try {
        const filter = { term };
        if (classLevel) filter.classLevel = classLevel;
        if (subject) filter.subject = subject;

        const update = { term, subject: subject || null, dueDate, createdBy: req.user.sub };
        if (classLevel) update.classLevel = classLevel;
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

  // Delete a due date
  router.delete('/result-due/:id', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
    try {
      const item = await ResultDueDate.findByIdAndDelete(req.params.id);
      if (!item) return res.status(404).json({ message: 'Due date not found' });
      return res.json({ message: 'Due date deleted' });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  });

module.exports = router;