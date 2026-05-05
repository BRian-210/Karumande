const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireRole, enforceMustChangePassword } = require('../middleware/auth');
const { stkPush, isIpAllowed, normalizePhone, validateSignature } = require('../services/daraja');
const { validatePagination } = require('../constants/school');
const { payments, bills, students } = require('../data/repositories');

const router = express.Router();

async function applyPaymentToBill(payment) {
  if (!payment.bill || payment.status !== 'success') return;
  const billId = typeof payment.bill === 'object' ? payment.bill.id : payment.bill;
  const bill = await bills.findById(billId);
  if (!bill) return;

  const amountPaid = Number(bill.amountPaid || 0) + Number(payment.amount || 0);
  const balance = Math.max(Number(bill.amount || 0) - amountPaid, 0);
  const status = balance === 0 ? 'paid' : 'partial';
  await bills.update(bill.id, { amountPaid, balance, status });
}

router.get('/', requireAuth, enforceMustChangePassword, requireRole('admin', 'accountant', 'parent'), async (req, res) => {
  const { page, limit, skip } = validatePagination(req.query);
  const filters = { limit, offset: skip };

  if (req.query.studentId) filters.studentId = req.query.studentId;
  if (req.query.billId) filters.billId = req.query.billId;

  if (req.user.role === 'parent') {
    filters.studentIds = await students.distinctIdsByParent(req.user.id);
    if (!filters.studentIds.length) {
      return res.json({ data: [], page, limit, total: 0 });
    }
  }

  const [items, total] = await Promise.all([payments.list(filters), payments.count(filters)]);
  return res.json({ data: items, page, limit, total });
});

router.post(
  '/initiate',
  requireAuth,
  enforceMustChangePassword,
  requireRole('admin', 'accountant', 'parent'),
  [
    body('studentId').isUUID(),
    body('billId').optional().isUUID(),
    body('phone').isString().trim(),
    body('amount').isNumeric(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { studentId, billId, phone, amount } = req.body;
    const normalizedPhone = normalizePhone(phone);

    const student = await students.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const parentId = typeof student.parent === 'object' ? student.parent.id : student.parent;
    if (req.user.role === 'parent' && parentId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    let payment = await payments.create({
      student: studentId,
      bill: billId,
      phone: normalizedPhone,
      amount: Number(amount),
      status: 'pending',
    });

    try {
      const stkRes = await stkPush({
        phone: normalizedPhone,
        amount,
        accountReference: billId || 'KARUMANDE',
        description: 'Fees payment',
      });
      payment = await payments.update(payment.id, {
        merchantRequestId: stkRes.MerchantRequestID,
        checkoutRequestId: stkRes.CheckoutRequestID,
      });
      return res.status(201).json({ message: 'Payment initiated', payment });
    } catch (err) {
      payment = await payments.update(payment.id, { status: 'failed' });
      return res.status(500).json({ message: err.message });
    }
  }
);

router.post(
  '/:id/confirm',
  requireAuth,
  enforceMustChangePassword,
  requireRole('admin'),
  [body('status').isIn(['success', 'failed']), body('amount').optional().isNumeric()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    let payment = await payments.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    payment = await payments.update(payment.id, {
      amount: req.body.amount !== undefined ? Number(req.body.amount) : payment.amount,
      status: req.body.status,
    });

    await applyPaymentToBill(payment);
    return res.json(payment);
  }
);

router.post('/callback', async (req, res) => {
  if (!isIpAllowed(req)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const signature = req.headers['x-daraja-signature'] || req.headers['x-mpesa-signature'];
  if (!validateSignature(req.rawBody, signature)) {
    return res.status(403).json({ message: 'Invalid signature' });
  }

  const payload = req.body;
  const callback = payload.Body?.stkCallback;
  if (!callback) {
    return res.status(400).json({ message: 'Invalid callback payload' });
  }

  const { MerchantRequestID, CheckoutRequestID, ResultCode, CallbackMetadata } = callback;
  const amount = CallbackMetadata?.Item?.find?.((i) => i.Name === 'Amount')?.Value;
  const mpesaReceiptNumber = CallbackMetadata?.Item?.find?.((i) => i.Name === 'MpesaReceiptNumber')?.Value;
  const status = ResultCode === 0 ? 'success' : 'failed';

  const payment = await payments.upsertByCheckoutRequestId(CheckoutRequestID, {
    merchantRequestId: MerchantRequestID,
    transactionId: mpesaReceiptNumber,
    status,
    amount: amount ?? undefined,
    rawCallback: payload,
  });

  await applyPaymentToBill(payment);
  return res.json({ message: 'Callback processed', status: payment.status });
});

module.exports = router;
