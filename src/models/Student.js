const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    admissionNumber: { type: String, trim: true, unique: true, sparse: true },
    classLevel: { type: String, required: true, trim: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    stream: { type: String, trim: true },
    status: { type: String, enum: ['active', 'graduated', 'transferred'], default: 'active' },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Student', studentSchema);

