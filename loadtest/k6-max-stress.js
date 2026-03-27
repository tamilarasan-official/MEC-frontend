import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ── Custom metrics ──────────────────────────────────────────────
const errorRate = new Rate('errors');
const serverErrors = new Counter('server_errors_5xx');
const clientErrors = new Counter('client_errors_4xx');
const timeouts = new Counter('timeouts');
const reqDuration = new Trend('req_duration_ms', true);

// ── Config ──────────────────────────────────────────────────────
const BASE = 'https://campusoneapi.madrascollege.ac.in/api/v1';
const API_KEY = '272183449088151d1938eca9e9de6cd2cb7a7001ad073cc050352117c1b52ca3';
const HEADERS = {
  'Content-Type': 'application/json',
  'X-App-Key': API_KEY,
};

// Shop IDs from the actual database
const SHOP_IDS = [
  '699b453a611371a58fd179ea',  // Madras Kitchen
  '699f26ed16a2a6b814f39b87',  // MEC Bites
  '69a2a28b4c205718de38f68f',  // Stationery
];

// ── Stress test profile ─────────────────────────────────────────
// Ramp aggressively to find the breaking point
export const options = {
  stages: [
    { duration: '10s', target: 100 },   // Warmup
    { duration: '15s', target: 300 },   // Ramp to 300
    { duration: '20s', target: 500 },   // Push to 500
    { duration: '15s', target: 750 },   // Spike to 750
    { duration: '20s', target: 1000 },  // EXTREME — 1000 concurrent
    { duration: '30s', target: 1000 },  // Sustain 1000 for 30s
    { duration: '10s', target: 500 },   // Drop to 500
    { duration: '10s', target: 0 },     // Cooldown
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'],   // 95% under 5s
    errors: ['rate<0.3'],                // <30% error rate
  },
  noConnectionReuse: false,
  userAgent: 'MEC-StressTest/2.0',
};

// ── Helpers ─────────────────────────────────────────────────────
function track(res) {
  reqDuration.add(res.timings.duration);
  if (res.status === 0) { timeouts.add(1); errorRate.add(true); }
  else if (res.status >= 500) { serverErrors.add(1); errorRate.add(true); }
  else if (res.status >= 400) { clientErrors.add(1); errorRate.add(false); }
  else { errorRate.add(false); }
}

function randomShop() {
  return SHOP_IDS[Math.floor(Math.random() * SHOP_IDS.length)];
}

function randomPhone() {
  return `+91${7000000000 + Math.floor(Math.random() * 2999999999)}`;
}

// ── Main VU function ────────────────────────────────────────────
export default function () {
  const roll = Math.random();

  if (roll < 0.30) {
    scenarioBrowseMenu();        // 30% — heaviest read path
  } else if (roll < 0.50) {
    scenarioShopDetails();       // 20% — shop + category reads
  } else if (roll < 0.65) {
    scenarioAuthMiddleware();    // 15% — hit auth-protected endpoints (401s)
  } else if (roll < 0.78) {
    scenarioAuthFlow();          // 13% — OTP send + validation stress
  } else if (roll < 0.88) {
    scenarioHeavyReads();        // 10% — all items, offers, bulk reads
  } else if (roll < 0.95) {
    scenarioVersionCheck();      // 7% — lightweight health-like endpoint
  } else {
    scenarioMalformedRequests(); // 5% — validation stress, bad payloads
  }
}

// ── Scenario 1: Browse Menu (30%) ───────────────────────────────
function scenarioBrowseMenu() {
  group('Browse Menu', () => {
    const shopId = randomShop();

    // Get shops
    let r = http.get(`${BASE}/shops`, { headers: HEADERS, timeout: '10s' });
    track(r);
    check(r, { 'shops 200': (r) => r.status === 200 });
    sleep(0.2);

    // Get menu
    r = http.get(`${BASE}/shops/${shopId}/menu`, { headers: HEADERS, timeout: '10s' });
    track(r);
    check(r, { 'menu 200': (r) => r.status === 200 });
    sleep(0.2);

    // Get categories
    r = http.get(`${BASE}/shops/${shopId}/categories`, { headers: HEADERS, timeout: '10s' });
    track(r);
    sleep(0.2);

    // Get offers
    r = http.get(`${BASE}/shops/${shopId}/offers`, { headers: HEADERS, timeout: '10s' });
    track(r);
    sleep(0.2);

    // Browse second shop
    const shopId2 = SHOP_IDS[(SHOP_IDS.indexOf(shopId) + 1) % SHOP_IDS.length];
    r = http.get(`${BASE}/shops/${shopId2}/menu`, { headers: HEADERS, timeout: '10s' });
    track(r);

    sleep(Math.random() * 1.5 + 0.5);
  });
}

// ── Scenario 2: Shop Details (20%) ──────────────────────────────
function scenarioShopDetails() {
  group('Shop Details', () => {
    // List all shops
    let r = http.get(`${BASE}/shops`, { headers: HEADERS, timeout: '10s' });
    track(r);
    sleep(0.2);

    // Individual shop details
    for (const sid of SHOP_IDS) {
      r = http.get(`${BASE}/shops/${sid}`, { headers: HEADERS, timeout: '10s' });
      track(r);
      sleep(0.1);
    }

    // Categories for each shop
    for (const sid of SHOP_IDS) {
      r = http.get(`${BASE}/shops/${sid}/categories`, { headers: HEADERS, timeout: '10s' });
      track(r);
      sleep(0.1);
    }

    sleep(Math.random() + 0.5);
  });
}

// ── Scenario 3: Auth Middleware Stress (15%) ─────────────────────
// These hit auth-protected endpoints WITHOUT a token.
// Server still does: API key check → parse auth header → return 401
// Tests the auth middleware hot path under load.
function scenarioAuthMiddleware() {
  group('Auth Middleware', () => {
    // Student endpoints
    let r = http.get(`${BASE}/orders/my`, { headers: HEADERS, timeout: '10s' });
    track(r);
    sleep(0.1);

    r = http.get(`${BASE}/student/wallet`, { headers: HEADERS, timeout: '10s' });
    track(r);
    sleep(0.1);

    r = http.get(`${BASE}/student/profile`, { headers: HEADERS, timeout: '10s' });
    track(r);
    sleep(0.1);

    r = http.get(`${BASE}/student/payments/pending`, { headers: HEADERS, timeout: '10s' });
    track(r);
    sleep(0.1);

    // Shop staff endpoints
    r = http.get(`${BASE}/orders/shop/active`, { headers: HEADERS, timeout: '10s' });
    track(r);
    sleep(0.1);

    r = http.get(`${BASE}/orders/shop/stats`, { headers: HEADERS, timeout: '10s' });
    track(r);
    sleep(0.1);

    r = http.get(`${BASE}/owner/shop`, { headers: HEADERS, timeout: '10s' });
    track(r);

    sleep(Math.random() * 0.5 + 0.3);
  });
}

// ── Scenario 4: Auth Flow (13%) ─────────────────────────────────
// Tests OTP send (rate-limited), token refresh, validation
function scenarioAuthFlow() {
  group('Auth Flow', () => {
    // Send OTP — will hit rate limiter + validation
    let r = http.post(`${BASE}/auth/send-otp`, JSON.stringify({
      phone: randomPhone(),
    }), { headers: HEADERS, timeout: '10s' });
    track(r);
    sleep(0.5);

    // Token refresh — will fail but tests the endpoint
    r = http.post(`${BASE}/auth/refresh`, JSON.stringify({
      refreshToken: 'invalid-stress-test-token',
    }), { headers: HEADERS, timeout: '10s' });
    track(r);
    sleep(0.3);

    // Login attempt — tests bcrypt + validation
    r = http.post(`${BASE}/auth/login`, JSON.stringify({
      username: `stresstest_${Math.floor(Math.random() * 10000)}`,
      password: 'test123456',
    }), { headers: HEADERS, timeout: '10s' });
    track(r);

    sleep(Math.random() + 0.5);
  });
}

// ── Scenario 5: Heavy Reads (10%) ───────────────────────────────
function scenarioHeavyReads() {
  group('Heavy Reads', () => {
    // All menu items (across all shops)
    let r = http.get(`${BASE}/menu/items`, { headers: HEADERS, timeout: '15s' });
    track(r);
    sleep(0.3);

    // All offers
    r = http.get(`${BASE}/menu/offers`, { headers: HEADERS, timeout: '15s' });
    track(r);
    sleep(0.3);

    // All shops
    r = http.get(`${BASE}/shops`, { headers: HEADERS, timeout: '10s' });
    track(r);
    sleep(0.2);

    // All categories for all shops in parallel batch
    const batch = SHOP_IDS.map(sid => ['GET', `${BASE}/shops/${sid}/menu`, null, { headers: HEADERS, timeout: '15s' }]);
    const responses = http.batch(batch);
    responses.forEach(r => track(r));

    sleep(Math.random() + 1);
  });
}

// ── Scenario 6: Version Check (7%) ──────────────────────────────
function scenarioVersionCheck() {
  group('Version Check', () => {
    let r = http.get(`${BASE}/app/version-check`, { headers: HEADERS, timeout: '5s' });
    track(r);
    sleep(0.1);

    // Quick shop list (simulates app startup)
    r = http.get(`${BASE}/shops`, { headers: HEADERS, timeout: '10s' });
    track(r);

    sleep(Math.random() * 0.5 + 0.3);
  });
}

// ── Scenario 7: Malformed Requests (5%) ─────────────────────────
// Tests validation, error handling, edge cases
function scenarioMalformedRequests() {
  group('Malformed Requests', () => {
    // Empty body to OTP endpoint
    let r = http.post(`${BASE}/auth/send-otp`, '{}', { headers: HEADERS, timeout: '10s' });
    track(r);
    sleep(0.1);

    // Invalid shop ID
    r = http.get(`${BASE}/shops/invalid-id/menu`, { headers: HEADERS, timeout: '10s' });
    track(r);
    sleep(0.1);

    // Oversized body
    r = http.post(`${BASE}/auth/login`, JSON.stringify({
      username: 'x'.repeat(500),
      password: 'y'.repeat(500),
    }), { headers: HEADERS, timeout: '10s' });
    track(r);
    sleep(0.1);

    // Non-existent route
    r = http.get(`${BASE}/nonexistent/route`, { headers: HEADERS, timeout: '10s' });
    track(r);
    sleep(0.1);

    // Method not allowed
    r = http.del(`${BASE}/shops`, { headers: HEADERS, timeout: '10s' });
    track(r);

    sleep(Math.random() * 0.5);
  });
}

// ── Summary ─────────────────────────────────────────────────────
export function handleSummary(data) {
  const med = data.metrics.http_req_duration?.values?.med || 0;
  const p95 = data.metrics.http_req_duration?.values['p(95)'] || 0;
  const p99 = data.metrics.http_req_duration?.values['p(99)'] || 0;
  const max = data.metrics.http_req_duration?.values?.max || 0;
  const total = data.metrics.http_reqs?.values?.count || 0;
  const rate = data.metrics.http_reqs?.values?.rate || 0;
  const errs = data.metrics.errors?.values?.rate || 0;
  const s5xx = data.metrics.server_errors_5xx?.values?.count || 0;
  const s4xx = data.metrics.client_errors_4xx?.values?.count || 0;
  const sto = data.metrics.timeouts?.values?.count || 0;
  const vus = data.metrics.vus_max?.values?.max || 0;

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   CAMPUS ONE — MAX STRESS TEST (up to 1000 VUs)     ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Peak VUs:          ${String(vus).padStart(8)}                       ║`);
  console.log(`║  Total Requests:    ${String(total).padStart(8)}                       ║`);
  console.log(`║  Requests/sec:      ${rate.toFixed(1).padStart(8)}                       ║`);
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Median Latency:    ${(med.toFixed(0) + 'ms').padStart(8)}                       ║`);
  console.log(`║  P95 Latency:       ${(p95.toFixed(0) + 'ms').padStart(8)}                       ║`);
  console.log(`║  P99 Latency:       ${(p99.toFixed(0) + 'ms').padStart(8)}                       ║`);
  console.log(`║  Max Latency:       ${(max.toFixed(0) + 'ms').padStart(8)}                       ║`);
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Server Errors:     ${String(s5xx).padStart(8)}  (5xx)                  ║`);
  console.log(`║  Client Errors:     ${String(s4xx).padStart(8)}  (4xx — expected)       ║`);
  console.log(`║  Timeouts:          ${String(sto).padStart(8)}                          ║`);
  console.log(`║  Error Rate:        ${(errs * 100).toFixed(2).padStart(7)}%                       ║`);
  console.log('╠══════════════════════════════════════════════════════╣');

  if (s5xx === 0 && sto === 0) {
    console.log('║  ✅  ZERO SERVER ERRORS — BACKEND IS SOLID           ║');
  } else if (s5xx > 0 && s5xx < 10) {
    console.log(`║  ⚠️  ${s5xx} server errors — minor degradation          ║`);
  } else if (s5xx >= 10) {
    console.log(`║  ❌  ${s5xx} server errors — BACKEND IS BREAKING       ║`);
  }
  if (sto > 0) {
    console.log(`║  ⚠️  ${sto} timeouts — server can't keep up            ║`);
  }
  if (p95 > 5000) {
    console.log('║  ❌  P95 > 5s — UNACCEPTABLE LATENCY                 ║');
  } else if (p95 > 2000) {
    console.log('║  ⚠️  P95 > 2s — DEGRADED PERFORMANCE                 ║');
  } else if (p95 < 1000) {
    console.log('║  ✅  P95 < 1s — EXCELLENT PERFORMANCE                ║');
  }

  // Breaking point estimate
  if (s5xx === 0 && sto === 0 && p95 < 3000) {
    console.log(`║  🏆  Server handled ${vus} concurrent users cleanly    ║`);
  }

  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  return {};
}
