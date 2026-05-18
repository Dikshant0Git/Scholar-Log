const express = require('express');
const { getHealth } = require('../controllers/health.controller');

const router = express.Router();

// GET /health        → HTML dashboard (auto-refreshes every 30s)
// GET /health?format=json → JSON for AWS ALB / Render / uptime monitors
router.get('/', getHealth);

module.exports = router;
