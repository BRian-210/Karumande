const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    term: { type: String, required: true, trim: true },
    subjects: [
      {
        name: { type: String, required: true, trim: true },
        score: { type: Number, required: true, min: 0 },
        maxScore: { type: Number, default: 100 }
      }
    ],
    total: { type: Number, min: 0 },
    grade: { type: String, trim: true },
    comments: { type: String, trim: true }
  },
  { timestamps: true }
);

resultSchema.index({ student: 1, term: 1 }, { unique: true });

module.exports = mongoose.model('Result', resultSchema);

