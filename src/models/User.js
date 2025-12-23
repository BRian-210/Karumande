const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'parent', 'teacher', 'student'], default: 'parent' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);

