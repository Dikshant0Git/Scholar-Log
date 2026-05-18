const asyncHandler = require('../utils/asyncHandler');
const Journal = require('../models/journal.model');
const cacheService = require('../services/cache.service');
const { isValidObjectId } = require('../utils/validators');

const VALID_STATUSES = ['pending', 'in-progress', 'completed'];

const createEntry = asyncHandler(async (req, res) => {
    const { title, description, duration, difficulty, status, category, attachments, workspace } = req.body;

    if (!title || !duration) {
        return res.status(400).json({ success: false, message: 'Title and duration are required' });
    }

    if (typeof duration !== 'number' || duration <= 0) {
        return res.status(400).json({ success: false, message: 'Duration must be a positive number' });
    }

    if (status && !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const entry = await Journal.create({
        student: req.user._id,
        title,
        description,
        duration,
        difficulty,
        status: status || 'pending',
        category: category || 'General',
        attachments: attachments || [],
        workspace: workspace || null
    });
    
    // Clear the draft from Redis since entry is now official
    cacheService.clearDraft(req.user._id);
    
    // Non-blocking invalidation
    cacheService.invalidateDashboard(req.user._id);
    res.status(201).json({ success: true, entry });
});

const saveDraft = asyncHandler(async (req, res) => {
    // Draft can be partial, so we don't validate strictly
    await cacheService.setDraft(req.user._id, req.body);
    res.status(200).json({ success: true, message: 'Draft saved' });
});

const getDraft = asyncHandler(async (req, res) => {
    const draft = await cacheService.getDraft(req.user._id);
    res.status(200).json({ success: true, draft: draft || {} });
});

const clearDraft = asyncHandler(async (req, res) => {
    await cacheService.clearDraft(req.user._id);
    res.status(200).json({ success: true, message: 'Draft cleared' });
});

const getEntries = asyncHandler(async (req, res) => {
    const { topic, difficulty, status, category, workspace, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = { student: req.user._id };

    if (topic) {
        query.title = { $regex: topic, $options: 'i' };
    }

    if (difficulty) {
        query.difficulty = difficulty;
    }

    if (status) {
        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({ success: false, message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
        }
        query.status = status;
    }
    
    if (category) {
        query.category = category;
    }

    if (workspace) {
        query.workspace = workspace;
    }

    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [entries, total] = await Promise.all([
        Journal.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
        Journal.countDocuments(query)
    ]);

    res.status(200).json({ 
        success: true, 
        entries,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

const getEntryById = asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid entry ID' });
    }
    const entry = await Journal.findOne({ _id: req.params.id, student: req.user._id });
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    res.status(200).json({ success: true, entry });
});

const updateEntry = asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid entry ID' });
    }

    if (req.body.status && !VALID_STATUSES.includes(req.body.status)) {
        return res.status(400).json({ success: false, message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    if (req.body.workspace === "") {
        req.body.workspace = null;
    }

    const entry = await Journal.findOneAndUpdate(
        { _id: req.params.id, student: req.user._id },
        req.body,
        { new: true, runValidators: true }
    );
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    cacheService.invalidateDashboard(req.user._id);
    res.status(200).json({ success: true, entry });
});

const updateEntryStatus = asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid entry ID' });
    }

    const { status } = req.body;
    if (!status || !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const entry = await Journal.findOneAndUpdate(
        { _id: req.params.id, student: req.user._id },
        { status },
        { new: true }
    );
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    cacheService.invalidateDashboard(req.user._id);
    res.status(200).json({ success: true, entry });
});

const deleteEntry = asyncHandler(async (req, res) => {
    console.log(`[DELETE] Request to delete entry ${req.params.id} by user ${req.user._id}`);
    
    if (!isValidObjectId(req.params.id)) {
        console.warn(`[DELETE] Invalid ObjectId passed: ${req.params.id}`);
        return res.status(400).json({ success: false, message: 'Invalid entry ID' });
    }
    
    const entry = await Journal.findOneAndDelete({ _id: req.params.id, student: req.user._id });
    
    if (!entry) {
        console.warn(`[DELETE] Entry not found or unauthorized for entry ${req.params.id} and user ${req.user._id}`);
        return res.status(404).json({ success: false, message: 'Entry not found or unauthorized' });
    }
    
    console.log(`[DELETE] Successfully deleted entry ${req.params.id}`);
    cacheService.invalidateDashboard(req.user._id);
    res.status(200).json({ success: true, message: 'Entry deleted' });
});

const getSuggestions = asyncHandler(async (req, res) => {
    const { q } = req.query;
    if (!q || q.length < 2) return res.status(200).json({ success: true, suggestions: [] });

    const suggestions = await Journal.find({
        student: req.user._id,
        title: { $regex: q, $options: 'i' }
    })
    .limit(8)
    .select('title')
    .lean();

    // Return unique titles
    const uniqueTitles = [...new Set(suggestions.map(s => s.title))];
    res.status(200).json({ success: true, suggestions: uniqueTitles });
});

const getDashboardStats = asyncHandler(async (req, res) => {
    const studentId = req.user._id;

    // Check Redis cache first
    const cached = await cacheService.getDashboardCache(studentId);
    if (cached) {
        return res.status(200).json({ success: true, stats: cached, cached: true });
    }

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
                { $project: { title: 1, createdAt: 1, status: 1 } }
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
    const totalHours = ((result.totals[0]?.totalMinutes || 0) / 60).toFixed(2);

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

    const stats = {
        totalEntries,
        totalHours,
        weeklySummary: result.weeklySummary,
        productivity: result.productivity,
        statusBreakdown: result.statusBreakdown,
        recentTopics: result.recentTopics,
        streak
    };

    await cacheService.setDashboardCache(studentId, stats);
    res.status(200).json({ success: true, stats });
});

const clearNotification = asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid entry ID' });
    }

    const entry = await Journal.findOneAndUpdate(
        { _id: req.params.id, student: req.user._id },
        { notificationCleared: true },
        { new: true }
    );

    if (!entry) {
        return res.status(404).json({ success: false, message: 'Entry not found' });
    }

    res.status(200).json({ success: true, message: 'Notification cleared' });
});

const clearAllNotifications = asyncHandler(async (req, res) => {
    const studentId = req.user._id;

    await Journal.updateMany(
        { student: studentId, duration: { $gt: 0 }, notificationCleared: { $ne: true } },
        { notificationCleared: true }
    );

    res.status(200).json({ success: true, message: 'All notifications cleared' });
});

module.exports = { 
    createEntry, 
    getEntries, 
    getEntryById, 
    updateEntry, 
    updateEntryStatus, 
    deleteEntry, 
    getDashboardStats,
    getSuggestions,
    saveDraft,
    getDraft,
    clearDraft,
    clearNotification,
    clearAllNotifications
};
