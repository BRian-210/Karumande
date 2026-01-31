const express = require('express');
const { body, validationResult } = require('express-validator');
const Payment = require('../models/Payment');
const Bill = require('../models/Bill');
const Student = require('../models/Student');
const { requireAuth, requireRole } = require('../middleware/auth');
const { stkPush, isIpAllowed, normalizePhone, validateSignature } = require('../services/daraja');

const router = express.Router();

router.post(
  '/initiate',
  requireAuth,
  [
    body('studentId').isString(),
    body('billId').optional().isString(),
    body('phone').isString().trim(),
    body('amount').isNumeric()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { studentId, billId, phone, amount } = req.body;
    const normalizedPhone = normalizePhone(phone);

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Parent can only pay for their child
    if (req.user.role === 'parent' && String(student.parent) !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const payment = await Payment.create({
      student: studentId,
      bill: billId,
      phone: normalizedPhone,
      amount,
      status: 'pending'
    });

    try {
      const stkRes = await stkPush({
        phone: normalizedPhone,
        amount,
        accountReference: billId || 'KARUMANDE',
        description: 'Fees payment'
      });
      payment.merchantRequestId = stkRes.MerchantRequestID;
      payment.checkoutRequestId = stkRes.CheckoutRequestID;
      await payment.save();
      return res.status(201).json({ message: 'Payment initiated', payment });
    } catch (err) {
      payment.status = 'failed';
      await payment.save();
      return res.status(500).json({ message: err.message });
    }
  }
);

// Manual payment confirmation
router.post(
  '/:id/confirm',
  requireAuth,
  requireRole('admin', 'teacher'),
  [body('status').isIn(['success', 'failed']), body('amount').optional().isNumeric()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    if (req.body.amount !== undefined) payment.amount = req.body.amount;
    payment.status = req.body.status;
    await payment.save();

    if (payment.bill && payment.status === 'success') {
      const bill = await Bill.findById(payment.bill);
      if (bill) {
        bill.amountPaid += payment.amount;
        bill.balance = Math.max(bill.amount - bill.amountPaid, 0);
        bill.status = bill.balance === 0 ? 'paid' : 'partial';
        await bill.save();
      }
    }

    return res.json(payment);
  }
);

// Daraja callback receiver
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

  const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;

  const amount = CallbackMetadata?.Item?.find?.((i) => i.Name === 'Amount')?.Value;
  const mpesaReceiptNumber = CallbackMetadata?.Item?.find?.((i) => i.Name === 'MpesaReceiptNumber')?.Value;

  const status = ResultCode === 0 ? 'success' : 'failed';

  const payment = await Payment.findOneAndUpdate(
    { checkoutRequestId: CheckoutRequestID },
    {
      merchantRequestId: MerchantRequestID,
      checkoutRequestId: CheckoutRequestID,
      transactionId: mpesaReceiptNumber,
      status,
      amount: amount ?? undefined,
      rawCallback: payload
    },
    { upsert: true, new: true }
  );

  if (payment.bill && status === 'success') {
    const bill = await Bill.findById(payment.bill);
    if (bill) {
      bill.amountPaid += payment.amount;
      bill.balance = Math.max(bill.amount - bill.amountPaid, 0);
      bill.status = bill.balance === 0 ? 'paid' : 'partial';
      await bill.save();
    }
  }

  return res.json({ message: 'Callback processed', status: payment.status });
});

module.exports = router;

