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
      sparse: true, // allows multiple nulls, enforces uniqueness when set
      match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number (E.164 format)'],
    },

    // Authentication
    passwordHash: {
      type: String,
      required: true,
      select: false, // intentionally excluded from default queries
    },

    // Role & Permissions
    role: {
      type: String,
      enum: ['admin', 'parent', 'teacher', 'student'],
      default: 'student',
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
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: Date,

    // Security extras
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: Date,

    // Optional: Profile photo
    profilePhoto: String,
  },
  { timestamps: true }
);

// ========================
// Indexes for Performance
// ======================== 
userSchema.index({ role: 1 });
userSchema.index({ children: 1 });

// ========================
// Virtuals & JSON transformation
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
    delete ret.failedLoginAttempts;
    delete ret.lockedUntil;
    delete ret.__v;
    return ret;
  },
});

// ========================
// Instance Method: Compare Password
// ========================
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// ========================
// Static Method: Find user + validate password in one step
// ========================
userSchema.statics.findAndValidate = async function (query, password) {
  // query example: { email: "user@example.com" } or { admissionNumber: "ST12345" }
  const user = await this.findOne(query).select('+passwordHash');

  if (!user) {
    return null;
  }

  const isValid = await user.comparePassword(password);
  return isValid ? user : null;
};

// ========================
// Pre-save: Hash password only when modified
// ========================
userSchema.pre('save', async function (next) {
  if (this.isModified('passwordHash')) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  }
  next();
});

module.exports = mongoose.model('User', userSchema);