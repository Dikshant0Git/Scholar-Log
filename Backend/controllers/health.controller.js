const mongoose = require('mongoose');
const os = require('os');
const { transporter } = require('../config/email.config');
const cloudinary = require('../config/cloudinary.config');
const redis = require('../config/redis.config');
const cacheService = require('../services/cache.service');

const SERVER_START = Date.now();

// Cache external service check results for 60 seconds
// Prevents expensive network calls on every health request
const serviceCache = new Map();
const SERVICE_CACHE_TTL = 60 * 1000;

async function cachedCheck(key, fn) {
    const cached = serviceCache.get(key);
    if (cached && Date.now() - cached.timestamp < SERVICE_CACHE_TTL) {
        return { ...cached.result, cached: true, cachedAgoSecs: Math.floor((Date.now() - cached.timestamp) / 1000) };
    }
    const result = await fn();
    serviceCache.set(key, { result, timestamp: Date.now() });
    return { ...result, cached: false, cachedAgoSecs: 0 };
}

async function checkMongo() {
    const start = Date.now();
    try {
        const state = mongoose.connection.readyState;
        if (state !== 1) return { status: 'DOWN', latencyMs: null, detail: 'Not connected' };
        await mongoose.connection.db.admin().ping();
        return { status: 'UP', latencyMs: Date.now() - start, detail: 'Connected & responsive' };
    } catch (e) {
        return { status: 'DOWN', latencyMs: null, detail: e.message };
    }
}

async function checkRedis() {
    const start = Date.now();
    try {
        const pong = await redis.ping();
        const keys = await redis.dbsize();
        return { status: pong === 'PONG' ? 'UP' : 'DOWN', latencyMs: Date.now() - start, detail: `Upstash · ${keys} keys stored` };
    } catch (e) {
        return { status: 'DOWN', latencyMs: null, detail: e.message };
    }
}

async function checkEmailService() {
    const start = Date.now();
    try {
        await transporter.verify();
        return { status: 'UP', latencyMs: Date.now() - start, detail: 'Mailgun API reachable' };
    } catch (e) {
        return { status: 'DOWN', latencyMs: null, detail: e.message };
    }
}

async function checkCloudinary() {
    const start = Date.now();
    try {
        await cloudinary.api.ping();
        return { status: 'UP', latencyMs: Date.now() - start, detail: 'API reachable' };
    } catch (e) {
        return { status: 'DOWN', latencyMs: null, detail: e.message };
    }
}

function getMemoryInfo() {
    const used = process.memoryUsage();
    const total = os.totalmem();
    const free = os.freemem();
    return {
        heapUsedMB: (used.heapUsed / 1024 / 1024).toFixed(1),
        heapTotalMB: (used.heapTotal / 1024 / 1024).toFixed(1),
        rssMB: (used.rss / 1024 / 1024).toFixed(1),
        externalMB: (used.external / 1024 / 1024).toFixed(1),
        systemTotalMB: (total / 1024 / 1024).toFixed(0),
        systemFreeMB: (free / 1024 / 1024).toFixed(0),
        systemUsedPct: (((total - free) / total) * 100).toFixed(1),
        heapUsedPct: ((used.heapUsed / used.heapTotal) * 100).toFixed(1),
    };
}

function formatUptime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
    if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
}

function buildHTML(data) {
    const { overall, checks, memory, system, responseTimeMs, generatedAt } = data;
    const overallColor = overall === 'HEALTHY' ? '#22c55e' : '#ef4444';
    const overallBg = overall === 'HEALTHY' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';

    function statusBadge(s) {
        const color = s === 'UP' ? '#22c55e' : '#ef4444';
        const bg = s === 'UP' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)';
        return `<span style="background:${bg};color:${color};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">${s}</span>`;
    }

    function latencyBadge(ms, isCached, agoSecs) {
        if (ms === null) return `<span style="color:#ef4444;font-size:13px">—</span>`;
        const color = ms < 100 ? '#22c55e' : ms < 500 ? '#f59e0b' : '#ef4444';
        const cacheTag = isCached
            ? `<span style="margin-left:6px;color:#475569;font-size:11px">(cached ${agoSecs}s ago)</span>`
            : `<span style="margin-left:6px;color:#475569;font-size:11px">(live)</span>`;
        return `<span style="color:${color};font-size:13px;font-weight:600">${ms}ms</span>${cacheTag}`;
    }

    function progressBar(pct, color) {
        const col = color || (pct < 60 ? '#22c55e' : pct < 80 ? '#f59e0b' : '#ef4444');
        return `
        <div style="background:rgba(255,255,255,0.06);border-radius:6px;height:7px;width:100%;margin-top:8px;overflow:hidden">
            <div style="background:${col};width:${Math.min(pct, 100)}%;height:100%;border-radius:6px"></div>
        </div>`;
    }

    const checkRows = Object.entries(checks).map(([name, c]) => `
        <tr>
            <td style="padding:14px 16px;color:#e2e8f0;font-weight:500">${name}</td>
            <td style="padding:14px 16px">${statusBadge(c.status)}</td>
            <td style="padding:14px 16px">${latencyBadge(c.latencyMs, c.cached, c.cachedAgoSecs)}</td>
            <td style="padding:14px 16px;color:#94a3b8;font-size:13px">${c.detail}</td>
        </tr>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Student Journal — Health</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',sans-serif;background:#080d1a;color:#e2e8f0;min-height:100vh;padding:32px 20px}
  .container{max-width:980px;margin:0 auto}
  .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;flex-wrap:wrap;gap:16px}
  .logo{font-size:22px;font-weight:700;background:linear-gradient(135deg,#6366f1,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .badge{padding:9px 22px;border-radius:28px;font-weight:700;font-size:14px;border:1.5px solid;letter-spacing:0.5px;display:flex;align-items:center;gap:8px}
  .card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:24px;margin-bottom:20px}
  .card-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#6366f1;margin-bottom:20px}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;padding:10px 16px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#475569;border-bottom:1px solid rgba(255,255,255,0.05)}
  tr:not(:last-child) td{border-bottom:1px solid rgba(255,255,255,0.04)}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px}
  .metric{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px}
  .metric-label{font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
  .metric-value{font-size:24px;font-weight:700;color:#f1f5f9;line-height:1.2}
  .metric-unit{font-size:13px;font-weight:400;color:#64748b}
  .metric-sub{font-size:12px;color:#475569;margin-top:5px}
  .footer{color:#334155;font-size:12px;text-align:center;margin-top:28px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.05)}
  .note{background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:10px;padding:12px 16px;font-size:12px;color:#818cf8;margin-bottom:20px}
  .dot{width:9px;height:9px;border-radius:50%;display:inline-block;animation:blink 2s infinite}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div>
      <div class="logo">📘 Student Journal</div>
      <div style="color:#475569;font-size:13px;margin-top:4px">System Health Dashboard</div>
    </div>
    <div class="badge" style="background:${overallBg};color:${overallColor};border-color:${overallColor}50">
      <span class="dot" style="background:${overallColor}"></span>${overall}
    </div>
  </div>

  <div class="note">
    ℹ️ External service checks (Email API, Cloudinary) are <strong>cached for 60 seconds</strong> to avoid unnecessary network calls on every health ping. MongoDB is always checked live.
  </div>

  <div class="card">
    <div class="card-title">Service Status</div>
    <table>
      <thead>
        <tr><th>Service</th><th>Status</th><th>Latency</th><th>Detail</th></tr>
      </thead>
      <tbody>${checkRows}</tbody>
    </table>
  </div>

  <div class="card">
    <div class="card-title">Process Memory (Node.js)</div>
    <div class="grid">
      <div class="metric">
        <div class="metric-label">Heap Used</div>
        <div class="metric-value">${memory.heapUsedMB}<span class="metric-unit"> MB</span></div>
        <div class="metric-sub">of ${memory.heapTotalMB} MB heap (${memory.heapUsedPct}%)</div>
        ${progressBar(parseFloat(memory.heapUsedPct))}
      </div>
      <div class="metric">
        <div class="metric-label">RSS (Process Total)</div>
        <div class="metric-value">${memory.rssMB}<span class="metric-unit"> MB</span></div>
        <div class="metric-sub">incl. native addons &amp; buffers</div>
      </div>
      <div class="metric">
        <div class="metric-label">External (Buffers)</div>
        <div class="metric-value">${memory.externalMB}<span class="metric-unit"> MB</span></div>
        <div class="metric-sub">C++ objects linked to V8</div>
      </div>
      <div class="metric">
        <div class="metric-label">System RAM Used</div>
        <div class="metric-value">${memory.systemUsedPct}<span class="metric-unit">%</span></div>
        <div class="metric-sub">${memory.systemFreeMB} MB free of ${memory.systemTotalMB} MB total</div>
        ${progressBar(parseFloat(memory.systemUsedPct))}
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">Runtime Info</div>
    <div class="grid">
      <div class="metric">
        <div class="metric-label">Server Uptime</div>
        <div class="metric-value" style="font-size:20px">${system.uptime}</div>
        <div class="metric-sub">Since process start</div>
      </div>
      <div class="metric">
        <div class="metric-label">Node.js Version</div>
        <div class="metric-value" style="font-size:20px">${system.nodeVersion}</div>
        <div class="metric-sub">${system.platform} · ${system.arch}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Environment</div>
        <div class="metric-value" style="font-size:20px">${system.env}</div>
        <div class="metric-sub">${system.cpus} CPU core${system.cpus > 1 ? 's' : ''} available</div>
      </div>
      <div class="metric">
        <div class="metric-label">Cache Entries</div>
        <div class="metric-value" style="font-size:20px">${system.cacheKeys}</div>
        <div class="metric-sub">Active dashboard cache keys</div>
      </div>
      <div class="metric">
        <div class="metric-label">Health Check Time</div>
        <div class="metric-value" style="font-size:20px">${responseTimeMs}<span class="metric-unit"> ms</span></div>
        <div class="metric-sub">This page response time</div>
      </div>
    </div>
  </div>

  <div class="footer">
    Generated ${generatedAt} · Auto-refreshes every 30s · 
    <a href="/health?format=json" style="color:#6366f1;text-decoration:none">JSON API</a>
  </div>
</div>
<script>setTimeout(()=>location.reload(),30000)</script>
</body>
</html>`;
}

const getHealth = async (req, res) => {
    const format = req.query.format;
    const start = Date.now();

    // MongoDB is always live — it's local and fast (~1ms)
    // Email API and Cloudinary are cached for 60s — they involve external network calls
    const [mongo, redisCheck, emailService, cloud] = await Promise.all([
        checkMongo(),
        checkRedis(),
        cachedCheck('emailService', checkEmailService),
        cachedCheck('cloudinary', checkCloudinary),
    ]);

    const checks = {
        'MongoDB Atlas': mongo,
        'Redis (Upstash)': redisCheck,
        'Mailgun API': emailService,
        'Cloudinary CDN': cloud,
    };

    const allUp = Object.values(checks).every(c => c.status === 'UP');
    const overall = allUp ? 'HEALTHY' : 'DEGRADED';

    const memory = getMemoryInfo();
    const cacheStats = cacheService.getStats();

    const system = {
        uptime: formatUptime(Date.now() - SERVER_START),
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        env: process.env.NODE_ENV || 'development',
        cpus: os.cpus().length,
        cacheKeys: cacheStats?.keys ?? '—',
    };

    const responseTimeMs = Date.now() - start;
    const generatedAt = new Date().toISOString();

    if (format === 'json') {
        return res.status(allUp ? 200 : 503).json({
            overall, checks, memory, system, responseTimeMs, generatedAt,
        });
    }

    res.status(allUp ? 200 : 503).send(buildHTML({
        overall, checks, memory, system, responseTimeMs, generatedAt,
    }));
};

module.exports = { getHealth };
