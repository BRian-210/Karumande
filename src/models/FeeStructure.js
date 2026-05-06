const mongoose = require('mongoose');

const feeStructureSchema = new mongoose.Schema(
  {
    classLevel: { type: String, required: true, trim: true },
    term: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, trim: true }
  },
  { timestamps: true }
);

feeStructureSchema.index({ classLevel: 1, term: 1 }, { unique: true });

module.exports = mongoose.model('FeeStructure', feeStructureSchema);

