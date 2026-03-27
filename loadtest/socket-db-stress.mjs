#!/usr/bin/env node
/**
 * CAMPUS ONE — Socket.IO + DB Connection Stress Test
 *
 * Tests:
 *  1. Socket.IO connection storm (500 concurrent WebSocket connections)
 *  2. DB-heavy HTTP endpoints in parallel (menu reads, shop queries)
 *  3. Auth middleware stress (JWT parsing, bcrypt on login)
 *  4. Combined load: sockets + HTTP simultaneously
 */

import { io } from 'socket.io-client';

const BASE = 'https://campusoneapi.madrascollege.ac.in';
const API = `${BASE}/api/v1`;
const API_KEY = '272183449088151d1938eca9e9de6cd2cb7a7001ad073cc050352117c1b52ca3';
const HEADERS = { 'Content-Type': 'application/json', 'X-App-Key': API_KEY };

const SHOP_IDS = [
  '699b453a611371a58fd179ea',
  '699f26ed16a2a6b814f39b87',
  '69a2a28b4c205718de38f68f',
];

// ── Metrics ─────────────────────────────────────────────────────
const metrics = {
  socket: { attempted: 0, connected: 0, rejected: 0, errors: 0, disconnects: 0, latencies: [] },
  http: { total: 0, success: 0, errors: 0, timeouts: 0, latencies: [], status: {} },
  startTime: 0,
};

function recordStatus(code) {
  metrics.http.status[code] = (metrics.http.status[code] || 0) + 1;
}

// ── HTTP fetcher with timing ────────────────────────────────────
async function httpReq(method, path, body = null) {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const opts = {
      method,
      headers: HEADERS,
      signal: controller.signal,
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${API}${path}`, opts);
    clearTimeout(timeout);
    const latency = Date.now() - start;
    metrics.http.total++;
    metrics.http.latencies.push(latency);
    recordStatus(res.status);
    if (res.status < 400) metrics.http.success++;
    else if (res.status >= 500) metrics.http.errors++;
    return { status: res.status, latency };
  } catch (e) {
    clearTimeout(timeout);
    metrics.http.total++;
    metrics.http.latencies.push(Date.now() - start);
    if (e.name === 'AbortError') {
      metrics.http.timeouts++;
      recordStatus('timeout');
    } else {
      metrics.http.errors++;
      recordStatus('error');
    }
    return { status: 0, latency: Date.now() - start };
  }
}

// ── Socket.IO connection creator ────────────────────────────────
function createSocketConnection(id) {
  return new Promise((resolve) => {
    const start = Date.now();
    metrics.socket.attempted++;

    const socket = io(BASE, {
      auth: { token: `stress-test-token-${id}` }, // Invalid token — tests auth rejection path
      transports: ['websocket'],
      reconnection: false,
      timeout: 8000,
      forceNew: true,
    });

    const timer = setTimeout(() => {
      socket.disconnect();
      metrics.socket.errors++;
      resolve({ id, status: 'timeout', latency: Date.now() - start });
    }, 10000);

    socket.on('connect', () => {
      clearTimeout(timer);
      const latency = Date.now() - start;
      metrics.socket.connected++;
      metrics.socket.latencies.push(latency);
      resolve({ id, status: 'connected', latency, socket });
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      const latency = Date.now() - start;
      metrics.socket.rejected++;
      metrics.socket.latencies.push(latency);
      socket.disconnect();
      resolve({ id, status: 'rejected', latency, error: err.message });
    });

    socket.on('disconnect', () => {
      metrics.socket.disconnects++;
    });
  });
}

// ── Phase 1: Socket.IO Connection Storm ─────────────────────────
async function phaseSocketStorm(count, batchSize = 50) {
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  PHASE 1: Socket.IO Connection Storm (${count} connections)`);
  console.log(`${'═'.repeat(56)}`);

  const sockets = [];
  const start = Date.now();

  for (let i = 0; i < count; i += batchSize) {
    const batch = Math.min(batchSize, count - i);
    const promises = Array.from({ length: batch }, (_, j) => createSocketConnection(i + j));
    const results = await Promise.all(promises);
    sockets.push(...results);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const done = Math.min(i + batch, count);
    process.stdout.write(`\r  Progress: ${done}/${count} connections (${elapsed}s)`);
  }

  console.log('');
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const avgLatency = metrics.socket.latencies.length > 0
    ? Math.round(metrics.socket.latencies.reduce((a, b) => a + b, 0) / metrics.socket.latencies.length)
    : 0;

  console.log(`  Time:       ${elapsed}s`);
  console.log(`  Connected:  ${metrics.socket.connected} / ${count}`);
  console.log(`  Rejected:   ${metrics.socket.rejected} (auth failed — expected)`);
  console.log(`  Errors:     ${metrics.socket.errors}`);
  console.log(`  Avg Latency: ${avgLatency}ms`);

  // Cleanup connected sockets
  sockets.forEach(s => s.socket?.disconnect());
  return sockets;
}

// ── Phase 2: DB-Heavy HTTP Endpoints ────────────────────────────
async function phaseDBStress(duration, concurrency) {
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  PHASE 2: DB-Heavy HTTP Stress (${concurrency} concurrent, ${duration}s)`);
  console.log(`${'═'.repeat(56)}`);

  // Reset HTTP metrics
  metrics.http = { total: 0, success: 0, errors: 0, timeouts: 0, latencies: [], status: {} };

  const endTime = Date.now() + duration * 1000;
  let active = 0;

  const endpoints = [
    () => httpReq('GET', '/shops'),
    () => httpReq('GET', `/shops/${SHOP_IDS[0]}/menu`),
    () => httpReq('GET', `/shops/${SHOP_IDS[1]}/menu`),
    () => httpReq('GET', `/shops/${SHOP_IDS[0]}/categories`),
    () => httpReq('GET', `/shops/${SHOP_IDS[1]}/categories`),
    () => httpReq('GET', `/shops/${SHOP_IDS[0]}/offers`),
    () => httpReq('GET', `/shops/${SHOP_IDS[1]}/offers`),
    () => httpReq('GET', `/shops/${SHOP_IDS[0]}`),
    () => httpReq('GET', `/shops/${SHOP_IDS[1]}`),
    () => httpReq('GET', `/shops/${SHOP_IDS[2]}`),
    () => httpReq('GET', '/menu/items'),
    () => httpReq('GET', '/menu/offers'),
    () => httpReq('GET', '/app/version-check'),
    // Auth-protected (will 401 but stresses auth middleware + DB user lookup)
    () => httpReq('GET', '/orders/my'),
    () => httpReq('GET', '/student/wallet'),
    () => httpReq('GET', '/student/profile'),
    () => httpReq('GET', '/orders/shop/active'),
    () => httpReq('GET', '/orders/shop/stats'),
    // Login attempts (bcrypt stress + DB user lookup)
    () => httpReq('POST', '/auth/login', { username: `user${Math.random().toString(36).slice(2, 8)}`, password: 'test' }),
    () => httpReq('POST', '/auth/refresh', { refreshToken: 'invalid' }),
  ];

  async function worker() {
    while (Date.now() < endTime) {
      active++;
      const fn = endpoints[Math.floor(Math.random() * endpoints.length)];
      await fn();
      active--;
      // Small jitter
      await new Promise(r => setTimeout(r, Math.random() * 100));
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());

  // Progress reporter
  const progressInterval = setInterval(() => {
    const remaining = Math.max(0, ((endTime - Date.now()) / 1000)).toFixed(0);
    const rps = metrics.http.total > 0 ? (metrics.http.total / ((Date.now() - (endTime - duration * 1000)) / 1000)).toFixed(0) : 0;
    process.stdout.write(`\r  Requests: ${metrics.http.total} | ${rps} req/s | Active: ${active} | ${remaining}s left   `);
  }, 500);

  await Promise.all(workers);
  clearInterval(progressInterval);
  console.log('');

  printHTTPResults();
}

// ── Phase 3: Combined Socket + HTTP ─────────────────────────────
async function phaseCombined(socketCount, httpConcurrency, duration) {
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  PHASE 3: Combined — ${socketCount} sockets + ${httpConcurrency} HTTP workers (${duration}s)`);
  console.log(`${'═'.repeat(56)}`);

  // Reset metrics
  metrics.socket = { attempted: 0, connected: 0, rejected: 0, errors: 0, disconnects: 0, latencies: [] };
  metrics.http = { total: 0, success: 0, errors: 0, timeouts: 0, latencies: [], status: {} };

  // Launch sockets in background
  const socketPromise = phaseSocketStorm(socketCount, 100);

  // Simultaneously hammer HTTP
  const endTime = Date.now() + duration * 1000;
  const endpoints = [
    () => httpReq('GET', '/shops'),
    () => httpReq('GET', `/shops/${SHOP_IDS[0]}/menu`),
    () => httpReq('GET', `/shops/${SHOP_IDS[1]}/menu`),
    () => httpReq('GET', `/shops/${SHOP_IDS[0]}/categories`),
    () => httpReq('GET', '/menu/items'),
    () => httpReq('GET', '/orders/my'),
    () => httpReq('GET', '/student/wallet'),
    () => httpReq('POST', '/auth/login', { username: 'stress', password: 'test' }),
  ];

  async function httpWorker() {
    while (Date.now() < endTime) {
      const fn = endpoints[Math.floor(Math.random() * endpoints.length)];
      await fn();
      await new Promise(r => setTimeout(r, Math.random() * 50));
    }
  }

  const httpWorkers = Array.from({ length: httpConcurrency }, () => httpWorker());

  // Wait for both
  await Promise.all([socketPromise, ...httpWorkers]);

  console.log(`\n  Combined HTTP results:`);
  printHTTPResults();
}

// ── Print HTTP results ──────────────────────────────────────────
function printHTTPResults() {
  const lat = metrics.http.latencies.sort((a, b) => a - b);
  const p50 = lat[Math.floor(lat.length * 0.5)] || 0;
  const p95 = lat[Math.floor(lat.length * 0.95)] || 0;
  const p99 = lat[Math.floor(lat.length * 0.99)] || 0;
  const max = lat[lat.length - 1] || 0;
  const avg = lat.length > 0 ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0;

  console.log(`  Total:      ${metrics.http.total} requests`);
  console.log(`  Success:    ${metrics.http.success} (2xx/3xx)`);
  console.log(`  4xx:        ${Object.entries(metrics.http.status).filter(([k]) => k >= 400 && k < 500).reduce((s, [, v]) => s + v, 0)} (expected auth failures)`);
  console.log(`  5xx:        ${metrics.http.errors}`);
  console.log(`  Timeouts:   ${metrics.http.timeouts}`);
  console.log(`  Latency:    p50=${p50}ms  p95=${p95}ms  p99=${p99}ms  max=${max}ms  avg=${avg}ms`);

  const statusStr = Object.entries(metrics.http.status).sort(([a], [b]) => a - b).map(([k, v]) => `${k}:${v}`).join('  ');
  console.log(`  Status:     ${statusStr}`);
}

// ── Main ────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  CAMPUS ONE — Socket.IO + DB Stress Test            ║');
  console.log('║  Target: 500 sockets + 500 HTTP concurrent          ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`  Server: ${BASE}`);
  console.log(`  Time:   ${new Date().toLocaleString()}`);

  metrics.startTime = Date.now();

  // Phase 1: Pure socket storm — 500 connections
  await phaseSocketStorm(500, 50);

  // Small cooldown
  await new Promise(r => setTimeout(r, 2000));

  // Phase 2: Pure DB stress — 200 concurrent HTTP workers for 30s
  await phaseDBStress(30, 200);

  // Small cooldown
  await new Promise(r => setTimeout(r, 2000));

  // Phase 3: Combined — 500 sockets + 300 HTTP workers simultaneously for 30s
  await phaseCombined(500, 300, 30);

  // ── Final Report ──────────────────────────────────────────────
  const totalTime = ((Date.now() - metrics.startTime) / 1000).toFixed(1);
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  FINAL REPORT — Total time: ${totalTime}s`);
  console.log(`${'═'.repeat(56)}`);

  const allTimeouts = metrics.http.timeouts;
  const all5xx = metrics.http.errors;

  if (all5xx === 0 && allTimeouts < 10) {
    console.log('  ✅  SERVER SURVIVED — Zero crashes, minimal timeouts');
  } else if (all5xx === 0 && allTimeouts < 50) {
    console.log(`  ⚠️  SERVER STRESSED — ${allTimeouts} timeouts but no crashes`);
  } else if (all5xx > 0) {
    console.log(`  ❌  SERVER DEGRADED — ${all5xx} server errors, ${allTimeouts} timeouts`);
  }
  console.log(`${'═'.repeat(56)}\n`);
}

main().catch(console.error);
