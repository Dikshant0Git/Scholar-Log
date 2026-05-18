const express = require('express');
const { requireAuth, requireGuest, attachUser } = require('../middlewares/view.middleware');
const {
    renderDashboard,
    renderEntries,
    renderEntryDetail,
    renderNewEntry,
    renderSettings,
    renderWorkspace,
    renderEditEntry,
    renderNotifications
} = require('../controllers/view.controller');

const router = express.Router();

// ── Public Routes ──
router.get('/', attachUser, (req, res) => {
    res.render('landing', {
        pageTitle: 'Home',
        layout: 'layout'
    });
});

// ── Guest-Only Routes (Auth Pages) ──
router.get('/login', requireGuest, (req, res) => {
    res.render('auth/login', {
        pageTitle: 'Sign In',
        layout: 'layout'
    });
});

router.get('/register', requireGuest, (req, res) => {
    res.render('auth/register', {
        pageTitle: 'Create Account',
        layout: 'layout'
    });
});

router.get('/verify', (req, res) => {
    res.render('auth/verify', {
        pageTitle: 'Verify Email',
        layout: 'layout',
        email: req.query.email || ''
    });
});

router.get('/forgot-password', requireGuest, (req, res) => {
    res.render('auth/forgot-password', {
        pageTitle: 'Forgot Password',
        layout: 'layout'
    });
});

router.get('/reset-password', (req, res) => {
    res.render('auth/reset-password', {
        pageTitle: 'Reset Password',
        layout: 'layout',
        email: req.query.email || ''
    });
});

// ── Authenticated Routes ──
router.get('/dashboard', requireAuth, renderDashboard);
router.get('/entries', requireAuth, renderEntries);
router.get('/entries/new', requireAuth, renderNewEntry);
router.get('/entries/:id', requireAuth, renderEntryDetail);
router.get('/entries/:id/edit', requireAuth, renderEditEntry);
router.get('/settings', requireAuth, renderSettings);
router.get('/notifications', requireAuth, renderNotifications);

router.get('/workspaces/:id', requireAuth, renderWorkspace);

module.exports = router;
