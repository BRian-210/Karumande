const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');

const { requireAuth, requireRole } = require('../middleware/auth');
const { admissions, query } = require('../data/repositories');

const router = express.Router();

const uploadDir = path.join(__dirname, '../../public/uploads/admissions');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.bin';
    const safeBase = path
      .basename(file.originalname || 'upload', ext)
      .replace(/[^a-z0-9-_]+/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'upload';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeBase}${ext}`);
  },
});

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
]);

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
  fileFilter(req, file, cb) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error('Invalid file type. Only JPG, PNG, and PDF files are allowed.'));
    }
    return cb(null, true);
  },
});

const submissionValidation = [
  body('parentName').isString().trim().notEmpty().withMessage('Parent name is required'),
  body('phone').isString().trim().notEmpty().withMessage('Phone number is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('relationship').isString().trim().notEmpty().withMessage('Relationship is required'),
  body('studentName').isString().trim().notEmpty().withMessage('Student name is required'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('Valid gender is required'),
  body('dob').optional({ values: 'falsy' }).isISO8601().withMessage('Valid date of birth is required'),
  body('classApplied').isString().trim().notEmpty().withMessage('Class applied is required'),
  body('previousSchool').optional({ values: 'falsy' }).isString().trim(),
  body('medicalInfo').optional({ values: 'falsy' }).isString().trim(),
];

function validateRequest(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return false;
  }
  return true;
}

function publicFilePath(file) {
  return file ? `/uploads/admissions/${file.filename}` : null;
}

function removeUploadedFiles(filesByField = {}) {
  Object.values(filesByField)
    .flat()
    .filter(Boolean)
    .forEach((file) => {
      fs.unlink(file.path, () => {});
    });
}

router.post(
  '/',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'birthCertificate', maxCount: 1 },
    { name: 'transferLetter', maxCount: 1 },
  ]),
  submissionValidation,
  async (req, res) => {
    if (!validateRequest(req, res)) {
      removeUploadedFiles(req.files);
      return;
    }

    try {
      const files = req.files || {};
      const photo = files.photo?.[0];
      const birthCertificate = files.birthCertificate?.[0];

      if (!photo || !birthCertificate) {
        removeUploadedFiles(files);
        return res.status(400).json({
          message: 'Student photo and birth certificate are required.',
        });
      }

      const created = await admissions.create({
        parentName: req.body.parentName.trim(),
        phone: req.body.phone.trim(),
        email: req.body.email.trim().toLowerCase(),
        relationship: req.body.relationship.trim(),
        studentName: req.body.studentName.trim(),
        gender: req.body.gender,
        dob: req.body.dob || null,
        classApplied: req.body.classApplied.trim(),
        previousSchool: req.body.previousSchool?.trim() || null,
        medicalInfo: req.body.medicalInfo?.trim() || null,
        photo: publicFilePath(photo),
        birthCertificate: publicFilePath(birthCertificate),
        transferLetter: publicFilePath(files.transferLetter?.[0]),
        status: 'pending',
      });

      return res.status(201).json({
        message: 'Application submitted successfully. Please wait as your request is being reviewed.',
        application: created,
      });
    } catch (error) {
      console.error('Create admission error:', error);
      removeUploadedFiles(req.files);
      return res.status(500).json({ message: 'Failed to submit application. Please try again.' });
    }
  }
);

router.get('/recent', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const items = await admissions.list({
      withStudent: true,
      status: 'accepted',
      limit: 50,
      offset: 0,
    });
    return res.json(items);
  } catch (error) {
    console.error('List recent admissions error:', error);
    return res.status(500).json({ message: 'Failed to load recent admissions.' });
  }
});

router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const items = await admissions.list({
      status: req.query.status || 'pending',
      limit: Number.isFinite(Number(req.query.limit)) ? Number(req.query.limit) : 200,
      offset: Number.isFinite(Number(req.query.offset)) ? Number(req.query.offset) : 0,
    });
    return res.json({ applications: items });
  } catch (error) {
    console.error('List admissions error:', error);
    return res.status(500).json({ message: 'Failed to load admissions.' });
  }
});

router.patch(
  '/:id/status',
  requireAuth,
  requireRole('admin'),
  [body('status').isIn(['pending', 'accepted', 'rejected']).withMessage('Valid status is required')],
  async (req, res) => {
    if (!validateRequest(req, res)) return;

    try {
      const values = [req.params.id, req.body.status, new Date(), req.user.id];
      const result = await query(
        `update public.admissions
         set status = $2,
             reviewed_at = $3,
             reviewed_by = $4
         where id = $1
         returning *`,
        values
      );

      if (!result.rows[0]) {
        return res.status(404).json({ message: 'Admission not found.' });
      }

      return res.json({
        message: 'Admission status updated successfully.',
        application: result.rows[0],
      });
    } catch (error) {
      console.error('Update admission status error:', error);
      return res.status(500).json({ message: 'Failed to update admission status.' });
    }
  }
);

module.exports = router;
