const express = require('express');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const Bill = require('../models/Bill');
const Payment = require('../models/Payment');
const Student = require('../models/Student');
const Result = require('../models/Result');
const Admission = require('../models/Admission');
const SiteConfig = require('../models/SiteConfig');
const { requireAuth, requireRole } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const CURSOR_BATCH = 200;

router.get('/bills.csv', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bills.csv"');
  res.write('Student,Class,Term,Amount,Balance,Status,UpdatedAt\n');
  const cursor = Bill.find().populate('student', 'name classLevel').cursor({ batchSize: CURSOR_BATCH });
  for await (const b of cursor) {
    res.write(
      `${safe(b.student?.name)},${safe(b.student?.classLevel)},${safe(b.term)},${b.amount},${b.balance},${b.status},${b.updatedAt.toISOString()}\n`
    );
  }
  res.end();
});

router.get('/payments.csv', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="payments.csv"');
  res.write('Student,Class,Term,Amount,Status,TransactionId,UpdatedAt\n');
  const cursor = Payment.find()
    .populate('student', 'name classLevel')
    .populate('bill', 'term')
    .cursor({ batchSize: CURSOR_BATCH });
  for await (const p of cursor) {
    res.write(
      `${safe(p.student?.name)},${safe(p.student?.classLevel)},${safe(p.bill?.term)},${p.amount},${p.status},${safe(
        p.transactionId
      )},${p.updatedAt.toISOString()}\n`
    );
  }
  res.end();
});

router.get('/bills.xlsx', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="bills.xlsx"');

  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: res,
    useSharedStrings: true,
  });
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

  const cursor = Bill.find().populate('student', 'name classLevel').cursor({ batchSize: CURSOR_BATCH });
  for await (const b of cursor) {
    ws.addRow({
      student: b.student?.name,
      classLevel: b.student?.classLevel,
      term: b.term,
      amount: b.amount,
      amountPaid: b.amountPaid,
      balance: b.balance,
      status: b.status,
      updatedAt: b.updatedAt,
    }).commit();
  }
  await ws.commit();
  await wb.commit();
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

// Grade calculation rules (simple percentage-based mapping)
function calculateGrade(percent) {
  if (percent >= 80) return 'A';
  if (percent >= 70) return 'B';
  if (percent >= 60) return 'C';
  if (percent >= 50) return 'D';
  return 'E';
}

function renderHeader(doc, title) {
  // default logo path, may be overridden by settings
  const defaultLogo = path.resolve(__dirname, '../../public/IMG-20250625-WA0010.jpg');
  const logoPath = doc._reportLogoPath || defaultLogo;
  const left = 50;
  const top = 40;
  if (fs.existsSync(logoPath)) {
    try { doc.image(logoPath, left, top, { width: 60 }); } catch (e) { /* ignore image problems */ }
  }
  doc.fontSize(16).text('Karumande Link School', 130, top + 6);
  if (title) doc.fontSize(12).text(title, 130, top + 28);
  doc.moveDown(2);
  doc.moveTo(50, top + 70).lineTo(545, top + 70).stroke();
  doc.moveDown();
}

// Draw a simple table with borders; columns is array of { header, width }
function drawTable(doc, startX, startY, columns, rows, rowHeight = 20) {
  const tableWidth = columns.reduce((s, c) => s + c.width, 0);
  // header background
  doc.save();
  doc.rect(startX, startY, tableWidth, rowHeight).fillAndStroke('#f3f4f6', '#e5e7eb');
  doc.fillColor('#0f172a').fontSize(11);
  let x = startX;
  columns.forEach(col => {
    doc.text(col.header, x + 4, startY + 5, { width: col.width - 8 });
    x += col.width;
  });
  // rows
  let y = startY + rowHeight;
  doc.fontSize(10).fillColor('#0f172a');
  rows.forEach((r, ri) => {
    x = startX;
    // row background (alternate)
    if (ri % 2 === 0) doc.rect(startX, y, tableWidth, rowHeight).fill('#ffffff');
    else doc.rect(startX, y, tableWidth, rowHeight).fill('#fbfbfb');
    // cells
    for (let ci = 0; ci < columns.length; ci++) {
      const txt = String(r[ci] ?? '');
      doc.fillColor('#0f172a').text(txt, x + 4, y + 5, { width: columns[ci].width - 8 });
      x += columns[ci].width;
    }
    // row border
    doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(startX, y).lineTo(startX + tableWidth, y).stroke();
    y += rowHeight;
  });
  // outer border
  doc.strokeColor('#e5e7eb').lineWidth(1).rect(startX, startY, tableWidth, rowHeight + rows.length * rowHeight).stroke();
  doc.restore();
}

function calcTotalsFromSubjects(subjects) {
  if (!subjects || subjects.length === 0) return { total: 0, maxTotal: 0 };
  let total = 0, maxTotal = 0;
  subjects.forEach(s => { total += Number(s.score || 0); maxTotal += Number(s.maxScore || 100); });
  return { total, maxTotal };
}

function studentReportFromResult(student, term, result) {
  if (!result) return { student, term, subjects: [], total: 0, maxTotal: 0, percent: 0, grade: null, comments: undefined };
  const { total, maxTotal } = calcTotalsFromSubjects(result.subjects);
  const percent = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
  return {
    student,
    term,
    subjects: result.subjects || [],
    total,
    maxTotal,
    percent: Math.round(percent * 100) / 100,
    grade: calculateGrade(percent),
    comments: result.comments,
  };
}

async function loadResultsByStudentId(studentIds, term) {
  if (!studentIds.length) return new Map();
  const results = await Result.find({ student: { $in: studentIds }, term }).lean();
  const map = new Map();
  for (const r of results) {
    map.set(String(r.student), r);
  }
  return map;
}

// Helper: assemble a per-student report object for a given term (single DB round-trip when used alone)
async function buildStudentReport(student, term) {
  const result = await Result.findOne({ student: student._id, term }).lean();
  return studentReportFromResult(student, term, result);
}

// ===== Class-wide report endpoints =====
// JSON summary for a class and term
router.get('/class/:classLevel/:term', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { classLevel, term } = req.params;
    const students = await Student.find({ classLevel, active: true }).lean();
    const ids = students.map((s) => s._id);
    const byResult = await loadResultsByStudentId(ids, term);
    const reports = students.map((s) => studentReportFromResult(s, term, byResult.get(String(s._id))));
    return res.json({ classLevel, term, count: reports.length, reports });
  } catch (err) {
    console.error('class report error:', err.message);
    return res.status(500).json({ message: err.message });
  }
});

// PDF: generate a multi-student report for the class (one page per student)
router.get('/admissions', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { classLevel } = req.query;
    let query = {};
    if (classLevel) query.classApplied = classLevel;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="admissions.xlsx"');

    const wb = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useSharedStrings: true,
    });
    const ws = wb.addWorksheet('Admissions');
    ws.columns = [
      { header: 'Student Name', key: 'studentName', width: 24 },
      { header: 'Parent Name', key: 'parentName', width: 24 },
      { header: 'Email', key: 'email', width: 24 },
      { header: 'Class Applied', key: 'classApplied', width: 16 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Submitted', key: 'submittedAt', width: 20 },
    ];

    const cursor = Admission.find(query).sort('-submittedAt').cursor({ batchSize: CURSOR_BATCH });
    for await (const a of cursor) {
      ws.addRow({
        studentName: a.studentName,
        parentName: a.parentName,
        email: a.email,
        classApplied: a.classApplied,
        status: a.status,
        submittedAt: new Date(a.submittedAt).toLocaleDateString(),
      }).commit();
    }
    await ws.commit();
    await wb.commit();
  } catch (err) {
    console.error('admissions report error:', err.message);
    return res.status(500).json({ message: err.message });
  }
});

router.get('/students', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { classLevel } = req.query;
    let query = { active: true };
    if (classLevel) query.classLevel = classLevel;

    const students = await Student.find(query).lean();

    // Count by gender
    const byClass = {};
    students.forEach(s => {
      const cls = s.classLevel || 'Unassigned';
      byClass[cls] = byClass[cls] || { total: 0, male: 0, female: 0, other: 0 };
      byClass[cls].total++;
      const gender = (s.gender || 'other').toLowerCase();
      byClass[cls][gender === 'm' || gender === 'male' ? 'male' : gender === 'f' || gender === 'female' ? 'female' : 'other']++;
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Students');
    ws.columns = [
      { header: 'Class', key: 'class', width: 16 },
      { header: 'Total', key: 'total', width: 10 },
      { header: 'Male', key: 'male', width: 10 },
      { header: 'Female', key: 'female', width: 10 },
      { header: 'Other', key: 'other', width: 10 }
    ];

    Object.keys(byClass).sort().forEach(cls => {
      const data = byClass[cls];
      ws.addRow({
        class: cls,
        total: data.total,
        male: data.male,
        female: data.female,
        other: data.other
      });
    });

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
    const { classLevel } = req.query;
    let billQuery = {};
    if (classLevel) {
      const students = await Student.find({ classLevel, active: true }).select('_id').lean();
      billQuery.student = { $in: students.map(s => s._id) };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="fees.xlsx"');

    const wb = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useSharedStrings: true,
    });
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

    const cursor = Bill.find(billQuery).populate('student', 'name classLevel').cursor({ batchSize: CURSOR_BATCH });
    for await (const b of cursor) {
      ws.addRow({
        student: b.student?.name,
        classLevel: b.student?.classLevel,
        term: b.term,
        amount: b.amount,
        amountPaid: b.amountPaid,
        balance: b.balance,
        status: b.status,
      }).commit();
    }
    await ws.commit();
    await wb.commit();
  } catch (err) {
    console.error('fees report error:', err.message);
    return res.status(500).json({ message: err.message });
  }
});

router.get('/payments', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { classLevel } = req.query;
    let paymentQuery = {};
    if (classLevel) {
      const students = await Student.find({ classLevel, active: true }).select('_id').lean();
      paymentQuery.student = { $in: students.map(s => s._id) };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="payments.xlsx"');

    const wb = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useSharedStrings: true,
    });
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

    const cursor = Payment.find(paymentQuery)
      .populate('student', 'name classLevel')
      .populate('bill', 'term')
      .cursor({ batchSize: CURSOR_BATCH });
    for await (const p of cursor) {
      ws.addRow({
        student: p.student?.name,
        classLevel: p.student?.classLevel,
        term: p.bill?.term,
        amount: p.amount,
        status: p.status,
        transactionId: p.transactionId,
        updatedAt: new Date(p.updatedAt).toLocaleDateString(),
      }).commit();
    }
    await ws.commit();
    await wb.commit();
  } catch (err) {
    console.error('payments report error:', err.message);
    return res.status(500).json({ message: err.message });
  }
});

router.get('/results', requireAuth, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { classLevel, term } = req.query;
    let studentQuery = { active: true };
    if (classLevel) studentQuery.classLevel = classLevel;

    const students = await Student.find(studentQuery).lean();
    const ids = students.map((s) => s._id);
    const studentsById = new Map(students.map((s) => [String(s._id), s]));

    let resultQuery = { student: { $in: ids } };
    if (term) resultQuery.term = term;
    const allResultDocs = ids.length ? await Result.find(resultQuery).lean() : [];

    const allResults = [];
    for (const r of allResultDocs) {
      const s = studentsById.get(String(r.student));
      if (!s) continue;
      allResults.push({
        student: s,
        term: r.term,
        subjects: r.subjects,
        total: r.total,
        maxTotal: r.maxTotal,
        grade: r.grade,
        comments: r.comments,
      });
    }

    const allSubjects = new Set();
    allResults.forEach((r) => {
      (r.subjects || []).forEach((s) => allSubjects.add(s.name));
    });
    const subjectList = Array.from(allSubjects).sort();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="results.xlsx"');

    const wb = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useSharedStrings: true,
    });
    const ws = wb.addWorksheet('Results');

    const columns = [
      { header: 'Student', key: 'student', width: 24 },
      { header: 'Class', key: 'classLevel', width: 16 },
      { header: 'Term', key: 'term', width: 12 },
    ];
    subjectList.forEach((subj) => {
      columns.push({ header: subj, key: `subj_${subj}`, width: 10 });
    });
    columns.push(
      { header: 'Total Score', key: 'total', width: 12 },
      { header: 'Max Score', key: 'maxTotal', width: 12 },
      { header: 'Percent', key: 'percent', width: 10 },
      { header: 'Grade', key: 'grade', width: 10 }
    );
    ws.columns = columns;

    for (const r of allResults) {
      const percent = r.maxTotal > 0 ? Math.round((r.total / r.maxTotal) * 100 * 100) / 100 : 0;
      const row = {
        student: r.student.name,
        classLevel: r.student.classLevel,
        term: r.term,
        total: r.total,
        maxTotal: r.maxTotal,
        percent,
        grade: r.grade,
      };
      subjectList.forEach((subj) => {
        const subjectData = (r.subjects || []).find((s) => s.name === subj);
        row[`subj_${subj}`] = subjectData ? `${subjectData.score}/${subjectData.maxScore || 100}` : '-';
      });
      ws.addRow(row).commit();
    }
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
    const students = await Student.find({ classLevel, active: true }).lean();
    if (!students || students.length === 0) return res.status(404).json({ message: 'No students found for this class' });

    const studentIds = students.map((s) => s._id);
    const resultsByStudent = await loadResultsByStudentId(studentIds, term);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${classLevel}-${term}.pdf"`);

    // get configured logo path if set
    const cfg = await SiteConfig.findOne({ key: 'logoPath' }).lean();
    const logo = cfg?.value ? path.join(process.cwd(), 'public', cfg.value.replace(/^\//, '')) : null;

    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    // attach logo path to doc so renderHeader can access
    if (logo) doc._reportLogoPath = logo;
    doc.pipe(res);

    // Cover / summary page
    renderHeader(doc, `${classLevel} — ${term} Report Cards`);
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();
    doc.fontSize(12).text('Class Summary', { underline: true });
    doc.moveDown(0.5);

    const summaries = [];
    for (const s of students) {
      const report = studentReportFromResult(s, term, resultsByStudent.get(String(s._id)));
      summaries.push({ name: s.name, admissionNumber: s.admissionNumber, percent: report.percent, grade: report.grade });
    }

    // small table-like summary
    summaries.forEach((row, i) => {
      doc.fontSize(10).text(`${i + 1}. ${row.name} (${row.admissionNumber || '-'}) — ${row.percent}% — ${row.grade}`);
    });

    doc.addPage();

    // Per-student pages
    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      const r = studentReportFromResult(s, term, resultsByStudent.get(String(s._id)));
      renderHeader(doc, `${s.name} — ${s.classLevel}`);
      doc.fontSize(12).text(`Admission No: ${s.admissionNumber || '-'}`);
      doc.fontSize(12).text(`Term: ${term}`);
      doc.moveDown(0.5);

      if (!r.subjects || r.subjects.length === 0) {
        doc.text('No results available for this term.');
      } else {
        // build table data
        const cols = [{ header: 'Subject', width: 260 }, { header: 'Score', width: 80 }, { header: 'Max', width: 80 }];
        const rows = r.subjects.map(s => [s.name || '-', String(s.score || 0), String(s.maxScore || 100)]);
        // draw table
        const startX = doc.page.margins.left;
        const startY = doc.y;
        drawTable(doc, startX, startY, cols, rows, 20);
        // move cursor below table
        doc.y = startY + 20 + rows.length * 20 + 10;
        doc.fontSize(11).text(`Total: ${r.total} / ${r.maxTotal}`);
        doc.text(`Percent: ${r.percent}%`);
        doc.text(`Grade: ${r.grade}`);
        if (r.comments) {
          doc.moveDown(0.3);
          doc.text(`Comments: ${r.comments}`);
        }
      }

      if (i < students.length - 1) doc.addPage();
    }

    // Add footers with page numbers (buffered pages)
    const range = doc.bufferedPageRange(); // { start: 0, count }
    for (let i = range.start; i < range.start + range.count; i++) {
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

// ===== Report Card endpoints =====
// Get assembled report data for a student (JSON)
router.get('/student/:id/report', requireAuth, requireRole('admin', 'teacher', 'parent', 'student'), async (req, res) => {
  try {
    const studentId = req.params.id;
    const student = await Student.findById(studentId).lean();
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Parent/student ownership check
    if (req.user.role === 'parent' || req.user.role === 'student') {
      const User = require('../models/User');
      const user = await User.findById(req.user.id).select('children').lean();
      const owns = (student.parent && String(student.parent) === String(req.user.id)) || (user && Array.isArray(user.children) && user.children.map(String).includes(String(student._id)));
      if (!owns && req.user.role !== 'admin' && req.user.role !== 'teacher') return res.status(403).json({ message: 'Forbidden' });
    }

    const results = await Result.find({ student: studentId }).lean();
    // Organize by term
    const byTerm = {};
    results.forEach(r => {
      byTerm[r.term] = byTerm[r.term] || [];
      byTerm[r.term].push({ subjects: r.subjects, total: r.total, grade: r.grade, comments: r.comments, updatedAt: r.updatedAt });
    });

    return res.json({ student, report: byTerm });
  } catch (err) {
    console.error('report error:', err.message);
    return res.status(500).json({ message: err.message });
  }
});

// Get a PDF report card for a student
router.get('/student/:id/report.pdf', requireAuth, requireRole('admin', 'teacher', 'parent', 'student'), async (req, res) => {
  try {
    const studentId = req.params.id;
    const student = await Student.findById(studentId).lean();
    if (!student) return res.status(404).json({ message: 'Student not found' });

    if (req.user.role === 'parent' || req.user.role === 'student') {
      const User = require('../models/User');
      const user = await User.findById(req.user.id).select('children').lean();
      const owns = (student.parent && String(student.parent) === String(req.user.id)) || (user && Array.isArray(user.children) && user.children.map(String).includes(String(student._id)));
      if (!owns && req.user.role !== 'admin' && req.user.role !== 'teacher') return res.status(403).json({ message: 'Forbidden' });
    }

    const results = await Result.find({ student: studentId }).lean();


    // configured logo
    const cfg = await SiteConfig.findOne({ key: 'logoPath' }).lean();
    const logo = cfg?.value ? path.join(process.cwd(), 'public', cfg.value.replace(/^\//, '')) : null;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${student.name || student._id}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    if (logo) doc._reportLogoPath = logo;
    doc.pipe(res);

    renderHeader(doc, 'Report Card');
    doc.fontSize(12).text(`Name: ${student.name || ''}`);
    doc.text(`Class: ${student.classLevel || ''}`);
    doc.text(`Admission No: ${student.admissionNumber || ''}`);
    doc.moveDown();

    if (!results || results.length === 0) {
      doc.text('No results available.');
      doc.end();
      return;
    }

    // Group by term
    const grouped = {};
    results.forEach(r => {
      grouped[r.term] = grouped[r.term] || [];
      grouped[r.term].push(r);
    });

    for (const term of Object.keys(grouped)) {
      doc.fontSize(14).text(term, { underline: true });
      doc.moveDown(0.2);
      // build table rows
      const cols = [{ header: 'Subject', width: 260 }, { header: 'Score', width: 80 }, { header: 'Max', width: 80 }];
      const rows = [];
      grouped[term].forEach(r => {
        r.subjects.forEach(s => rows.push([s.name, String(s.score), String(s.maxScore || 100)]));
      });
      if (rows.length > 0) {
        const startX = doc.page.margins.left;
        const startY = doc.y;
        drawTable(doc, startX, startY, cols, rows, 20);
        doc.y = startY + 20 + rows.length * 20 + 10;
      } else {
        doc.text('No subject results available.');
      }
      doc.moveDown();
    }

    // add footer page numbers
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
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

