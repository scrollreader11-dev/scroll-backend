/* ScrollHub banner generator — turns a few simple settings into an animated SVG banner.
   Used by the Sprite Studio (preview) and by the server (which builds the saved value itself,
   so only these settings — never raw SVG — are ever accepted). Works as a browser script and
   as a side-effect ES module import (sets globalThis.SHBanner). */
(function () {
  var STYLES = ['gradient', 'stripes', 'dots', 'waves', 'checker', 'stars', 'hearts'];
  var ANIMS = ['none', 'shift', 'pulse', 'shimmer', 'sparkle', 'scroll', 'rainbow', 'twinkle'];
  function hex(v, d) { v = String(v || ''); return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : d; }
  function clean(p) {
    p = p || {};
    var txt = function (v, n) { return Array.from(String(v || '').replace(/[\u0000-\u001f<>&"'`\\{}]/g, '')).slice(0, n).join('').trim(); };
    return {
      c1: hex(p.c1, '#ff6ec7'), c2: hex(p.c2, '#7b5cff'), c3: hex(p.c3, '#3fa9ff'),
      angle: [0, 45, 90, 135, 180, 225, 270, 315].indexOf(+p.angle) >= 0 ? +p.angle : 135,
      style: STYLES.indexOf(p.style) >= 0 ? p.style : 'gradient',
      anim: ANIMS.indexOf(p.anim) >= 0 ? p.anim : 'none',
      speed: Math.max(1, Math.min(3, Math.round(+p.speed || 2))),
      emoji: txt(p.emoji, 3), text: txt(p.text, 18), textColor: hex(p.textColor, '#ffffff'),
    };
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function rnd(seed) { var x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }
  function hueShift(h, deg) { // rotate a hex color's hue (for the rainbow animation keyframes)
    var n = parseInt(h.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, s = 0, hh = 0, d = mx - mn;
    if (d) { s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; }
    hh = (hh + deg) % 360; s = Math.max(s, 0.55); l = Math.min(Math.max(l, 0.35), 0.7);
    return 'hsl(' + Math.round(hh) + ',' + Math.round(s * 100) + '%,' + Math.round(l * 100) + '%)';
  }
  function svg(p) {
    p = clean(p);
    var W = 600, H = 200, dur = [0, 9, 5, 3][p.speed], out = [];
    out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice">');
    out.push('<defs>');
    // background gradient (wide so it can slide)
    var stops = [p.c1, p.c2, p.c3, p.c1], shift = p.anim === 'shift';
    out.push('<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="' + (shift ? W * 2 : W) + '" y2="0" gradientTransform="rotate(' + p.angle + ' ' + W / 2 + ' ' + H / 2 + ')"' + (shift ? ' spreadMethod="repeat"' : '') + '>');
    (shift ? stops : [p.c1, p.c2, p.c3]).forEach(function (c, i, a) {
      var anim = p.anim === 'rainbow' ? '<animate attributeName="stop-color" dur="' + dur * 1.5 + 's" repeatCount="indefinite" values="' + [0, 90, 180, 270, 360].map(function (d) { return hueShift(c, d); }).join(';') + '"/>' : '';
      out.push('<stop offset="' + (i / (a.length - 1)).toFixed(3) + '" stop-color="' + c + '">' + anim + '</stop>');
    });
    if (shift) out.push('<animateTransform attributeName="gradientTransform" type="translate" additive="sum" from="0 0" to="' + (-W * 2) + ' 0" dur="' + dur + 's" repeatCount="indefinite"/>');
    out.push('</linearGradient>');
    // pattern layer
    var pat = '', ps = 40;
    if (p.style === 'stripes') { ps = 30; pat = '<rect x="0" y="0" width="12" height="30" fill="#fff" fill-opacity=".14"/>'; }
    else if (p.style === 'dots') { ps = 32; pat = '<circle cx="8" cy="8" r="5" fill="#fff" fill-opacity=".18"/><circle cx="24" cy="24" r="5" fill="#fff" fill-opacity=".18"/>'; }
    else if (p.style === 'waves') { ps = 60; pat = '<path d="M0 20 Q15 8 30 20 T60 20" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="5"/><path d="M0 50 Q15 38 30 50 T60 50" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="5"/>'; }
    else if (p.style === 'checker') { ps = 40; pat = '<rect width="20" height="20" fill="#fff" fill-opacity=".12"/><rect x="20" y="20" width="20" height="20" fill="#fff" fill-opacity=".12"/>'; }
    else if (p.style === 'stars') { ps = 50; pat = '<path d="M12 4 L14 10 L20 12 L14 14 L12 20 L10 14 L4 12 L10 10Z" fill="#fff" fill-opacity=".28"/><path d="M37 29 L38 33 L42 34 L38 35 L37 39 L36 35 L32 34 L36 33Z" fill="#fff" fill-opacity=".22"/>'; }
    else if (p.style === 'hearts') { ps = 48; pat = '<path d="M14 22 C4 14 8 4 14 10 C20 4 24 14 14 22Z" fill="#fff" fill-opacity=".22"/><path d="M38 44 C30 38 33 30 38 35 C43 30 46 38 38 44Z" fill="#fff" fill-opacity=".16"/>'; }
    var stripesRot = p.style === 'stripes' ? ' patternTransform="rotate(35)"' : '';
    if (pat) {
      out.push('<pattern id="p" width="' + ps + '" height="' + ps + '" patternUnits="userSpaceOnUse"' + stripesRot + '>' + pat + '</pattern>');
    }
    if (p.emoji) out.push('<pattern id="e" width="90" height="90" patternUnits="userSpaceOnUse"><text x="10" y="40" font-size="32">' + esc(p.emoji) + '</text><text x="55" y="85" font-size="32">' + esc(p.emoji) + '</text></pattern>');
    if (p.anim === 'shimmer') out.push('<linearGradient id="sh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>');
    out.push('</defs>');
    out.push('<rect width="' + W + '" height="' + H + '" fill="url(#g)"/>');
    var scroll = p.anim === 'scroll' ? '<animateTransform attributeName="transform" type="translate" from="0 0" to="-90 -90" dur="' + dur + 's" repeatCount="indefinite"/>' : '';
    if (pat) out.push('<g><rect x="-200" y="-200" width="' + (W + 400) + '" height="' + (H + 400) + '" fill="url(#p)">' + (p.anim === 'scroll' ? '<animateTransform attributeName="transform" type="translate" from="0 0" to="' + (-ps * 3) + ' ' + (-ps * 3) + '" dur="' + dur + 's" repeatCount="indefinite"/>' : '') + '</rect></g>');
    if (p.emoji) out.push('<rect x="-200" y="-200" width="' + (W + 400) + '" height="' + (H + 400) + '" fill="url(#e)" opacity=".9">' + scroll + '</rect>');
    if (p.anim === 'pulse') out.push('<rect width="' + W + '" height="' + H + '" fill="#fff" opacity="0"><animate attributeName="opacity" values="0;.22;0" dur="' + dur / 2 + 's" repeatCount="indefinite"/></rect>');
    if (p.anim === 'shimmer') out.push('<rect x="-260" y="-100" width="200" height="' + (H + 200) + '" fill="url(#sh)" transform="rotate(20)"><animate attributeName="x" from="-300" to="' + (W + 200) + '" dur="' + dur / 1.5 + 's" repeatCount="indefinite"/></rect>');
    if (p.anim === 'sparkle' || p.anim === 'twinkle') {
      for (var i = 0; i < 14; i++) {
        var x = Math.round(rnd(i + 1) * W), y = Math.round(rnd(i + 51) * H), s = 4 + rnd(i + 99) * 7, d = (1.2 + rnd(i + 7) * 2) * (4 - p.speed) / 2, b = (rnd(i + 3) * 3).toFixed(2);
        var shape = p.anim === 'sparkle' ? '<path d="M0 ' + (-s) + ' L' + s / 4 + ' ' + (-s / 4) + ' L' + s + ' 0 L' + s / 4 + ' ' + s / 4 + ' L0 ' + s + ' L' + (-s / 4) + ' ' + s / 4 + ' L' + (-s) + ' 0 L' + (-s / 4) + ' ' + (-s / 4) + 'Z" fill="#fff"/>' : '<circle r="' + (s / 3).toFixed(1) + '" fill="#fff"/>';
        out.push('<g transform="translate(' + x + ' ' + y + ')" opacity="0">' + shape + '<animate attributeName="opacity" values="0;1;0" dur="' + d.toFixed(2) + 's" begin="' + b + 's" repeatCount="indefinite"/></g>');
      }
    }
    if (p.text) out.push('<text x="' + W / 2 + '" y="' + (H / 2 + 22) + '" text-anchor="middle" font-family="Fredoka,Arial Rounded MT Bold,system-ui,sans-serif" font-weight="800" font-size="64" fill="' + p.textColor + '" stroke="#1b1636" stroke-width="7" paint-order="stroke" stroke-linejoin="round">' + esc(p.text) + '</text>');
    out.push('</svg>');
    return out.join('');
  }
  function css(p) { return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(p)) + '") center/cover no-repeat, ' + clean(p).c2; }
  var api = { clean: clean, svg: svg, css: css, STYLES: STYLES, ANIMS: ANIMS };
  (typeof globalThis !== 'undefined' ? globalThis : window).SHBanner = api;
})();
