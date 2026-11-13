// ============================================================
// ScrollHub Games — stored data the owners control: custom maps (from the map
// builder), which maps each game plays (rotation), game settings, bans and an
// activity log. Kept in /tmp + Upstash KV like the casino, so it survives redeploys.
// ============================================================
import fs from 'node:fs';
import { kvGet, kvSet } from './casino.js';

const MG = globalThis.MG, BW = globalThis.BW;
const N = BW.W * BW.H;
const FILE = '/tmp/scrollhub-gamemaps.json';
const KEY = 'sh:gamemaps';
const GAMES = ['bw', 'ctf', 'spleef', 'hide'];
export const MAPPER = 'scrollreader11';           // the only account that can make maps

export const DEFAULT_SETTINGS = { ctfCaps: 3, ctfMins: 8, hideSec: 30, seekSec: 180, spleefMins: 4, publicDiff: 'normal', motd: '', doubleUntil: 0 };
export const store = { maps: {}, rot: {}, settings: { ...DEFAULT_SETTINGS }, bans: {}, logs: [] };
GAMES.forEach((g) => { store.rot[g] = { def: true, ids: [] }; });

function load(raw) {
  try {
    const d = JSON.parse(raw); if (!d) return;
    if (d.maps) store.maps = d.maps;
    if (d.rot) for (const g of GAMES) if (d.rot[g]) store.rot[g] = { def: d.rot[g].def !== false, ids: (d.rot[g].ids || []).filter((id) => store.maps[id]) };
    if (d.settings) store.settings = { ...DEFAULT_SETTINGS, ...d.settings };
    if (d.bans) store.bans = d.bans;
    if (d.logs) store.logs = d.logs.slice(-150);
  } catch (e) {}
  applySettings();
}
try { if (fs.existsSync(FILE)) load(fs.readFileSync(FILE, 'utf8')); } catch (e) {}
kvGet(KEY).then((s) => { if (s) load(s); }).catch((e) => console.log('gamemaps kv load failed:', e.message));
let dirty = false;
function blob() { return JSON.stringify(store); }
export function save() { dirty = true; try { fs.writeFileSync(FILE, blob()); } catch (e) {} }
setInterval(() => { if (!dirty) return; dirty = false; kvSet(KEY, blob()).catch(() => { dirty = true; }); }, 8000);

// ---- settings: push into the shared game rules
export function applySettings() {
  const s = store.settings;
  MG.GAMES.ctf.caps = s.ctfCaps; MG.GAMES.ctf.mins = s.ctfMins;
  MG.GAMES.hide.hideSec = s.hideSec; MG.GAMES.hide.seekSec = s.seekSec;
  MG.GAMES.spleef.mins = s.spleefMins;
}
export function clientCfg(game) {
  const s = store.settings;
  if (game === 'ctf') return { caps: s.ctfCaps, mins: s.ctfMins };
  if (game === 'hide') return { hideSec: s.hideSec, seekSec: s.seekSec };
  if (game === 'spleef') return { mins: s.spleefMins };
  return {};
}
const LIMITS = { ctfCaps: [1, 10], ctfMins: [2, 20], hideSec: [10, 90], seekSec: [60, 600], spleefMins: [1, 10] };
export function setSetting(k, v) {
  if (k === 'publicDiff') { if (['easy', 'normal', 'hard'].includes(v)) store.settings.publicDiff = v; else return false; }
  else if (k === 'motd') store.settings.motd = String(v || '').slice(0, 120);
  else if (LIMITS[k]) { const n = Math.round(Number(v)); if (!Number.isFinite(n)) return false; store.settings[k] = Math.max(LIMITS[k][0], Math.min(LIMITS[k][1], n)); }
  else return false;
  applySettings(); save(); return true;
}
export function rewardMult() { return Date.now() < (store.settings.doubleUntil || 0) ? 2 : 1; }

// ---- bans (by account id)
export function banInfo(cid) { const b = store.bans[cid]; if (!b) return null; if (b.until && Date.now() > b.until) { delete store.bans[cid]; save(); return null; } return b; }
export function ban(cid, nick, mins, by) { store.bans[cid] = { nick, until: mins > 0 ? Date.now() + mins * 60000 : 0, by, at: Date.now() }; save(); }
export function unban(cid) { delete store.bans[cid]; save(); }

// ---- activity log
export function log(text) { store.logs.push({ at: Date.now(), text: String(text).slice(0, 160) }); if (store.logs.length > 150) store.logs.splice(0, store.logs.length - 150); dirty = true; }

// ---- maps
function int(v, a, b) { v = Math.floor(Number(v)); return Number.isFinite(v) && v >= a && v <= b ? v : null; }
function cleanRle(s) { s = String(s || ''); return /^[0-9a-z.,]{0,60000}$/.test(s) ? s : ''; }
function cleanPairs(list, max, team) { const out = []; if (!Array.isArray(list)) return out; for (const q of list.slice(0, max)) { if (team) { const t = int(q && q[0], 0, 7), i = int(q && q[1], 0, N - 1); if (t != null && i != null) out.push(q.length > 2 ? [t, i, int(q[2], 0, 3) || 0] : [t, i]); } else { const i = int(q, 0, N - 1); if (i != null) out.push(i); } } return out; }
// Validates and normalises a map coming from the builder. Returns null if it's junk.
export function cleanMap(m) {
  if (!m || !GAMES.includes(m.game)) return null;
  const cm = { v: 1, game: m.game, name: String(m.name || '').trim().slice(0, 40) || 'Untitled', desc: String(m.desc || '').slice(0, 140), g: cleanRle(m.g), w: [], f: [], props: [], mk: {} };
  for (const q of (Array.isArray(m.w) ? m.w : []).slice(0, N)) { const i = int(q[0], 0, N - 1), b = int(q[1], 1, 4), t = int(q[2] || 0, 0, 7); if (i != null && b != null) cm.w.push([i, b, t || 0]); }
  for (const q of (Array.isArray(m.f) ? m.f : []).slice(0, N)) { const i = int(q[0], 0, N - 1), b = int(q[1], 1, 4), t = int(q[2] || 0, 0, 7); if (i != null && b != null) cm.f.push([i, b, t || 0]); }
  for (const q of (Array.isArray(m.props) ? m.props : []).slice(0, 2000)) { const i = int(q[0], 0, N - 1); if (i != null && MG.PROPS[q[1]]) cm.props.push([i, q[1]]); }
  if (m.game === 'spleef') cm.L = (Array.isArray(m.L) ? m.L : []).slice(0, MG.SP_LAYERS).map(cleanRle);
  const mk = m.mk || {};
  for (const k of ['sp', 'bed', 'tg', 'shop', 'up', 'flag']) if (mk[k]) cm.mk[k] = cleanPairs(mk[k], 16, true);
  for (const k of ['dia', 'em', 'pick', 'hs', 'seek']) if (mk[k]) cm.mk[k] = cleanPairs(mk[k], k === 'seek' ? 1 : 24, false);
  return cm;
}
export function mapMeta(cm) { return { id: cm.id, name: cm.name, game: cm.game, author: cm.author, at: cm.at, ok: !!cm.ok, size: JSON.stringify(cm).length, rot: !!(store.rot[cm.game] && store.rot[cm.game].ids.includes(cm.id)) }; }
export function listMaps(game) { return Object.values(store.maps).filter((m) => !game || m.game === game).sort((a, b) => b.at - a.at).map(mapMeta); }
export function getMap(id) { return store.maps[id] || null; }
export function saveMap(raw, author) {
  const cm = cleanMap(raw); if (!cm) return { ok: false, msg: 'That map is broken.' };
  let id = raw.id && store.maps[raw.id] ? raw.id : null;
  if (!id) { if (Object.keys(store.maps).length >= 120) return { ok: false, msg: 'Too many maps saved — delete some first.' }; do { id = 'm' + Math.random().toString(36).slice(2, 8); } while (store.maps[id]); }
  const problems = MG.validateCustom(cm);
  cm.id = id; cm.author = author; cm.at = Date.now(); cm.ok = problems.length === 0;
  store.maps[id] = cm;
  if (!cm.ok) for (const g of GAMES) store.rot[g].ids = store.rot[g].ids.filter((x) => x !== id);
  save(); log('🗺️ ' + author + ' saved map "' + cm.name + '" (' + MG.GAMES[cm.game].name + ')');
  return { ok: true, id, problems, meta: mapMeta(cm) };
}
export function deleteMap(id, by) { const m = store.maps[id]; if (!m) return false; delete store.maps[id]; for (const g of GAMES) store.rot[g].ids = store.rot[g].ids.filter((x) => x !== id); save(); log('🗑️ ' + by + ' deleted map "' + m.name + '"'); return true; }
export function setRotation(game, id, on) {
  const r = store.rot[game]; if (!r) return false;
  if (id === 'default') { r.def = !!on; if (!r.def && !r.ids.length) r.def = true; save(); return true; }
  const m = store.maps[id]; if (!m || m.game !== game || (on && !m.ok)) return false;
  r.ids = r.ids.filter((x) => x !== id); if (on) r.ids.push(id);
  if (!r.def && !r.ids.length) r.def = true;
  save(); return true;
}
// Which map does a new match get? null = the built-in one.
export function pickMap(game) {
  const r = store.rot[game]; if (!r) return null;
  const pool = r.ids.filter((id) => store.maps[id] && store.maps[id].ok);
  const n = pool.length + (r.def ? 1 : 0);
  if (!pool.length) return null;
  const k = Math.floor(Math.random() * n);
  return k < pool.length ? store.maps[pool[k]] : null;
}
export function publishedMaps(game) { return Object.values(store.maps).filter((m) => m.game === game && m.ok).map((m) => ({ id: m.id, name: m.name, author: m.author })); }
