const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { authenticate, authorize } = require('../middleware/auth');
const sendEmail = require('../utils/sendEmail');
const sendSMS = require('../utils/sendSms');
const { CLASS_LEVELS } = require('../constants/school');
const { admissions, users, students, withTransaction } = require('../data/repositories');

const router = express.Router();

const admissionsUploadDir = path.join(__dirname, '../../public/uploads/admissions');
if (!fs.existsSync(admissionsUploadDir)) {
  fs.mkdirSync(admissionsUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, admissionsUploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '-');
    cb(null, `${uniqueSuffix}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Invalid file type. Only JPG, PNG, and PDF allowed.'));
  },
});

function normalizePhoneNumber(phone) {
  if (!phone) return null;
  let value = String(phone).trim();
  if (value.startsWith('0')) {
    value = `+254${value.slice(1)}`;
  }
  return value;
}

function buildPhotoValue(files) {
  return {
    original: `/uploads/admissions/${files.photo[0].filename}`,
    thumbnail: null,
    medium: null,
  };
}

async function generateUniqueAdmissionNumber() {
  for (let i = 0; i < 8; i += 1) {
    const candidate = `ADM${new Date().getFullYear()}${Math.floor(10000 + Math.random() * 90000)}`;
    const exists = await students.findByAdmissionNumber(candidate);
    if (!exists) return candidate;
  }
  throw new Error('Unable to generate unique admission number');
}

router.post(
  '/',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'birthCertificate', maxCount: 1 },
    { name: 'transferLetter', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const files = req.files || {};
      if (!files.photo?.[0] || !files.birthCertificate?.[0]) {
        return res.status(400).json({ message: 'Student photo and birth certificate are required' });
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
        photo: buildPhotoValue(files),
        birthCertificate: `/uploads/admissions/${files.birthCertificate[0].filename}`,
        transferLetter: files.transferLetter ? `/uploads/admissions/${files.transferLetter[0].filename}` : null,
        status: 'pending',
        submittedAt: new Date(),
      };

      const admission = await admissions.create(data);

      let createdTempPassword = null;
      if (admission.email) {
        let parentUser = await users.findByEmail(admission.email.toLowerCase());
        if (!parentUser) {
          createdTempPassword = `KL${crypto.randomBytes(6).toString('base64url')}`;
          parentUser = await users.create({
            name: admission.parentName || admission.email,
            email: admission.email.toLowerCase(),
            phone: admission.phone || undefined,
            passwordHash: createdTempPassword,
            role: 'parent',
            mustChangePassword: true,
            children: [],
          });

          try {
            await sendEmail({
              to: parentUser.email,
              subject: 'Your Karumande Parent Portal Account',
              html: `
                <h2>Welcome to Karumande Link School</h2>
                <p>Dear ${parentUser.name},</p>
                <p>Thank you for submitting a new admission application for <strong>${admission.studentName}</strong>.</p>
                <p>We have created a temporary parent portal account for you so you can follow the admission progress and log in once the application is reviewed.</p>
                <p><strong>Login details</strong></p>
                <ul>
                  <li><strong>Email:</strong> ${parentUser.email}</li>
                  <li><strong>Temporary password:</strong> <code>${createdTempPassword}</code></li>
                </ul>
                <p>For security, you will need to change your password on first login.</p>
                <p>Login here: <a href="${process.env.FRONTEND_URL || 'https://karumande.onrender.com'}/login">${process.env.FRONTEND_URL || 'https://karumande.onrender.com'}/login</a></p>
                <p>Thank you,<br/>Karumande Link School</p>
              `,
            });
          } catch (notifyParentErr) {
            console.warn('Parent account email failed:', notifyParentErr?.message || notifyParentErr);
          }

          const smsPhone = normalizePhoneNumber(admission.phone);
          if (smsPhone) {
            try {
              await sendSMS({
                to: smsPhone,
                message: `Karumande: ${parentUser.name}, your parent portal account has been created. Login email: ${parentUser.email}. Temporary password: ${createdTempPassword}. Please change it on first login.`,
              });
            } catch (smsErr) {
              console.warn('Parent account SMS failed:', smsErr?.message || smsErr);
            }
          }
        }
      }

      try {
        const emailResult = await sendEmail({
          to: process.env.ADMIN_EMAIL || 'githinjibriank973@gmail.com',
          subject: 'New Admission Application - Action Required',
          html: `
            <h2>New Admission Application</h2>
            <p><strong>Student:</strong> ${admission.studentName}</p>
            <p><strong>Parent:</strong> ${admission.parentName} (${admission.email})</p>
            <p><strong>Phone:</strong> ${admission.phone}</p>
            <p><strong>Class:</strong> ${admission.classApplied}</p>
            <p><a href="${process.env.FRONTEND_URL || 'https://karumande.onrender.com'}/admin/login.html">View in Admin Panel</a></p>
          `,
        });
        if (emailResult && emailResult.success === false) {
          console.warn('Admin email notification failed:', emailResult.error || emailResult);
        }

        const smsPhone = normalizePhoneNumber(admission.phone);
        if (smsPhone) {
          const smsResult = await sendSMS({
            to: smsPhone,
            message: `Thank you, ${admission.parentName}! We have received ${admission.studentName}'s admission application. We'll review it and contact you soon. - Karumande Link School`,
          });
          if (smsResult && smsResult.success === false) {
            console.warn('Admin SMS notification failed:', smsResult.error || smsResult);
          }
        }
      } catch (notifyErr) {
        console.error('Notification failed:', notifyErr?.message || notifyErr);
      }

      return res.status(201).json({
        message: 'Application Submitted Successfully! Please wait as your request is being reviewed.',
        id: admission.id,
      });
    } catch (error) {
      console.error('Admission submission error:', error);
      return res.status(500).json({ message: 'Failed to submit application' });
    }
  }
);

router.get('/recent', authenticate, authorize('admin'), async (req, res) => {
  try {
    const recent = await admissions.list({ withStudent: true, limit: 10, offset: 0 });
    return res.json(recent || []);
  } catch (error) {
    console.error('Error fetching recent admissions (with students):', error.stack || error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const status = req.query.status;
    const offset = (page - 1) * limit;

    const [applications, total] = await Promise.all([
      admissions.list({ status, limit, offset }),
      admissions.count({ status }),
    ]);

    return res.json({
      applications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching admissions:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id/status', authenticate, authorize('admin'), async (req, res) => {
  const { status } = req.body;
  if (!['accepted', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status. Use: accepted, rejected, or pending' });
  }

  try {
    let admission = await admissions.findById(req.params.id);
    if (!admission) {
      return res.status(404).json({ message: 'Application not found' });
    }

    admission = await admissions.update(admission.id, {
      status,
      reviewedAt: new Date(),
      reviewedBy: req.user.id,
    });

    const actionWord = status === 'accepted' ? 'approved' : 'not approved';

    try {
      if (admission.phone && status !== 'accepted') {
        const smsPhone = normalizePhoneNumber(admission.phone);
        if (smsPhone) {
          const smsRes = await sendSMS({
            to: smsPhone,
            message: `Dear ${admission.parentName}, your admission application for ${admission.studentName} has been ${actionWord}. Contact the school for next steps. - Karumande Link School`,
          });
          if (smsRes && smsRes.success === false) {
            console.warn('Parent SMS notification failed:', smsRes.error || smsRes);
          }
        }
      }

      if (status === 'accepted') {
        const admissionNumber = await generateUniqueAdmissionNumber();
        const createdTempPassword = `${admissionNumber}-${crypto.randomBytes(4).toString('hex')}`;

        await withTransaction(async (client) => {
          let parentUser = admission.email ? await users.findByEmail(admission.email.toLowerCase(), { includePasswordHash: true }) : null;

          if (!parentUser) {
            parentUser = await users.create({
              name: admission.parentName || admission.email || 'Parent',
              email: admission.email || `parent+${admission.id}@local.invalid`,
              phone: admission.phone || undefined,
              passwordHash: createdTempPassword,
              role: 'parent',
              children: [],
              mustChangePassword: true,
            }, client);
          } else {
            parentUser = await users.update(parentUser.id, {
              passwordHash: createdTempPassword,
              mustChangePassword: true,
              phone: parentUser.phone || admission.phone || null,
            }, client);
          }

          const classLevel = CLASS_LEVELS.includes(admission.classApplied) ? admission.classApplied : 'PlayGroup';
          const student = await students.create({
            name: admission.studentName,
            admissionNumber,
            classLevel,
            stream: null,
            gender: admission.gender
              ? `${String(admission.gender).charAt(0).toUpperCase()}${String(admission.gender).slice(1)}`
              : 'Other',
            dob: admission.dob || new Date('2008-01-01'),
            previousSchool: admission.previousSchool || null,
            medicalInfo: admission.medicalInfo || null,
            photo: admission.photo?.original || admission.photo || null,
            parent: parentUser.id,
          }, client);

          await users.addChild(parentUser.id, student.id, client);
          await admissions.update(admission.id, { student: student.id, admissionNumber }, client);
        });

        admission = await admissions.findById(admission.id);

        const smsPhone = normalizePhoneNumber(admission.phone);
        if (smsPhone) {
          try {
            await sendSMS({
              to: smsPhone,
              message: `Karumande Link School: Your application for ${admission.studentName} has been approved. Admission Number: ${admission.admissionNumber}. Temporary password: ${createdTempPassword}. Please use them to log in, then change your password. ${process.env.FRONTEND_URL || 'https://karumande.onrender.com'}/login`,
            });
          } catch (smsErr) {
            console.warn('Parent approval SMS failed:', smsErr?.message || smsErr);
          }
        }

        const parentUser = await users.findByEmail(admission.email.toLowerCase());
        if (parentUser) {
          const emailRes = await sendEmail({
            to: parentUser.email,
            subject: `Admission Approved — ${admission.studentName}`,
            html: `
              <h2>Admission Approved</h2>
              <p>Dear ${admission.parentName},</p>
              <p>Congratulations — your application for <strong>${admission.studentName}</strong> has been approved.</p>
              <p><strong>Admission Number:</strong> ${admission.admissionNumber}</p>
              <p>Please use the details below to log in to the parent portal:</p>
              <p><strong>Login email:</strong> ${parentUser.email}</p>
              <p><strong>Temporary password:</strong> <code>${createdTempPassword}</code></p>
              <p>For security, you will be redirected to change your password immediately after login. Your new password will be the one you use going forward.</p>
              <p>Visit the portal to complete registration and view next steps: <a href="${process.env.FRONTEND_URL || 'https://karumande.onrender.com'}">${process.env.FRONTEND_URL || 'https://karumande.onrender.com'}</a></p>
              <p>Thank you,<br/>Karumande Link School</p>
            `,
          });
          if (emailRes && emailRes.success === false) {
            console.warn('Admission approval email failed for parent:', emailRes.error || emailRes);
          }
        }
      } else {
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

    const fullAdmission = await admissions.findById(admission.id);
    return res.json({
      message: `Application ${actionWord} successfully`,
      admission: fullAdmission,
    });
  } catch (error) {
    console.error('Status update error:', error.stack || error);
    return res.status(500).json({ message: 'Failed to update status' });
  }
});

router.get('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const admission = await admissions.findById(req.params.id);
    if (!admission) {
      return res.status(404).json({ message: 'Application not found' });
    }
    return res.json(admission);
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
