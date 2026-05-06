const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');

const { requireAuth } = require('../middleware/auth');
const { users, students } = require('../data/repositories');

const router = express.Router();


/* ======================================================
 HELPER: Send Reset Email
====================================================== */
// Helper: Send Reset Email using Brevo
// Helper: Send Reset Email using Brevo (Fixed)
async function sendResetEmail(email, name, resetLink) {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.BREVO_EMAIL,
        pass: process.env.BREVO_SMTP_KEY,
      },
      tls: { rejectUnauthorized: false }
    });

    await transporter.sendMail({
      from: `"Karumande School" <${process.env.BREVO_EMAIL}>`,
      to: email,
      subject: "Reset Your Password - Karumande School",
      html: `... your html ...`
    });

    console.log(`✅ Password reset email sent to ${email}`);
    return true;

  } catch (err) {
    console.error('❌ Brevo Email failed:', err.message);
    // Don't crash the server
    return false;
  }
}

/* ======================================================
   VALIDATION
====================================================== */

const loginValidation = [
  body('password').notEmpty().withMessage('Password is required'),
  body().custom((value, { req }) => {
    if (!req.body.email && !req.body.admissionNo) {
      throw new Error('Either email or admissionNo is required');
    }
    return true;
  }),
];

/* ======================================================
   LOGIN
====================================================== */
router.post('/login', loginValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, admissionNo } = req.body;
  let user = null;

  try {
    if (admissionNo) {
      const student = await students.findByAdmissionNumber(admissionNo.trim());
      if (!student) return res.status(401).json({ message: 'Invalid admission number or password' });
      user = await users.findById(student.parent || student.parent_id, { includePasswordHash: true });
    } else {
      user = await users.findByEmail(email?.toLowerCase(), { includePasswordHash: true });
    }

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash || '');
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    await users.updateLastLogin(user.id);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword || false,
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ======================================================
   CHANGE PASSWORD
====================================================== */
router.post(
  '/change-password',
  requireAuth,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { currentPassword, newPassword } = req.body;

    try {
      const user = await users.findById(req.user.id, { includePasswordHash: true });
      if (!user) return res.status(404).json({ message: 'User not found' });

      const match = await bcrypt.compare(currentPassword, user.passwordHash || '');
      if (!match) return res.status(401).json({ message: 'Current password is incorrect' });

      await users.updatePassword(req.user.id, newPassword, { mustChangePassword: false });

      res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Failed to change password' });
    }
  }
);

/* ======================================================
   FORGOT PASSWORD
====================================================== */
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Valid email is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email } = req.body;

  try {
    const user = await users.findByEmail(email.toLowerCase());

    if (!user || !user.isActive) {
      return res.json({ 
        message: "If an account with that email exists, a password reset link has been sent." 
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    await users.update(user.id, {
      password_reset_token: resetToken,
      password_reset_expires: resetExpires
    });

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5432'}/reset-password.html?token=${resetToken}`;

    await sendResetEmail(user.email, user.name, resetLink);

    res.json({
      message: "If an account with that email exists, a password reset link has been sent."
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: "Something went wrong. Please try again later." });
  }
});

/* ======================================================
   RESET PASSWORD
====================================================== */
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Token is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { token, newPassword } = req.body;

  try {
    const user = await users.findByResetToken(token);

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset link." });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await users.update(user.id, {
      passwordHash,
      password_reset_token: null,
      password_reset_expires: null,
      mustChangePassword: false
    });

    res.json({
      success: true,
      message: "Password reset successfully. You can now login."
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

module.exports = router;