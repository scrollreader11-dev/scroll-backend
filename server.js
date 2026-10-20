// ============================================================
// SCROLL UNBLOCKER — all-in-one server
// Serves the website (dist/) AND the Wisp proxy backend on the
// SAME origin. Same-origin is what the proxy engine needs, so
// games tunnel correctly (this is why static-only hosts fail).
//
// The open-source build ships the catalog + thumbnails but NOT
// the actual game files (they live under /storage/ag/... and
// /iframe.html on petezahgames.com). Any asset missing locally
// is transparently proxied from UPSTREAM so games/apps load.
// ============================================================
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sirv from 'sirv';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, 'dist');

// Where the real game files / app icons / iframe loader are hosted.
const UPSTREAM = 'https://petezahgames.com';

// sirv WITHOUT single — we handle SPA fallback + upstream proxy ourselves,
// so a missing asset (a game file) doesn't get index.html served as its body.
const serve = sirv(distDir, { dev: false, etag: true });

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function looksLikeFile(path) {
  const last = path.split('/').pop() || '';
  return last.includes('.');
}

// Proxy a missing asset from the upstream games host and stream it back
// from our own origin (so the game loads inside our iframe).
async function proxyUpstream(req, res) {
  const target = UPSTREAM + req.url;
  try {
    const headers = {
      'user-agent': req.headers['user-agent'] || 'Mozilla/5.0',
      'accept': req.headers['accept'] || '*/*',
    };
    if (req.headers['range']) headers['range'] = req.headers['range'];

    const up = await fetch(target, { headers, redirect: 'follow' });
    const outHeaders = {
      'content-type': up.headers.get('content-type') || 'application/octet-stream',
      'cache-control': 'public, max-age=86400',
      'access-control-allow-origin': '*',
    };
    // NOTE: fetch() auto-decompresses, so upstream's content-length/encoding no
    // longer match the bytes we send. Never forward content-length or
    // content-encoding here — Node sets the correct length from the buffer.
    // accept-ranges/content-range are only meaningful for byte-range replies.
    if (up.status === 206) {
      for (const h of ['content-range', 'accept-ranges']) {
        const v = up.headers.get(h);
        if (v) outHeaders[h] = v;
      }
    }
    if (req.method === 'HEAD') { res.writeHead(up.status, outHeaders); res.end(); return; }
    const buf = Buffer.from(await up.arrayBuffer());
    res.writeHead(up.status, outHeaders);
    res.end(buf);
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Upstream fetch failed');
  }
}

const httpServer = createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];

  // Admin panel lives at /admin/index.html — serve it for /admin and /admin/
  if (url === '/admin' || url === '/admin/') {
    req.url = '/admin/index.html';
    return serve(req, res, () => { res.writeHead(404); res.end('Not found'); });
  }

  // Legal/policy gate: report already-accepted so the gate never blocks the app.
  if (url === '/api/legal/status') {
    return sendJson(res, 200, { accepted: true, needsCaptcha: false, gate: false, version: '1' });
  }
  if (url === '/api/legal/accept') {
    return sendJson(res, 200, { ok: true, accepted: true, version: '1' });
  }

  // Other non-existent API routes 404 (never fall back to index.html as HTML).
  if (url.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end('{"error":"not found"}');
    return;
  }

  serve(req, res, () => {
    // Not found locally.
    if (looksLikeFile(url)) {
      // An asset (game file, icon, iframe.html, missing thumbnail) -> upstream.
      return proxyUpstream(req, res);
    }
    // A client-side route -> serve the SPA shell.
    req.url = '/index.html';
    serve(req, res, () => { res.writeHead(404); res.end('Not found'); });
  });
});

// Every WebSocket upgrade is routed to the Wisp proxy server.
httpServer.on('upgrade', (req, socket, head) => {
  wisp.routeRequest(req, socket, head);
});

const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Scroll Unblocker running on port ${PORT}`);
});
