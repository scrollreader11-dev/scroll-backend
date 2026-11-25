/* Typed chat for the casino and for Games (Bedwars and its lobbies).
   Every typed line goes through chatSay(): clean it up, rate limit it, refuse links / contact details / bad words,
   then ask server.js (ban, timeout, mute, the admin word list, the on/off switches). Nothing reaches other
   players unless it passes. Refusals go back to the sender only, with a plain reason. */

const MAX_LEN = 100;
const RECENT_MAX = 300;
export const recent = [];                 // newest last, for the admin "Game chat" page

let ext = null;                           // server.js: (ctx, text) => reason string, or '' when fine
export function setChatCheck(fn) { ext = fn; }
let ipFn = null;
export function setIpFn(fn) { ipFn = fn; }
export const ipOf = (req) => { try { return ipFn ? ipFn(req) : ''; } catch (e) { return ''; } };

// Whole-word matches (so "class" and "cockpit" are fine) plus a squashed check for the worst words, which catches "n i g g a" and "f@ggot".
const WORDS = new Set(['nigger', 'nigga', 'niggers', 'niggas', 'faggot', 'faggots', 'fag', 'fags', 'retard', 'retards', 'retarded', 'kike', 'kikes', 'spic', 'chink', 'chinks', 'coon', 'coons', 'tranny', 'cunt', 'cunts', 'fuck', 'fucks', 'fucker', 'fucking', 'fucked', 'shit', 'shits', 'shitty', 'bitch', 'bitches', 'dick', 'dicks', 'pussy', 'cock', 'cocks', 'whore', 'whores', 'slut', 'sluts', 'rape', 'raped', 'rapist', 'nazi', 'nazis', 'hitler', 'kys', 'pedo', 'pedophile', 'porn', 'nude', 'nudes', 'sex', 'sexy', 'horny', 'asshole', 'bastard', 'cum', 'dumbass', 'jackass']);
const SQUASH = ['nigger', 'nigga', 'faggot', 'retard', 'chink', 'cunt', 'whore', 'kikes', 'pedophile', 'fuck', 'bitch', 'shit'];
const LEET = { '@': 'a', '4': 'a', '3': 'e', '1': 'i', '!': 'i', '0': 'o', '$': 's', '5': 's', '7': 't' };
export function badText(text) {
  const mapped = String(text).toLowerCase().replace(/[@4310!$57]/g, (c) => LEET[c]);
  const tokens = mapped.split(/[^a-z]+/).filter(Boolean);
  if (tokens.some((w) => WORDS.has(w))) return true;
  const squashed = mapped.replace(/[^a-z]/g, '');
  return SQUASH.some((w) => squashed.includes(w));
}
const LINK = /(https?:\/\/|www\.|discord\.gg|\b[a-z0-9-]{2,}\.(com|net|org|gg|io|xyz|ly|me|co|app|dev|tv|ru|cn|info|link|site|club|shop)\b)/i;
const EMAIL = /[a-z0-9._-]+@[a-z0-9-]+\.[a-z]{2,}/i;

export function cleanLine(raw) {
  return String(raw == null ? '' : raw).replace(/[\u0000-\u001f\u007f​-‏‪-‮⁠﻿<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
}

/* ctx: { scope: 'casino' | 'games', cid, nick, ip, st } where st is a small object kept on the connection (rate limit state).
   Returns { ok: true, text } or { err: 'why' }. */
export function chatSay(ctx, raw, now) {
  now = now || Date.now();
  const text = cleanLine(raw);
  if (!text) return { err: '' };
  const st = ctx.st || (ctx.st = {});
  st.tok = Math.min(3, (st.tok == null ? 3 : st.tok) + (now - (st.at || now)) / 2500); st.at = now;
  if (st.tok < 1) return { err: 'Slow down a little.' };
  if (st.last === text && now - (st.lastAt || 0) < 12000) return { err: 'You just said that.' };
  if (LINK.test(text) || EMAIL.test(text)) return { err: 'Links and emails are not allowed in chat.' };
  if (/\d[\d\s().-]{6,}\d/.test(text)) return { err: 'Do not share phone numbers or other personal details.' };
  if (badText(text)) return { err: 'That message has words that are not allowed here.' };
  if (/(.)\1{9,}/.test(text)) return { err: 'Try fewer repeated letters.' };
  let why = ''; try { why = ext ? ext(ctx, text) || '' : ''; } catch (e) {}
  if (why) return { err: why };
  st.tok -= 1; st.last = text; st.lastAt = now;
  recent.push({ at: now, scope: ctx.scope, cid: String(ctx.cid || ''), nick: String(ctx.nick || ''), text });
  if (recent.length > RECENT_MAX) recent.splice(0, recent.length - RECENT_MAX);
  return { ok: true, text };
}
