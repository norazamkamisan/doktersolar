#!/usr/bin/env node
// Regenerates the README screenshots in docs/screenshots/ from a running DokterSolar site.
//
//   npm run screenshots                                  # live site, with PVWatts data
//   npm run screenshots -- --no-pvwatts                  # simple-estimate numbers only
//   npm run screenshots -- --site http://localhost:4173  # e.g. after `npm run build && npm run preview`
//
// Drives a headless Chromium browser (Edge or Chrome) over the DevTools protocol, so it
// needs no extra dependencies. Set BROWSER_PATH to use a specific browser binary.
// Requires Node.js 22+ (for the built-in WebSocket client).
//
// PVWatts data is fetched through the site's own /api/pvwatts endpoint (one request),
// so it only works where that function has NREL_API_KEY configured.
//
// If the site is password-protected, set SITE_PASSWORD in your environment first
// (PowerShell: $env:SITE_PASSWORD = '...'). It is only sent to the site's /api/login.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const SITE = option('--site', 'https://doktersolar.vercel.app').replace(/\/$/, '');
const WITH_PVWATTS = !flag('--no-pvwatts');
const PROJECT = 'demo-3'; // Priya Nair: has a drawn roof and a proposal
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'screenshots');
const PORT = 9300 + Math.floor(Math.random() * 600);

if (typeof WebSocket === 'undefined') {
  console.error('This script needs Node.js 22 or newer (built-in WebSocket).');
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* Browser                                                             */
/* ------------------------------------------------------------------ */

function findBrowser() {
  const candidates = [
    process.env.BROWSER_PATH,
    // Windows
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) throw new Error('No Edge/Chrome found. Set BROWSER_PATH to a Chromium-based browser.');
  return found;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const profile = mkdtempSync(join(tmpdir(), 'doktersolar-shots-'));
  const proc = spawn(
    findBrowser(),
    ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'],
    { stdio: 'ignore' },
  );
  let targets;
  for (let i = 0; i < 60 && !targets; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    } catch {
      await sleep(250);
    }
  }
  const page = targets?.find((t) => t.type === 'page');
  if (!page) throw new Error('Browser did not start with remote debugging.');
  return {
    wsUrl: page.webSocketDebuggerUrl,
    close: () => {
      proc.kill();
      setTimeout(() => rmSync(profile, { recursive: true, force: true }), 1000).unref?.();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Minimal DevTools protocol client                                    */
/* ------------------------------------------------------------------ */

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => {
    ws.addEventListener('open', r, { once: true });
    ws.addEventListener('error', j, { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method) {
      for (const l of [...listeners]) if (l.method === msg.method) l.resolve(msg);
    }
  });
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const id = nextId++;
      pending.set(id, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)));
      ws.send(JSON.stringify({ id, method, params }));
    });
  const once = (method) =>
    new Promise((res) => {
      const l = { method, resolve: (m) => (listeners.splice(listeners.indexOf(l), 1), res(m)) };
      listeners.push(l);
    });
  return { send, once, close: () => ws.close() };
}

/* ------------------------------------------------------------------ */
/* Capture                                                             */
/* ------------------------------------------------------------------ */

const SHOTS = [
  { name: 'dashboard', path: '/home', width: 1440, height: 1000 },
  { name: 'design-tool', path: `/projects/${PROJECT}/design`, width: 1440, height: 900, map: true },
  { name: 'energy', path: `/projects/${PROJECT}/energy`, width: 1440, height: 1100 },
  { name: 'proposal', path: `/proposals/${PROJECT}`, width: 1100, height: 1500, map: true },
  { name: 'mobile', path: '/home', width: 390, height: 844, mobile: true, scale: 2 },
];

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Site:   ${SITE}`);
  console.log(`Output: ${OUT_DIR}\n`);

  const browser = await launch();
  const cdp = await connect(browser.wsUrl);

  const evaluate = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };

  const goto = async (path) => {
    const loaded = cdp.once('Page.loadEventFired');
    await cdp.send('Page.navigate', { url: SITE + path });
    await loaded;
  };

  // Wait until the app has rendered and, on map pages, every satellite tile has loaded.
  const settle = async (hasMap) => {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const ready = await evaluate(`(() => {
        if (!document.querySelector('main, article')) return false;
        const tiles = [...document.querySelectorAll('img.leaflet-tile')];
        if (${hasMap} && tiles.length === 0) return false;
        return tiles.every((t) => t.complete);
      })()`);
      if (ready) break;
      await sleep(250);
    }
    await sleep(800); // let charts and fonts finish painting
  };

  try {
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

    // A fresh profile, so the first visit seeds the 5 demo projects.
    await goto('/home');

    // Password-protected site (middleware.js): sign in with SITE_PASSWORD from the environment.
    if ((await evaluate('location.pathname')) === '/login') {
      const password = process.env.SITE_PASSWORD;
      if (!password) throw new Error('The site is password-protected. Set SITE_PASSWORD in your environment and re-run.');
      const ok = await evaluate(`(async () => {
        const res = await fetch('/api/login', { method: 'POST', body: new URLSearchParams({ password: ${JSON.stringify(password)}, next: '/home' }) });
        return new URL(res.url).pathname === '/home';
      })()`);
      if (!ok) throw new Error('Sign-in failed: SITE_PASSWORD does not match the site password.');
      console.log('Signed in.\n');
      await goto('/home');
    }
    await settle(false);

    if (WITH_PVWATTS) {
      // Same steps as the "Get PVWatts estimate" button: fetch, then store on the project.
      const r = await evaluate(`(async () => {
        const KEY = 'doktersolar.projects.v1';
        const projects = JSON.parse(localStorage.getItem(KEY));
        const p = projects.find((x) => x.id === '${PROJECT}');
        const q = new URLSearchParams({ lat: p.lat, lon: p.lng, system_capacity: p.systemKw.toFixed(3), tilt: p.design.tilt, azimuth: p.design.azimuth });
        const res = await fetch('/api/pvwatts?' + q);
        const body = await res.json().catch(() => null);
        // Hosts without the function (e.g. vite preview) answer with the SPA's index.html and a 200.
        if (!body) return { error: 'no PVWatts function at ' + location.origin + '/api/pvwatts' };
        if (!res.ok) return { error: body.error || 'HTTP ' + res.status };
        if (typeof body.annual !== 'number' || !Array.isArray(body.monthly)) return { error: 'unexpected PVWatts response' };
        p.energy = { ...p.energy, usePvWatts: true, pvwatts: { annual: body.annual, monthly: body.monthly, fetchedAt: new Date().toISOString() } };
        localStorage.setItem(KEY, JSON.stringify(projects));
        return { annual: Math.round(body.annual) };
      })()`);
      if (r.error) {
        console.warn(`! PVWatts unavailable (${r.error}). Continuing with the simple estimate.\n`);
      } else {
        console.log(`PVWatts: ${r.annual.toLocaleString()} kWh/yr for ${PROJECT}\n`);
      }
    }

    for (const s of SHOTS) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: s.width,
        height: s.height,
        deviceScaleFactor: s.scale ?? 1,
        mobile: !!s.mobile,
      });
      await goto(s.path);
      await settle(!!s.map);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(OUT_DIR, `${s.name}.png`), Buffer.from(data, 'base64'));
      console.log(`  ✓ ${s.name}.png`);
    }
    console.log('\nDone.');
  } finally {
    cdp.close();
    browser.close();
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
