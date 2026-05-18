require('dotenv').config();
const cluster = require('cluster');
const os = require('os');
const connectDB = require('./config/db');
const app = require('./app/app');

const PORT = process.env.PORT || 5000;
const WORKERS = process.env.WEB_CONCURRENCY || os.cpus().length;

// Clustering for multi-core load balancing (disable on Render with ENABLE_CLUSTERING=false)
if (process.env.ENABLE_CLUSTERING === 'true' && cluster.isPrimary) {
    console.log(`Primary process ${process.pid} spawning ${WORKERS} workers`);
    for (let i = 0; i < WORKERS; i++) {
        cluster.fork();
    }
    cluster.on('exit', (worker) => {
        console.log(`Worker ${worker.process.pid} died, restarting...`);
        cluster.fork();
    });
} else {
    connectDB();
    app.listen(PORT, () => {
        console.log(`Worker ${process.pid} running on port ${PORT}`);
    });
}