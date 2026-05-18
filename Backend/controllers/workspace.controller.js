const Workspace = require('../models/workspace.model');
const Journal = require('../models/journal.model');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Create a new workspace
// @route   POST /api/workspaces
const createWorkspace = asyncHandler(async (req, res) => {
    const { name, description, heroImage, color } = req.body;

    const workspace = await Workspace.create({
        student: req.user._id,
        name,
        description,
        heroImage,
        color
    });

    res.status(201).json({
        success: true,
        workspace
    });
});

// @desc    Get all workspaces for student
// @route   GET /api/workspaces
const getWorkspaces = asyncHandler(async (req, res) => {
    const workspaces = await Workspace.find({ student: req.user._id })
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        count: workspaces.length,
        workspaces
    });
});

// @desc    Get workspace details and entries
// @route   GET /api/workspaces/:id
const getWorkspaceDetails = asyncHandler(async (req, res) => {
    const workspace = await Workspace.findOne({
        _id: req.params.id,
        student: req.user._id
    });

    if (!workspace) {
        return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    const entries = await Journal.find({ workspace: workspace._id })
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        workspace,
        entries
    });
});

// @desc    Update workspace
// @route   PATCH /api/workspaces/:id
const updateWorkspace = asyncHandler(async (req, res) => {
    const { name, description, heroImage, color } = req.body;

    let workspace = await Workspace.findOne({
        _id: req.params.id,
        student: req.user._id
    });

    if (!workspace) {
        return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    workspace.name = name || workspace.name;
    workspace.description = description !== undefined ? description : workspace.description;
    workspace.heroImage = heroImage !== undefined ? heroImage : workspace.heroImage;
    workspace.color = color || workspace.color;

    await workspace.save();

    res.status(200).json({
        success: true,
        workspace
    });
});

// @desc    Delete workspace (doesn't delete journals, just unassigns them)
// @route   DELETE /api/workspaces/:id
const deleteWorkspace = asyncHandler(async (req, res) => {
    const workspace = await Workspace.findOne({
        _id: req.params.id,
        student: req.user._id
    });

    if (!workspace) {
        return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    // Unassign entries
    await Journal.updateMany(
        { workspace: workspace._id },
        { $unset: { workspace: "" } }
    );

    await workspace.deleteOne();

    res.status(200).json({
        success: true,
        message: 'Workspace removed and entries unassigned'
    });
});

module.exports = {
    createWorkspace,
    getWorkspaces,
    getWorkspaceDetails,
    updateWorkspace,
    deleteWorkspace
};
