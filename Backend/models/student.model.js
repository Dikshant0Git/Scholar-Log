const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    mobile: {
        type: String,
        required: true,
    },
    signature: {
        type: String, // Cloudinary URL
        default: ''
    },
    backgroundImage: {
        type: String, // Cloudinary URL
        default: ''
    },
    settings: {
        preferredTheme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
        showStats: { type: Boolean, default: true }
    },
    password: {
        type: String,
        required: true,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    otp: {
        type: String,
    },
    otpExpires: {
        type: Date,
    },
    otpAttempts: {
        type: Number,
        default: 0,
    },
    resetPasswordOtp: {
        type: String,
    },
    resetPasswordOtpExpires: {
        type: Date,
    },
    profilePic: {
        type: String,
        default: '',
    }
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);
