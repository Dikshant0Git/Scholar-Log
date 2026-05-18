const asyncHandler = require('../utils/asyncHandler');
const Journal = require('../models/journal.model');
const cacheService = require('../services/cache.service');

/**
 * Render the analytics dashboard with server-side data
 */
const renderDashboard = asyncHandler(async (req, res) => {
    const studentId = req.user._id;

    // Check cache first
    let stats = await cacheService.getDashboardCache(studentId);

    if (!stats) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const [result] = await Journal.aggregate([
            { $match: { student: studentId } },
            { $facet: {
                totals: [
                    { $group: { _id: null, totalEntries: { $sum: 1 }, totalMinutes: { $sum: '$duration' } } }
                ],
                weeklySummary: [
                    { $match: { createdAt: { $gte: sevenDaysAgo } } },
                    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, duration: { $sum: '$duration' } } },
                    { $sort: { _id: 1 } }
                ],
                productivity: [
                    { $group: { _id: '$difficulty', count: { $sum: 1 } } }
                ],
                statusBreakdown: [
                    { $group: { _id: '$status', count: { $sum: 1 } } }
                ],
                recentTopics: [
                    { $sort: { createdAt: -1 } },
                    { $limit: 5 },
                    { $project: { title: 1, createdAt: 1, status: 1, duration: 1, difficulty: 1 } }
                ],
                streakDates: [
                    { $sort: { createdAt: -1 } },
                    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } } },
                    { $sort: { _id: -1 } },
                    { $limit: 60 }
                ]
            }}
        ]);

        const totalEntries = result.totals[0]?.totalEntries || 0;
        const totalHours = ((result.totals[0]?.totalMinutes || 0) / 60).toFixed(1);

        const uniqueDates = result.streakDates.map(d => d._id);
        let streak = 0;
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        if (uniqueDates.length > 0 && (uniqueDates[0] === today || uniqueDates[0] === yesterday)) {
            streak = 1;
            for (let i = 0; i < uniqueDates.length - 1; i++) {
                const current = new Date(uniqueDates[i]);
                const next = new Date(uniqueDates[i + 1]);
                const diff = (current - next) / (1000 * 60 * 60 * 24);
                if (diff === 1) { streak++; } else { break; }
            }
        }

        // Calculate this week's hours
        const thisWeekMinutes = result.weeklySummary.reduce((sum, d) => sum + d.duration, 0);
        const thisWeekHours = (thisWeekMinutes / 60).toFixed(1);

        stats = {
            totalEntries,
            totalHours,
            thisWeekHours,
            weeklySummary: result.weeklySummary,
            productivity: result.productivity,
            statusBreakdown: result.statusBreakdown,
            recentTopics: result.recentTopics,
            streak
        };

        await cacheService.setDashboardCache(studentId, stats);
    }

    // Check for draft
    const draft = await cacheService.getDraft(studentId);

    res.render('dashboard', {
        pageTitle: 'Dashboard',
        activePage: 'dashboard',
        stats,
        draft: draft || null,
        user: req.user
    });
});

/**
 * Render entries list with search/filter/pagination
 */
const renderEntries = asyncHandler(async (req, res) => {
    const { topic, difficulty, status, page = 1, limit = 20 } = req.query;
    const query = { student: req.user._id };

    if (topic) query.title = { $regex: topic, $options: 'i' };
    if (difficulty) query.difficulty = difficulty;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [entries, total] = await Promise.all([
        Journal.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
        Journal.countDocuments(query)
    ]);

    res.render('entries/index', {
        pageTitle: 'Entries Registry',
        activePage: 'entries',
        entries,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        },
        filters: { topic: topic || '', difficulty: difficulty || '', status: status || '' },
        workspaces: res.locals.workspaces
    });
});

/**
 * Render Workspace Details
 */
const renderWorkspace = asyncHandler(async (req, res) => {
    const Workspace = require('../models/workspace.model');
    const Journal = require('../models/journal.model');

    const workspace = await Workspace.findOne({
        _id: req.params.id,
        student: req.user._id
    });

    if (!workspace) {
        return res.redirect('/dashboard');
    }

    const entries = await Journal.find({ workspace: workspace._id })
        .sort({ createdAt: -1 });

    res.render('workspaces/show', {
        pageTitle: workspace.name,
        activePage: `workspace-${workspace._id}`,
        workspace,
        entries
    });
});

/**
 * Render single entry detail
 */
const renderEntryDetail = asyncHandler(async (req, res) => {
    const entry = await Journal.findOne({ _id: req.params.id, student: req.user._id });

    if (!entry) {
        return res.redirect('/entries');
    }

    res.render('entries/show', {
        pageTitle: entry.title,
        activePage: 'entries',
        entry,
        user: req.user
    });
});

/**
 * Render new entry form (with optional draft recovery)
 */
const renderNewEntry = asyncHandler(async (req, res) => {
    const draft = await cacheService.getDraft(req.user._id);
    const selectedWorkspace = req.query.workspace || null;

    res.render('entries/new', {
        pageTitle: 'New Entry',
        activePage: 'new-entry',
        draft: draft || null,
        selectedWorkspace,
        user: req.user
    });
});

/**
 * Render settings page
 */
const renderSettings = asyncHandler(async (req, res) => {
    res.render('settings', {
        pageTitle: 'Settings',
        activePage: 'settings',
        user: req.user
    });
});

/**
 * Render edit entry page pre-filled with data
 */
const renderEditEntry = asyncHandler(async (req, res) => {
    const entry = await Journal.findOne({ _id: req.params.id, student: req.user._id });

    if (!entry) {
        return res.redirect('/entries');
    }

    res.render('entries/edit', {
        pageTitle: `Edit Entry: ${entry.title}`,
        activePage: 'entries',
        entry,
        workspaces: res.locals.workspaces || [],
        user: req.user
    });
});

/**
 * Render notifications page with tasks that have a timing duration
 */
const renderNotifications = asyncHandler(async (req, res) => {
    const studentId = req.user._id;

    // Fetch all journal entries with a timing duration for this student
    const entries = await Journal.find({
        student: studentId,
        duration: { $gt: 0 },
        notificationCleared: { $ne: true }
    }).sort({ createdAt: -1 });

    res.render('notifications', {
        pageTitle: 'Task Notifications',
        activePage: 'notifications',
        entries,
        user: req.user
    });
});

module.exports = {
    renderDashboard,
    renderEntries,
    renderEntryDetail,
    renderNewEntry,
    renderSettings,
    renderWorkspace,
    renderEditEntry,
    renderNotifications
};
