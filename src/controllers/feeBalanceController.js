const FeeBalance = require('../models/Bill'); // Assuming Bill model will be used for fees

exports.updateFeeBalance = async (req, res) => {
    try {
        const { studentId, amount, type } = req.body; // type can be 'credit' or 'debit'

        // Logic to update fee balance
        // This will involve finding the student's bill, and updating the balance based on amount and type.
        // For simplicity, let's assume we're updating a 'balance' field in the Bill model.
        // In a real application, you'd likely create a new transaction record.

        let bill = await FeeBalance.findOne({ student: studentId });

        if (!bill) {
            return res.status(404).json({ message: 'Bill not found for this student.' });
        }

        if (type === 'credit') {
            bill.amountPaid += amount;
            bill.balance -= amount; // Assuming balance is total - amountPaid
        } else if (type === 'debit') {
            bill.amountPaid -= amount;
            bill.balance += amount;
        } else {
            return res.status(400).json({ message: 'Invalid transaction type.' });
        }

        await bill.save();

        res.status(200).json({ message: 'Fee balance updated successfully.', bill });

    } catch (error) {
        console.error('Error updating fee balance:', error);
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

// Function to get a student's fee balance
exports.getFeeBalance = async (req, res) => {
    try {
        const { studentId } = req.params;

        const bill = await FeeBalance.findOne({ student: studentId }).populate('student');

        if (!bill) {
            return res.status(404).json({ message: 'Bill not found for this student.' });
        }

        res.status(200).json({ message: 'Fee balance retrieved successfully.', bill });

    } catch (error) {
        console.error('Error getting fee balance:', error);
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};
