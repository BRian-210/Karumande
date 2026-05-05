const express = require('express');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { requireAuth, requireRole } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const { bills, payments, students, results, admissions, siteConfigs, users } = require('../data/repositories');

const router = express.Router();

function safe(val) {
  if (val === undefined || val === null) return '';
  return String(val).replace(/,/g, ' ');
}

function calculateGrade(percent) {
  if (percent >= 80) return 'A';
  if (percent >= 70) return 'B';
  if (percent >= 60) return 'C';
  if (percent >= 50) return 'D';
  return 'E';
}

function renderHeader(doc, title) {
  const defaultLogo = path.resolve(__dirname, '../../public/IMG-20250625-WA0010.jpg');
  const logoPath = doc._reportLogoPath || defaultLogo;
  const left = 50;
  const top = 40;
  if (fs.existsSync(logoPath)) {
    try { doc.image(logoPath, left, top, { width: 60 }); } catch (e) {}
  }
  doc.fontSize(16).text('Karumande Link School', 130, top + 6);
  if (title) doc.fontSize(12).text(title, 130, top + 28);
  doc.moveDown(2);
  doc.moveTo(50, top + 70).lineTo(545, top + 70).stroke();
  doc.moveDown();
}

function drawTable(doc, startX, startY, columns, rows, rowHeight = 20) {
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  doc.save();
  doc.rect(startX, startY, tableWidth, rowHeight).fillAndStroke('#f3f4f6', '#e5e7eb');
  doc.fillColor('#0f172a').fontSize(11);
  let x = startX;
  columns.forEach((col) => {
    doc.text(col.header, x + 4, startY + 5, { width: col.width - 8 });
    x += col.width;
  });
  let y = startY + rowHeight;
  doc.fontSize(10).fillColor('#0f172a');
  rows.forEach((row, rowIndex) => {
    x = startX;
    doc.rect(startX, y, tableWidth, rowHeight).fill(rowIndex % 2 === 0 ? '#ffffff' : '#fbfbfb');
    for (let i = 0; i < columns.length; i += 1) {
      doc.fillColor('#0f172a').text(String(row[i] ?? ''), x + 4, y + 5, { width: columns[i].width - 8 });
      x += columns[i].width;
    }
    doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(startX, y).lineTo(startX + tableWidth, y).stroke();
    y += rowHeight;
  });
  doc.strokeColor('#e5e7eb').lineWidth(1).rect(startX, startY, tableWidth, rowHeight + rows.length * rowHeight).stroke();
  doc.restore();
}

function calcTotalsFromSubjects(subjects) {
  if (!subjects || subjects.length === 0) return { total: 0, maxTotal: 0 };
  let total = 0;
  let maxTotal = 0;
  subjects.forEach((subject) => {
    total += Number(subject.score || 0);
    maxTotal += Number(subject.maxScore || 100);
  });
  return { total, maxTotal };
}

function studentReportFromResult(student, term, result) {
  if (!result) {
    return { student, term, subjects: [], total: 0, maxTotal: 0, percent: 0, grade: null, comments: undefined };
  }
  const { total, maxTotal } = calcTotalsFromSubjects(result.subjects);
  const percent = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
  return {
    student,
    term,
    subjects: result.subjects || [],
    total,
    maxTotal,
    percent: Math.round(percent * 100) / 100,
    grade: result.grade || calculateGrade(percent),
    comments: result.comments,
  };
}

async function getConfiguredLogoPath() {
  const cfg = await siteConfigs.findByKey('logoPath');
  return cfg?.value ? path.join(process.cwd(), 'public', cfg.value.replace(/^\//, '')) : null;
}

async function loadResultsByStudentId(studentIds, term) {
  if (!studentIds.length) return new Map();
  const docs = await results.list({ studentIds, term, limit: 5000, offset: 0 });
  return new Map(docs.map((doc) => [typeof doc.student === 'object' ? doc.student.id : doc.student, doc]));
}

async function ensureOwnsStudent(req, student) {
  if (!['parent', 'student'].includes(req.user.role)) return true;
  const user = await users.findById(req.user.id);
  const ownsByParent = student.parent && (typeof student.parent === 'object' ? student.parent.id : student.parent) === req.user.id;
  const ownsByChildren = Array.isArray(user?.children) && user.children.includes(student.id);
  return ownsByParent || ownsByChildren;
}

router.get('/bills.csv', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bills.csv"');
  res.write('Student,Class,Term,Amount,Balance,Status,UpdatedAt\n');
  const rows = await bills.list({ limit: 5000, offset: 0 });
  rows.forEach((bill) => {
    res.write(`${safe(bill.student?.name)},${safe(bill.student?.classLevel)},${safe(bill.term)},${bill.amount},${bill.balance},${bill.status},${new Date(bill.updatedAt).toISOString()}\n`);
  });
  res.end();
});

router.get('/payments.csv', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="payments.csv"');
  res.write('Student,Class,Term,Amount,Status,TransactionId,UpdatedAt\n');
  const rows = await payments.list({ limit: 5000, offset: 0 });
  rows.forEach((payment) => {
    res.write(`${safe(payment.student?.name)},${safe(payment.student?.classLevel)},${safe(payment.bill?.term)},${payment.amount},${payment.status},${safe(payment.transactionId)},${new Date(payment.updatedAt).toISOString()}\n`);
  });
  res.end();
});

router.get('/bills.xlsx', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="bills.xlsx"');
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useSharedStrings: true });
  const ws = wb.addWorksheet('Bills');
  ws.columns = [
    { header: 'Student', key: 'student', width: 24 },
    { header: 'Class', key: 'classLevel', width: 12 },
    { header: 'Term', key: 'term', width: 16 },
    { header: 'Amount', key: 'amount', width: 12 },
    { header: 'Paid', key: 'amountPaid', width: 12 },
    { header: 'Balance', key: 'balance', width: 12 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Updated', key: 'updatedAt', width: 24 },
  ];
  const rows = await bills.list({ limit: 5000, offset: 0 });
  rows.forEach((bill) => {
    ws.addRow({
      student: bill.student?.name,
      classLevel: bill.student?.classLevel,
      term: bill.term,
      amount: bill.amount,
      amountPaid: bill.amountPaid,
      balance: bill.balance,
      status: bill.status,
      updatedAt: bill.updatedAt,
    }).commit();
  });
  await ws.commit();
  await wb.commit();
});

router.get('/payments/:id/receipt.pdf', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  const payment = await payments.findById(req.params.id);
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
  doc.text(`Date: ${new Date(payment.updatedAt).toISOString()}`);
  doc.moveDown();
  doc.text('Thank you.', { align: 'left' });
  doc.end();
});

router.get('/class/:classLevel/:term', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { classLevel, term } = req.params;
    const classStudents = await students.list({ classLevel, active: true, limit: 1000, offset: 0 });
    const ids = classStudents.map((student) => student.id);
    const byResult = await loadResultsByStudentId(ids, term);
    const reports = classStudents.map((student) => studentReportFromResult(student, term, byResult.get(student.id)));
    return res.json({ classLevel, term, count: reports.length, reports });
  } catch (err) {
    console.error('class report error:', err.message);
    return res.status(500).json({ message: err.message });
  }
});

router.get('/admissions', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const rows = await admissions.list({ classApplied: req.query.classLevel, limit: 5000, offset: 0 });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="admissions.xlsx"');
    const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useSharedStrings: true });
    const ws = wb.addWorksheet('Admissions');
    ws.columns = [
      { header: 'Student Name', key: 'studentName', width: 24 },
      { header: 'Parent Name', key: 'parentName', width: 24 },
      { header: 'Email', key: 'email', width: 24 },
      { header: 'Class Applied', key: 'classApplied', width: 16 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Submitted', key: 'submittedAt', width: 20 },
    ];
    rows.forEach((row) => {
      ws.addRow({
        studentName: row.studentName,
        parentName: row.parentName,
        email: row.email,
        classApplied: row.classApplied,
        status: row.status,
        submittedAt: new Date(row.submittedAt).toLocaleDateString(),
      }).commit();
    });
    await ws.commit();
    await wb.commit();
  } catch (err) {
    console.error('admissions report error:', err.message);
    return res.status(500).json({ message: err.message });
  }
});

router.get('/students', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const studentRows = await students.list({ classLevel: req.query.classLevel, active: true, limit: 5000, offset: 0 });
    const byClass = {};
    studentRows.forEach((student) => {
      const cls = student.classLevel || 'Unassigned';
      if (!byClass[cls]) byClass[cls] = { total: 0, male: 0, female: 0, other: 0 };
      byClass[cls].total += 1;
      const gender = (student.gender || 'other').toLowerCase();
      if (gender === 'male' || gender === 'm') byClass[cls].male += 1;
      else if (gender === 'female' || gender === 'f') byClass[cls].female += 1;
      else byClass[cls].other += 1;
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Students');
    ws.columns = [
      { header: 'Class', key: 'class', width: 16 },
      { header: 'Total', key: 'total', width: 10 },
      { header: 'Male', key: 'male', width: 10 },
      { header: 'Female', key: 'female', width: 10 },
      { header: 'Other', key: 'other', width: 10 },
    ];
    Object.keys(byClass).sort().forEach((cls) => ws.addRow({ class: cls, ...byClass[cls] }));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="students.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('students report error:', err.message);
    return res.status(500).json({ message: err.message });
  }
});

router.get('/fees', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    let filters = { limit: 5000, offset: 0 };
    if (req.query.classLevel) {
      const classStudents = await students.list({ classLevel: req.query.classLevel, active: true, limit: 5000, offset: 0 });
      filters = { ...filters, studentIds: classStudents.map((student) => student.id) };
    }
    const rows = await bills.list(filters);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="fees.xlsx"');
    const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useSharedStrings: true });
    const ws = wb.addWorksheet('Fees');
    ws.columns = [
      { header: 'Student', key: 'student', width: 24 },
      { header: 'Class', key: 'classLevel', width: 16 },
      { header: 'Term', key: 'term', width: 12 },
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Paid', key: 'amountPaid', width: 12 },
      { header: 'Balance', key: 'balance', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
    ];
    rows.forEach((bill) => {
      ws.addRow({
        student: bill.student?.name,
        classLevel: bill.student?.classLevel,
        term: bill.term,
        amount: bill.amount,
        amountPaid: bill.amountPaid,
        balance: bill.balance,
        status: bill.status,
      }).commit();
    });
    await ws.commit();
    await wb.commit();
  } catch (err) {
    console.error('fees report error:', err.message);
    return res.status(500).json({ message: err.message });
  }
});

router.get('/payments', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    let filters = { limit: 5000, offset: 0 };
    if (req.query.classLevel) {
      const classStudents = await students.list({ classLevel: req.query.classLevel, active: true, limit: 5000, offset: 0 });
      filters = { ...filters, studentIds: classStudents.map((student) => student.id) };
    }
    const rows = await payments.list(filters);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="payments.xlsx"');
    const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useSharedStrings: true });
    const ws = wb.addWorksheet('Payments');
    ws.columns = [
      { header: 'Student', key: 'student', width: 24 },
      { header: 'Class', key: 'classLevel', width: 16 },
      { header: 'Term', key: 'term', width: 12 },
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Transaction ID', key: 'transactionId', width: 20 },
      { header: 'Date', key: 'updatedAt', width: 20 },
    ];
    rows.forEach((payment) => {
      ws.addRow({
        student: payment.student?.name,
        classLevel: payment.student?.classLevel,
        term: payment.bill?.term,
        amount: payment.amount,
        status: payment.status,
        transactionId: payment.transactionId,
        updatedAt: new Date(payment.updatedAt).toLocaleDateString(),
      }).commit();
    });
    await ws.commit();
    await wb.commit();
  } catch (err) {
    console.error('payments report error:', err.message);
    return res.status(500).json({ message: err.message });
  }
});

router.get('/results', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const classStudents = await students.list({ classLevel: req.query.classLevel, active: true, limit: 5000, offset: 0 });
    const ids = classStudents.map((student) => student.id);
    const studentsById = new Map(classStudents.map((student) => [student.id, student]));
    const resultRows = await results.list({ studentIds: ids, term: req.query.term, limit: 5000, offset: 0 });

    const allSubjects = new Set();
    resultRows.forEach((row) => (row.subjects || []).forEach((subject) => allSubjects.add(subject.name)));
    const subjectList = Array.from(allSubjects).sort();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="results.xlsx"');
    const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useSharedStrings: true });
    const ws = wb.addWorksheet('Results');
    const columns = [
      { header: 'Student', key: 'student', width: 24 },
      { header: 'Class', key: 'classLevel', width: 16 },
      { header: 'Term', key: 'term', width: 12 },
      ...subjectList.map((subject) => ({ header: subject, key: `subj_${subject}`, width: 10 })),
      { header: 'Total Score', key: 'total', width: 12 },
      { header: 'Max Score', key: 'maxTotal', width: 12 },
      { header: 'Percent', key: 'percent', width: 10 },
      { header: 'Grade', key: 'grade', width: 10 },
    ];
    ws.columns = columns;

    resultRows.forEach((row) => {
      const student = studentsById.get(typeof row.student === 'object' ? row.student.id : row.student) || row.student;
      const totals = calcTotalsFromSubjects(row.subjects);
      const percent = totals.maxTotal > 0 ? Math.round((totals.total / totals.maxTotal) * 10000) / 100 : 0;
      const data = {
        student: student?.name,
        classLevel: student?.classLevel,
        term: row.term,
        total: totals.total,
        maxTotal: totals.maxTotal,
        percent,
        grade: row.grade,
      };
      subjectList.forEach((subject) => {
        const entry = (row.subjects || []).find((item) => item.name === subject);
        data[`subj_${subject}`] = entry ? `${entry.score}/${entry.maxScore || 100}` : '-';
      });
      ws.addRow(data).commit();
    });
    await ws.commit();
    await wb.commit();
  } catch (err) {
    console.error('results report error:', err.message);
    return res.status(500).json({ message: err.message });
  }
});

router.get('/class/:classLevel/:term/report.pdf', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { classLevel, term } = req.params;
    const classStudents = await students.list({ classLevel, active: true, limit: 1000, offset: 0 });
    if (!classStudents.length) return res.status(404).json({ message: 'No students found for this class' });

    const resultsByStudent = await loadResultsByStudentId(classStudents.map((student) => student.id), term);
    const logo = await getConfiguredLogoPath();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${classLevel}-${term}.pdf"`);
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    if (logo) doc._reportLogoPath = logo;
    doc.pipe(res);

    renderHeader(doc, `${classLevel} — ${term} Report Cards`);
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();
    doc.fontSize(12).text('Class Summary', { underline: true }).moveDown(0.5);

    classStudents.forEach((student, index) => {
      const report = studentReportFromResult(student, term, resultsByStudent.get(student.id));
      doc.fontSize(10).text(`${index + 1}. ${student.name} (${student.admissionNumber || '-'}) — ${report.percent}% — ${report.grade}`);
    });
    doc.addPage();

    classStudents.forEach((student, index) => {
      const report = studentReportFromResult(student, term, resultsByStudent.get(student.id));
      renderHeader(doc, `${student.name} — ${student.classLevel}`);
      doc.fontSize(12).text(`Admission No: ${student.admissionNumber || '-'}`);
      doc.fontSize(12).text(`Term: ${term}`);
      doc.moveDown(0.5);

      if (!report.subjects.length) {
        doc.text('No results available for this term.');
      } else {
        const columns = [{ header: 'Subject', width: 260 }, { header: 'Score', width: 80 }, { header: 'Max', width: 80 }];
        const rows = report.subjects.map((subject) => [subject.name || '-', String(subject.score || 0), String(subject.maxScore || 100)]);
        const startX = doc.page.margins.left;
        const startY = doc.y;
        drawTable(doc, startX, startY, columns, rows, 20);
        doc.y = startY + 20 + rows.length * 20 + 10;
        doc.fontSize(11).text(`Total: ${report.total} / ${report.maxTotal}`);
        doc.text(`Percent: ${report.percent}%`);
        doc.text(`Grade: ${report.grade}`);
        if (report.comments) {
          doc.moveDown(0.3);
          doc.text(`Comments: ${report.comments}`);
        }
      }
      if (index < classStudents.length - 1) doc.addPage();
    });

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      const bottom = doc.page.height - doc.page.margins.bottom + 10;
      doc.fontSize(9).fillColor('#6b7280').text(`Page ${i - range.start + 1} of ${range.count}`, 0, bottom, { align: 'center' });
    }
    doc.end();
  } catch (err) {
    console.error('class report pdf error:', err.message);
    return res.status(500).json({ message: err.message });
  }
});

router.get('/student/:id/report', requireAuth, requireRole('admin', 'teacher', 'parent', 'student'), async (req, res) => {
  try {
    const student = await students.findById(req.params.id, { withParent: true });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    if (!(await ensureOwnsStudent(req, student))) return res.status(403).json({ message: 'Forbidden' });

    const resultRows = await results.list({ studentId: student.id, limit: 5000, offset: 0 });
    const byTerm = {};
    resultRows.forEach((row) => {
      if (!byTerm[row.term]) byTerm[row.term] = [];
      byTerm[row.term].push({
        subjects: row.subjects,
        total: row.total,
        grade: row.grade,
        comments: row.comments,
        updatedAt: row.updatedAt,
      });
    });
    return res.json({ student, report: byTerm });
  } catch (err) {
    console.error('report error:', err.message);
    return res.status(500).json({ message: err.message });
  }
});

router.get('/student/:id/report.pdf', requireAuth, requireRole('admin', 'teacher', 'parent', 'student'), async (req, res) => {
  try {
    const student = await students.findById(req.params.id, { withParent: true });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    if (!(await ensureOwnsStudent(req, student))) return res.status(403).json({ message: 'Forbidden' });

    const resultRows = await results.list({ studentId: student.id, limit: 5000, offset: 0 });
    const logo = await getConfiguredLogoPath();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${student.name || student.id}.pdf"`);
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    if (logo) doc._reportLogoPath = logo;
    doc.pipe(res);

    renderHeader(doc, 'Report Card');
    doc.fontSize(12).text(`Name: ${student.name || ''}`);
    doc.text(`Class: ${student.classLevel || ''}`);
    doc.text(`Admission No: ${student.admissionNumber || ''}`);
    doc.moveDown();

    if (!resultRows.length) {
      doc.text('No results available.');
      doc.end();
      return;
    }

    const grouped = {};
    resultRows.forEach((row) => {
      if (!grouped[row.term]) grouped[row.term] = [];
      grouped[row.term].push(row);
    });

    Object.keys(grouped).forEach((term) => {
      doc.fontSize(14).text(term, { underline: true }).moveDown(0.2);
      const columns = [{ header: 'Subject', width: 260 }, { header: 'Score', width: 80 }, { header: 'Max', width: 80 }];
      const rows = [];
      grouped[term].forEach((entry) => {
        (entry.subjects || []).forEach((subject) => rows.push([subject.name, String(subject.score), String(subject.maxScore || 100)]));
      });
      if (rows.length) {
        const startX = doc.page.margins.left;
        const startY = doc.y;
        drawTable(doc, startX, startY, columns, rows, 20);
        doc.y = startY + 20 + rows.length * 20 + 10;
      } else {
        doc.text('No subject results available.');
      }
      doc.moveDown();
    });

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      const bottom = doc.page.height - doc.page.margins.bottom + 10;
      doc.fontSize(9).fillColor('#6b7280').text(`Page ${i - range.start + 1} of ${range.count}`, 0, bottom, { align: 'center' });
    }
    doc.end();
  } catch (err) {
    console.error('report pdf error:', err.message);
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
