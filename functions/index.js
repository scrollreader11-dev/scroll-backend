/**
 * ScrollHub Cloud Functions
 * Handles:
 *  - GET /storage/data/collection.json  → catalog (merges live + bundled + overrides)
 *  - GET /cdn-proxy/**                  → proxy CDN assets through Google's servers
 *
 * NOTE: Outbound network calls to non-Google services require the Firebase
 * Blaze (pay-as-you-go) plan. The free usage tier is the same as Spark, so
 * you generally won't be charged for small traffic.
 */

const { onRequest } = require('firebase-functions/v2/https');
const path = require('path');
const fs = require('fs');

// ── Bundled catalog (shipped with the function; always available as fallback) ──
let BUNDLED_GAMES = [];
try {
  const raw = fs.readFileSync(path.join(__dirname, 'collection.json'), 'utf8');
  const data = JSON.parse(raw);
  BUNDLED_GAMES = Array.isArray(data) ? data : (data && data.games ? data.games : []);
} catch (e) {
  console.error('Failed to read bundled collection.json:', e.message);
}

// ── Upstream (live petezahgames catalog source) ──
const UPSTREAM = 'https://petezahgames.com';

// ── Pinned game overrides ─────────────────────────────────────────────────────
const CATALOG_OVERRIDES = [
  { label: 'Tomb of the Mask', url: '/iframe.html?url=/storage/ag/arsenic/tomb-of-the-mask/index.html', imageUrl: '/storage/images/main3/tombofthemask.png', categories: ['Arcade'] },
  { label: 'Paper.io 2', url: '/iframe.html?url=/storage/ag/originals/paperio2/index.html', imageUrl: '/storage/images/main/paper2.jpg', categories: ['.io'] },
  { label: 'Tactical Assassin 2', url: '/iframe.html?url=/storage/ag/echo/tacticalassasin2/index.html', imageUrl: '/storage/ag/echo/tacticalassasin2/tacticalassassin2.png', categories: ['Shooting'] },
  { label: 'Crazy Bikes', url: '/iframe.html?url=/storage/ag/arsenic/crazy-bikes/index.html', imageUrl: '/storage/images/main3/crazybikes.png', categories: ['Racing'] },
  { label: 'CrazyGames', url: '/iframe.html?url=/storage/ag/originals/crazygames/index.html', imageUrl: '/storage/ag/originals/crazygames/logo.png', categories: ['Arcade'] },
  { label: 'Melon Playground', url: '/iframe.html?url=/storage/ag/originals/melonplayground/index.html', imageUrl: '/storage/ag/originals/melonplayground/IMG_5304.jpeg', categories: ['Simulation'] },
  { label: 'Stickman Dragon Fight', url: '/extframe.html?url=https://ubgwtf.gitlab.io/stickman-dragon-fight/', imageUrl: '/imgx/https://ubgwtf.gitlab.io/assets/upload/ubgwtforg/png/stickman-dragon-fight.webp', categories: ['Fighting'] },
  { label: 'Burrito Bison', url: '/gadget.html?url=https://cdn.jsdelivr.net/gh/nexorainteractives/Nexora-Assets@main/games/clburritobison.html', imageUrl: '/storage/images/nexora/clburritobison.webp', categories: ['Platformer', 'Adventure'] },
  { label: 'Snow Rider 3D', url: '/iframe.html?url=/storage/ag/arsenic/snow-rider-3d/index.html', imageUrl: '/storage/images/main3/snowrider3d.png', categories: ['Racing', 'Sports'] },
  { label: '1v1.lol', url: '/gadget.html?url=https://cdn.jsdelivr.net/gh/nexorainteractives/Nexora-Assets@main/games/cl1v1lol.html', imageUrl: '/storage/images/nexora/cl1v1lol.webp', categories: ['Shooter', 'Multiplayer'] },
];

// ── In-memory catalog cache ───────────────────────────────────────────────────
let catalogCache = { data: null, ts: 0 };

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const isGitlab = (g) => /gitlab\.io/i.test(String(g.url || '') + ' ' + String(g.imageUrl || ''));

async function buildCatalog() {
  // Try fetching the live catalog from petezahgames.com
  let liveTxt = null;
  try {
    const ac = new AbortController();
    const to = setTimeout(() => { try { ac.abort(); } catch (e) {} }, 15000);
    let up;
    try {
      up = await fetch(UPSTREAM + '/storage/data/collection.json', {
        headers: { 'user-agent': 'Mozilla/5.0', accept: 'application/json' },
        signal: ac.signal,
      });
    } finally { clearTimeout(to); }
    if (up && up.ok) {
      const txt = await up.text();
      JSON.parse(txt); // validate JSON
      liveTxt = txt;
    }
  } catch (e) {
    console.warn('Live catalog fetch failed:', e.message);
  }

  // Build the base games array
  let baseGames = [];
  if (liveTxt) {
    try {
      const d = JSON.parse(liveTxt);
      baseGames = Array.isArray(d) ? d : (d && d.games ? d.games : []);
    } catch (e) {}
  }

  // Merge bundled extras (friends' games not in live catalog)
  if (BUNDLED_GAMES.length) {
    if (baseGames.length) {
      const liveNorm = new Set(baseGames.map((g) => norm(g.label)));
      for (const g of BUNDLED_GAMES) {
        if (g && !liveNorm.has(norm(g.label))) baseGames.push(g);
      }
    } else {
      baseGames = BUNDLED_GAMES;
    }
  }

  // Apply overrides: drop duplicates, pin overrides at top/bottom
  const overrideKeys = new Set(CATALOG_OVERRIDES.map((o) => norm(o.label)));
  const combined = baseGames.filter((g) => !overrideKeys.has(norm(g.label)));
  const seen = new Set();
  const uniq = [];
  for (const g of combined) {
    const k = norm(g.label);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    uniq.push(g);
  }

  const topGames = uniq.filter((g) => !isGitlab(g));
  const bottomGames = uniq.filter((g) => isGitlab(g));
  const topOverrides = CATALOG_OVERRIDES.filter((g) => !isGitlab(g));
  const bottomOverrides = CATALOG_OVERRIDES.filter((g) => isGitlab(g));

  const seeAll = bottomGames.length ? [{
    label: 'See All ' + bottomGames.length + '+ New Games',
    url: '/newgames',
    imageUrl: '/storage/images/main/arcade.jpg',
    categories: ['🆕 New Games'],
  }] : [];

  const games = [...topOverrides, ...topGames, ...seeAll, ...bottomOverrides, ...bottomGames];

  // Rewrite thumbnail URLs: local images served from Firebase Hosting (same origin)
  // External thumbnails go through wsrv.nl image CDN for resizing + caching
  const IMG_PROXY = 'https://wsrv.nl/';
  for (const g of games) {
    if (!g || typeof g.imageUrl !== 'string') continue;
    const img = g.imageUrl;
    if (img.startsWith('/!!/')) {
      // External thumbnail → wsrv.nl
      g.imageUrl = IMG_PROXY + '?url=' + encodeURIComponent(img.slice(4)) + '&w=360&output=webp&q=72&maxage=30d';
    } else if (img.startsWith('/storage/ag/')) {
      // petezahgames asset → wsrv.nl
      g.imageUrl = IMG_PROXY + '?url=' + encodeURIComponent(UPSTREAM + img) + '&w=360&output=webp&q=72&maxage=30d';
    }
    // Local /storage/images/... paths stay as-is (served by Firebase Hosting)
  }

  return JSON.stringify({ games });
}

// ── CDN allowlist ─────────────────────────────────────────────────────────────
const CDN_ALLOWLIST = new Set([
  'cdn.jsdelivr.net',
  'raw.githubusercontent.com',
  'unpkg.com',
  'cdnjs.cloudflare.com',
]);

// ── Main request handler ──────────────────────────────────────────────────────
async function handler(req, res) {
  const url = req.path || '/';

  // ── CORS preflight ──
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  // ── Catalog ──
  if (url === '/storage/data/collection.json') {
    const now = Date.now();

    // Serve from cache if fresh (10 min)
    if (catalogCache.data && now - catalogCache.ts < 10 * 60 * 1000) {
      res.set('Content-Type', 'application/json');
      res.set('Cache-Control', 'public, max-age=300');
      res.status(200).send(catalogCache.data);
      return;
    }

    try {
      const txt = await buildCatalog();
      const parsed = JSON.parse(txt);
      if (parsed.games && parsed.games.length > 5) {
        catalogCache = { data: txt, ts: now };
      }
      res.set('Content-Type', 'application/json');
      res.set('Cache-Control', 'public, max-age=300');
      res.status(200).send(txt);
    } catch (e) {
      // Fall back to bundled catalog
      const fallback = JSON.stringify({ games: BUNDLED_GAMES });
      res.set('Content-Type', 'application/json');
      res.status(200).send(fallback);
    }
    return;
  }

  // ── CDN Proxy ──
  if (url.startsWith('/cdn-proxy/')) {
    const raw = url.slice('/cdn-proxy/'.length);
    const targetUrl = 'https://' + raw + (req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '');

    let targetHost = '';
    try { targetHost = new URL('https://' + raw).hostname; } catch (e) {}

    if (!CDN_ALLOWLIST.has(targetHost)) {
      res.status(403).send('CDN host not allowed');
      return;
    }

    try {
      const ac = new AbortController();
      const to = setTimeout(() => { try { ac.abort(); } catch (e) {} }, 30000);
      let upstream;
      try {
        upstream = await fetch(targetUrl, {
          headers: { 'user-agent': 'Mozilla/5.0', accept: req.headers['accept'] || '*/*' },
          signal: ac.signal,
        });
      } finally { clearTimeout(to); }

      let ct = upstream.headers.get('content-type') || 'application/octet-stream';
      // Fix jsDelivr serving .html files as text/plain
      if ((ct.includes('text/plain') || ct === 'application/octet-stream') && raw.match(/\.html?(\?|$)/i)) {
        ct = 'text/html; charset=utf-8';
      }

      res.set('Content-Type', ct);
      res.set('Cache-Control', 'public, max-age=86400');
      res.set('Access-Control-Allow-Origin', '*');
      res.status(upstream.status);

      // Stream the response body
      const body = await upstream.arrayBuffer();
      res.send(Buffer.from(body));
    } catch (e) {
      if (!res.headersSent) {
        res.status(502).send('CDN proxy error: ' + (e && e.message));
      }
    }
    return;
  }

  res.status(404).send('Not found');
}

// Export the Cloud Function
exports.api = onRequest(
  { memory: '256MiB', timeoutSeconds: 60, region: 'us-central1' },
  handler
);
