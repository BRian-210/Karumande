const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    audience: { type: String, enum: ['public', 'parents', 'students', 'staff'], default: 'public' },
    startDate: { type: Date },
    endDate: { type: Date },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Announcement', announcementSchema);

