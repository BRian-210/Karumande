const mongoose = require('mongoose');

const { Schema } = mongoose;

const AdmissionSchema = new Schema({
  parentName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  relationship: { type: String, trim: true, default: null },

  studentName: { type: String, required: true, trim: true },
  gender: { type: String, enum: ['male', 'female', 'other'], default: 'other' },
  dob: { type: Date },
  classApplied: { type: String },
  previousSchool: { type: String, default: null },
  medicalInfo: { type: String, default: null },

  photo: { type: String, default: null },
  birthCertificate: { type: String, default: null },
  transferLetter: { type: String, default: null },

  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  submittedAt: { type: Date, default: Date.now },

  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  // Link to created student record (set after approval)
  student: { type: Schema.Types.ObjectId, ref: 'Student', default: null },
  admissionNumber: { type: String, trim: true, default: null },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Admission', AdmissionSchema);
