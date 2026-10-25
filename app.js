/* Общая логика: тема, прогресс между страницами, финал комнаты, штрафы, сердце из точек. */
(function () {
  'use strict';
  var KEY = 'otk-v3';
  var LV = [
    { id: 'l1', href: 'l1.html', name: 'Чёрное и белое', kind: 'внимание' },
    { id: 'l2', href: 'l2.html', name: 'Зеркало', kind: 'рука и глаз' },
    { id: 'l3', href: 'l3.html', name: 'Нервы', kind: 'терпение' },
    { id: 'l4', href: 'l4.html', name: 'Память', kind: 'запоминание' },
    { id: 'l5', href: 'l5.html', name: 'Допрос', kind: 'логика' },
    { id: 'l6', href: 'l6.html', name: 'Правда или действие', kind: 'честность' }
  ];
  var mem = null;
  var storageOk = true;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function load() {
    try { var s = localStorage.getItem(KEY); return s ? JSON.parse(s) : {}; }
    catch (e) { storageOk = false; return {}; }
  }
  function get() { if (!mem) { mem = load(); } if (!mem.lv) mem.lv = {}; return mem; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { storageOk = false; } }
  function lv(id) { var m = get(); if (!m.lv[id]) m.lv[id] = { fails: 0 }; return m.lv[id]; }

  var App = { LV: LV, $: $, $$: $$ };

  App.storageOk = function () { get(); try { localStorage.setItem('otk-t', '1'); localStorage.removeItem('otk-t'); } catch (e) { storageOk = false; } return storageOk; };
  App.name = function () { return get().name || ''; };
  App.setName = function (v) { get().name = v; save(); };
  App.cheat = function () { return !!get().cheat; };
  App.setCheat = function () { get().cheat = true; save(); };
  App.reset = function () { mem = { lv: {} }; save(); };
  App.done = function (id) { return !!lv(id).done; };
  App.stat = function (id) { return lv(id); };
  App.doneCount = function () { return LV.filter(function (l) { return App.done(l.id); }).length; };
  App.allDone = function () { return App.doneCount() === LV.length; };
  App.unlocked = function (i) { return i === 0 || App.done(LV[i - 1].id) || App.cheat(); };
  App.bump = function (id, key) { var o = lv(id); o[key] = (o[key] || 0) + 1; save(); return o[key]; };
  App.set = function (id, obj) { var o = lv(id); for (var k in obj) o[k] = obj[k]; save(); };
  App.fmt = function (s) { return s.toFixed(1).replace('.', ',') + ' с'; };
  App.norm = function (s) { return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]/g, ''); };

  App.guard = function (i) {
    if (App.unlocked(i)) return true;
    var g = $('#game'), l = $('#locked');
    if (g) g.hidden = true;
    if (l) l.hidden = false;
    return false;
  };
  App.finish = function (i, stats, msg, forfeit) {
    var o = lv(LV[i].id);
    o.done = true; if (forfeit) o.forfeit = true;
    for (var k in (stats || {})) o[k] = stats[k];
    save();
    var a = $('#after');
    if (!a) return;
    $('#after-msg').textContent = msg;
    var last = i >= LV.length - 1;
    var n = $('#next');
    n.href = last ? 'finale.html' : LV[i + 1].href;
    n.textContent = last ? 'К вердикту →' : 'Следующая комната →';
    var f = $('#forfeit'); if (f) f.hidden = true;
    a.hidden = false;
    a.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'center' });
  };
  App.offerForfeit = function (i, text) {
    var f = $('#forfeit');
    if (!f || !f.hidden || App.done(LV[i].id)) return;
    $('#forfeit-t').textContent = text;
    f.hidden = false;
    $('#forfeit-b').onclick = function () {
      App.finish(i, {}, 'Штраф принят, комната засчитана. Но я запомнил, что ты сдалась.', true);
    };
  };
  function reduce() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  App.reduce = reduce;

  /* тема */
  var root = document.documentElement;
  try {
    var st = localStorage.getItem('otk-theme');
    if (st === 'light' || st === 'dark') root.setAttribute('data-theme', st);
  } catch (e) {}
  function isLight() {
    var t = root.getAttribute('data-theme');
    if (t) return t === 'light';
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  }
  var hearts = [];
  App.hearts = hearts;
  document.addEventListener('DOMContentLoaded', function () {
    var t = $('#theme');
    if (t) t.addEventListener('click', function () {
      var next = isLight() ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('otk-theme', next); } catch (e) {}
      hearts.forEach(function (h) { h.recolor(); });
      document.dispatchEvent(new Event('themechange'));
    });
    $$('[data-track]').forEach(function (el) {
      var text = el.getAttribute('data-track');
      var n = +el.getAttribute('data-copies') || 4;
      var h = '';
      for (var i = 0; i < n; i++) h += '<span></span>';
      el.innerHTML = h;
      $$('span', el).forEach(function (s) { s.textContent = text; });
    });
  });

  /* ---------- сердце из точек ---------- */
  App.Heart = function (canvas, o) {
    o = o || {};
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, pts = [], ptr = { x: -999, y: -999, on: false };
    var phase = 0, bpm = 72, color = '#fff', running = false, last = 0, frame = 0;
    var self = {};
    var rm = reduce();
    function recolor() { color = getComputedStyle(canvas).color || '#fff'; }
    function build() {
      var r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var s = W < 420 ? 0.06 : 0.046;
      var scale = Math.min(W, H) * 0.37, cx = W / 2, cy = H / 2;
      var rs = Math.max(0.75, scale / 150);
      pts = [];
      var j = 0;
      for (var y = -1.15; y <= 1.4; y += s, j++) {
        for (var x = -1.4 + (j % 2) * s / 2; x <= 1.4; x += s) {
          var a = x * x + y * y - 1;
          if (a * a * a - x * x * y * y * y <= 0) {
            var sh = Math.max(0, Math.min(1, 0.5 + (-x + y) / 2.6));
            var hx = cx + x * scale, hy = cy - (y - 0.12) * scale;
            pts.push({ hx: hx, hy: hy, x: hx, y: hy, vx: 0, vy: 0, r: (0.9 + 1.7 * sh) * rs, k: 0.04 + Math.random() * 0.04 });
          }
        }
      }
      recolor();
      if (o.scatterOnBuild) self.scatter();
      if (rm || !running) draw();
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = color;
      ctx.beginPath();
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        ctx.moveTo(p.x + p.r, p.y);
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
      }
      ctx.fill();
    }
    function step(dt) {
      var target = ptr.on ? 138 : 72;
      bpm += (target - bpm) * Math.min(1, dt * 2);
      phase += dt * bpm / 60;
      var q = phase % 1;
      var a = Math.max(0, 1 - Math.abs(q - 0.04) * 10) + 0.6 * Math.max(0, 1 - Math.abs(q - 0.2) * 10);
      var beat = 1 + 0.05 * a;
      var cx = W / 2, cy = H / 2;
      var R = Math.max(60, W * 0.17), R2 = R * R;
      var m = dt * 60, damp = Math.pow(0.84, m);
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        var tx = cx + (p.hx - cx) * beat, ty = cy + (p.hy - cy) * beat;
        p.vx += (tx - p.x) * p.k * m;
        p.vy += (ty - p.y) * p.k * m;
        if (ptr.on) {
          var dx = p.x - ptr.x, dy = p.y - ptr.y, d2 = dx * dx + dy * dy;
          if (d2 < R2 && d2 > 0.01) {
            var d = Math.sqrt(d2), f = (1 - d / R) * 2.4 * m;
            p.vx += dx / d * f; p.vy += dy / d * f;
          }
        }
        p.vx *= damp; p.vy *= damp;
        p.x += p.vx * m; p.y += p.vy * m;
      }
      draw();
    }
    function loop(now) {
      if (!running) return;
      var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      step(dt);
      frame++;
      if (frame % 30 === 0) recolor();
      if (o.onTick && frame % 6 === 0) o.onTick(bpm);
      requestAnimationFrame(loop);
    }
    self.start = function () {
      if (rm) { build(); return; }
      if (running) return;
      running = true; last = performance.now();
      requestAnimationFrame(loop);
    };
    self.stop = function () { running = false; };
    self.build = build;
    self.recolor = function () { recolor(); if (rm || !running) draw(); };
    self.scatter = function () {
      if (rm) return;
      pts.forEach(function (p) { p.x = Math.random() * W; p.y = Math.random() * H; p.vx = 0; p.vy = 0; });
    };
    self.burst = function () {
      var cx = W / 2, cy = H / 2;
      pts.forEach(function (p) {
        var dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1, sp = 6 + Math.random() * 8;
        p.vx += dx / d * sp; p.vy += dy / d * sp;
      });
    };
    function setPtr(e, on) {
      var r = canvas.getBoundingClientRect();
      ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; ptr.on = on;
    }
    canvas.addEventListener('pointermove', function (e) { setPtr(e, true); });
    canvas.addEventListener('pointerdown', function (e) { setPtr(e, true); self.burst(); });
    canvas.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') ptr.on = false; });
    canvas.addEventListener('pointerleave', function () { ptr.on = false; });
    canvas.addEventListener('pointercancel', function () { ptr.on = false; });
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(function () { build(); }).observe(canvas);
    if (o.auto && typeof IntersectionObserver !== 'undefined') {
      new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) self.start(); else self.stop(); }); }, { threshold: 0.05 }).observe(canvas);
    } else if (o.auto) { self.start(); }
    build();
    hearts.push(self);
    return self;
  };

  window.App = App;
})();
