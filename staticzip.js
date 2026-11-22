// Bandwidth saver for the static site.
//
// Render's free plan has a hard monthly bandwidth cap. sirv serves files as-is,
// so every JS / CSS / JSON / WASM file went out uncompressed. This wraps sirv:
//   1. text-like files are sent brotli/gzip compressed (compressed once, kept in a
//      small in-memory cache, re-used for every later visitor);
//   2. image requests for <file>.png / .jpg get the pre-made <file>.png.webp
//      sibling when the browser accepts WebP (URLs in pages/JSON stay unchanged).
// Anything else (Range requests, unknown types, missing files) falls through to sirv.
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve, sep, extname } from 'node:path';
import { brotliCompress, gzip, constants as Z } from 'node:zlib';
import { promisify } from 'node:util';

const brotli = promisify(brotliCompress);
const gz = promisify(gzip);

const TEXT = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8', '.ttf': 'font/ttf', '.otf': 'font/otf', '.md': 'text/markdown; charset=utf-8',
};
const WEBP_SRC = { '.png': 1, '.jpg': 1, '.jpeg': 1 };
const MIN_SIZE = 1024;
const CACHE_MAX = 28 * 1024 * 1024;   // RAM budget for compressed copies (the box has 512 MB)
const cache = new Map();              // key -> { sig, br, gz, size }
const pending = new Map();
let cacheBytes = 0;

function remember(key, ent) {
  const old = cache.get(key); if (old) { cacheBytes -= old.size; cache.delete(key); }
  const size = (ent.br ? ent.br.length : 0) + (ent.gz ? ent.gz.length : 0);
  if (size > CACHE_MAX / 4) return;                     // huge: serve but don't keep
  ent.size = size; cache.set(key, ent); cacheBytes += size;
  for (const k of cache.keys()) { if (cacheBytes <= CACHE_MAX) break; const e = cache.get(k); cacheBytes -= e.size; cache.delete(k); }
}

async function compressed(key, file, sig, kind) {
  let ent = cache.get(key);
  if (ent && ent.sig === sig && ent[kind]) { cache.delete(key); cache.set(key, ent); return ent[kind]; }   // refresh LRU order
  const pk = key + '|' + sig + '|' + kind;
  if (pending.has(pk)) return pending.get(pk);
  const p = (async () => {
    const raw = await readFile(file);
    const out = kind === 'br'
      ? await brotli(raw, { params: { [Z.BROTLI_PARAM_QUALITY]: 5, [Z.BROTLI_PARAM_SIZE_HINT]: raw.length } })
      : await gz(raw, { level: 6 });
    const cur = cache.get(key);
    const next = cur && cur.sig === sig ? cur : { sig };
    next[kind] = out; remember(key, next);
    return out;
  })();
  pending.set(pk, p);
  try { return await p; } finally { pending.delete(pk); }
}

function candidates(pathname) {
  const p = pathname.replace(/\/+$/, '') || '';
  if (!p) return ['/index.html'];
  return [pathname.endsWith('/') ? p + '/index.html' : pathname, p + '.html', p + '.htm', p + '/index.html'];
}

export function withCompression(sirvHandler, distDir, setHeaders) {
  const root = resolve(distDir);
  return function serve(req, res, next) {
    const m = req.method;
    if ((m !== 'GET' && m !== 'HEAD') || req.headers.range) return sirvHandler(req, res, next);
    const ae = String(req.headers['accept-encoding'] || '');
    const accept = String(req.headers.accept || '');
    const wantBr = /\bbr\b/.test(ae), wantGz = /\bgzip\b/.test(ae), wantWebp = /image\/webp/.test(accept);
    if (!wantBr && !wantGz && !wantWebp) return sirvHandler(req, res, next);
    let pathname;
    try { pathname = decodeURIComponent((req.url || '/').split('?')[0]); } catch (e) { return sirvHandler(req, res, next); }
    if (pathname.includes('\0') || pathname.split('/').some(s => s.startsWith('.'))) return sirvHandler(req, res, next);
    const ext0 = extname(pathname).toLowerCase();
    // cheap pre-filter so ordinary requests don't touch the disk twice
    const maybeText = !ext0 || ext0 === '.html' || ext0 === '.htm' || TEXT[ext0];
    const maybeImg = wantWebp && WEBP_SRC[ext0] && pathname.startsWith('/storage/images/');
    if (!maybeText && !maybeImg) return sirvHandler(req, res, next);
    handle(pathname, ext0, maybeImg, wantBr, wantGz, req, res).then(done => { if (!done) sirvHandler(req, res, next); }, () => { if (!res.headersSent) sirvHandler(req, res, next); else res.end(); });
  };

  async function handle(pathname, ext0, maybeImg, wantBr, wantGz, req, res) {
    let file, st, ctype, kind = null, vary = 'Accept-Encoding';
    if (maybeImg) {
      const f = join(root, pathname + '.webp');
      if (!f.startsWith(root + sep)) return false;
      st = await stat(f).catch(() => null);
      if (!st || !st.isFile()) return false;
      file = f; ctype = 'image/webp'; vary = 'Accept';
    } else {
      for (const c of candidates(pathname)) {
        const f = join(root, c);
        if (!f.startsWith(root + sep)) return false;
        const s = await stat(f).catch(() => null);
        if (s && s.isFile()) { file = f; st = s; break; }
      }
      if (!file) return false;
      const e = extname(file).toLowerCase();
      ctype = TEXT[e];
      if (!ctype || st.size < MIN_SIZE) return false;
      kind = wantBr ? 'br' : wantGz ? 'gz' : null;
      if (!kind) return false;
    }
    const etag = 'W/"' + st.size + '-' + Math.floor(st.mtimeMs) + (kind ? '-' + kind : '') + '"';
    res.setHeader('Content-Type', ctype);
    res.setHeader('Last-Modified', new Date(st.mtimeMs).toUTCString());
    res.setHeader('ETag', etag);
    res.setHeader('Vary', vary);
    setHeaders(res, maybeImg ? pathname : '/' + file.slice(root.length + 1).split(sep).join('/'));
    if (kind) res.setHeader('Content-Encoding', kind === 'br' ? 'br' : 'gzip');
    if (req.headers['if-none-match'] === etag) { res.writeHead(304); res.end(); return true; }
    if (kind) {
      const body = await compressed(file, file, st.size + ':' + Math.floor(st.mtimeMs), kind);
      res.setHeader('Content-Length', body.length);
      res.writeHead(200); res.end(req.method === 'HEAD' ? undefined : body);
    } else {
      res.setHeader('Content-Length', st.size);
      res.writeHead(200);
      if (req.method === 'HEAD') res.end(); else createReadStream(file).on('error', () => res.destroy()).pipe(res);
    }
    return true;
  }
}
