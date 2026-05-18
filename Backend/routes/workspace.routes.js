const express = require('express');
const router = express.Router();
const { 
    createWorkspace, 
    getWorkspaces, 
    getWorkspaceDetails, 
    updateWorkspace, 
    deleteWorkspace 
} = require('../controllers/workspace.controller');
const { protectRoute } = require('../middlewares/auth.middleware');

router.use(protectRoute);

router.route('/')
    .get(getWorkspaces)
    .post(createWorkspace);

router.route('/:id')
    .get(getWorkspaceDetails)
    .patch(updateWorkspace)
    .delete(deleteWorkspace);

module.exports = router;
