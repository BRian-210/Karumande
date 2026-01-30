// auth.routes.js  or  routes/changePassword.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authMiddleware } = require('../middleware/auth'); // your JWT middleware

const router = express.Router();

// Assume you have a User model (e.g. Mongoose)
const User = require('../models/User');

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    // 1. Find user (already attached by auth middleware)
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // 2. Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // 3. Optional: prevent reusing same password (good practice)
    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) {
      return res.status(400).json({ error: 'New password must be different' });
    }

    // 4. Validate password strength (mirror frontend rules)
    if (newPassword.length < 10 ||
        !/[A-Z]/.test(newPassword) ||
        !/[a-z]/.test(newPassword) ||
        !/[0-9]/.test(newPassword) ||
        !/[^A-Za-z0-9\s]/.test(newPassword)) {
      return res.status(400).json({
        error: 'Password must be ≥10 characters with uppercase, lowercase, number & special character'
      });
    }

    // 5. Hash & save new password
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    // Optional: Invalidate old tokens / force re-login
    // e.g. store token blacklist, increment version, etc.

    res.status(200).json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});

module.exports = router;