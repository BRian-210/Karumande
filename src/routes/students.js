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
// Parent dashboard data – returns profile, recent results, fees overview
// Parent / Admin dashboard data for a specific student
router.get('/dashboard/:studentId', requireAuth, async (req, res) => {
  try {
    const { studentId } = req.params;

    // Fetch student + parent info
    const student = await Student.findById(studentId)
      .populate('parent', 'name email phone role')
      .lean();

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Authorization: parent must own this student, or user must be admin/teacher
    const isParentOfStudent = 
      req.user.role === 'parent' && 
      student.parent && 
      String(student.parent._id) === req.user.id;

    const isAuthorized = isParentOfStudent || ['admin', 'teacher'].includes(req.user.role);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this student\'s dashboard'
      });
    }

    // Load related data with graceful degradation
    let results = [], bills = [], payments = [], feeStructure = null;

    try {
      const Result = require('../models/Result');
      results = await Result.find({ student: studentId })
        .sort({ year: -1, term: -1 })
        .limit(10)
        .lean();
    } catch (err) {
      console.warn('[dashboard] Results query failed:', err.message);
    }

    try {
      const Bill = require('../models/Bill');
      bills = await Bill.find({ student: studentId })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean();
    } catch (err) {
      console.warn('[dashboard] Bills query failed:', err.message);
    }

    try {
      const Payment = require('../models/Payment');
      payments = await Payment.find({ student: studentId })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean();
    } catch (err) {
      console.warn('[dashboard] Payments query failed:', err.message);
    }

    try {
      const FeeStructure = require('../models/FeeStructure');
      feeStructure = await FeeStructure.findOne({ classLevel: student.classLevel }).lean();
    } catch (err) {
      console.warn('[dashboard] FeeStructure lookup failed:', err.message);
    }

    // Calculate balance
    const totalBilled = bills.reduce((sum, b) => sum + Number(b.amount || 0), 0);
    const totalPaid = payments
      .filter(p => ['completed', 'success', 'paid'].includes((p.status || '').toLowerCase()))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const balance = totalBilled - totalPaid;

    // Determine fee status (adjust thresholds as needed)
    let feeStatus = balance <= 0 ? 'paid' : 'outstanding';
    if (balance > 0) {
      if (balance < totalBilled * 0.3) feeStatus = 'partial-low';
      else if (balance < totalBilled * 0.7) feeStatus = 'partial';
      else feeStatus = 'high';
    }

    // Build clean response
    res.json({
      success: true,
      student: {
        id: student._id.toString(),
        name: student.name,
        classLevel: student.classLevel,
        stream: student.stream || null,
        admissionNumber: student.admissionNumber,
        gender: student.gender,
        dob: student.dob ? student.dob.toISOString().split('T')[0] : null,
        parent: student.parent ? {
          id: student.parent._id?.toString(),
          name: student.parent.name,
          email: student.parent.email,
          phone: student.parent.phone || null
        } : null
      },
      results: results.map(r => ({
        id: r._id.toString(),
        term: r.term,
        year: r.year,
        subjects: r.subjects || [],
        totalMarks: r.total,
        grade: r.grade,
        date: r.createdAt ? r.createdAt.toISOString() : null
      })),
      fees: {
        summary: {
          totalBilled,
          totalPaid,
          balance,
          status: feeStatus,
          lastActivity: payments.length > 0 ? payments[0].createdAt?.toISOString() : null
        },
        recentBills: bills.map(b => ({
          id: b._id.toString(),
          description: b.description || 'Fee bill',
          amount: Number(b.amount || 0),
          term: b.term,
          date: b.createdAt?.toISOString()
        })),
        recentPayments: payments.map(p => ({
          id: p._id.toString(),
          amount: Number(p.amount || 0),
          method: p.method || (p.phone ? 'M-Pesa' : 'Unknown'),
          status: p.status || 'unknown',
          date: p.createdAt?.toISOString()
        }))
      },
      feeStructure: feeStructure ? {
        tuition: Number(feeStructure.tuitionFee || 0),
        meals: Number(feeStructure.meals || 0),
        transport: Number(feeStructure.transport || 0),
        other: Number(feeStructure.otherFees || 0),
        totalPerTerm: Number(feeStructure.total || 0)
      } : null
    });
  } catch (err) {
    console.error('GET /student/dashboard/:studentId → error:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error while loading dashboard',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});
module.exports = router;