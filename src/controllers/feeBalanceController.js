const { bills } = require('../data/repositories');

exports.updateFeeBalance = async (req, res) => {
    try {
        const { studentId, amount, type } = req.body; // type can be 'credit' or 'debit'

        // Logic to update fee balance
        // This will involve finding the student's bill, and updating the balance based on amount and type.
        // For simplicity, let's assume we're updating a 'balance' field in the Bill model.
        // In a real application, you'd likely create a new transaction record.

        let bill = await bills.findOne({ studentId });

        if (!bill) {
            return res.status(404).json({ message: 'Bill not found for this student.' });
        }

        let amountPaid = Number(bill.amountPaid || 0);
        let balance = Number(bill.balance || 0);

        if (type === 'credit') {
            amountPaid += Number(amount);
            balance -= Number(amount);
        } else if (type === 'debit') {
            amountPaid -= Number(amount);
            balance += Number(amount);
        } else {
            return res.status(400).json({ message: 'Invalid transaction type.' });
        }

        amountPaid = Math.max(amountPaid, 0);
        balance = Math.max(balance, 0);
        const status = balance === 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'pending';
        bill = await bills.update(bill.id, { amountPaid, balance, status });

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

        const bill = await bills.findOne({ studentId });

        if (!bill) {
            return res.status(404).json({ message: 'Bill not found for this student.' });
        }

        res.status(200).json({ message: 'Fee balance retrieved successfully.', bill });

    } catch (error) {
        console.error('Error getting fee balance:', error);
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};
