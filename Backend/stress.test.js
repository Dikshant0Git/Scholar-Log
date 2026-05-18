require('dotenv').config();
const http = require('http');
const autocannon = require('autocannon');

const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;
const TEST_EMAIL = `stresstest_${Date.now()}@test.com`;
const TEST_PASS = 'StressTest123';

// ─── Helpers ────────────────────────────────────────────────────────────────

function request(method, path, body, cookie) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const options = {
            hostname: 'localhost',
            port: process.env.PORT || 5000,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(payload && { 'Content-Length': Buffer.byteLength(payload) }),
                ...(cookie && { Cookie: cookie }),
            },
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const cookies = res.headers['set-cookie'] || [];
                    resolve({ status: res.statusCode, body: JSON.parse(data), cookies });
                } catch {
                    resolve({ status: res.statusCode, body: data, cookies: [] });
                }
            });
        });

        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

function extractCookie(cookieArr) {
    return cookieArr
        .map(c => c.split(';')[0])
        .join('; ');
}

function printHeader(title) {
    console.log('\n' + '═'.repeat(60));
    console.log(`  ${title}`);
    console.log('═'.repeat(60));
}

function printResult(instance) {
    const r = instance;
    const latency = r.latency;
    const requests = r.requests;
    const errors = r.errors;
    const throughput = r.throughput;

    console.log(`  Requests/sec  : ${requests.mean.toFixed(0)} avg  |  ${requests.max} peak`);
    console.log(`  Latency avg   : ${latency.mean.toFixed(1)}ms`);
    console.log(`  Latency p99   : ${latency.p99}ms`);
    console.log(`  Latency p99.9 : ${latency.p999}ms`);
    console.log(`  Throughput    : ${(throughput.mean / 1024).toFixed(1)} KB/s`);
    console.log(`  Total Req     : ${r.requests.total}`);
    console.log(`  Errors        : ${errors} (${((errors / r.requests.total) * 100).toFixed(2)}%)`);
    console.log(`  Timeouts      : ${r.timeouts}`);
    console.log(`  Non-2xx       : ${r['2xx'] ? r.requests.total - r['2xx'] : 'N/A'}`);
    
    if (latency.p99 < 100) console.log('  Status        : ✅ EXCELLENT (p99 < 100ms)');
    else if (latency.p99 < 300) console.log('  Status        : ✅ GOOD (p99 < 300ms)');
    else if (latency.p99 < 1000) console.log('  Status        : ⚠️  ACCEPTABLE (p99 < 1s)');
    else console.log('  Status        : ❌ POOR (p99 > 1s)');
}

function runBenchmark(config) {
    return new Promise((resolve) => {
        const instance = autocannon(config, (err, result) => {
            if (err) { console.error(err); resolve(null); return; }
            resolve(result);
        });
        autocannon.track(instance, { renderProgressBar: true });
    });
}

// ─── Main Test Runner ────────────────────────────────────────────────────────

async function main() {
    printHeader('STUDENT JOURNAL — STRESS TEST SUITE');
    console.log(`  Target  : ${BASE_URL}`);
    console.log(`  Time    : ${new Date().toISOString()}`);

    // ── Step 1: Setup test user ──────────────────────────────────────────────
    printHeader('PHASE 0 — Test User Setup');

    process.stdout.write('  Registering test user... ');
    const reg = await request('POST', '/api/students/register', {
        name: 'Stress Tester',
        email: TEST_EMAIL,
        mobile: '9876543210',
        password: TEST_PASS
    });
    
    if (reg.status !== 201) {
        console.log(`❌ FAILED (${reg.status}): ${reg.body.message}`);
        process.exit(1);
    }
    console.log('✅');

    // Manually verify (bypass OTP for test — directly update in DB)
    process.stdout.write('  Bypassing OTP verification via API... ');
    // We'll hit verify with incorrect OTP to confirm server handles it, then stop
    // Instead: start server tests on public endpoints only for now
    console.log('⚠️  (Skipping — testing public + login endpoints)');

    // ── Test 1: Public health baseline ──────────────────────────────────────
    printHeader('TEST 1 — Baseline (Public Register Endpoint, 100 users, 10s)');
    console.log('  Simulates: 100 concurrent users hitting registration\n');

    const t1 = await runBenchmark({
        url: `${BASE_URL}/api/students/register`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Load User',
            email: `load_${Date.now()}@test.com`,
            mobile: '9876543210',
            password: TEST_PASS
        }),
        connections: 100,
        duration: 10,
        title: 'Register (Public)',
    });
    printResult(t1);

    // ── Test 2: Login stress ─────────────────────────────────────────────────
    printHeader('TEST 2 — Login Endpoint (50 users, 10s)');
    console.log('  This is the HARDEST endpoint — bcrypt + DB lookup\n');

    const t2 = await runBenchmark({
        url: `${BASE_URL}/api/students/login`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASS }),
        connections: 50,
        duration: 10,
        title: 'Login (bcrypt)',
    });
    printResult(t2);

    // ── Step 2: Get auth cookie ──────────────────────────────────────────────
    // Verify email first
    printHeader('PHASE 2 — Authenticate Test User');
    
    // Get the OTP from DB (we need to get the student's OTP — use forgot-password trick to reset)
    process.stdout.write('  Requesting OTP via forgot-password... ');
    await request('POST', '/api/students/forgot-password', { email: TEST_EMAIL });
    console.log('✅');
    
    // Try login (account not verified, expect 403)
    const loginAttempt = await request('POST', '/api/students/login', {
        email: TEST_EMAIL,
        password: TEST_PASS
    });
    
    let authCookie = null;
    let journalId = null;

    if (loginAttempt.status === 200) {
        authCookie = extractCookie(loginAttempt.cookies);
        console.log('  Auth cookie acquired ✅');
    } else {
        console.log(`  ⚠️  Login status: ${loginAttempt.status} — ${loginAttempt.body.message}`);
        console.log('  Skipping authenticated endpoint tests (account not verified)');
    }

    if (authCookie) {
        // Create a test entry
        const entry = await request('POST', '/api/journal', {
            title: 'Stress Test Entry',
            description: 'Testing under load',
            duration: 60,
            difficulty: 'Medium',
            status: 'pending'
        }, authCookie);

        if (entry.status === 201) {
            journalId = entry.body.entry._id;
            console.log(`  Journal entry created: ${journalId} ✅`);
        }

        // ── Test 3: Get Entries (100 concurrent, 15s) ────────────────────────
        printHeader('TEST 3 — GET Journal Entries (100 users, 15s)');
        console.log('  Simulates: 100 students loading their journal list concurrently\n');

        const t3 = await runBenchmark({
            url: `${BASE_URL}/api/journal?page=1&limit=20`,
            method: 'GET',
            headers: { Cookie: authCookie },
            connections: 100,
            duration: 15,
            title: 'GET /api/journal',
        });
        printResult(t3);

        // ── Test 4: Dashboard (cold cache, 50 users, 10s) ────────────────────
        printHeader('TEST 4 — Dashboard (First Hit = Cold Cache, 50 users, 10s)');
        console.log('  After first request, subsequent ones are served from cache\n');

        const t4 = await runBenchmark({
            url: `${BASE_URL}/api/journal/dashboard`,
            method: 'GET',
            headers: { Cookie: authCookie },
            connections: 50,
            duration: 10,
            title: 'GET /api/journal/dashboard',
        });
        printResult(t4);

        // ── Test 5: Status update (PATCH, 200 users, 10s) ────────────────────
        if (journalId) {
            printHeader('TEST 5 — PATCH Status Toggle (200 users, 10s)');
            console.log('  Simulates rapid status updates from many users\n');

            const t5 = await runBenchmark({
                url: `${BASE_URL}/api/journal/${journalId}/status`,
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Cookie: authCookie },
                body: JSON.stringify({ status: 'completed' }),
                connections: 200,
                duration: 10,
                title: 'PATCH status toggle',
            });
            printResult(t5);
        }

        // ── Test 6: Search with filter (100 users, 10s) ──────────────────────
        printHeader('TEST 6 — Filtered Search (100 users, 10s)');
        console.log('  Exercises: $text index + status + difficulty filters\n');

        const t6 = await runBenchmark({
            url: `${BASE_URL}/api/journal?topic=Stress&status=pending&difficulty=Medium`,
            method: 'GET',
            headers: { Cookie: authCookie },
            connections: 100,
            duration: 10,
            title: 'Filtered Search',
        });
        printResult(t6);

        // ── Test 7: Spike test (500 users, 5s burst) ─────────────────────────
        printHeader('TEST 7 — SPIKE TEST (500 users, 5s burst)');
        console.log('  Simulates: sudden viral spike — can the server hold?\n');

        const t7 = await runBenchmark({
            url: `${BASE_URL}/api/journal`,
            method: 'GET',
            headers: { Cookie: authCookie },
            connections: 500,
            duration: 5,
            title: 'Spike 500 users',
        });
        printResult(t7);
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    printHeader('STRESS TEST COMPLETE');
    console.log('  Check results above for bottlenecks.\n');
    console.log('  Key things to watch:');
    console.log('  → Login p99 > 1s     = bcrypt bottleneck (expected, by design)');
    console.log('  → Dashboard p99 < 50ms after first hit = cache working');
    console.log('  → Spike errors > 1%  = connection pool too small');
    console.log('  → Timeouts > 0       = need horizontal scaling\n');

    process.exit(0);
}

main().catch(err => {
    console.error('Test runner failed:', err);
    process.exit(1);
});
