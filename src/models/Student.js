// src/models/Student.js
const mongoose = require('mongoose');
const { CLASS_LEVELS } = require('../constants/school'); // Optional: for enum validation

const studentSchema = new mongoose.Schema(
  {
    // Basic Info
    name: {
      type: String,
      required: true,
      trim: true,
    },
    admissionNumber: {
      type: String,
      unique: true,
      sparse: true, // Allows null/undefined while still enforcing uniqueness
      trim: true,
    },
    classLevel: {
      type: String,
      required: true,
      trim: true,
      // Optional: restrict to your allowed classes
      enum: {
        values: CLASS_LEVELS,
        message: '{VALUE} is not a valid class level',
      },
    },
    stream: {
      type: String,
      trim: true,
      uppercase: true, // e.g., "A", "B", "EAST"
    },

    // Personal Info
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      required: true,
    },
    dob: {
      type: Date,
      required: true,
    },

    // Relationships
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      // made optional so admins can create students before adding parent accounts
      required: false,
    },

    // Academic & Status
    status: {
      type: String,
      enum: ['active', 'graduated', 'transferred', 'suspended'],
      default: 'active',
    },
    active: {
      type: Boolean,
      default: true,
    },

    // Documents & History
    photo: {
      type: String, // Path like /uploads/admissions/xxx-photo.jpg
    },
    previousSchool: {
      type: String,
      trim: true,
    },
    medicalInfo: {
      type: String,
      trim: true,
    },

    // Future extensions (optional now, useful later)
    // enrollmentYear: { type: Number },
    // graduationYear: { type: Number },
    // house: { type: String }, // e.g., Red, Blue
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// Index for faster queries (especially parent lookups)
studentSchema.index({ parent: 1 });
studentSchema.index({ classLevel: 1, active: 1 });

module.exports = mongoose.model('Student', studentSchema);