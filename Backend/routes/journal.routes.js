const express = require('express');
const { 
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
} = require('../controllers/journal.controller');
const { protectRoute } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protectRoute);

router.get('/dashboard', getDashboardStats);
router.get('/suggestions', getSuggestions);

// Draft Management
router.get('/draft', getDraft);
router.patch('/draft', saveDraft);
router.delete('/draft', clearDraft);

// Notifications dismissal (must be before :id routes)
router.patch('/clear-all-notifications', clearAllNotifications);
router.patch('/:id/clear-notification', clearNotification);

// Journal Entries
router.post('/', createEntry);
router.get('/', getEntries);
router.get('/:id', getEntryById);
router.put('/:id', updateEntry);
router.patch('/:id/status', updateEntryStatus);
router.delete('/:id', deleteEntry);

module.exports = router;
