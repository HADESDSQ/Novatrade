const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    // Trading Data
    balance: {
        type: Number,
        default: 0.00 // Everyone starts with $0.00
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    // For Admin Use later
    isAdmin: {
        type: Boolean,
        default: false
    },
    date: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', UserSchema);