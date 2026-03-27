import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ── Custom metrics ──────────────────────────────────────────────
const errorRate = new Rate('errors');
const reqDuration = new Trend('req_duration', true);
const statusCodes = {
  ok: new Counter('status_2xx'),
  clientErr: new Counter('status_4xx'),
  serverErr: new Counter('status_5xx'),
  timeout: new Counter('status_timeout'),
};

// ── Config ──────────────────────────────────────────────────────
const BASE = 'https://campusoneapi.madrascollege.ac.in/api/v1';
const HEADERS = {
  'Content-Type': 'application/json',
  'X-App-Key': '272183449088151d1938eca9e9de6cd2cb7a7001ad073cc050352117c1b52ca3',
};

// ── Load profile: ramp to 500 concurrent VUs ────────────────────
export const options = {
  stages: [
    { duration: '15s', target: 50 },    // Warmup
    { duration: '15s', target: 150 },   // Ramp
    { duration: '20s', target: 300 },   // Target load
    { duration: '30s', target: 500 },   // Peak — 500 concurrent
    { duration: '20s', target: 500 },   // Sustain peak
    { duration: '10s', target: 0 },     // Cooldown
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],   // 95% under 3s
    errors: ['rate<0.1'],                // <10% error rate
  },
  noConnectionReuse: false,
  userAgent: 'MEC-LoadTest/1.0',
};

// ── Helpers ─────────────────────────────────────────────────────
function trackResponse(res) {
  reqDuration.add(res.timings.duration);
  if (res.status >= 200 && res.status < 300) statusCodes.ok.add(1);
  else if (res.status >= 400 && res.status < 500) statusCodes.clientErr.add(1);
  else if (res.status >= 500) statusCodes.serverErr.add(1);
  else if (res.status === 0) statusCodes.timeout.add(1);
  errorRate.add(res.status >= 500 || res.status === 0);
}

// ── Simulated user scenarios ────────────────────────────────────
// Weighted distribution: 60% browse, 20% order-check, 15% auth, 5% heavy

export default function () {
  const scenario = Math.random();

  if (scenario < 0.40) {
    browseMenu();
  } else if (scenario < 0.65) {
    checkShops();
  } else if (scenario < 0.80) {
    checkOrders();
  } else if (scenario < 0.92) {
    authFlow();
  } else {
    heavyEndpoints();
  }
}

// ── Scenario 1: Browse menu (40% of users) ─────────────────────
function browseMenu() {
  group('Browse Menu', () => {
    // Get shops list
    let res = http.get(`${BASE}/shops`, { headers: HEADERS, timeout: '10s' });
    trackResponse(res);
    check(res, { 'shops: status 200': (r) => r.status === 200 });

    sleep(0.5);

    // Get menu for first canteen shop
    let shopId = '699b453a611371a58fd179ea'; // Madras Kitchen
    res = http.get(`${BASE}/shops/${shopId}/menu`, { headers: HEADERS, timeout: '10s' });
    trackResponse(res);
    check(res, { 'menu: status 200': (r) => r.status === 200 });

    sleep(0.3);

    // Get categories
    res = http.get(`${BASE}/shops/${shopId}/categories`, { headers: HEADERS, timeout: '10s' });
    trackResponse(res);
    check(res, { 'categories: status 200': (r) => r.status === 200 });

    sleep(0.3);

    // Get offers
    res = http.get(`${BASE}/shops/${shopId}/offers`, { headers: HEADERS, timeout: '10s' });
    trackResponse(res);

    sleep(0.5);

    // Get second shop menu (MEC Bites)
    res = http.get(`${BASE}/shops/699f26ed16a2a6b814f39b87/menu`, { headers: HEADERS, timeout: '10s' });
    trackResponse(res);

    sleep(Math.random() * 2 + 1); // Think time 1-3s
  });
}

// ── Scenario 2: Check shops (25% of users) ──────────────────────
function checkShops() {
  group('Check Shops', () => {
    let res = http.get(`${BASE}/shops`, { headers: HEADERS, timeout: '10s' });
    trackResponse(res);
    check(res, { 'shops list: 200': (r) => r.status === 200 });

    sleep(0.5);

    // Get individual shop details
    res = http.get(`${BASE}/shops/699b453a611371a58fd179ea`, { headers: HEADERS, timeout: '10s' });
    trackResponse(res);

    sleep(0.3);

    res = http.get(`${BASE}/shops/699f26ed16a2a6b814f39b87`, { headers: HEADERS, timeout: '10s' });
    trackResponse(res);

    sleep(0.3);

    // Version check (lightweight)
    res = http.get(`${BASE}/app/version-check`, { headers: HEADERS, timeout: '10s' });
    trackResponse(res);

    sleep(Math.random() * 2 + 1);
  });
}

// ── Scenario 3: Check orders (15% — needs auth, will get 401) ───
function checkOrders() {
  group('Order Check (unauthed)', () => {
    // These will return 401 — that's expected. We're testing the server's
    // ability to handle auth middleware under load.
    let res = http.get(`${BASE}/orders/my`, { headers: HEADERS, timeout: '10s' });
    trackResponse(res);

    sleep(0.3);

    res = http.get(`${BASE}/student/wallet`, { headers: HEADERS, timeout: '10s' });
    trackResponse(res);

    sleep(0.3);

    res = http.get(`${BASE}/student/profile`, { headers: HEADERS, timeout: '10s' });
    trackResponse(res);

    sleep(0.3);

    res = http.get(`${BASE}/student/payments/pending`, { headers: HEADERS, timeout: '10s' });
    trackResponse(res);

    sleep(Math.random() * 1.5 + 0.5);
  });
}

// ── Scenario 4: Auth flow (12% of users) ────────────────────────
function authFlow() {
  group('Auth Flow', () => {
    // Send OTP (will fail with invalid phone — tests rate limiting + validation)
    let res = http.post(`${BASE}/auth/send-otp`, JSON.stringify({
      phone: `+91${Math.floor(7000000000 + Math.random() * 2999999999)}`,
    }), { headers: HEADERS, timeout: '10s' });
    trackResponse(res);

    sleep(1);

    // Token refresh (will fail without valid token — tests the endpoint)
    res = http.post(`${BASE}/auth/refresh`, JSON.stringify({
      refreshToken: 'invalid-token-load-test',
    }), { headers: HEADERS, timeout: '10s' });
    trackResponse(res);

    sleep(Math.random() * 2 + 1);
  });
}

// ── Scenario 5: Heavy endpoints (8%) ────────────────────────────
function heavyEndpoints() {
  group('Heavy Endpoints', () => {
    // Menu items (all items across shops)
    let res = http.get(`${BASE}/menu/items`, { headers: HEADERS, timeout: '15s' });
    trackResponse(res);

    sleep(0.5);

    // Menu offers
    res = http.get(`${BASE}/menu/offers`, { headers: HEADERS, timeout: '15s' });
    trackResponse(res);

    sleep(0.5);

    // Shops list again
    res = http.get(`${BASE}/shops`, { headers: HEADERS, timeout: '10s' });
    trackResponse(res);

    sleep(0.5);

    // All categories for each shop
    res = http.get(`${BASE}/shops/699b453a611371a58fd179ea/categories`, { headers: HEADERS, timeout: '10s' });
    trackResponse(res);

    res = http.get(`${BASE}/shops/699f26ed16a2a6b814f39b87/categories`, { headers: HEADERS, timeout: '10s' });
    trackResponse(res);

    sleep(Math.random() * 2 + 1);
  });
}

// ── Summary ─────────────────────────────────────────────────────
export function handleSummary(data) {
  const med = data.metrics.http_req_duration?.values?.med || 0;
  const p95 = data.metrics.http_req_duration?.values['p(95)'] || 0;
  const p99 = data.metrics.http_req_duration?.values['p(99)'] || 0;
  const total = data.metrics.http_reqs?.values?.count || 0;
  const rate = data.metrics.http_reqs?.values?.rate || 0;
  const errs = data.metrics.errors?.values?.rate || 0;
  const s5xx = data.metrics.status_5xx?.values?.count || 0;
  const sto = data.metrics.status_timeout?.values?.count || 0;

  console.log('\n══════════════════════════════════════════════════');
  console.log('  CAMPUS ONE LOAD TEST — 500 CONCURRENT USERS');
  console.log('══════════════════════════════════════════════════');
  console.log(`  Total Requests:    ${total}`);
  console.log(`  Requests/sec:      ${rate.toFixed(1)}`);
  console.log(`  Median Latency:    ${med.toFixed(0)}ms`);
  console.log(`  P95 Latency:       ${p95.toFixed(0)}ms`);
  console.log(`  P99 Latency:       ${p99.toFixed(0)}ms`);
  console.log(`  Error Rate:        ${(errs * 100).toFixed(2)}%`);
  console.log(`  5xx Errors:        ${s5xx}`);
  console.log(`  Timeouts:          ${sto}`);
  console.log('══════════════════════════════════════════════════');

  if (p95 > 3000) console.log('  ⚠️  P95 > 3s — SERVER IS STRUGGLING');
  if (errs > 0.1) console.log('  ⚠️  Error rate > 10% — SERVER IS FAILING');
  if (s5xx > 0) console.log(`  ⚠️  ${s5xx} server errors (5xx) detected`);
  if (sto > 0) console.log(`  ⚠️  ${sto} request timeouts — server unresponsive`);
  if (p95 < 1000 && errs < 0.05) console.log('  ✅ SERVER SURVIVED 500 CONCURRENT USERS');

  console.log('══════════════════════════════════════════════════\n');

  return {};
}
