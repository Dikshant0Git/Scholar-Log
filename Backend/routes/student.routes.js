const express = require('express');
const { 
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
} = require('../controllers/student.controller');
const { protectRoute } = require('../middlewares/auth.middleware');
const upload = require('../utils/multer');

const router = express.Router();

// Public auth routes
router.post('/register', registerStudent);
router.post('/verify-email', verifyEmail);
router.post('/login', loginStudent);
router.post('/logout', logoutStudent);
router.post('/refresh', refreshAccessToken);
router.post('/forgot-password', forgotPassword);
router.post('/resend-otp', resendOtp);
router.post('/reset-password', resetPassword);

// Protected profile & settings routes
router.use(protectRoute);

router.get('/profile', getStudentProfile);
router.get('/upload-signature', getUploadSignature);
router.patch('/profile', updateStudentProfile);
router.patch('/settings', updateSettings);

// Generic server-side upload fallback
router.post('/upload', upload.single('file'), uploadFile);

router.post('/request-password-change', requestPasswordChange);
router.put('/change-password', changePassword);
router.delete('/profile', deleteAccount);

module.exports = router;
