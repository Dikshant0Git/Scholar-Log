const asyncHandler = require('../utils/asyncHandler');
const Student = require('../models/student.model');
const Journal = require('../models/journal.model');
const Workspace = require('../models/workspace.model');
const jwt = require('jsonwebtoken');
const { sendEmailAsync } = require('../config/email.config');
const bcrypt = require('bcrypt');
const uploadService = require('../services/upload.service');
const cacheService = require('../services/cache.service');
const { validateEmail, validatePassword, validateMobile, normalizeEmail } = require('../utils/validators');

const MAX_OTP_ATTEMPTS = 5;

// Generate Access Token (1 hour)
const generateAccessToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET , { expiresIn: '1h' });
};

// Generate Refresh Token (7 days)
const generateRefreshToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET , { expiresIn: '7d' });
};

// Reusable cookie options
const getCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
});

// @desc    Register a new student
// @route   POST /api/students/register
const registerStudent = asyncHandler(async (req, res) => {
    const { name, password } = req.body;
    const email = normalizeEmail(req.body.email);
    const mobile = req.body.mobile?.trim();

    if (!name || !email || !mobile || !password) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (!validateEmail(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
        return res.status(400).json({ success: false, message: passwordError });
    }

    if (!validateMobile(mobile)) {
        return res.status(400).json({ success: false, message: 'Invalid mobile number' });
    }

    const existingStudent = await Student.findOne({ email });

    // Allow re-registration if previous account was never verified and OTP expired
    if (existingStudent) {
        if (existingStudent.isVerified) {
            return res.status(400).json({ success: false, message: 'Student already exists' });
        }
        if (existingStudent.otpExpires && existingStudent.otpExpires < Date.now()) {
            await existingStudent.deleteOne();
        } else {
            return res.status(400).json({ success: false, message: 'Verification pending. Check your email for the OTP.' });
        }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const hashedOtp = await bcrypt.hash(otp, salt);

    await Student.create({
        name: name.trim(),
        email,
        mobile,
        password: hashedPassword,
        otp: hashedOtp,
        otpExpires,
        otpAttempts: 0,
    });

    sendEmailAsync(email, 'Verify Your Email - Student Journal', `Your OTP is: ${otp}`);

    res.status(201).json({ success: true, message: 'Registration successful. Please verify your email with the OTP sent.' });
});

// @desc    Verify email with OTP
// @route   POST /api/students/verify-email
const verifyEmail = asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const { otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const student = await Student.findOne({ email });
    if (!student) {
        return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (student.isVerified) {
        return res.status(400).json({ success: false, message: 'Email already verified' });
    }

    if (student.otpExpires < Date.now()) {
        return res.status(400).json({ success: false, message: 'OTP expired. Please register again.' });
    }

    if (student.otpAttempts >= MAX_OTP_ATTEMPTS) {
        return res.status(429).json({ success: false, message: 'Too many failed attempts. Account blocked.' });
    }

    const isMatch = await bcrypt.compare(otp, student.otp);
    if (!isMatch) {
        student.otpAttempts += 1;
        await student.save();
        return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    student.isVerified = true;
    student.otp = undefined;
    student.otpExpires = undefined;
    student.otpAttempts = 0;
    await student.save();

    res.status(200).json({ success: true, message: 'Email verified successfully' });
});

// @desc    Login student
// @route   POST /api/students/login
const loginStudent = asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    const student = await Student.findOne({ email });
    if (!student || !(await bcrypt.compare(password, student.password))) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!student.isVerified) {
        return res.status(403).json({ success: false, message: 'Please verify your email first' });
    }

    const accessToken = generateAccessToken(student._id);
    const refreshToken = generateRefreshToken(student._id);

    const cookieOptions = getCookieOptions();
    res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 3600000 });
    res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 604800000 });

    res.status(200).json({
        success: true,
        student: { id: student._id, name: student.name, email: student.email, profilePic: student.profilePic }
    });
});

// @desc    Refresh Token
// @route   POST /api/students/refresh
const refreshAccessToken = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ success: false, message: 'No refresh token' });

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const accessToken = generateAccessToken(decoded.id);
        
        res.cookie('accessToken', accessToken, { ...getCookieOptions(), maxAge: 3600000 });
        res.status(200).json({ success: true });
    } catch {
        res.status(403).json({ success: false, message: 'Invalid refresh token' });
    }
});

// @desc    Logout
// @route   POST /api/students/logout
const logoutStudent = asyncHandler(async (req, res) => {
    const cookieOptions = getCookieOptions();
    res.cookie('accessToken', '', { ...cookieOptions, expires: new Date(0) });
    res.cookie('refreshToken', '', { ...cookieOptions, expires: new Date(0) });
    res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// @desc    Get Student Profile
// @route   GET /api/students/profile
const getStudentProfile = asyncHandler(async (req, res) => {
    const student = await Student.findById(req.user._id).select('-password -otp -otpExpires -otpAttempts -resetPasswordOtp -resetPasswordOtpExpires');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.status(200).json({ success: true, student });
});

// @desc    Update Student Profile
// @route   PATCH /api/students/profile
const updateStudentProfile = asyncHandler(async (req, res) => {
    const { name, mobile, profilePic, signature } = req.body;
    const student = await Student.findById(req.user._id);

    if (name) student.name = name;
    if (mobile) {
        if (!validateMobile(mobile)) return res.status(400).json({ success: false, message: 'Invalid mobile number' });
        student.mobile = mobile;
    }
    
    // If the frontend sent a new profilePic URL, update it
    if (profilePic) student.profilePic = profilePic;
    
    // Allow clearing signature by checking for undefined vs empty string
    if (signature !== undefined) student.signature = signature;

    await student.save();
    res.status(200).json({ success: true, student });
});

// @desc    Update UI Settings & Background
// @route   PATCH /api/students/settings
const updateSettings = asyncHandler(async (req, res) => {
    const { backgroundImage, preferredTheme, showStats } = req.body;
    const student = await Student.findById(req.user._id);

    if (backgroundImage !== undefined) student.backgroundImage = backgroundImage;
    
    // Ensure settings object exists and update sub-fields safely
    if (!student.settings) student.settings = {};
    if (preferredTheme) student.settings.preferredTheme = preferredTheme;
    if (showStats !== undefined) student.settings.showStats = showStats;

    await student.save();
    res.status(200).json({ success: true, settings: student.settings, backgroundImage: student.backgroundImage });
});

// @desc    Get Signed Upload URL for Cloudinary (Direct Upload)
// @route   GET /api/students/upload-signature
const getUploadSignature = asyncHandler(async (req, res) => {
    const { type } = req.query; // profile, background, or attachment
    const signatureData = uploadService.generateUploadSignature(type);
    res.status(200).json({ success: true, ...signatureData });
});

// @desc    Server-side File Upload (Fallback)
// @route   POST /api/students/upload
const uploadFile = asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });
    
    const { folder, resourceType } = req.body;
    const result = await uploadService.uploadFile(req.file, folder, resourceType);
    
    res.status(200).json({ success: true, ...result });
});

// @desc    Forgot Password - Request OTP
// @route   POST /api/students/forgot-password
const forgotPassword = asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const student = await Student.findOne({ email });
    if (!student) {
        return res.status(404).json({ success: false, message: 'This email is not registered in our system.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    student.resetPasswordOtp = await bcrypt.hash(otp, salt);
    student.resetPasswordOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    student.otpAttempts = 0;
    await student.save();

    sendEmailAsync(email, 'Password Reset OTP', `Your OTP for password reset is: ${otp}`);
    res.status(200).json({ success: true, message: 'OTP sent to your email.' });
});

// @desc    Resend OTP (for verification or password reset)
// @route   POST /api/students/resend-otp
const resendOtp = asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const { action } = req.body; // 'verify' or 'reset'

    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const student = await Student.findOne({ email });
    if (!student) {
        return res.status(404).json({ success: false, message: 'This email is not registered in our system.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    if (action === 'verify') {
        if (student.isVerified) {
            return res.status(400).json({ success: false, message: 'Email is already verified.' });
        }
        student.otp = hashedOtp;
        student.otpExpires = otpExpires;
        student.otpAttempts = 0;
        await student.save();

        sendEmailAsync(email, 'Verify Your Email - Resend', `Your new OTP is: ${otp}`);
        return res.status(200).json({ success: true, message: 'New verification OTP sent to your email.' });
    } else if (action === 'reset') {
        student.resetPasswordOtp = hashedOtp;
        student.resetPasswordOtpExpires = otpExpires;
        student.otpAttempts = 0;
        await student.save();

        sendEmailAsync(email, 'Password Reset OTP - Resend', `Your new OTP for password reset is: ${otp}`);
        return res.status(200).json({ success: true, message: 'New password reset OTP sent to your email.' });
    } else {
        return res.status(400).json({ success: false, message: 'Invalid action parameter.' });
    }
});

// @desc    Reset Password with OTP
// @route   POST /api/students/reset-password
const resetPassword = asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const { otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
        return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required' });
    }

    const student = await Student.findOne({ email });
    if (!student || !student.resetPasswordOtp || student.resetPasswordOtpExpires < Date.now()) {
        return res.status(400).json({ success: false, message: 'OTP expired or not found.' });
    }

    const isMatch = await bcrypt.compare(otp, student.resetPasswordOtp);
    if (!isMatch) {
        student.otpAttempts += 1;
        await student.save();
        return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    const salt = await bcrypt.genSalt(10);
    student.password = await bcrypt.hash(newPassword, salt);
    student.resetPasswordOtp = undefined;
    student.resetPasswordOtpExpires = undefined;
    student.otpAttempts = 0;
    await student.save();

    res.status(200).json({ success: true, message: 'Password reset successfully' });
});

const requestPasswordChange = asyncHandler(async (req, res) => {
    const student = await Student.findById(req.user._id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    student.resetPasswordOtp = await bcrypt.hash(otp, salt);
    student.resetPasswordOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    student.otpAttempts = 0;
    await student.save();

    sendEmailAsync(student.email, 'Password Change Request', `Your OTP for changing your password is: ${otp}`);
    res.status(200).json({ success: true, message: 'OTP sent to your email.', email: student.email });
});

const changePassword = asyncHandler(async (req, res) => {
    const { otp, newPassword } = req.body;
    const student = await Student.findById(req.user._id);

    if (!student || !student.resetPasswordOtp || student.resetPasswordOtpExpires < Date.now()) {
        return res.status(400).json({ success: false, message: 'OTP expired or not found.' });
    }

    const isValidOtp = await bcrypt.compare(otp, student.resetPasswordOtp);
    if (!isValidOtp) {
        student.otpAttempts = (student.otpAttempts || 0) + 1;
        await student.save();
        return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    const salt = await bcrypt.genSalt(10);
    student.password = await bcrypt.hash(newPassword, salt);
    student.resetPasswordOtp = undefined;
    student.resetPasswordOtpExpires = undefined;
    student.otpAttempts = 0;

    await student.save();
    res.status(200).json({ success: true, message: 'Password changed successfully' });
});

const deleteAccount = asyncHandler(async (req, res) => {
    const student = await Student.findById(req.user._id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // 1. Delete student profile pic from Cloudinary
    if (student.profilePic) {
        try {
            const parts = student.profilePic.split('/');
            const fileName = parts[parts.length - 1].split('.')[0];
            const folder = parts[parts.length - 2];
            const publicId = `${folder}/${fileName}`;
            await uploadService.deleteFile(publicId);
        } catch (e) {
            console.error('Failed to delete profile pic from Cloudinary:', e);
        }
    }

    // 2. Delete student custom signature from Cloudinary
    if (student.signature) {
        try {
            const parts = student.signature.split('/');
            const fileName = parts[parts.length - 1].split('.')[0];
            const folder = parts[parts.length - 2];
            const publicId = `${folder}/${fileName}`;
            await uploadService.deleteFile(publicId);
        } catch (e) {
            console.error('Failed to delete signature from Cloudinary:', e);
        }
    }

    // 3. Delete student custom background image from Cloudinary
    if (student.backgroundImage) {
        try {
            const parts = student.backgroundImage.split('/');
            const fileName = parts[parts.length - 1].split('.')[0];
            const folder = parts[parts.length - 2];
            const publicId = `${folder}/${fileName}`;
            await uploadService.deleteFile(publicId);
        } catch (e) {
            console.error('Failed to delete background image from Cloudinary:', e);
        }
    }

    // 4. Fetch journals and delete their Cloudinary attachments
    const journals = await Journal.find({ student: student._id });
    for (const journal of journals) {
        if (journal.attachments && journal.attachments.length > 0) {
            for (const att of journal.attachments) {
                if (att.public_id) {
                    try {
                        await uploadService.deleteFile(att.public_id);
                    } catch (e) {
                        console.error('Failed to delete journal attachment from Cloudinary:', e);
                    }
                }
            }
        }
    }

    // 5. Delete all student journal entries from MongoDB
    await Journal.deleteMany({ student: student._id });

    // 6. Fetch workspaces and delete their Cloudinary hero images
    const workspaces = await Workspace.find({ student: student._id });
    for (const ws of workspaces) {
        if (ws.heroImage) {
            try {
                const parts = ws.heroImage.split('/');
                const fileName = parts[parts.length - 1].split('.')[0];
                const folder = parts[parts.length - 2];
                const publicId = `${folder}/${fileName}`;
                await uploadService.deleteFile(publicId);
            } catch (e) {
                console.error('Failed to delete workspace hero image from Cloudinary:', e);
            }
        }
    }

    // 7. Delete all student workspaces from MongoDB
    await Workspace.deleteMany({ student: student._id });

    // 8. Invalidate Dashboard Cache and Delete Student document
    cacheService.invalidateDashboard(student._id);
    await student.deleteOne();

    // 9. Clear security cookies
    const cookieOptions = getCookieOptions();
    res.cookie('accessToken', '', { ...cookieOptions, expires: new Date(0) });
    res.cookie('refreshToken', '', { ...cookieOptions, expires: new Date(0) });

    res.status(200).json({ success: true, message: 'Account deleted permanently' });
});

module.exports = { 
    registerStudent, 
    verifyEmail, 
    loginStudent, 
    logoutStudent, 
    refreshAccessToken, 
    forgotPassword, 
    resendOtp,
    resetPassword,
    getStudentProfile,
    getUploadSignature,
    updateStudentProfile,
    updateSettings,
    uploadFile,
    requestPasswordChange,
    changePassword,
    deleteAccount
};
