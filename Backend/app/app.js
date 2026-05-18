const express = require('express');
const path = require('path');
const cors = require('cors');
const cookies = require('cookie-parser');
const compression = require('compression');
const helmet = require('helmet');
const engine = require('ejs-mate');
const errorHandler = require('../middlewares/error.middleware');
const studentRoutes = require('../routes/student.routes');
const journalRoutes = require('../routes/journal.routes');
const workspaceRoutes = require('../routes/workspace.routes');
const healthRoutes = require('../routes/health.routes');
const viewRoutes = require('../routes/view.routes');

const app = express();

// ── View Engine ──
app.engine('ejs', engine);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// ── Static Files ──
app.use(express.static(path.join(__dirname, '../public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    etag: true,
    lastModified: true
}));

// ── Security & Performance ──
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "blob:"],
            connectSrc: ["'self'", "https://api.cloudinary.com"],
        }
    }
}));
app.use(compression());

// ── Request Parsing ──
app.use(express.json({ limit: '500kb' }));
app.use(express.urlencoded({ extended: true, limit: '500kb' }));
app.use(cookies());

// ── CORS — for API routes (external clients) ──
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5000',
    credentials: true,
}));

// ── Routes ──
// View routes (EJS pages) — BEFORE API routes
app.use('/api/students', studentRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/health', healthRoutes);

// View routes (EJS pages)
app.use('/', viewRoutes);

// ── Global Error Handler ──
app.use(errorHandler);

module.exports = app;
