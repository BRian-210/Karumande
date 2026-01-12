const express = require('express');
const multer = require('multer');
const path = require('path');
const Admission = require('../models/Admission');
const User = require('../models/User');
const Student = require('../models/Student');
const crypto = require('crypto');
const { authenticate, authorize } = require('../middleware/auth'); // assuming you have these
const sendEmail = require('../utils/sendEmail');
const sendSMS = require('../utils/sendSms');
const { CLASS_LEVELS } = require('../constants/school');

const router = express.Router();

// ========================
// File Upload Configuration
// ========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../public/uploads/admissions');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Invalid file type. Only JPG, PNG, and PDF allowed.'));
  },
});

// ========================
// PUBLIC: Submit New Admission Application
// ========================
router.post(
  '/',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'birthCertificate', maxCount: 1 },
    { name: 'transferLetter', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const files = req.files;
      if (!files.photo?.[0] || !files.birthCertificate?.[0]) {
        return res.status(400).json({
          message: 'Student photo and birth certificate are required',
        });
      }

      const data = {
        parentName: req.body.parentName?.trim(),
        phone: req.body.phone?.trim(),
        email: req.body.email?.trim().toLowerCase(),
        relationship: req.body.relationship,

        studentName: req.body.studentName?.trim(),
        gender: req.body.gender,
        dob: req.body.dob,
        classApplied: req.body.classApplied,
        previousSchool: req.body.previousSchool?.trim() || null,
        medicalInfo: req.body.medicalInfo?.trim() || null,

        photo: `/uploads/admissions/${files.photo[0].filename}`,
        birthCertificate: `/uploads/admissions/${files.birthCertificate[0].filename}`,
        transferLetter: files.transferLetter
          ? `/uploads/admissions/${files.transferLetter[0].filename}`
          : null,

        status: 'pending',
        submittedAt: new Date(),
      };

      const admission = await Admission.create(data);

      // Notify admin
      try {
        const emailResult = await sendEmail({
          to: process.env.ADMIN_EMAIL || 'admin@karumande.sc.ke',
          subject: 'New Admission Application - Action Required',
          html: `
            <h2>New Admission Application</h2>
            <p><strong>Student:</strong> ${admission.studentName}</p>
            <p><strong>Parent:</strong> ${admission.parentName} (${admission.email})</p>
            <p><strong>Phone:</strong> ${admission.phone}</p>
            <p><strong>Class:</strong> ${admission.classApplied}</p>
            <p><a href="${process.env.ADMIN_DASHBOARD_URL}/admissions.html">View in Admin Panel</a></p>
          `,
        });
        if (emailResult && emailResult.success === false) {
          console.warn('Admin email notification failed:', emailResult.error || emailResult);
        }

        const smsResult = await sendSMS({
          to: admission.phone,
          message: `Thank you, ${admission.parentName}! We have received ${admission.studentName}'s admission application. We'll review it and contact you soon. - Karumande Link School`,
        });
        if (smsResult && smsResult.success === false) {
          console.warn('Admin SMS notification failed:', smsResult.error || smsResult);
        }
      } catch (notifyErr) {
        console.error('Notification failed:', notifyErr?.message || notifyErr);
      }

      res.status(201).json({
        message: 'Application submitted successfully!',
        id: admission._id,
      });
    } catch (error) {
      console.error('Admission submission error:', error);
      res.status(500).json({ message: 'Failed to submit application' });
    }
  }
);

// ========================
// ADMIN: Get Recent Applications (for Dashboard)
// ========================
router.get('/recent', authenticate, authorize('admin'), async (req, res) => {
  try {
    // Return recent admissions which have a created Student record
    // use lean() to return plain JS objects (faster / less memory), and limit populated fields
    const recent = await Admission.find({ student: { $ne: null } })
      .sort({ submittedAt: -1 })
      .limit(10)
      .select('studentName parentName email classApplied status submittedAt student admissionNumber')
      .populate('student', 'name admissionNumber classLevel gender dob photo')
      .populate('reviewedBy', 'name email')
      .lean()
      .exec();

    res.json(recent || []);
  } catch (error) {
    console.error('Error fetching recent admissions (with students):', error.stack || error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ========================
// ADMIN: List All / Filtered Applications
// ========================
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const [applications, total] = await Promise.all([
      Admission.find(query)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select(
          'studentName parentName phone email classApplied status submittedAt photo birthCertificate'
        ),
      Admission.countDocuments(query),
    ]);

    res.json({
      applications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching admissions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ========================
// ADMIN: Update Application Status (Approve/Reject)
// ========================
router.patch('/:id/status', authenticate, authorize('admin'), async (req, res) => {
  const { status } = req.body;

  if (!['accepted', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status. Use: accepted, rejected, or pending' });
  }

  try {
    const admission = await Admission.findByIdAndUpdate(
      req.params.id,
      {
        status,
        reviewedAt: new Date(),
        reviewedBy: req.user.id,
      },
      { new: true }
    ).populate('reviewedBy', 'name email');

    if (!admission) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Notify parent
    const actionWord = status === 'accepted' ? 'approved' : 'not approved';
    try {
      const smsRes = await sendSMS({
        to: admission.phone,
        message: `Dear ${admission.parentName}, your admission application for ${admission.studentName} has been ${actionWord}. Contact the school for next steps. - Karumande Link School`,
      });
      if (smsRes && smsRes.success === false) {
        console.warn('Parent SMS notification failed:', smsRes.error || smsRes);
      }

      // If application accepted, create Student record and parent User if needed
      if (status === 'accepted') {
        // Helper: generate unique admission number
        const generateAdmissionNumber = async () => {
          for (let i = 0; i < 8; i++) {
            const candidate = `ADM${new Date().getFullYear()}${Math.floor(10000 + Math.random() * 90000)}`;
            // ensure uniqueness
            // eslint-disable-next-line no-await-in-loop
            const exists = await Student.findOne({ admissionNumber: candidate });
            if (!exists) return candidate;
          }
          throw new Error('Unable to generate unique admission number');
        };

        const generateTempPassword = (admissionNumber) => {
          const rand = crypto.randomBytes(4).toString('hex');
          return `${admissionNumber}-${rand}`; // includes admission number for easy reference
        };

        const admissionNumber = await generateAdmissionNumber();

        // Find or create parent user
        let parentUser = null;
        if (admission.email) {
          parentUser = await User.findOne({ email: admission.email.toLowerCase() });
        }

        let createdTempPassword = null;

        if (!parentUser) {
          // create parent user with temporary password
          createdTempPassword = generateTempPassword(admissionNumber);
          parentUser = new User({
            name: admission.parentName || admission.email || 'Parent',
            email: admission.email || `parent+${admission._id}@local.invalid`,
            phone: admission.phone || undefined,
            passwordHash: createdTempPassword,
            role: 'parent',
            children: [],
            mustChangePassword: true,
          });

          await parentUser.save();
        }

        // Normalize class level to allowed values and create student record with parent linked
        let classLevel = 'PlayGroup';
        try {
          if (admission.classApplied && CLASS_LEVELS.includes(admission.classApplied)) {
            classLevel = admission.classApplied;
          }
        } catch (e) {
          // fallback to default
          classLevel = 'PlayGroup';
        }

        const studentData = {
          name: admission.studentName,
          admissionNumber,
          classLevel,
          stream: undefined,
          gender: admission.gender ? (String(admission.gender).charAt(0).toUpperCase() + String(admission.gender).slice(1)) : 'Other',
          dob: admission.dob || new Date('2008-01-01'),
          previousSchool: admission.previousSchool || undefined,
          medicalInfo: admission.medicalInfo || undefined,
          photo: admission.photo || undefined,
          parent: parentUser._id,
        };

        const student = await Student.create({ ...studentData });

        // If parent existed, attach child if not already
        if (parentUser && (!parentUser.children || !parentUser.children.find((c) => String(c) === String(student._id)))) {
          parentUser.children = parentUser.children || [];
          parentUser.children.push(student._id);
          await parentUser.save();
        }

        // Link admission -> student + admissionNumber
        admission.student = student._id;
        admission.admissionNumber = admissionNumber;
        await admission.save();

        // Send email with details. If we created a user, include temp credentials and force-change info
        const emailHtml = `
          <h2>Admission Approved</h2>
          <p>Dear ${admission.parentName},</p>
          <p>Congratulations — your application for <strong>${admission.studentName}</strong> has been approved.</p>
          <p><strong>Admission Number:</strong> ${admissionNumber}</p>
          ${createdTempPassword ? `<p>An account has been created for you to access the parent portal:</p>
            <ul>
              <li><strong>Email:</strong> ${parentUser.email}</li>
              <li><strong>Temporary password:</strong> <code>${createdTempPassword}</code></li>
            </ul>
            <p>For security, you will be required to change your password on first login.</p>` : `<p>You can access your account with your existing credentials.</p>`}
          <p>Visit the portal to complete registration and view next steps: <a href="${process.env.FRONTEND_URL}">${process.env.FRONTEND_URL}</a></p>
          <p>Thank you,<br/>Karumande Link School</p>
        `;

        const emailRes = await sendEmail({
          to: parentUser.email,
          subject: `Admission Approved — ${admission.studentName}`,
          html: emailHtml,
        });
        if (emailRes && emailRes.success === false) {
          console.warn('Admission approval email failed for parent:', emailRes.error || emailRes);
        }
      } else {
        // non-accepted update (rejection or pending)
        const notifyRes = await sendEmail({
          to: admission.email,
          subject: `Admission Application ${status === 'accepted' ? 'Approved' : 'Update'}`,
          html: `
            <h2>Admission Application Update</h2>
            <p>Dear ${admission.parentName},</p>
            <p>Your application for <strong>${admission.studentName}</strong> (Class: ${admission.classApplied}) has been <strong>${actionWord}</strong>.</p>
            ${status === 'accepted' ? '<p>Congratulations! Please visit the school to complete registration.</p>' : '<p>We regret to inform you that the application was not successful at this time.</p>'}
            <p>Thank you,<br>Karumande Link School</p>
          `,
        });
        if (notifyRes && notifyRes.success === false) {
          console.warn('Parent notification email failed:', notifyRes.error || notifyRes);
        }
      }
    } catch (notifyErr) {
      console.error('Parent notification failed:', notifyErr.stack || notifyErr);
    }

    // Return populated admission so frontend sees created student and reviewer
    try {
      const admissionPop = await Admission.findById(admission._id)
        .populate('student')
        .populate('reviewedBy', 'name email');

      return res.json({
        message: `Application ${actionWord} successfully`,
        admission: admissionPop,
      });
    } catch (popErr) {
      console.error('Failed to populate admission after update:', popErr.stack || popErr);
      return res.json({
        message: `Application ${actionWord} successfully`,
        admission,
      });
    }
  } catch (error) {
    console.error('Status update error:', error.stack || error);
    res.status(500).json({ message: 'Failed to update status' });
  }
});

// ========================
// ADMIN: Get Single Application (for detailed view)
// ========================
router.get('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const admission = await Admission.findById(req.params.id);

    if (!admission) {
      return res.status(404).json({ message: 'Application not found' });
    }

    res.json(admission);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;