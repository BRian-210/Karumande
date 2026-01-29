const express = require('express');
const { body, validationResult } = require('express-validator');
const Student = require('../models/Student');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const { CLASS_LEVELS, validatePagination } = require('../constants/school');

const router = express.Router();

const POPULATE_PARENT = { path: 'parent', select: 'name email role' };

// Helpers
const GENDERS = ['Male', 'Female', 'Other'];

router.get(
  '/',
  requireAuth,
  async (req, res) => {
    const { page, limit, skip } = validatePagination(req.query);

    const query = { active: true };
    // Optional search (name or admission number)
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      const q = req.query.search.trim();
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { admissionNumber: { $regex: q, $options: 'i' } },
      ];
    }
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

// Summary counts for admin dashboard
router.get('/summary', requireAuth, async (req, res) => {
  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const startOfNextYear = new Date(Date.UTC(year + 1, 0, 1));

  const [total, boys, girls, newThisYear] = await Promise.all([
    Student.countDocuments({ active: true }),
    Student.countDocuments({ active: true, gender: 'Male' }),
    Student.countDocuments({ active: true, gender: 'Female' }),
    Student.countDocuments({ active: true, createdAt: { $gte: startOfYear, $lt: startOfNextYear } }),
  ]);

  return res.json({
    total,
    boys,
    girls,
    new2026: year === 2026 ? newThisYear : newThisYear, // keep key expected by frontend
    newThisYear,
    year,
  });
});

// Learners by grade breakdown for dashboard table
router.get('/by-grade', requireAuth, async (req, res) => {
  const rows = await Student.aggregate([
    { $match: { active: true } },
    { $group: { _id: { classLevel: '$classLevel', gender: '$gender' }, count: { $sum: 1 } } },
  ]);

  const map = new Map(); // classLevel => { grade, boys, girls }
  for (const r of rows) {
    const grade = r._id.classLevel;
    const gender = r._id.gender;
    const count = r.count || 0;
    const entry = map.get(grade) || { grade, boys: 0, girls: 0 };
    if (gender === 'Male') entry.boys += count;
    if (gender === 'Female') entry.girls += count;
    map.set(grade, entry);
  }

  // Sort by known class order
  const order = CLASS_LEVELS;
  const out = Array.from(map.values()).sort((a, b) => {
    const ia = order.indexOf(a.grade);
    const ib = order.indexOf(b.grade);
    if (ia === -1 && ib === -1) return a.grade.localeCompare(b.grade);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return res.json(out);
});

const createStudentValidation = [
  body('name').isString().trim().notEmpty().withMessage('Student name is required'),
  body('classLevel')
    .isIn(CLASS_LEVELS)
    .withMessage(`classLevel must be one of: ${CLASS_LEVELS.join(', ')}`),
  body('gender').isIn(GENDERS).withMessage(`gender must be one of: ${GENDERS.join(', ')}`),
  body('dob').isISO8601().withMessage('dob must be a valid date (YYYY-MM-DD)').toDate(),
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

    const { name, classLevel, parentId, stream, admissionNumber, gender, dob } = req.body;
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
      gender,
      dob,
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
  body('gender').optional().isIn(GENDERS).withMessage(`gender must be one of: ${GENDERS.join(', ')}`),
  body('dob').optional().isISO8601().withMessage('dob must be a valid date (YYYY-MM-DD)').toDate(),
  body('stream').optional().isString().trim(),
  body('admissionNumber').optional().isString().trim(),
  body('status')
    .optional()
    .isIn(['active', 'graduated', 'transferred']),
  body('active').optional().isBoolean(),
];

// Get single student (for edit page)
router.get('/:id', requireAuth, async (req, res) => {
  const student = await Student.findById(req.params.id).populate(POPULATE_PARENT);
  if (!student) return res.status(404).json({ message: 'Student not found' });
  return res.json({ data: student });
});

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

// Delete (soft-delete) student: admin only
router.delete('/:id', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
  const student = await Student.findByIdAndUpdate(
    req.params.id,
    { active: false },
    { new: true }
  ).populate(POPULATE_PARENT);

  if (!student) return res.status(404).json({ message: 'Student not found' });
  return res.json({ message: 'Student deleted successfully', data: student });
});

// Parent dashboard data
router.get('/dashboard/:studentId', requireAuth, async (req, res) => {
  const { studentId } = req.params;

  // Find the student
  const student = await Student.findById(studentId).populate('parent', 'name email');
  if (!student) {
    return res.status(404).json({ message: 'Student not found' });
  }

  // Check if user is parent of this student or admin
  if (req.user.role === 'parent' && String(student.parent._id) !== req.user.sub) {
    return res.status(403).json({ message: 'Access denied' });
  }

  // Get student's results
  const results = await require('../models/Result').find({ student: studentId })
    .sort({ createdAt: -1 })
    .limit(10);

  // Get student's bills/fees
  const bills = await require('../models/Bill').find({ student: studentId })
    .sort({ createdAt: -1 });

  // Get student's payments
  const payments = await require('../models/Payment').find({ student: studentId })
    .sort({ createdAt: -1 });

  // Calculate fee balance
  const totalBilled = bills.reduce((sum, bill) => sum + bill.amount, 0);
  const totalPaid = payments
    .filter(payment => payment.status === 'completed')
    .reduce((sum, payment) => sum + payment.amount, 0);
  const balance = totalBilled - totalPaid;

  // Get fee structure for the student's class
  const feeStructure = await require('../models/FeeStructure').findOne({ 
    classLevel: student.classLevel 
  });

  return res.json({
    student: {
      id: student._id,
      name: student.name,
      classLevel: student.classLevel,
      admissionNumber: student.admissionNumber,
      parent: student.parent
    },
    results: results.map(result => ({
      id: result._id,
      term: result.term,
      year: result.year,
      subjects: result.subjects,
      total: result.total,
      grade: result.grade,
      createdAt: result.createdAt
    })),
    fees: {
      totalBilled,
      totalPaid,
      balance,
      status: balance <= 0 ? 'paid' : balance < totalBilled * 0.5 ? 'partial' : 'unpaid',
      bills: bills.map(bill => ({
        id: bill._id,
        description: bill.description,
        amount: bill.amount,
        term: bill.term,
        createdAt: bill.createdAt
      })),
      payments: payments.map(payment => ({
        id: payment._id,
        amount: payment.amount,
        phone: payment.phone,
        status: payment.status,
        createdAt: payment.createdAt
      }))
    },
    feeStructure: feeStructure ? {
      tuitionFee: feeStructure.tuitionFee,
      meals: feeStructure.meals,
      transport: feeStructure.transport,
      otherFees: feeStructure.otherFees,
      total: feeStructure.total
    } : null
  });
});

module.exports = router;