const redis = require('../config/redis.config');

const DASHBOARD_TTL = 300; 

const cacheService = {
    async getDashboardCache(studentId) {
        try {
            const data = await redis.get(`dashboard:${studentId}`);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    },

    async setDashboardCache(studentId, data) {
        try {
            await redis.set(`dashboard:${studentId}`, JSON.stringify(data), 'EX', DASHBOARD_TTL);
        } catch {}
    },

    async invalidateDashboard(studentId) {
        try {
            await redis.del(`dashboard:${studentId}`);
        } catch {}
    },

    async setDraft(studentId, data) {
        try {
            await redis.set(`draft:${studentId}`, JSON.stringify(data), 'EX', 86400); // 24h
        } catch {}
    },

    async getDraft(studentId) {
        try {
            const data = await redis.get(`draft:${studentId}`);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    },

    async clearDraft(studentId) {
        try {
            await redis.del(`draft:${studentId}`);
        } catch {}
    },

    async getStats() {
        try {
            const info = await redis.info('stats');
            const keys = await redis.dbsize();
            const hitMatch = info.match(/keyspace_hits:(\d+)/);
            const missMatch = info.match(/keyspace_misses:(\d+)/);
            return {
                keys,
                hits: hitMatch ? parseInt(hitMatch[1]) : 0,
                misses: missMatch ? parseInt(missMatch[1]) : 0,
            };
        } catch {
            return { keys: '—', hits: 0, misses: 0 };
        }
    }
};

module.exports = cacheService;
