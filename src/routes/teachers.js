const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireRole } = require('../middleware/auth');
const { TERMS } = require('../constants/school');
const { results, students, resultDueDates } = require('../data/repositories');

const router = express.Router();

async function resolveDueDateLock({ role, classLevel, term, subjectNames }) {
  if (role !== 'teacher') return null;
  const now = new Date();

  const [globalDueDate, classDueDate, globalSubjectDueDates, classSubjectDueDates] = await Promise.all([
    resultDueDates.findOne({ classLevel: null, term, subject: null }),
    resultDueDates.findOne({ classLevel, term, subject: null }),
    subjectNames?.length ? resultDueDates.findList({ classLevel: null, term, subjects: subjectNames }) : [],
    subjectNames?.length ? resultDueDates.findList({ classLevel, term, subjects: subjectNames }) : [],
  ]);

  if (globalDueDate && new Date(globalDueDate.dueDate) < now) {
    return `Submission deadline has passed for all classes - ${term}. Only admins can edit results now.`;
  }
  if (classDueDate && new Date(classDueDate.dueDate) < now) {
    return `Submission deadline has passed for ${classLevel} - ${term}. Only admins can edit results now.`;
  }

  const lockedSubjects = [...globalSubjectDueDates, ...classSubjectDueDates]
    .filter((item) => new Date(item.dueDate) < now)
    .map((item) => item.subject)
    .filter(Boolean);

  if (lockedSubjects.length === 1) {
    return `Submission deadline has passed for ${lockedSubjects[0]} in ${classLevel} - ${term}. Only admins can edit results now.`;
  }
  if (lockedSubjects.length > 1) {
    return `Submission deadline has passed for subject(s): ${lockedSubjects.join(', ')}. Only admins can edit these now.`;
  }
  return null;
}

router.post(
  '/results-batch',
  requireAuth,
  requireRole('admin', 'teacher'),
  [
    body('term').isIn(TERMS),
    body('subject').isString().trim().notEmpty(),
    body('results').isArray({ min: 1 }),
    body('results.*.studentId').isUUID(),
    body('results.*.score').isNumeric(),
    body('maxScore').optional().isNumeric(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { term, subject, results: payload, maxScore = 100 } = req.body;
    const firstStudent = await students.findById(payload[0]?.studentId);
    if (!firstStudent) {
      return res.status(400).json({ message: 'Invalid student ID' });
    }

    const lockMessage = await resolveDueDateLock({
      role: req.user.role,
      classLevel: firstStudent.classLevel,
      term,
      subjectNames: [subject],
    });
    if (lockMessage) {
      return res.status(403).json({ message: lockMessage });
    }

    const saved = [];
    const failed = [];

    for (const row of payload) {
      try {
        const student = await students.findById(row.studentId);
        if (!student) {
          failed.push({ studentId: row.studentId, message: 'Student not found' });
          continue;
        }

        const existing = await results.findOne({ studentId: row.studentId, term });
        const subjectEntry = { name: subject, score: Number(row.score || 0), maxScore: Number(maxScore || 100) };

        if (!existing) {
          await results.upsert({
            student: row.studentId,
            term,
            subjects: [subjectEntry],
            total: subjectEntry.score,
            grade: '',
          });
          saved.push({ studentId: row.studentId });
          continue;
        }

        const nextSubjects = [...(existing.subjects || [])];
        const idx = nextSubjects.findIndex((item) => item.name.toLowerCase() === subject.toLowerCase());
        if (idx >= 0) nextSubjects[idx] = subjectEntry;
        else nextSubjects.push(subjectEntry);

        const total = nextSubjects.reduce((sum, item) => sum + Number(item.score || 0), 0);
        await results.update(existing.id, { subjects: nextSubjects, total });
        saved.push({ studentId: row.studentId });
      } catch (err) {
        failed.push({ studentId: row.studentId, message: err.message });
      }
    }

    return res.json({ saved: saved.length, failed });
  }
);

router.post(
  '/results-grid',
  requireAuth,
  requireRole('admin', 'teacher'),
  [
    body('classLevel').isString().trim().notEmpty(),
    body('term').isIn(TERMS),
    body('results').isArray({ min: 1 }),
    body('results.*.studentId').isUUID(),
    body('results.*.subjects').isArray({ min: 1 }),
    body('results.*.subjects.*.name').isString().trim().notEmpty(),
    body('results.*.subjects.*.score').isNumeric(),
    body('results.*.subjects.*.maxScore').optional().isNumeric(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { classLevel, term, results: payload } = req.body;
    const allSubjects = Array.from(
      new Set(payload.flatMap((entry) => (entry.subjects || []).map((subject) => subject.name)))
    );

    const lockMessage = await resolveDueDateLock({
      role: req.user.role,
      classLevel,
      term,
      subjectNames: allSubjects,
    });
    if (lockMessage) {
      return res.status(403).json({ message: lockMessage });
    }

    const saved = [];
    const failed = [];

    for (const row of payload) {
      try {
        const student = await students.findById(row.studentId);
        if (!student) {
          failed.push({ studentId: row.studentId, message: 'Student not found' });
          continue;
        }
        if (student.classLevel !== classLevel) {
          failed.push({ studentId: row.studentId, message: `Student not in class ${classLevel}` });
          continue;
        }

        const existing = await results.findOne({ studentId: row.studentId, term });
        const nextSubjects = existing ? [...(existing.subjects || [])] : [];

        row.subjects.forEach((subject) => {
          const normalized = {
            name: String(subject.name),
            score: Number(subject.score || 0),
            maxScore: Number(subject.maxScore || 100),
          };
          const idx = nextSubjects.findIndex((item) => item.name.toLowerCase() === normalized.name.toLowerCase());
          if (idx >= 0) nextSubjects[idx] = normalized;
          else nextSubjects.push(normalized);
        });

        const total = nextSubjects.reduce((sum, item) => sum + Number(item.score || 0), 0);
        await results.upsert({
          student: row.studentId,
          term,
          subjects: nextSubjects,
          total,
          grade: existing?.grade || '',
          comments: existing?.comments || null,
        });
        saved.push({ studentId: row.studentId });
      } catch (err) {
        failed.push({ studentId: row.studentId, message: err.message });
      }
    }

    return res.json({ saved: saved.length, failed });
  }
);

router.post(
  '/result-due',
  requireAuth,
  requireRole('admin', 'teacher'),
  [
    body('classLevel').optional().isString().trim(),
    body('term').isString().notEmpty(),
    body('dueDate').isISO8601().toDate(),
    body('subject').optional().isString().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const doc = await resultDueDates.upsert({
      classLevel: req.body.classLevel || null,
      term: req.body.term,
      subject: req.body.subject || null,
      dueDate: req.body.dueDate,
      createdBy: req.user.id,
    });

    return res.json({ message: 'Due date saved', data: doc });
  }
);

router.get('/result-due', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  const items = await resultDueDates.findList({
    classLevel: req.query.classLevel,
    term: req.query.term,
    subject: req.query.subject,
  });
  return res.json(items);
});

router.delete('/result-due/:id', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  const item = await resultDueDates.delete(req.params.id);
  if (!item) return res.status(404).json({ message: 'Due date not found' });
  return res.json({ message: 'Due date deleted' });
});

module.exports = router;
