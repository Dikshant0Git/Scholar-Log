const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');

// No DB call — JWT already contains the user ID
const protectRoute = asyncHandler(async (req, res, next) => {
    const token = req.cookies.accessToken;

    if (!token) {
        // No access token — try refresh before failing
        return tryRefresh(req, res, next);
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { _id: decoded.id };
        next();
    } catch (error) {
        // Token invalid/expired — try refresh
        return tryRefresh(req, res, next);
    }
});

const tryRefresh = (req, res, next) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ success: false, message: 'Session expired. Please login again.' });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const newAccessToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 3600000
        });

        req.user = { _id: decoded.id };
        return next();
    } catch (refreshError) {
        return res.status(401).json({ success: false, message: 'Session expired. Please login again.' });
    }
};

module.exports = { protectRoute };
