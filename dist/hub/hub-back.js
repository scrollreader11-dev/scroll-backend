/* Back-to-hub handle for pages opened directly (not inside the hub's player). */
(function () {
  'use strict';
  try { if (window.top !== window.self) return; } catch (e) { return; }
  if (document.getElementById('shBackHub')) return;
  var css = document.createElement('style');
  css.textContent = '#shBackHub{position:fixed;left:0;top:42%;z-index:2147483000;display:flex;align-items:center;gap:8px;height:46px;padding:0 12px 0 8px;border-radius:0 14px 14px 0;color:#fff;font:600 14px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;text-decoration:none;background:rgba(8,14,32,.78);border:1px solid rgba(150,185,255,.28);border-left:0;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:0 8px 24px rgba(0,0,0,.4);transform:translateX(calc(-100% + 30px));transition:transform .28s cubic-bezier(.2,.8,.2,1);padding-left:calc(8px + env(safe-area-inset-left,0px));-webkit-tap-highlight-color:transparent}#shBackHub:hover,#shBackHub:focus-visible,#shBackHub.open{transform:none;outline:none}#shBackHub svg{width:18px;height:18px;flex:none;opacity:.9}#shBackHub span{white-space:nowrap}@media (prefers-reduced-motion:reduce){#shBackHub{transition:none}}';
  document.head.appendChild(css);
  var a = document.createElement('a'); a.id = 'shBackHub'; a.href = '/'; a.setAttribute('aria-label', 'Back to ScrollHub');
  a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg><span>ScrollHub</span>';
  // On touch screens the first tap reveals the handle, the second one goes back.
  a.addEventListener('click', function (e) { if (matchMedia('(hover: none)').matches && !a.classList.contains('open')) { e.preventDefault(); a.classList.add('open'); setTimeout(function () { a.classList.remove('open'); }, 3500); } });
  (document.body || document.documentElement).appendChild(a);
})();
