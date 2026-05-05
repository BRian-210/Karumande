const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../middleware/auth');
const { users, students } = require('../data/repositories');

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

  const exists = await users.findByEmail(email.toLowerCase());
  if (exists) {
    return res.status(409).json({ message: 'Email already registered' });
  }

  const user = await users.create({
    name,
    email: email.toLowerCase(),
    passwordHash: password,
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

    const exists = await users.findByEmail(email.toLowerCase());
    if (exists) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    const teacher = await users.create({
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
   CREATE ADMIN (REQUIRES INVITE CODE)
====================================================== */

router.post(
  '/create-admin',
  [
    body('name').trim().notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('inviteCode').trim().notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, inviteCode } = req.body;
    if (!process.env.ADMIN_INVITE_CODE) {
      return res.status(500).json({ message: 'ADMIN_INVITE_CODE is not configured' });
    }
    const adminCount = await users.countActiveAdmins();

    if (adminCount > 0) {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (!token) {
        return res.status(403).json({ message: 'Admin authentication required' });
      }

      let payload;
      try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }

      const requesterId = payload.sub || payload.id || payload.userId;
      const requester = await users.findById(requesterId);
      if (!requester || !requester.isActive || requester.role !== 'admin') {
        return res.status(403).json({ message: 'Admin authentication required' });
      }
    }

    // Check invite code
    if (inviteCode !== process.env.ADMIN_INVITE_CODE) {
      return res.status(403).json({ message: 'Invalid invite code' });
    }

    const exists = await users.findByEmail(email.toLowerCase());
    if (exists) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    const admin = await users.create({
      name,
      email: email.toLowerCase(),
      passwordHash: password,
      role: 'admin',
      mustChangePassword: true,
    });

    res.status(201).json({
      message: 'Admin created successfully',
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
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
    const student = await students.findByAdmissionNumber(search);

    if (!student) {
      return res.status(401).json({ message: 'Invalid admission number or password' });
    }

    user = await users.findById(
      typeof student.parent === 'object' ? student.parent.id : student.parent,
      { includePasswordHash: true }
    );

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
    user = await users.findByEmail(email.toLowerCase(), { includePasswordHash: true });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash || '');
  if (!validPassword) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  await users.updateLastLogin(user.id);

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

router.get('/me', requireAuth, async (req, res) => {
  const user = await users.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.json({
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

    // We need the password hash → include it explicitly
    const user = await users.findById(req.user.id, { includePasswordHash: true });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const match = await bcrypt.compare(currentPassword, user.passwordHash || '');
    if (!match) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    await users.updatePassword(user.id, newPassword, { mustChangePassword: false });

    res.json({ message: 'Password changed successfully' });
  }
);

module.exports = router;
