const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireRole } = require('../middleware/auth');
const { TERMS, validatePagination } = require('../constants/school');
const { bills, students, feeStructures } = require('../data/repositories');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const { page, limit, skip } = validatePagination(req.query);
  const filters = { limit, offset: skip };

  if (req.user.role === 'parent') {
    const studentIds = await students.distinctIdsByParent(req.user.id);
    if (!studentIds.length) {
      return res.json({ data: [], page, limit, total: 0 });
    }
    filters.studentIds = studentIds;
  }

  if (req.query.studentId) {
    if (req.user.role === 'parent') {
      const allowed = await students.distinctIdsByParent(req.user.id);
      if (!allowed.includes(req.query.studentId)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }
    filters.studentId = req.query.studentId;
  }

  if (req.query.term) filters.term = req.query.term;

  const [items, total] = await Promise.all([bills.list(filters), bills.count(filters)]);
  return res.json({ data: items, page, limit, total });
});

router.post(
  '/',
  requireAuth,
  requireRole('admin', 'teacher'),
  [
    body('studentId').isUUID().withMessage('studentId is required'),
    body('description').optional().isString().trim(),
    body('term').isIn(TERMS),
    body('amount').isNumeric().withMessage('amount must be a number'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { studentId, description, amount, term } = req.body;
    const student = await students.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const bill = await bills.create({
      student: studentId,
      description,
      amount: Number(amount),
      term,
      status: 'pending',
      amountPaid: 0,
      balance: Number(amount),
    });

    return res.status(201).json(bill);
  }
);

router.post(
  '/generate',
  requireAuth,
  requireRole('admin', 'teacher'),
  [body('classLevel').isString().trim(), body('term').isIn(TERMS)],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { classLevel, term } = req.body;
    const structure = await feeStructures.findOne({ classLevel, term });
    if (!structure) return res.status(404).json({ message: 'No fee structure found for that class and term' });

    const classStudents = await students.list({ classLevel, limit: 1000, offset: 0 });
    if (!classStudents.length) return res.json({ created: 0, message: 'No students in that class' });

    let created = 0;
    for (const student of classStudents) {
      const exists = await bills.findOne({ studentId: student.id, term });
      if (exists) continue;
      await bills.create({
        student: student.id,
        term,
        description: structure.description,
        amount: structure.amount,
        amountPaid: 0,
        balance: structure.amount,
        status: 'pending',
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

    const bill = await bills.findById(req.params.id);
    if (!bill) return res.status(404).json({ message: 'Bill not found' });

    const amount = Number(req.body.amount);
    const amountPaid = Number(bill.amountPaid || 0) + amount;
    const balance = Math.max(Number(bill.amount) - amountPaid, 0);
    const status = balance === 0 ? 'paid' : 'partial';
    const updated = await bills.update(req.params.id, { amountPaid, balance, status });
    return res.json(updated);
  }
);

router.patch(
  '/:id/adjust',
  requireAuth,
  requireRole('admin', 'accountant'),
  [body('amount').optional().isNumeric(), body('amountPaid').optional().isNumeric(), body('balance').optional().isNumeric()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { amount, amountPaid, balance } = req.body;
    if (amount === undefined && amountPaid === undefined && balance === undefined) {
      return res.status(400).json({ message: 'Provide amount, amountPaid, or balance' });
    }

    const bill = await bills.findById(req.params.id);
    if (!bill) return res.status(404).json({ message: 'Bill not found' });

    let nextAmount = Number(bill.amount || 0);
    let nextPaid = Number(bill.amountPaid || 0);
    let nextBalance = Number(bill.balance || 0);

    if (amount !== undefined) nextAmount = Math.max(Number(amount), 0);
    if (amountPaid !== undefined) {
      nextPaid = Math.min(Math.max(Number(amountPaid), 0), nextAmount);
      nextBalance = Math.max(nextAmount - nextPaid, 0);
    } else if (balance !== undefined) {
      nextBalance = Math.min(Math.max(Number(balance), 0), nextAmount);
      nextPaid = Math.max(nextAmount - nextBalance, 0);
    } else {
      nextBalance = Math.max(nextAmount - nextPaid, 0);
    }

    const status = nextBalance === 0 ? 'paid' : nextPaid > 0 ? 'partial' : 'pending';
    const updated = await bills.update(req.params.id, {
      amount: nextAmount,
      amountPaid: nextPaid,
      balance: nextBalance,
      status,
    });
    return res.json(updated);
  }
);

module.exports = router;
