const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Student = require('../models/Student');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/* ======================================================
   VALIDATION RULES
====================================================== */

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role')
    .optional()
    .isIn(['parent', 'teacher', 'admin'])
    .withMessage('Invalid role'),
];

// Allow either email or admissionNo for login
const loginValidation = [
  body('password').notEmpty().withMessage('Password is required'),
  body().custom((value, { req }) => {
    if (!req.body.email && !req.body.admissionNo) {
      throw new Error('Either email or admissionNo is required');
    }
    if (req.body.email) {
      const email = req.body.email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('A valid email is required');
      }
    }
    return true;
  }),
];

/* ======================================================
   REGISTER (PARENTS ONLY)
====================================================== */

router.post('/register', registerValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, password } = req.body;

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) {
    return res.status(409).json({ message: 'Email already registered' });
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash: password, // hashed by model hook
    role: 'parent',
  });

  res.status(201).json({
    message: 'Parent registered successfully',
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
  });
});

/* ======================================================
   CREATE TEACHER (ADMIN ONLY)
====================================================== */

router.post(
  '/create-teacher',
  requireAuth,
  [
    body('name').trim().notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
  ],
  async (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    const teacher = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash: password,
      role: 'teacher',
      mustChangePassword: true,
    });

    res.status(201).json({
      message: 'Teacher created successfully',
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        role: teacher.role,
      },
    });
  }
);

/* ======================================================
   LOGIN (EMAIL OR ADMISSION NUMBER)
====================================================== */

router.post('/login', loginValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, admissionNo } = req.body;
  let user = null;

  if (admissionNo) {
    const search = admissionNo.toString().trim();
    let student = await Student.findOne({ admissionNumber: search });

    if (!student) {
      return res.status(401).json({ message: 'Invalid admission number or password' });
    }

    user = await User.findById(student.parent);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid admission number or password' });
    }

    // Audit log
    try {
      const logsDir = path.join(__dirname, '../../logs');
      const auditFile = path.join(logsDir, 'auth_audit.log');

      fs.mkdirSync(logsDir, { recursive: true });
      fs.appendFileSync(
        auditFile,
        JSON.stringify({
          event: 'login_by_admission',
          admissionNo: search,
          parentEmail: user.email,
          ip: req.ip,
          time: new Date().toISOString(),
        }) + '\n'
      );
    } catch (err) {
      console.error('Audit log error:', err.message);
    }
  } else {
    user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
  }

  const validPassword = await user.comparePassword(password);
  if (!validPassword) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  user.lastLoginAt = new Date();
  await user.save();

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      mustChangePassword: user.mustChangePassword,
    },
  });
});

/* ======================================================
   CURRENT USER
====================================================== */

router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      name: req.user.name,
    },
  });
});

/* ======================================================
   CHANGE PASSWORD
====================================================== */

router.post(
  '/change-password',
  requireAuth,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const match = await user.comparePassword(currentPassword);
    if (!match) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.passwordHash = newPassword;
    user.mustChangePassword = false;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  }
);

module.exports = router;