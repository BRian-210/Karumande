const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    bill: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill' },
    transactionId: { type: String, unique: true, sparse: true },
    merchantRequestId: { type: String, index: true, sparse: true },
    checkoutRequestId: { type: String, index: true, sparse: true },
    phone: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
    rawCallback: { type: Object }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);

