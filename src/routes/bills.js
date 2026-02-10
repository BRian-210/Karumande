const express = require('express');
const { body, validationResult } = require('express-validator');
const Bill = require('../models/Bill');
const Student = require('../models/Student');
const FeeStructure = require('../models/FeeStructure');
const { requireAuth, requireRole } = require('../middleware/auth');
const { TERMS, validatePagination } = require('../constants/school');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const { page, limit, skip } = validatePagination(req.query);
  let filter = {};
  if (req.user.role === 'parent') {
    const studentIds = await Student.find({ parent: req.user.sub }).distinct('_id');
    filter.student = { $in: studentIds };
  }
  if (req.query.studentId) {
    if (req.user.role === 'parent') {
      const allowed = await Student.find({ parent: req.user.sub }).distinct('_id');
      if (!allowed.map(String).includes(String(req.query.studentId))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }
    filter.student = req.query.studentId;
  }
  if (req.query.term) filter.term = req.query.term;
  const [items, total] = await Promise.all([
    Bill.find(filter)
      .populate('student', 'name classLevel parent')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit),
    Bill.countDocuments(filter)
  ]);
  return res.json({ data: items, page, limit, total });
});

router.post(
  '/',
  requireAuth,
  requireRole('admin', 'teacher'),
  [
    body('studentId').isString().withMessage('studentId is required'),
    body('description').optional().isString().trim(),
    body('term').isIn(TERMS),
    body('amount').isNumeric().withMessage('amount must be a number')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { studentId, description, amount, term } = req.body;
    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const bill = await Bill.create({
      student: studentId,
      description,
      amount,
      term,
      status: 'pending',
      amountPaid: 0,
      balance: amount
    });

    return res.status(201).json(bill);
  }
);

// Generate bills for a grade/term based on fee structure
router.post(
  '/generate',
  requireAuth,
  requireRole('admin', 'teacher'),
  [body('classLevel').isString().trim(), body('term').isIn(TERMS)],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { classLevel, term } = req.body;
    const structure = await FeeStructure.findOne({ classLevel, term });
    if (!structure) return res.status(404).json({ message: 'No fee structure found for that class and term' });

    const students = await Student.find({ classLevel });
    if (!students.length) return res.json({ created: 0, message: 'No students in that class' });

    let created = 0;
    for (const student of students) {
      const exists = await Bill.findOne({ student: student.id, term });
      if (exists) continue;
      await Bill.create({
        student: student.id,
        term,
        description: structure.description,
        amount: structure.amount,
        amountPaid: 0,
        balance: structure.amount,
        status: 'pending'
      });
      created += 1;
    }

    return res.json({ created, term, classLevel });
  }
);

router.patch(
  '/:id/pay',
  requireAuth,
  requireRole('admin', 'teacher'),
  [body('amount').isNumeric().withMessage('amount is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount } = req.body;
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.status(404).json({ message: 'Bill not found' });

    bill.amountPaid += amount;
    bill.balance = Math.max(bill.amount - bill.amountPaid, 0);
    bill.status = bill.balance === 0 ? 'paid' : 'partial';
    await bill.save();

    return res.json(bill);
  }
);

// Admin-only adjustment of bill amounts/balance
router.patch(
  '/:id/adjust',
  requireAuth,
  requireRole('admin', 'accountant'),
  [
    body('amount').optional().isNumeric(),
    body('amountPaid').optional().isNumeric(),
    body('balance').optional().isNumeric()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { amount, amountPaid, balance } = req.body;
    if (amount === undefined && amountPaid === undefined && balance === undefined) {
      return res.status(400).json({ message: 'Provide amount, amountPaid, or balance' });
    }

    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.status(404).json({ message: 'Bill not found' });

    if (amount !== undefined) bill.amount = Math.max(Number(amount), 0);

    const safeAmount = Number(bill.amount || 0);
    if (amountPaid !== undefined) {
      bill.amountPaid = Math.min(Math.max(Number(amountPaid), 0), safeAmount);
      bill.balance = Math.max(safeAmount - bill.amountPaid, 0);
    } else if (balance !== undefined) {
      bill.balance = Math.min(Math.max(Number(balance), 0), safeAmount);
      bill.amountPaid = Math.max(safeAmount - bill.balance, 0);
    }

    if (bill.balance === 0) bill.status = 'paid';
    else if (bill.amountPaid > 0) bill.status = 'partial';
    else bill.status = 'pending';

    await bill.save();
    return res.json(bill);
  }
);

module.exports = router;
