const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireRole } = require('../middleware/auth');
const { TERMS, validatePagination } = require('../constants/school');
const { results, students, resultDueDates } = require('../data/repositories');

const router = express.Router();

async function ensureTeacherCanEdit({ role, classLevel, term, subjects }) {
  if (role !== 'teacher') return null;
  const now = new Date();
  const [classDueDate, ...subjectDueDates] = await Promise.all([
    resultDueDates.findOne({ classLevel, term, subject: null }),
    resultDueDates.findList({ classLevel, term, subjects }),
  ]);
  const allDueDates = [classDueDate, ...subjectDueDates].filter(Boolean);
  const locked = allDueDates.find((item) => new Date(item.dueDate) < now);
  if (!locked) return null;
  return `Submission deadline has passed for ${classLevel} - ${term}. Only admins can edit results now.`;
}

router.get('/', requireAuth, async (req, res) => {
  const { page, limit, skip } = validatePagination(req.query);
  const filters = { limit, offset: skip };
  if (req.query.term) filters.term = req.query.term;

  if (req.query.classLevel || req.query.class) {
    const classLevel = req.query.classLevel || req.query.class;
    const studentsInClass = await students.list({ classLevel, active: true, limit: 1000, offset: 0 });
    const ids = studentsInClass.map((student) => student.id);
    if (!ids.length) {
      return res.json({ data: [], page, limit, total: 0 });
    }
    filters.studentIds = ids;
  }

  if (req.query.studentId) {
    filters.studentId = req.query.studentId;
  }

  if (req.user.role === 'parent') {
    const ownedStudentIds = await students.distinctIdsByParent(req.user.id);
    if (!ownedStudentIds.length) {
      return res.json({ data: [], page, limit, total: 0 });
    }
    if (filters.studentId && !ownedStudentIds.includes(filters.studentId)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (filters.studentIds?.length) {
      filters.studentIds = filters.studentIds.filter((id) => ownedStudentIds.includes(id));
    } else {
      filters.studentIds = ownedStudentIds;
    }
  }

  const [items, total] = await Promise.all([results.list(filters), results.count(filters)]);
  return res.json({ data: items, page, limit, total });
});

router.get('/:id', requireAuth, async (req, res) => {
  const result = await results.findById(req.params.id);
  if (!result) {
    return res.status(404).json({ message: 'Result not found' });
  }

  if (req.user.role === 'parent') {
    const ownedStudentIds = await students.distinctIdsByParent(req.user.id);
    const studentId = typeof result.student === 'object' ? result.student.id : result.student;
    if (!ownedStudentIds.includes(studentId)) {
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
    body('studentId').isUUID(),
    body('term').isIn(TERMS),
    body('subjects').isArray({ min: 1 }),
    body('subjects.*.name').isString().trim().notEmpty(),
    body('subjects.*.score').isNumeric(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { studentId, term, subjects, grade, comments } = req.body;
    const student = await students.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const dueDateMessage = await ensureTeacherCanEdit({
      role: req.user.role,
      classLevel: student.classLevel,
      term,
      subjects: subjects.map((subject) => subject.name),
    });
    if (dueDateMessage) {
      return res.status(403).json({ message: dueDateMessage });
    }

    const total = subjects.reduce((sum, subject) => sum + Number(subject.score || 0), 0);
    const result = await results.upsert({
      student: studentId,
      term,
      subjects,
      total,
      grade,
      comments,
    });
    return res.status(201).json(result);
  }
);

router.patch(
  '/:id',
  requireAuth,
  requireRole('admin', 'teacher'),
  [
    body('subjects').optional().isArray(),
    body('subjects.*.name').optional().isString().trim(),
    body('subjects.*.score').optional().isNumeric(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const doc = await results.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Result not found' });

    const student = typeof doc.student === 'object' ? doc.student : await students.findById(doc.student);
    const subjectsToCheck = req.body.subjects ? req.body.subjects.map((item) => item.name) : (doc.subjects || []).map((item) => item.name);
    const dueDateMessage = await ensureTeacherCanEdit({
      role: req.user.role,
      classLevel: student.classLevel,
      term: doc.term,
      subjects: subjectsToCheck,
    });
    if (dueDateMessage) {
      return res.status(403).json({ message: dueDateMessage });
    }

    const patch = {};
    if (req.body.subjects) {
      patch.subjects = req.body.subjects;
      patch.total = req.body.subjects.reduce((sum, subject) => sum + Number(subject.score || 0), 0);
    }
    if (req.body.grade !== undefined) patch.grade = req.body.grade;
    if (req.body.comments !== undefined) patch.comments = req.body.comments;

    const updated = await results.update(doc.id, patch);
    return res.json(updated);
  }
);

module.exports = router;
