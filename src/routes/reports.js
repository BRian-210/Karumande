const express = require('express');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const Bill = require('../models/Bill');
const Payment = require('../models/Payment');
const Student = require('../models/Student');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/bills.csv', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  const bills = await Bill.find().populate('student', 'name classLevel');
  const rows = ['Student,Class,Term,Amount,Balance,Status,UpdatedAt'];
  bills.forEach((b) => {
    rows.push(
      `${safe(b.student?.name)},${safe(b.student?.classLevel)},${safe(b.term)},${b.amount},${b.balance},${b.status},${b.updatedAt.toISOString()}`
    );
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="bills.csv"');
  res.send(rows.join('\n'));
});

router.get('/payments.csv', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  const payments = await Payment.find().populate('student', 'name classLevel').populate('bill', 'term');
  const rows = ['Student,Class,Term,Amount,Status,TransactionId,UpdatedAt'];
  payments.forEach((p) => {
    rows.push(
      `${safe(p.student?.name)},${safe(p.student?.classLevel)},${safe(p.bill?.term)},${p.amount},${p.status},${safe(
        p.transactionId
      )},${p.updatedAt.toISOString()}`
    );
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="payments.csv"');
  res.send(rows.join('\n'));
});

router.get('/bills.xlsx', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  const bills = await Bill.find().populate('student', 'name classLevel');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Bills');
  ws.columns = [
    { header: 'Student', key: 'student', width: 24 },
    { header: 'Class', key: 'classLevel', width: 12 },
    { header: 'Term', key: 'term', width: 16 },
    { header: 'Amount', key: 'amount', width: 12 },
    { header: 'Paid', key: 'amountPaid', width: 12 },
    { header: 'Balance', key: 'balance', width: 12 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Updated', key: 'updatedAt', width: 24 }
  ];

  bills.forEach((b) =>
    ws.addRow({
      student: b.student?.name,
      classLevel: b.student?.classLevel,
      term: b.term,
      amount: b.amount,
      amountPaid: b.amountPaid,
      balance: b.balance,
      status: b.status,
      updatedAt: b.updatedAt
    })
  );

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="bills.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

router.get('/payments/:id/receipt.pdf', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  const payment = await Payment.findById(req.params.id).populate('student', 'name classLevel').populate('bill', 'term');
  if (!payment) return res.status(404).json({ message: 'Payment not found' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="receipt.pdf"');

  const doc = new PDFDocument();
  doc.pipe(res);
  doc.fontSize(16).text('Payment Receipt', { align: 'center' }).moveDown();
  doc.fontSize(12);
  doc.text(`Student: ${payment.student?.name || 'N/A'}`);
  doc.text(`Class: ${payment.student?.classLevel || 'N/A'}`);
  doc.text(`Term: ${payment.bill?.term || 'N/A'}`);
  doc.text(`Amount: ${payment.amount}`);
  doc.text(`Status: ${payment.status}`);
  doc.text(`Transaction: ${payment.transactionId || 'N/A'}`);
  doc.text(`Date: ${payment.updatedAt.toISOString()}`);
  doc.moveDown();
  doc.text('Thank you.', { align: 'left' });
  doc.end();
});

function safe(val) {
  if (val === undefined || val === null) return '';
  return String(val).replace(/,/g, ' ');
}

module.exports = router;

