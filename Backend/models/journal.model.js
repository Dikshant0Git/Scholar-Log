const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');

const journalSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        // Transparent Encryption
        set: encrypt,
        get: decrypt
    },
    duration: {
        type: Number, // duration in minutes
        required: true
    },
    notificationCleared: {
        type: Boolean,
        default: false
    },
    difficulty: {
        type: String,
        enum: ['low', 'medium', 'high', 'Easy', 'Medium', 'Hard'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['pending', 'in-progress', 'completed'],
        default: 'pending'
    },
    category: {
        type: String,
        enum: ['General', 'Lecture', 'Lab', 'Project', 'Research', 'Exam Prep'],
        default: 'General'
    },
    workspace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace'
    },
    attachments: [{
        url: String,
        public_id: String,
        resource_type: { type: String, enum: ['image', 'video', 'raw'], default: 'image' }
    }]
}, { 
    timestamps: true,
    // Ensure getters run when converting to JSON/Object for the frontend
    toJSON: { getters: true },
    toObject: { getters: true }
});

// Fast lookup for per-student queries sorted by date
journalSchema.index({ student: 1, createdAt: -1 });
// Filtered queries by difficulty
journalSchema.index({ student: 1, difficulty: 1 });
// Filtered queries by status
journalSchema.index({ student: 1, status: 1 });
// Filtered queries by category
journalSchema.index({ student: 1, category: 1 });
// Compound index for optimized partial title search
journalSchema.index({ student: 1, title: 1 });
// Full-text search on titles (fallback)
journalSchema.index({ title: 'text' });

module.exports = mongoose.model('Journal', journalSchema);
