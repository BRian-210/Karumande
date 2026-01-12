const mongoose = require('mongoose');

const resultDueDateSchema = new mongoose.Schema({
  classLevel: { type: String, required: true, trim: true },
  term: { type: String, required: true, trim: true },
  subject: { type: String, trim: true },
  dueDate: { type: Date, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

resultDueDateSchema.index({ classLevel: 1, term: 1, subject: 1 }, { unique: true });

module.exports = mongoose.model('ResultDueDate', resultDueDateSchema);
