const jwt = require('jsonwebtoken');
const Student = require('../models/student.model');
const Workspace = require('../models/workspace.model');
const Journal = require('../models/journal.model');

/**
 * View middleware: verifies JWT from cookie for page routes.
 * Redirects to /login instead of returning JSON errors.
 */
const requireAuth = async (req, res, next) => {
    const token = req.cookies.accessToken;

    if (!token) {
        return res.redirect('/login');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const student = await Student.findById(decoded.id)
            .select('-password -otp -otpExpires -otpAttempts -resetPasswordOtp -resetPasswordOtpExpires');

        if (!student) {
            return res.redirect('/login');
        }

        req.user = student;
        res.locals.user = student;

        // Populate workspaces for sidebar
        res.locals.workspaces = await Workspace.find({ student: student._id }).sort({ name: 1 });
        
        // Count active timers
        res.locals.activeTimersCount = await Journal.countDocuments({
            student: student._id,
            $expr: {
                $gt: [
                    { $add: ["$createdAt", { $multiply: ["$duration", 60, 1000] }] },
                    new Date()
                ]
            }
        });
        
        next();
    } catch (error) {
        // Token expired — try refresh
        const refreshToken = req.cookies.refreshToken;
        if (refreshToken) {
            try {
                const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
                const newAccessToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

                res.cookie('accessToken', newAccessToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    maxAge: 3600000
                });

                const student = await Student.findById(decoded.id)
                    .select('-password -otp -otpExpires -otpAttempts -resetPasswordOtp -resetPasswordOtpExpires');

                if (!student) return res.redirect('/login');

                req.user = student;
                res.locals.user = student;

                // Populate workspaces for sidebar
                res.locals.workspaces = await Workspace.find({ student: student._id }).sort({ name: 1 });

                // Count active timers
                res.locals.activeTimersCount = await Journal.countDocuments({
                    student: student._id,
                    $expr: {
                        $gt: [
                            { $add: ["$createdAt", { $multiply: ["$duration", 60, 1000] }] },
                            new Date()
                        ]
                    }
                });

                return next();
            } catch {
                return res.redirect('/login');
            }
        }
        return res.redirect('/login');
    }
};

/**
 * Redirect authenticated users away from guest-only pages (login, register, etc.)
 */
const requireGuest = (req, res, next) => {
    const token = req.cookies.accessToken;

    if (token) {
        try {
            jwt.verify(token, process.env.JWT_SECRET);
            return res.redirect('/dashboard');
        } catch {
            // Token invalid, continue to guest page
        }
    }
    next();
};

/**
 * Optionally attach user to res.locals if authenticated (for landing page).
 */
const attachUser = async (req, res, next) => {
    res.locals.user = null;
    const token = req.cookies.accessToken;

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const student = await Student.findById(decoded.id)
                .select('name email profilePic');
            res.locals.user = student;
        } catch {
            // Ignore - user stays null
        }
    }
    next();
};

module.exports = { requireAuth, requireGuest, attachUser };
