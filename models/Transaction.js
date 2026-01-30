const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String, // 'deposit' or 'withdrawal'
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    method: {
        type: String, // 'BTC', 'ETH', etc.
        required: true
    },
    status: {
        type: String, 
        default: 'pending' // 'pending', 'approved', 'rejected'
    },
    date: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Transaction', TransactionSchema);