const mongoose = require('mongoose');

const workspaceSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    heroImage: {
        type: String, // Cloudinary URL
        default: ''
    },
    color: {
        type: String,
        default: '#f59e0b' // Default oxide amber
    },
    isDefault: {
        type: Boolean,
        default: false
    }
}, { 
    timestamps: true 
});

// Index for fast lookup per student
workspaceSchema.index({ student: 1, createdAt: -1 });

module.exports = mongoose.model('Workspace', workspaceSchema);
