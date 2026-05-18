const mongoose = require('mongoose');

const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
};

const validatePassword = (password) => {
    if (!password || password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
    if (!/[0-9]/.test(password)) return 'Password must contain a number';
    return null;
};

const validateMobile = (mobile) => {
    return mobile && /^\+?[0-9\s]{10,20}$/.test(mobile);
};

const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};

const normalizeEmail = (email) => {
    return email ? email.toLowerCase().trim() : '';
};

module.exports = { validateEmail, validatePassword, validateMobile, isValidObjectId, normalizeEmail };
