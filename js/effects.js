// Solar System theme: the starfield behind the page and the particle blasts on merges.
window.Effects = (function () {
  "use strict";
  var TAU = Math.PI * 2;
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var rgba = Planets.rgba;

  var fx = { parts: [], rings: [], flashes: [], rays: [], singular: false, dirty: false };
  var board, boardWrap, fxc, fctx, stc, sctx;
  var VW = 0, VH = 0, last = 0, started = false;
  var stars = [];

  function sizeCanvases() {
    VW = window.innerWidth; VH = window.innerHeight;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    [[fxc, fctx], [stc, sctx]].forEach(function (p) {
      p[0].width = Math.round(VW * dpr); p[0].height = Math.round(VH * dpr);
      p[1].setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    stars.length = 0;
    var n = Math.min(380, Math.round(VW * VH / 4200));
    var tints = [[255, 255, 255], [205, 218, 255], [255, 228, 196]];
    for (var i = 0; i < n; i++) {
      stars.push({ x: Math.random() * VW, y: Math.random() * VH, r: 0.35 + Math.pow(Math.random(), 3) * 1.4,
        a: 0.25 + Math.random() * 0.7, ph: Math.random() * TAU, sp: 0.5 + Math.random() * 2,
        z: 0.3 + Math.random() * 0.7, c: tints[(Math.random() * 3) | 0] });
    }
    drawStars(0, performance.now(), true);
  }

  function respawn(s) {
    var e = (Math.random() * 4) | 0;
    if (e === 0) { s.x = Math.random() * VW; s.y = -4; }
    else if (e === 1) { s.x = VW + 4; s.y = Math.random() * VH; }
    else if (e === 2) { s.x = Math.random() * VW; s.y = VH + 4; }
    else { s.x = -4; s.y = Math.random() * VH; }
  }

  // Normally the stars drift and twinkle. Past the event horizon they spiral toward the board.
  function drawStars(dt, now, force) {
    if (REDUCED && !force) return;
    sctx.clearRect(0, 0, VW, VH);
    var sing = fx.singular && !REDUCED, bc = null;
    if (sing) { var r = board.getBoundingClientRect(); bc = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var al = s.a * (REDUCED ? 1 : 0.7 + 0.3 * Math.sin(now * 0.001 * s.sp + s.ph));
      if (sing) {
        var dx = bc.x - s.x, dy = bc.y - s.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
        var sp = (14 + 5200 / Math.max(d, 50)) * s.z, vx = ux * sp - uy * sp * 0.7, vy = uy * sp + ux * sp * 0.7;
        s.x += vx * dt; s.y += vy * dt;
        if (d < 26) { respawn(s); continue; }
        sctx.strokeStyle = rgba(s.c, al); sctx.lineWidth = s.r;
        sctx.beginPath(); sctx.moveTo(s.x, s.y); sctx.lineTo(s.x - vx * 0.05, s.y - vy * 0.05); sctx.stroke();
      } else {
        if (!REDUCED) { s.x += 3 * s.z * dt; if (s.x > VW + 2) s.x = -2; }
        sctx.fillStyle = rgba(s.c, al); sctx.beginPath(); sctx.arc(s.x, s.y, s.r, 0, TAU); sctx.fill();
      }
    }
  }

  function shake(kind) {
    if (REDUCED || !boardWrap) return;
    boardWrap.classList.remove("shake-s"); boardWrap.classList.remove("shake-l"); boardWrap.classList.remove("shake-xl");
    void boardWrap.offsetWidth;
    boardWrap.classList.add("shake-" + kind);
  }

  // The blast when two bodies merge. Bigger bodies blow up bigger.
  function blast(x, y, level, cell) {
    var pal = Planets.BODIES[level].pal, k = 1 + level * 0.2, i, a, sp;
    var n = REDUCED ? 10 : Math.min(130, 18 + level * 9);
    for (i = 0; i < n; i++) {
      a = Math.random() * TAU; sp = cell * (0.8 + Math.random() * 2.4) * k;
      var ember = Math.random() < 0.28;
      fx.parts.push({ kind: ember ? "ember" : "spark", x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0,
        max: 0.4 + Math.random() * 0.45 + level * 0.035, size: (ember ? 2.2 : 1) + Math.random() * 1.6 + level * 0.1,
        c: pal[(Math.random() * 3) | 0], drag: 3.4 });
    }
    if (level <= 5 && !REDUCED) {
      for (i = 0; i < 9; i++) { // rocky debris
        a = Math.random() * TAU; sp = cell * (0.6 + Math.random() * 1.4);
        fx.parts.push({ kind: "chunk", x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, max: 0.5 + Math.random() * 0.3,
          size: 1.5 + Math.random() * 2.5, c: pal[2], drag: 2.6, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 14 });
      }
    }
    fx.rings.push({ x: x, y: y, r0: cell * 0.2, r1: cell * (0.7 + level * 0.11), t: 0, max: 0.4 + level * 0.025, c: pal[1], w: 1.5 + level * 0.35 });
    fx.flashes.push({ x: x, y: y, r: cell * (0.5 + level * 0.08), t: 0, max: 0.2 + level * 0.015, c: pal[1] });
    if (level >= 10) {
      var m = REDUCED ? 6 : 16;
      for (i = 0; i < m; i++) fx.rays.push({ x: x, y: y, a: i / m * TAU + Math.random() * 0.2, len: cell * (1.2 + Math.random() * 1.2), t: 0, max: 0.6, c: pal[1] });
    }
    if (level >= 10) shake("l"); else if (level >= 8) shake("s");
  }

  function orbiter(tx, ty, r, th, w, vr, acc, size, c, max, cell) {
    return { kind: "orbit", tx: tx, ty: ty, r: r, th: th, w: w, vr: vr, acc: acc, size: size, c: c, max: max, t: 0, k: cell,
      x: tx + Math.cos(th) * r, y: ty + Math.sin(th) * r * 0.9, px: null, py: null };
  }
  // Matter spiralling into the black hole.
  function implode(x, y, cell) {
    var pal = Planets.BODIES[Planets.BH].pal, n = REDUCED ? 30 : 170;
    for (var i = 0; i < n; i++) {
      fx.parts.push(orbiter(x, y, cell * (1.1 + Math.random() * 2.6), Math.random() * TAU, 1.6 + Math.random() * 2.2,
        cell * (0.3 + Math.random() * 0.5), cell * (2.6 + Math.random() * 2), 0.8 + Math.random() * 1.8, pal[(Math.random() * 3) | 0], 2.4, cell));
    }
  }
  // A swallowed body leaving a trail toward the black hole.
  function inflow(sx, sy, tx, ty, level, cell) {
    var pal = Planets.BODIES[level].pal, n = REDUCED ? 3 : 14, r0 = Math.hypot(sx - tx, sy - ty), th0 = Math.atan2(sy - ty, sx - tx);
    for (var i = 0; i < n; i++) {
      fx.parts.push(orbiter(tx, ty, r0 + (Math.random() - 0.5) * cell * 0.5, th0 + (Math.random() - 0.5) * 0.5, 1.2 + Math.random(),
        cell * 0.4, cell * (3 + Math.random() * 2), 1 + Math.random() * 1.6, pal[(Math.random() * 3) | 0], 2, cell));
    }
  }
  function flashOut(x, y, cell) {
    fx.flashes.push({ x: x, y: y, r: cell * 2.4, t: 0, max: 0.55, c: [255, 200, 140] });
    fx.rings.push({ x: x, y: y, r0: cell * 0.3, r1: cell * 3.6, t: 0, max: 0.9, c: [255, 170, 90], w: 6 });
    fx.rings.push({ x: x, y: y, r0: cell * 0.2, r1: cell * 2.4, t: 0, max: 0.7, c: [255, 240, 220], w: 3 });
    blast(x, y, Planets.BH, cell);
  }

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function drawFx(dt) {
    if (!(fx.parts.length || fx.rings.length || fx.flashes.length || fx.rays.length)) {
      if (fx.dirty) { fctx.clearRect(0, 0, VW, VH); fx.dirty = false; }
      return;
    }
    fx.dirty = true;
    fctx.clearRect(0, 0, VW, VH);
    fctx.globalCompositeOperation = "lighter";
    fx.flashes = fx.flashes.filter(function (f) {
      f.t += dt; var t = f.t / f.max; if (t >= 1) return false;
      var a = (1 - t) * (1 - t), r = f.r * (0.6 + 0.6 * t);
      var g = fctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      g.addColorStop(0, "rgba(255,255,255," + (0.85 * a).toFixed(3) + ")"); g.addColorStop(0.35, rgba(f.c, 0.55 * a)); g.addColorStop(1, rgba(f.c, 0));
      fctx.fillStyle = g; fctx.beginPath(); fctx.arc(f.x, f.y, r, 0, TAU); fctx.fill();
      return true;
    });
    fx.rings = fx.rings.filter(function (r) {
      r.t += dt; var t = r.t / r.max; if (t >= 1) return false;
      fctx.strokeStyle = rgba(r.c, Math.pow(1 - t, 1.5)); fctx.lineWidth = r.w * (1 - t) + 0.5;
      fctx.beginPath(); fctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * easeOut(t), 0, TAU); fctx.stroke();
      return true;
    });
    fctx.lineCap = "round";
    fx.rays = fx.rays.filter(function (r) {
      r.t += dt; var t = r.t / r.max; if (t >= 1) return false;
      var i0 = r.len * (0.15 + 0.35 * t), i1 = r.len * (0.35 + 0.9 * easeOut(t));
      fctx.strokeStyle = rgba(r.c, 0.8 * (1 - t)); fctx.lineWidth = 2.5 * (1 - t) + 0.5;
      fctx.beginPath(); fctx.moveTo(r.x + Math.cos(r.a) * i0, r.y + Math.sin(r.a) * i0); fctx.lineTo(r.x + Math.cos(r.a) * i1, r.y + Math.sin(r.a) * i1); fctx.stroke();
      return true;
    });
    if (fx.parts.length > 1600) fx.parts.splice(0, fx.parts.length - 1600);
    var chunks = [];
    fx.parts = fx.parts.filter(function (p) {
      p.t += dt; if (p.t >= p.max) return false;
      var life = 1 - p.t / p.max;
      if (p.kind === "orbit") {
        p.vr += p.acc * dt; p.r -= p.vr * dt; p.th += p.w * dt * Math.min(6, p.k / Math.max(p.r, 6));
        if (p.r < 3) return false;
        p.px = p.x; p.py = p.y;
        p.x = p.tx + Math.cos(p.th) * p.r; p.y = p.ty + Math.sin(p.th) * p.r * 0.9;
        fctx.strokeStyle = rgba(p.c, Math.min(1, life * 1.6)); fctx.lineWidth = p.size;
        fctx.beginPath(); fctx.moveTo(p.px, p.py); fctx.lineTo(p.x, p.y); fctx.stroke();
        return true;
      }
      var dmp = Math.exp(-p.drag * dt);
      p.vx *= dmp; p.vy *= dmp; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === "chunk") { p.rot += p.vr * dt; chunks.push(p); return true; }
      if (p.kind === "ember") {
        fctx.fillStyle = rgba(p.c, 0.55 * life); fctx.beginPath(); fctx.arc(p.x, p.y, p.size * (0.6 + 0.6 * life), 0, TAU); fctx.fill();
      } else {
        fctx.strokeStyle = rgba(p.c, life); fctx.lineWidth = p.size * (0.4 + 0.6 * life);
        fctx.beginPath(); fctx.moveTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); fctx.lineTo(p.x, p.y); fctx.stroke();
      }
      return true;
    });
    fctx.globalCompositeOperation = "source-over";
    chunks.forEach(function (p) {
      var life = 1 - p.t / p.max;
      fctx.save(); fctx.translate(p.x, p.y); fctx.rotate(p.rot); fctx.fillStyle = rgba(p.c, life);
      fctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.75); fctx.restore();
    });
  }

  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    drawStars(dt, now, false);
    drawFx(dt);
    window.requestAnimationFrame(frame);
  }

  function init(boardEl, wrapEl) {
    board = boardEl; boardWrap = wrapEl;
    if (started) return;
    started = true;
    fxc = document.getElementById("fx"); fctx = fxc.getContext("2d");
    stc = document.getElementById("stars"); sctx = stc.getContext("2d");
    sizeCanvases();
    window.addEventListener("resize", sizeCanvases);
    boardWrap.addEventListener("animationend", function (e) {
      if (e.target === boardWrap) { boardWrap.classList.remove("shake-s"); boardWrap.classList.remove("shake-l"); boardWrap.classList.remove("shake-xl"); }
    });
    last = performance.now();
    window.requestAnimationFrame(frame);
  }

  return {
    init: init, blast: blast, implode: implode, inflow: inflow, flashOut: flashOut, shake: shake,
    setSingular: function (on) { fx.singular = !!on; }
  };
})();
