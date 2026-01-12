// src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    // Personal Info
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    phone: {
      type: String,
      trim: true,
      sparse: true, // Allows multiple nulls, enforces uniqueness when set
      match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number (E.164 format)'],
    },

    // Authentication
    passwordHash: {
      type: String,
      required: true,
    },

    // Role & Permissions
    role: {
      type: String,
      enum: ['admin', 'parent', 'teacher', 'student'],
      default: 'parent',
      required: true,
    },

    // Relationships
    children: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
      },
    ],

    // Password Management
    passwordResetToken: String,
    passwordResetExpires: Date,

    // Account Status
    isActive: {
      type: Boolean,
      default: true,
    },
    // Force the user to change temporary password on first login
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: Date,

    // Optional: Profile photo
    profilePhoto: String,
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// ========================
// Indexes for Performance
// ========================
// Indexes: keep only non-duplicative indexes
userSchema.index({ role: 1 });
userSchema.index({ children: 1 });

// ========================
// Virtual: Hide sensitive fields
// ========================
userSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

userSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.__v;
    return ret;
  },
});

// ========================
// Method: Compare Password
// ========================
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// ========================
// Pre-save: Hash Password
// ========================
userSchema.pre('save', async function (next) {
  if (this.isModified('passwordHash')) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  }
  next();
});

module.exports = mongoose.model('User', userSchema);