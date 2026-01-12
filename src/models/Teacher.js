const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      default: 'teacher'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Teacher', teacherSchema);
