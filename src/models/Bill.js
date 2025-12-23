const mongoose = require('mongoose');

const billSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    term: { type: String, trim: true }, // e.g., "2026 Term 1"
    description: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: function () { return this.amount; }, min: 0 },
    status: { type: String, enum: ['pending', 'partial', 'paid'], default: 'pending' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Bill', billSchema);

