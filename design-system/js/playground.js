/* Edexcel IAL Visual Playground — runtime helpers. One classic script; no imports, no network. */
window.Playground = (function () {
  'use strict';
  var PALETTES = {"catppuccin":{"name":"Catppuccin","light":{"v":"Latte","bg":"#eff1f5","surf":"#ffffff","ink":"#4c4f69","muted":"#6c6f85","line":"#ccd0da","accent":"#1e66f5","redox":"#d20f39","ligand":"#8839ef","acidbase":"#40a02b","amph":"#df8e1d","cond":"#ea76cb","b1":"#7287fd","b2":"#ea76cb","b3":"#179299"},"dark":{"v":"Mocha","bg":"#1e1e2e","surf":"#313244","ink":"#cdd6f4","muted":"#a6adc8","line":"#45475a","accent":"#89b4fa","redox":"#f38ba8","ligand":"#cba6f7","acidbase":"#a6e3a1","amph":"#f9e2af","cond":"#f5c2e7","b1":"#cba6f7","b2":"#89b4fa","b3":"#f5c2e7"}},"tokyo":{"name":"Tokyo Night","light":{"v":"Day","bg":"#e1e2e7","surf":"#f4f5f9","ink":"#3760bf","muted":"#6172b0","line":"#c4c8da","accent":"#2e7de9","redox":"#f52a65","ligand":"#9854f1","acidbase":"#587539","amph":"#b15c00","cond":"#007197","b1":"#2e7de9","b2":"#9854f1","b3":"#007197"},"dark":{"v":"Night","bg":"#1a1b26","surf":"#24283b","ink":"#c0caf5","muted":"#9aa5ce","line":"#3b4261","accent":"#7aa2f7","redox":"#f7768e","ligand":"#bb9af7","acidbase":"#9ece6a","amph":"#e0af68","cond":"#7dcfff","b1":"#7aa2f7","b2":"#bb9af7","b3":"#7dcfff"}},"nord":{"name":"Nord","light":{"v":"Snow Storm","bg":"#e5e9f0","surf":"#f6f8fb","ink":"#2e3440","muted":"#4c566a","line":"#d1d8e3","accent":"#5e81ac","redox":"#bf616a","ligand":"#9a6f94","acidbase":"#6d8a55","amph":"#b97d1e","cond":"#4f8a89","b1":"#88c0d0","b2":"#81a1c1","b3":"#b48ead"},"dark":{"v":"Polar Night","bg":"#2e3440","surf":"#3b4252","ink":"#eceff4","muted":"#c0c8d6","line":"#4c566a","accent":"#88c0d0","redox":"#bf616a","ligand":"#b48ead","acidbase":"#a3be8c","amph":"#ebcb8b","cond":"#8fbcbb","b1":"#5e81ac","b2":"#88c0d0","b3":"#b48ead"}},"rosepine":{"name":"Rosé Pine","light":{"v":"Dawn","bg":"#faf4ed","surf":"#fffaf3","ink":"#575279","muted":"#797593","line":"#dfdad9","accent":"#286983","redox":"#b4637a","ligand":"#907aa9","acidbase":"#56949f","amph":"#ea9d34","cond":"#d7827e","b1":"#d7827e","b2":"#907aa9","b3":"#56949f"},"dark":{"v":"Moon","bg":"#232136","surf":"#2a273f","ink":"#e0def4","muted":"#908caa","line":"#44415a","accent":"#9ccfd8","redox":"#eb6f92","ligand":"#c4a7e7","acidbase":"#3e8fb0","amph":"#f6c177","cond":"#ea9a97","b1":"#ea9a97","b2":"#c4a7e7","b3":"#3e8fb0"}},"gruvbox":{"name":"Gruvbox","light":{"v":"Light","bg":"#fbf1c7","surf":"#fdf6dc","ink":"#3c3836","muted":"#7c6f64","line":"#d5c4a1","accent":"#076678","redox":"#9d0006","ligand":"#8f3f71","acidbase":"#79740e","amph":"#b57614","cond":"#427b58","b1":"#d79921","b2":"#689d6a","b3":"#d65d0e"},"dark":{"v":"Dark","bg":"#282828","surf":"#3c3836","ink":"#ebdbb2","muted":"#a89984","line":"#504945","accent":"#83a598","redox":"#fb4934","ligand":"#d3869b","acidbase":"#b8bb26","amph":"#fabd2f","cond":"#8ec07c","b1":"#fe8019","b2":"#83a598","b3":"#8ec07c"}},"everforest":{"name":"Everforest","light":{"v":"Light","bg":"#fdf6e3","surf":"#fffbef","ink":"#5c6a72","muted":"#829181","line":"#e0dcc7","accent":"#3a94c5","redox":"#f85552","ligand":"#df69ba","acidbase":"#8da101","amph":"#dfa000","cond":"#f57d26","b1":"#93b259","b2":"#35a77c","b3":"#e66868"},"dark":{"v":"Dark","bg":"#2d353b","surf":"#343f44","ink":"#d3c6aa","muted":"#9da9a0","line":"#475258","accent":"#7fbbb3","redox":"#e67e80","ligand":"#d699b6","acidbase":"#a7c080","amph":"#dbbc7f","cond":"#e69875","b1":"#a7c080","b2":"#83c092","b3":"#e69875"}}};
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var KEY = 'chem-';
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(KEY + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) {} }
  };
  var root = document.documentElement;
  var state = { palette: 'catppuccin', mode: 'auto' };
  var mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : { matches: false };
  var listeners = [];

  function effMode() { return state.mode !== 'auto' ? state.mode : (root.getAttribute('data-theme') || (mq.matches ? 'dark' : 'light')); }
  function apply() {
    var m = effMode();
    root.setAttribute('data-palette', state.palette); root.setAttribute('data-mode', m);
    listeners.forEach(function (f) { f(getTheme()); });
  }
  function getTheme() {
    var m = effMode(), P = PALETTES[state.palette];
    return { palette: state.palette, mode: state.mode, effective: m, name: P.name, variant: P[m].v, colors: P[m] };
  }
  /* setTheme({palette, mode}, event?) — mode is 'auto' | 'light' | 'dark'. With an event, plays the circular reveal from the click. */
  function setTheme(next, ev) {
    var go = function () {
      if (next.palette && PALETTES[next.palette]) state.palette = next.palette;
      if (next.mode) state.mode = next.mode;
      apply(); store.set('palette', state.palette); store.set('mode', state.mode);
    };
    if (!ev || !document.startViewTransition || RM) { go(); return; }
    var x = ev.clientX, y = ev.clientY, rad = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    var t = document.startViewTransition(go);
    t.ready.then(function () {
      root.animate({ clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + rad + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 650, easing: 'cubic-bezier(.22,.7,.2,1)', pseudoElement: '::view-transition-new(root)' });
    }).catch(function () {});
  }
  /* initTheme() — restore the saved palette + mode and follow the OS / host data-theme while on Auto. */
  function initTheme() {
    state.palette = store.get('palette', 'catppuccin'); if (!PALETTES[state.palette]) state.palette = 'catppuccin';
    state.mode = store.get('mode', 'auto');
    if (mq.addEventListener) mq.addEventListener('change', apply);
    new MutationObserver(function () { if (state.mode === 'auto') apply(); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    apply();
    return getTheme();
  }
  function onTheme(f) { listeners.push(f); }

  /* themePicker(container) — renders the glass theme pill + popover into container and wires it up. */
  function themePicker(host) {
    host.classList.add('theme-wrap');
    host.innerHTML = '<button class="theme-btn" type="button" aria-haspopup="true" aria-expanded="false"><span class="dots"></span><span class="theme-name"></span></button>' +
      '<div class="theme-pop" hidden><div class="tp-h"><b>Palette</b><b class="tp-note"></b></div><div class="tp-list"></div>' +
      '<div class="tp-mode"><div class="seg" role="group" aria-label="Light or dark"><button type="button" data-tm="auto">Auto</button><button type="button" data-tm="light">Light</button><button type="button" data-tm="dark">Dark</button></div></div></div>';
    var btn = host.querySelector('.theme-btn'), pop = host.querySelector('.theme-pop');
    var sw = function (c) { return '<span class="tp-sw" style="--pb:' + c.bg + ';background:' + c.bg + '">' + [c.accent, c.redox, c.ligand, c.acidbase, c.amph].map(function (x) { return '<i style="background:' + x + '"></i>'; }).join('') + '</span>'; };
    host.querySelector('.tp-list').innerHTML = Object.keys(PALETTES).map(function (k) { var P = PALETTES[k];
      return '<button type="button" class="tp-row" data-p="' + k + '"><span><span class="nm">' + P.name + '</span><span class="vn">' + P.light.v + ' · ' + P.dark.v + '</span></span>' + sw(P.light) + sw(P.dark) + '</button>'; }).join('');
    function paint(t) {
      host.querySelector('.theme-name').innerHTML = t.name + '<span class="tsep" aria-hidden="true"></span><span class="tvar">' + t.variant + '</span>';
      host.querySelector('.dots').innerHTML = [t.colors.accent, t.colors.redox, t.colors.ligand, t.colors.acidbase].map(function (x) { return '<i style="background:' + x + '"></i>'; }).join('');
      host.querySelector('.tp-note').textContent = t.mode === 'auto' ? 'Auto · ' + t.effective : t.mode;
      host.querySelectorAll('.tp-row').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.p === t.palette); });
      host.querySelectorAll('[data-tm]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.tm === t.mode); });
    }
    onTheme(paint); paint(getTheme());
    host.querySelectorAll('.tp-row').forEach(function (b) { b.onclick = function (e) { setTheme({ palette: b.dataset.p }, e); }; });
    host.querySelectorAll('[data-tm]').forEach(function (b) { b.onclick = function (e) { setTheme({ mode: b.dataset.tm }, e); }; });
    var close = function () { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.onclick = function (e) { e.stopPropagation(); pop.hidden = !pop.hidden; btn.setAttribute('aria-expanded', String(!pop.hidden)); };
    document.addEventListener('click', function (e) { if (!host.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    indicators(host);
    return { open: function () { pop.hidden = false; }, close: close };
  }

  /* indicators(scope) — one sliding pill per .tabs / .seg (selected via aria-selected / aria-pressed) and an underline per .subtabs. Snaps on first placement, springs after. */
  function syncInd(c, instant) {
    var ind = c.querySelector(':scope>.ind');
    var sel = c.querySelector(':scope>button[aria-selected="true"],:scope>button[aria-pressed="true"]');
    if (!ind) { ind = document.createElement('span'); ind.className = 'ind'; c.prepend(ind); c.classList.add('has-ind'); instant = true; }
    if (!sel || !sel.offsetParent) { ind.style.opacity = 0; ind.dataset.placed = ''; return; }
    if (!ind.dataset.placed) instant = true;
    ind.dataset.placed = '1';
    if (instant) ind.classList.add('no-anim');
    ind.style.opacity = 1;
    if (c.classList.contains('subtabs')) { ind.style.left = sel.offsetLeft + 'px'; ind.style.width = sel.offsetWidth + 'px'; ind.style.top = (sel.offsetTop + sel.offsetHeight - 2.5) + 'px'; ind.style.height = '2.5px'; }
    else { ind.style.left = sel.offsetLeft + 'px'; ind.style.top = sel.offsetTop + 'px'; ind.style.width = sel.offsetWidth + 'px'; ind.style.height = sel.offsetHeight + 'px'; }
    if (instant) { void ind.offsetWidth; requestAnimationFrame(function () { ind.classList.remove('no-anim'); }); }
  }
  function indicators(scope) {
    var list = Array.prototype.slice.call((scope || document).querySelectorAll('.tabs,.seg,.subtabs'));
    list.forEach(function (c) {
      if (c._pgInd) return; c._pgInd = true;
      new MutationObserver(function () { syncInd(c); }).observe(c, { subtree: true, attributes: true, attributeFilter: ['aria-selected', 'aria-pressed'] });
      if (window.ResizeObserver) new ResizeObserver(function () { syncInd(c); }).observe(c);
      syncInd(c, true);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { list.forEach(function (c) { syncInd(c, true); }); });
  }

  /* glint(selector) — a soft accent light follows a MOUSE pointer across matching glass cards. */
  function glint(sel) {
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse' || !e.target.closest) return;
      var el = e.target.closest(sel); if (!el) return;
      el.classList.add('glint');
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px'); el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }
  /* fadeIn(el) — the one short view-switch crossfade (0.3s, opacity + 3px lift). */
  function fadeIn(el) { if (!el || RM) return; el.classList.remove('view-in'); void el.offsetWidth; el.classList.add('view-in'); }
  /* boot() — rise-in on first load only. */
  function boot() { root.classList.add('booting'); setTimeout(function () { root.classList.remove('booting'); }, 1400); }
  /* enter(el) — stagger children (cards, flow boxes) after a filter change only. */
  function enter(el, sel) {
    if (!el) return;
    Array.prototype.forEach.call(el.querySelectorAll(sel || '.rxc,.tcx,.tech,.proc,.cc,.flow,.rx,.at'), function (c, i) { c.style.setProperty('--i', Math.min(i, 14)); });
    el.classList.add('enter'); clearTimeout(el._et); el._et = setTimeout(function () { el.classList.remove('enter'); }, 1600);
  }
  /* bump(el) — the stat-pill bump when a value changes. */
  function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

  /* chem(text) → HTML: '->' → arrow, '<=>' → equilibrium, ^2- → superscript, digits after a symbol → subscript. plain(text) does the same with Unicode for copying. */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function chem(s) {
    s = esc(String(s).replace(/<=>/g, '⇌').replace(/->/g, '→'));
    s = s.replace(/\^(\d*[+-])/g, function (m, c) { return '<sup>' + c.replace('-', '−') + '</sup>'; });
    return s.replace(/([A-Za-z\)\]])(\d+)/g, '$1<sub>$2</sub>');
  }
  var SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻' };
  function plain(s) {
    return String(s).replace(/<=>/g, '⇌').replace(/->/g, '→')
      .replace(/\^(\d*[+-])/g, function (m, c) { return c.split('').map(function (x) { return SUP[x]; }).join(''); })
      .replace(/([A-Za-z\)\]])(\d+)/g, function (m, a, d) { return a + d.split('').map(function (x) { return String.fromCharCode(0x2080 + +x); }).join(''); });
  }
  /* copy(button, text) — clipboard with a fallback; the button's <span> flips to 'Copied'. Call from a click. */
  function copy(btn, text) {
    var done = function (ok) { var sp = btn.querySelector('span') || btn; sp.textContent = ok ? 'Copied' : 'Select the text'; btn.classList.toggle('done', ok);
      clearTimeout(btn._t); btn._t = setTimeout(function () { sp.textContent = 'Copy'; btn.classList.remove('done'); }, 1600); };
    var fb = function () { try { var t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0;left:-9999px'; document.body.appendChild(t); t.select(); var ok = document.execCommand('copy'); t.remove(); done(ok); } catch (e) { done(false); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, fb); else fb();
  }

  /* drawer({dock, sheet, backdrop}) — the phone bottom sheet. open(pane), close(fast), swipe down to close; panes are [data-pane] children of the sheet. */
  function drawer(o) {
    var sheet = o.sheet, bg = o.backdrop, dock = o.dock, api = { isOpen: false };
    function setPane(p) {
      sheet.querySelectorAll('.pane').forEach(function (el) { el.hidden = el.dataset.pane !== p; });
      sheet.querySelectorAll('.sheet-head [data-pane]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.pane === p); });
      api.pane = p;
    }
    api.open = function (p) { setPane(p || api.pane || 'a'); api.isOpen = true; sheet.classList.remove('away'); sheet.style.removeProperty('--dy'); sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false'); bg && bg.classList.add('on'); root.classList.add('sheet-open'); };
    api.close = function (fast) { api.isOpen = false; sheet.classList.toggle('away', !!fast); sheet.classList.remove('open', 'dragging'); sheet.style.removeProperty('--dy'); sheet.setAttribute('aria-hidden', 'true'); bg && bg.classList.remove('on'); root.classList.remove('sheet-open'); };
    if (dock) dock.addEventListener('click', function (e) { var b = e.target.closest('[data-dock]'); if (!b) return; if (api.isOpen && api.pane === b.dataset.dock) api.close(); else api.open(b.dataset.dock); });
    sheet.addEventListener('click', function (e) { var b = e.target.closest('.sheet-head [data-pane]'); if (b) setPane(b.dataset.pane); if (e.target.closest('[data-close]')) api.close(); });
    if (bg) bg.onclick = function () { api.close(); };
    var sw = null;
    sheet.querySelectorAll('.sheet-grab,.sheet-head').forEach(function (h) { h.addEventListener('pointerdown', function (e) { if (api.isOpen) sw = { y: e.clientY, id: e.pointerId, dy: 0 }; }); });
    document.addEventListener('pointermove', function (e) { if (!sw || e.pointerId !== sw.id) return; sw.dy = Math.max(0, e.clientY - sw.y); if (sw.dy > 6) { sheet.classList.add('dragging'); sheet.style.setProperty('--dy', sw.dy + 'px'); } });
    var end = function (e) { if (!sw || e.pointerId !== sw.id) return; var d = sw.dy; sw = null; sheet.classList.remove('dragging'); if (d > 80) api.close(); else sheet.style.removeProperty('--dy'); };
    document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
    return api;
  }

  return { PALETTES: PALETTES, initTheme: initTheme, setTheme: setTheme, getTheme: getTheme, onTheme: onTheme, themePicker: themePicker,
    indicators: indicators, glint: glint, fadeIn: fadeIn, boot: boot, enter: enter, bump: bump, chem: chem, plain: plain, copy: copy, drawer: drawer };
})();
