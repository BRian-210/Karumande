const { bills } = require('../data/repositories');

exports.updateFeeBalance = async (req, res) => {
    try {
        const { studentId, amount, type } = req.body; // type can be 'credit' or 'debit'

        // Logic to update fee balance
        // This will involve finding the student's bill, and updating the balance based on amount and type.
        // For simplicity, let's assume we're updating a 'balance' field in the Bill model.
        // In a real application, you'd likely create a new transaction record.

        const bill = await bills.findOne({ studentId });

        if (!bill) {
            return res.status(404).json({ message: 'Bill not found for this student.' });
        }

        const amountNumber = Number(amount);
        if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
            return res.status(400).json({ message: 'Amount must be a positive number.' });
        }

        let nextAmountPaid = Number(bill.amountPaid || 0);
        let nextBalance = Number(bill.balance || 0);

        if (type === 'credit') {
            nextAmountPaid += amountNumber;
            nextBalance -= amountNumber;
        } else if (type === 'debit') {
            nextAmountPaid -= amountNumber;
            nextBalance += amountNumber;
        } else {
            return res.status(400).json({ message: 'Invalid transaction type.' });
        }

        const updatedBill = await bills.update(bill.id, {
            amountPaid: nextAmountPaid,
            balance: nextBalance,
        });

        res.status(200).json({ message: 'Fee balance updated successfully.', bill: updatedBill });

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
