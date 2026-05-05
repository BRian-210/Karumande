const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireRole } = require('../middleware/auth');
const { CLASS_LEVELS, validatePagination } = require('../constants/school');
const { users, students, results, bills, payments, feeStructures } = require('../data/repositories');

const router = express.Router();

const GENDERS = ['Male', 'Female', 'Other'];

function decorateStudent(student) {
  if (!student) return null;
  return {
    ...student,
    parent: student.parent && typeof student.parent === 'object' ? student.parent : student.parent || null,
  };
}

router.get('/', requireAuth, async (req, res) => {
  const { page, limit, skip } = validatePagination(req.query);
  const filters = { active: true, limit, offset: skip };

  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    filters.search = req.query.search.trim();
  }
  if (typeof req.query.classLevel === 'string' && req.query.classLevel.trim()) {
    filters.classLevel = req.query.classLevel.trim();
  }
  if (req.user.role === 'parent') {
    filters.parentId = req.user.id;
  }

  const [rows, total] = await Promise.all([students.list(filters), students.count(filters)]);
  return res.json({
    data: rows.map(decorateStudent),
    pagination: {
      page,
      limit,
      total,
      pages: limit > 0 ? Math.ceil(total / limit) : 1,
    },
  });
});

router.get('/summary', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  const year = new Date().getFullYear();
  const summary = await students.summaryCounts(year);
  return res.json({
    total: summary.total || 0,
    boys: summary.boys || 0,
    girls: summary.girls || 0,
    new2026: summary.new_this_year || 0,
    newThisYear: summary.new_this_year || 0,
    year,
  });
});

router.get('/by-grade', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  const rows = await students.byGrade();
  const map = new Map();
  rows.forEach((row) => {
    const grade = row.class_level;
    const gender = row.gender;
    const count = row.count || 0;
    const entry = map.get(grade) || { grade, boys: 0, girls: 0 };
    if (gender === 'Male') entry.boys += count;
    if (gender === 'Female') entry.girls += count;
    map.set(grade, entry);
  });

  const out = Array.from(map.values()).sort((a, b) => {
    const ia = CLASS_LEVELS.indexOf(a.grade);
    const ib = CLASS_LEVELS.indexOf(b.grade);
    if (ia === -1 && ib === -1) return a.grade.localeCompare(b.grade);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return res.json(out);
});

const createStudentValidation = [
  body('name').isString().trim().notEmpty().withMessage('Student name is required'),
  body('classLevel').isIn(CLASS_LEVELS).withMessage(`classLevel must be one of: ${CLASS_LEVELS.join(', ')}`),
  body('gender').isIn(GENDERS).withMessage(`gender must be one of: ${GENDERS.join(', ')}`),
  body('dob').isISO8601().withMessage('dob must be a valid date (YYYY-MM-DD)').toDate(),
  body('parentId').optional().isUUID().withMessage('Invalid parent ID format'),
  body('admissionNumber').optional().isString().trim(),
  body('stream').optional().isString().trim(),
];

router.post('/', requireAuth, requireRole('admin', 'teacher', 'parent'), createStudentValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, classLevel, parentId, stream, admissionNumber, gender, dob } = req.body;
  let parent = null;

  if (req.user.role === 'parent') {
    parent = await users.findById(req.user.id);
    if (!parent || parent.role !== 'parent') {
      return res.status(403).json({ message: 'Access denied' });
    }
  } else if (parentId) {
    parent = await users.findById(parentId);
    if (!parent || parent.role !== 'parent') {
      return res.status(404).json({ message: 'Parent not found or invalid role' });
    }
  }

  const student = await students.create({
    name: name.trim(),
    classLevel,
    stream: stream?.trim() || null,
    admissionNumber: admissionNumber?.trim() || null,
    gender,
    dob,
    parent: parent?.id || null,
  });

  if (parent) {
    await users.addChild(parent.id, student.id);
  }

  const fullStudent = await students.findById(student.id, { withParent: true });
  return res.status(201).json({
    message: 'Student created successfully',
    data: decorateStudent(fullStudent),
  });
});

const updateStudentValidation = [
  body('name').optional().isString().trim().notEmpty(),
  body('classLevel').optional().isIn(CLASS_LEVELS).withMessage(`classLevel must be one of: ${CLASS_LEVELS.join(', ')}`),
  body('gender').optional().isIn(GENDERS).withMessage(`gender must be one of: ${GENDERS.join(', ')}`),
  body('dob').optional().isISO8601().withMessage('dob must be a valid date (YYYY-MM-DD)').toDate(),
  body('stream').optional().isString().trim(),
  body('admissionNumber').optional().isString().trim(),
  body('status').optional().isIn(['active', 'graduated', 'transferred']),
  body('active').optional().isBoolean(),
];

router.get('/dashboard/:studentId', requireAuth, async (req, res) => {
  try {
    const { studentId } = req.params;
    const student = await students.findById(studentId, { withParent: true });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const parentId = student.parent && typeof student.parent === 'object' ? student.parent.id : student.parent;
    const isParentOfStudent = req.user.role === 'parent' && parentId === req.user.id;
    const isAuthorized = isParentOfStudent || ['admin', 'teacher'].includes(req.user.role);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this student's dashboard",
      });
    }

    const [resultRows, billRows, paymentRows, feeStructure] = await Promise.all([
      results.list({ studentId, limit: 10, offset: 0 }),
      bills.list({ studentId, limit: 30, offset: 0 }),
      payments.list({ studentId, limit: 30, offset: 0 }),
      feeStructures.findAnyByClass(student.classLevel),
    ]);

    const totalBilled = billRows.reduce((sum, b) => sum + Number(b.amount || 0), 0);
    const totalPaid = paymentRows
      .filter((p) => ['completed', 'success', 'paid'].includes((p.status || '').toLowerCase()))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const balance = totalBilled - totalPaid;
    let feeStatus = balance <= 0 ? 'paid' : 'outstanding';
    if (balance > 0) {
      if (balance < totalBilled * 0.3) feeStatus = 'partial-low';
      else if (balance < totalBilled * 0.7) feeStatus = 'partial';
      else feeStatus = 'high';
    }

    return res.json({
      success: true,
      student: {
        id: student.id,
        name: student.name,
        classLevel: student.classLevel,
        stream: student.stream || null,
        admissionNumber: student.admissionNumber,
        gender: student.gender,
        dob: student.dob ? student.dob.toISOString().split('T')[0] : null,
        parent: student.parent && typeof student.parent === 'object'
          ? {
              id: student.parent.id,
              name: student.parent.name,
              email: student.parent.email,
              phone: student.parent.phone || null,
            }
          : null,
      },
      results: resultRows.map((r) => ({
        id: r.id,
        term: r.term,
        year: null,
        subjects: r.subjects || [],
        totalMarks: r.total,
        grade: r.grade,
        date: r.createdAt ? new Date(r.createdAt).toISOString() : null,
      })),
      fees: {
        summary: { totalBilled, totalPaid, balance, status: feeStatus },
        feeStructure,
        bills: billRows,
        payments: paymentRows,
      },
    });
  } catch (err) {
    console.error('[dashboard] error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load student dashboard' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  const student = await students.findById(req.params.id, { withParent: true });
  if (!student) return res.status(404).json({ message: 'Student not found' });
  return res.json({ data: decorateStudent(student) });
});

router.patch('/:id', requireAuth, requireRole('admin', 'teacher'), updateStudentValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const updated = await students.update(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ message: 'Student not found' });
  }
  const fullStudent = await students.findById(req.params.id, { withParent: true });
  return res.json({
    message: 'Student updated successfully',
    data: decorateStudent(fullStudent),
  });
});

router.post('/:id/promote', requireAuth, requireRole('admin', 'teacher'), [body('nextClassLevel').isIn(CLASS_LEVELS).withMessage('Invalid class level')], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const updated = await students.update(req.params.id, { classLevel: req.body.nextClassLevel });
  if (!updated) {
    return res.status(404).json({ message: 'Student not found' });
  }
  const fullStudent = await students.findById(req.params.id, { withParent: true });
  return res.json({
    message: 'Student promoted successfully',
    data: decorateStudent(fullStudent),
  });
});

router.post('/:id/deactivate', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  const updated = await students.update(req.params.id, { active: false });
  if (!updated) {
    return res.status(404).json({ message: 'Student not found' });
  }
  const fullStudent = await students.findById(req.params.id, { withParent: true });
  return res.json({
    message: 'Student deactivated successfully',
    data: decorateStudent(fullStudent),
  });
});

router.delete('/:id', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
  const updated = await students.update(req.params.id, { active: false });
  if (!updated) return res.status(404).json({ message: 'Student not found' });
  const fullStudent = await students.findById(req.params.id, { withParent: true });
  return res.json({ message: 'Student deleted successfully', data: decorateStudent(fullStudent) });
});

module.exports = router;
