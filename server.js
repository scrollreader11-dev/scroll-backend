// ============================================================
// SCROLL UNBLOCKER — all-in-one server
// Serves the website (dist/) AND the Wisp proxy backend on the
// SAME origin. Same-origin is what the proxy engine needs, so
// games tunnel correctly (this is why static-only hosts fail).
// ============================================================
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sirv from 'sirv';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, 'dist');

// Static file server for the built site. single:true = SPA fallback to index.html.
const serve = sirv(distDir, { dev: false, etag: true, single: true });

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
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

  // Other non-existent API routes 404 (never fall back to index.html as HTML,
  // which would break the game list's JSON parsing).
  if (url.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end('{"error":"not found"}');
    return;
  }

  serve(req, res, () => {
    res.writeHead(404);
    res.end('Not found');
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
