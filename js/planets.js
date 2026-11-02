// Solar System theme: the ladder of bodies and their procedurally painted art.
// Tile values map to bodies by power of two: 2 = Pluto ... 1024 = Sun, 2048 = Black hole.
window.Planets = (function () {
  "use strict";
  var TAU = Math.PI * 2;
  var BH = 11; // level of the black hole (2^11 = 2048)

  /* ---------- helpers ---------- */
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function hex(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { t = clamp(t, 0, 1); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function norm3(v) { var l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
  function rgba(c, a) { return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + clamp(a, 0, 1).toFixed(3) + ")"; }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeNoise(seed) {
    function hash(x, y, z) {
      var n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177) ^ Math.imul(seed, 1442695041);
      n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16;
      return (n >>> 0) / 4294967295;
    }
    function noise(x, y, z) {
      var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
      var xf = x - xi, yf = y - yi, zf = z - zi;
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
      var a = hash(xi, yi, zi), b = hash(xi + 1, yi, zi), c = hash(xi, yi + 1, zi), d = hash(xi + 1, yi + 1, zi);
      var e = hash(xi, yi, zi + 1), f = hash(xi + 1, yi, zi + 1), g = hash(xi, yi + 1, zi + 1), h = hash(xi + 1, yi + 1, zi + 1);
      var x1 = a + (b - a) * u, x2 = c + (d - c) * u, x3 = e + (f - e) * u, x4 = g + (h - g) * u;
      var y1 = x1 + (x2 - x1) * v, y2 = x3 + (x4 - x3) * v;
      return y1 + (y2 - y1) * w;
    }
    function fbm(x, y, z, o) {
      o = o || 4;
      var s = 0, a = 0.5, f = 1, n = 0;
      for (var i = 0; i < o; i++) { s += a * noise(x * f + i * 17.1, y * f + i * 9.3, z * f + i * 3.7); n += a; a *= 0.5; f *= 2.03; }
      return s / n;
    }
    return { noise: noise, fbm: fbm };
  }

  /* ---------- the ladder ---------- */
  var BODIES = [null,
    { name: "Pluto",      km: "2,377 km",     img: 0.31, tint: "#c9a98a", pal: ["#fff3e2", "#e6c7a3", "#9a6b4f"] },
    { name: "Mercury",    km: "4,879 km",     img: 0.37, tint: "#a9a49e", pal: ["#ffffff", "#cfcac4", "#76706b"] },
    { name: "Mars",       km: "6,779 km",     img: 0.44, tint: "#c1502a", pal: ["#ffe2c8", "#ff8a4c", "#a8381a"] },
    { name: "Venus",      km: "12,104 km",    img: 0.50, tint: "#e6c98f", pal: ["#fffbe6", "#f6dc9c", "#c99a52"] },
    { name: "Earth",      km: "12,742 km",    img: 0.54, tint: "#3a7bd5", pal: ["#ffffff", "#7cc4ff", "#38a866"] },
    { name: "Neptune",    km: "49,244 km",    img: 0.58, tint: "#3f5fd0", pal: ["#e8f0ff", "#6d8dff", "#2f47c0"] },
    { name: "Uranus",     km: "50,724 km",    img: 0.83, tint: "#8fdde6", pal: ["#f0ffff", "#9ff0f2", "#4fb3c4"] },
    { name: "Saturn",     km: "116,460 km",   img: 0.97, tint: "#e3c88f", pal: ["#fff8e6", "#f0d49a", "#b98b4e"] },
    { name: "Jupiter",    km: "139,820 km",   img: 0.64, tint: "#d9a066", pal: ["#fff4e2", "#f0b47a", "#c2552f"] },
    { name: "Sun",        km: "1,392,700 km", img: 0.98, tint: "#ffb547", pal: ["#ffffff", "#ffd36b", "#ff6a1f"] },
    { name: "Black hole", km: "Singularity",  img: 0.98, tint: "#ff8a3d", pal: ["#ffffff", "#ffb36b", "#ff4d1a"] }
  ];
  BODIES.forEach(function (b, l) {
    if (!b) return;
    b.level = l;
    b.pal = b.pal.map(hex);
    var t = hex(b.tint);
    b.bg = l === 10
      ? "radial-gradient(circle at 50% 46%, rgba(255,190,90,.55), rgba(255,110,30,.14) 58%, rgba(255,90,20,0) 80%), linear-gradient(165deg,#2a1406,#0d0603)"
      : l === BH
        ? "radial-gradient(circle at 50% 46%, rgba(255,130,50,.24), rgba(255,90,30,0) 62%), #020203"
        : "radial-gradient(circle at 50% 46%, " + rgba(t, 0.26) + ", " + rgba(t, 0) + " 68%), linear-gradient(165deg, #151a33, #090b16)";
  });

  // A value that is not a power of two (say, a broken merge rule) is an "anomaly".
  function isAnomaly(value) {
    if (!(value >= 2)) return true;
    var l = Math.log2(value);
    return Math.abs(l - Math.round(l)) > 1e-9;
  }
  function levelFor(value) {
    if (!(value >= 2)) return 1;
    var l = Math.log2(value);
    return clamp(isAnomaly(value) ? Math.floor(l) : Math.round(l), 1, BH);
  }
  function bodyFor(value) { return BODIES[levelFor(value)]; }
  function nameFor(value) { return isAnomaly(value) ? "Anomaly" : bodyFor(value).name; }

  /* ---------- painting ---------- */
  function renderSphere(spec, S) {
    var h = S / 2, R = spec.R * h;
    var cv = document.createElement("canvas"); cv.width = cv.height = S;
    var ctx = cv.getContext("2d");
    var im = ctx.createImageData(S, S), d = im.data;
    var L = norm3([-0.55, 0.5, 0.67]), H = norm3([L[0], L[1], L[2] + 1]);
    var cR = Math.cos(spec.roll || 0), sR = Math.sin(spec.roll || 0);
    var cP = Math.cos(spec.pitch || 0), sP = Math.sin(spec.pitch || 0);
    var cS = Math.cos(spec.spin || 0), sS = Math.sin(spec.spin || 0);
    var amb = spec.amb == null ? 0.06 : spec.amb;
    for (var py = 0; py < S; py++) {
      for (var px = 0; px < S; px++) {
        var u = px + 0.5 - h, v = py + 0.5 - h;
        var r = 0, g = 0, b = 0, a = 0, na;
        var ring = spec.ring ? spec.ring(u / h, v / h) : null;
        if (ring && !ring[4]) { r = ring[0]; g = ring[1]; b = ring[2]; a = ring[3]; }
        var dx = u / R, dy = v / R, r2 = dx * dx + dy * dy;
        if (r2 < 1.05) {
          var edge = clamp((1 - Math.sqrt(r2)) * R + 0.5, 0, 1);
          if (edge > 0) {
            var nx = dx, ny = -dy, nz = Math.sqrt(1 - Math.min(r2, 1));
            var x1 = nx * cR + ny * sR, y1 = -nx * sR + ny * cR;
            var y2 = y1 * cP - nz * sP, z2 = y1 * sP + nz * cP;
            var x3 = x1 * cS + z2 * sS, z3 = -x1 * sS + z2 * cS;
            var s = spec.surface(x3, y2, z3, dx, dy, nz);
            var cr = s[0], cg = s[1], cb = s[2];
            if (!spec.emissive) {
              var lam = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
              var k = amb + (1 - amb) * Math.pow(lam, 0.85);
              cr *= k; cg *= k; cb *= k;
              if (s[3]) {
                var sp = Math.pow(Math.max(0, nx * H[0] + ny * H[1] + nz * H[2]), 48) * s[3] * 230;
                cr += sp; cg += sp; cb += sp;
              }
            }
            na = edge + a * (1 - edge);
            r = (cr * edge + r * a * (1 - edge)) / na; g = (cg * edge + g * a * (1 - edge)) / na; b = (cb * edge + b * a * (1 - edge)) / na; a = na;
          }
        }
        if (ring && ring[4]) {
          var ea = ring[3];
          na = ea + a * (1 - ea);
          if (na > 0) { r = (ring[0] * ea + r * a * (1 - ea)) / na; g = (ring[1] * ea + g * a * (1 - ea)) / na; b = (ring[2] * ea + b * a * (1 - ea)) / na; a = na; }
        }
        var i = (py * S + px) * 4;
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a * 255;
      }
    }
    ctx.putImageData(im, 0, 0);
    if (spec.post) spec.post(ctx, h, R);
    return cv;
  }
  function ringFn(rot, k, inner, outer, profile) {
    var c = Math.cos(rot), s = Math.sin(rot);
    return function (u, v) {
      var ru = u * c + v * s, rv = -u * s + v * c;
      var rad = Math.sqrt(ru * ru + (rv / k) * (rv / k));
      if (rad < inner - 0.01 || rad > outer + 0.01) return null;
      var p = profile((rad - inner) / (outer - inner));
      if (!p) return null;
      var al = p[3] * sstep(inner - 0.006, inner + 0.006, rad) * (1 - sstep(outer - 0.006, outer + 0.006, rad));
      if (al <= 0.003) return null;
      return [p[0], p[1], p[2], al, rv > 0 ? 1 : 0];
    };
  }
  function halo(ctx, h, R, rgb, a, ext) {
    ctx.save(); ctx.globalCompositeOperation = "destination-over";
    var g = ctx.createRadialGradient(h, h, R * 0.92, h, h, R * ext);
    g.addColorStop(0, "rgba(" + rgb + "," + a + ")"); g.addColorStop(1, "rgba(" + rgb + ",0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 2 * h, 2 * h); ctx.restore();
  }
  function rim(ctx, h, R, rgb, a) {
    ctx.save(); ctx.globalCompositeOperation = "source-atop";
    var g = ctx.createRadialGradient(h - R * 0.1, h - R * 0.1, R * 0.55, h, h, R);
    g.addColorStop(0, "rgba(" + rgb + ",0)"); g.addColorStop(1, "rgba(" + rgb + "," + a + ")");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 2 * h, 2 * h); ctx.restore();
  }

  function bodySpecs() {
    var S = [];
    (function () { // Pluto: tan crust, dark Cthulhu belt, bright heart
      var n = makeNoise(11);
      S[1] = { R: 0.97, roll: 0.1, amb: 0.05, surface: function (x, y, z, dx, dy) {
        var f = n.fbm(x * 3 + 1, y * 3, z * 3, 5);
        var c = mix(hex("#6d4a38"), hex("#d7bea0"), sstep(0.3, 0.7, f));
        var dark = sstep(0.05, -0.45, x) * sstep(0.32, 0.08, Math.abs(y + 0.16));
        c = mix(c, hex("#47291f"), dark * (0.55 + 0.5 * (f - 0.3)));
        var X = (dx - 0.2) / 0.4, Y = -(dy - 0.1) / 0.4, q = X * X + Y * Y - 1;
        var hv = q * q * q - X * X * Y * Y * Y + (n.noise(x * 10, y * 10, z * 10) - 0.5) * 0.5;
        return mix(c, hex("#f3eadc"), sstep(0.08, -0.12, hv) * 0.9);
      } };
    })();
    (function () { // Mercury: grey, cratered
      var n = makeNoise(23), r = rng(23), cr = [];
      for (var i = 0; i < 70; i++) {
        var z = r() * 2 - 1, t = r() * TAU, s = Math.sqrt(1 - z * z), rad = 0.035 + Math.pow(r(), 2.4) * 0.26;
        cr.push({ x: s * Math.cos(t), y: z, z: s * Math.sin(t), r: rad, co: Math.cos(rad * 1.7) });
      }
      S[2] = { R: 0.97, amb: 0.03, surface: function (x, y, z) {
        var g = 92 + n.fbm(x * 4, y * 4, z * 4, 5) * 100, k = 1;
        for (var j = 0; j < cr.length; j++) {
          var c = cr[j], d = x * c.x + y * c.y + z * c.z;
          if (d < c.co) continue;
          var t = Math.acos(Math.min(1, d)) / c.r;
          if (t < 0.82) k *= 0.8 + 0.1 * t;
          else if (t < 1.1) k *= 1 + 0.3 * sstep(0.82, 0.95, t) * (1 - sstep(0.95, 1.1, t));
          else k *= 1 + 0.07 * (1 - sstep(1.1, 1.7, t));
        }
        g *= k;
        return [g * 1.03, g, g * 0.94];
      } };
    })();
    (function () { // Mars: rust, dark albedo, polar caps
      var n = makeNoise(37);
      S[3] = { R: 0.95, roll: 0.2, spin: 1.1, amb: 0.04, surface: function (x, y, z) {
        var f = n.fbm(x * 2.6, y * 2.6, z * 2.6, 5);
        var c = mix(hex("#8a3a1f"), hex("#d9814a"), sstep(0.3, 0.72, f));
        c = mix(c, hex("#4f2417"), sstep(0.55, 0.68, n.fbm(x * 1.7 + 7, y * 1.7 + 3, z * 1.7, 4)) * 0.7);
        return mix(c, hex("#f3ece6"), sstep(0.84, 0.9, Math.abs(y) + (f - 0.5) * 0.12));
      }, post: function (ctx, h, R) { halo(ctx, h, R, "255,150,110", 0.22, 1.06); } };
    })();
    (function () { // Venus: cream cloud swirls
      var n = makeNoise(41);
      S[4] = { R: 0.93, roll: 0.15, amb: 0.1, surface: function (x, y, z) {
        var w = n.fbm(x * 2, y * 2, z * 2, 4);
        var v = Math.sin(y * 6 + (w - 0.5) * 6 + x * 1.2);
        var c = mix(hex("#c99b5c"), hex("#f6e6bd"), 0.5 + 0.4 * v);
        return mix(c, hex("#fff3d2"), (n.fbm(x * 5, y * 5, z * 5, 3) - 0.5) * 0.8 + 0.1);
      }, post: function (ctx, h, R) { rim(ctx, h, R, "255,236,190", 0.45); halo(ctx, h, R, "255,220,160", 0.3, 1.09); } };
    })();
    (function () { // Earth: oceans, continents, ice, clouds
      var n = makeNoise(53);
      S[5] = { R: 0.9, roll: 0.41, pitch: -0.12, spin: 2.3, amb: 0.05, surface: function (x, y, z) {
        var land = n.fbm(x * 1.7 + 3.1, y * 1.7 + 1.7, z * 1.7 + 0.4, 6);
        var c, spec = 0;
        if (land > 0.535) {
          var t = n.fbm(x * 3 + 5, y * 3, z * 3 + 2, 4);
          c = mix(hex("#3d7337"), hex("#a8895a"), sstep(0.45, 0.62, t) * (Math.abs(y) < 0.55 ? 1 : 0.4));
          c = mix(c, hex("#2c5a2a"), sstep(0.6, 0.75, land) * 0.4);
        } else {
          c = mix(hex("#3a8fd9"), hex("#123f86"), sstep(0.535, 0.4, land));
          spec = 0.55;
        }
        var ice = sstep(0.86, 0.92, Math.abs(y) + (land - 0.5) * 0.1);
        c = mix(c, hex("#f4f8fb"), ice);
        if (ice > 0.5) spec = 0;
        var ca = sstep(0.5, 0.66, n.fbm(x * 3.1 + 11, y * 4.2 + 2, z * 3.1 + 5, 5)) * 0.92;
        c = mix(c, [255, 255, 255], ca);
        return [c[0], c[1], c[2], spec * (1 - ca)];
      }, post: function (ctx, h, R) { rim(ctx, h, R, "120,180,255", 0.55); halo(ctx, h, R, "100,160,255", 0.38, 1.1); } };
    })();
    (function () { // Neptune: deep blue, Great Dark Spot, white streaks
      var n = makeNoise(67);
      S[6] = { R: 0.93, roll: 0.3, amb: 0.06, surface: function (x, y, z) {
        var v = Math.sin(y * 9 + (n.fbm(x * 2, y * 7, z * 2, 4) - 0.5) * 2.5);
        var c = mix(hex("#2a45b0"), hex("#4c78e6"), 0.5 + 0.4 * v);
        var lon = Math.atan2(x, z), lat = Math.asin(clamp(y, -1, 1));
        var e = Math.pow((lon - 0.35) / 0.32, 2) + Math.pow((lat + 0.36) / 0.13, 2);
        c = mix(c, hex("#18246a"), sstep(1, 0.55, e) * 0.85);
        var band = sstep(0.18, 0, Math.abs(lat + 0.55)) + sstep(0.12, 0, Math.abs(lat - 0.45)) * 0.6;
        return mix(c, hex("#e9f0ff"), sstep(0.6, 0.75, n.fbm(x * 3 + 4, y * 16, z * 3, 4)) * band * 0.9);
      }, post: function (ctx, h, R) { rim(ctx, h, R, "140,180,255", 0.5); halo(ctx, h, R, "90,130,255", 0.32, 1.08); } };
    })();
    (function () { // Uranus: pale cyan, sideways rings
      var n = makeNoise(71);
      var rings = [[0.1, 0.03], [0.35, 0.03], [0.55, 0.03], [0.93, 0.06]];
      S[7] = { R: 0.62, roll: 1.32, pitch: -0.22, amb: 0.08,
        ring: ringFn(-1.32, 0.22, 0.7, 0.98, function (t) {
          var a = 0;
          rings.forEach(function (rg) { a = Math.max(a, 1 - Math.abs(t - rg[0]) / rg[1]); });
          return a > 0 ? [205, 225, 232, a * 0.6] : null;
        }),
        surface: function (x, y, z) {
          var v = Math.sin(y * 7 + (n.fbm(x * 2, y * 6, z * 2, 3) - 0.5) * 1.5);
          var c = mix(hex("#86cfdb"), hex("#b5eef0"), 0.55 + 0.2 * v);
          return mix(c, hex("#dcfbfb"), sstep(0.7, 0.98, y) * 0.5);
        } };
    })();
    (function () { // Saturn: golden bands, tilted rings with the Cassini division
      var n = makeNoise(79);
      function prof(t) {
        var q = n.noise(t * 90, 0.5, 0.5), a, c;
        if (t < 0.15) { a = 0.22; c = hex("#8f7f66"); }
        else if (t < 0.55) { a = 0.88; c = mix(hex("#cdb68a"), hex("#f0e2bf"), sstep(0.15, 0.5, t)); }
        else if (t < 0.62) { a = 0.06; c = hex("#6d6252"); }
        else if (t < 0.97) { a = (t > 0.875 && t < 0.89) ? 0.2 : 0.7; c = hex("#d6c39d"); }
        else return null;
        c = mix(c, hex("#fff4dc"), (q - 0.5) * 0.4);
        return [c[0] * 0.95, c[1] * 0.95, c[2] * 0.95, clamp(a * (0.8 + 0.35 * q), 0, 1)];
      }
      S[8] = { R: 0.47, roll: 0.35, pitch: -0.3, amb: 0.07, ring: ringFn(-0.35, 0.3, 0.6, 0.98, prof),
        surface: function (x, y, z) {
          var v = Math.sin(y * 15 + (n.fbm(x * 2, y * 9, z * 2, 4) - 0.5) * 1.8);
          var c = mix(hex("#c9a46a"), hex("#f2e0b2"), 0.5 + 0.45 * v);
          return mix(c, hex("#a99a7d"), sstep(0.72, 0.95, y) * 0.6);
        } };
    })();
    (function () { // Jupiter: belts, zones, Great Red Spot
      var n = makeNoise(89);
      S[9] = { R: 0.97, roll: 0.05, pitch: -0.05, amb: 0.06, surface: function (x, y, z) {
        var f = n.fbm(x * 2.2, y * 10, z * 2.2, 5), t = n.fbm(x * 5 + 3, y * 20, z * 5, 3);
        var v = Math.sin(y * 12.5 + (f - 0.5) * 2.6 + (t - 0.5) * 0.8);
        var c = mix(hex("#a3623d"), hex("#f3e4c8"), sstep(-0.35, 0.45, v));
        c = mix(c, hex("#e7b57d"), sstep(0.14, 0, Math.abs(y + 0.02)) * 0.35);
        c = mix(c, hex("#8d7f74"), sstep(0.7, 0.95, Math.abs(y)) * 0.6);
        var lon = Math.atan2(x, z), lat = Math.asin(clamp(y, -1, 1));
        var ex = (lon - 0.45) / 0.3, ey = (lat + 0.36) / 0.12, e = ex * ex + ey * ey;
        if (e < 1.6) {
          var sw = n.noise(ex * 3 + Math.atan2(ey, ex) * 1.5, e * 4, 1.3);
          c = mix(c, mix(hex("#b8462a"), hex("#e0835a"), sw), sstep(1, 0.2, e) * 0.9);
          c = mix(c, hex("#f6ead2"), sstep(1, 1.15, e) * (1 - sstep(1.15, 1.5, e)) * 0.6);
        }
        return c;
      } };
    })();
    (function () { // Sun: granulation, limb darkening, sunspots, corona
      var n = makeNoise(97);
      var spots = [[0.3, 0.25, 0.9, 0.07], [-0.4, -0.2, 0.88, 0.05], [-0.31, -0.27, 0.9, 0.032]].map(function (s) {
        var v = norm3(s);
        return { x: v[0], y: v[1], z: v[2], co: Math.cos(s[3]), ci: Math.cos(s[3] * 0.5) };
      });
      S[10] = { R: 0.67, emissive: true, surface: function (x, y, z, dx, dy, mu) {
        var g = n.fbm(x * 16, y * 16, z * 16, 3), l = n.fbm(x * 4 + 2, y * 4, z * 4, 3);
        var limb = 0.38 + 0.62 * Math.pow(mu, 0.45);
        var c = mix(hex("#ff6a12"), hex("#ffe9a8"), limb * (0.82 + (g - 0.5) * 0.55) + (l - 0.5) * 0.15);
        c = mix(c, hex("#fffbea"), sstep(0.75, 1, mu) * 0.45);
        spots.forEach(function (s) {
          var d = x * s.x + y * s.y + z * s.z;
          if (d > s.co) c = mix(c, d > s.ci ? hex("#4a1804") : hex("#b34a10"), 0.85);
        });
        return c;
      }, post: function (ctx, h, R) {
        ctx.save(); ctx.globalCompositeOperation = "destination-over";
        var g = ctx.createRadialGradient(h, h, R * 0.92, h, h, h);
        g.addColorStop(0, "rgba(255,220,130,.95)"); g.addColorStop(0.12, "rgba(255,176,72,.6)");
        g.addColorStop(0.45, "rgba(255,120,40,.2)"); g.addColorStop(1, "rgba(255,90,20,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, 2 * h, 2 * h); ctx.restore();
      } };
    })();
    return S;
  }

  function paintBlackHole(S) {
    var cv = document.createElement("canvas"); cv.width = cv.height = S;
    var ctx = cv.getContext("2d"), h = S / 2, core = 0.36 * h;
    var g = ctx.createRadialGradient(h, h, core * 0.9, h, h, h);
    g.addColorStop(0, "rgba(255,240,210,1)"); g.addColorStop(0.08, "rgba(255,196,120,.9)");
    g.addColorStop(0.25, "rgba(255,120,40,.45)"); g.addColorStop(0.6, "rgba(200,60,20,.12)"); g.addColorStop(1, "rgba(150,40,10,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    ctx.save(); ctx.shadowColor = "rgba(255,170,80,1)"; ctx.shadowBlur = h * 0.12;
    ctx.strokeStyle = "rgba(255,170,90,.55)"; ctx.lineWidth = h * 0.06;
    ctx.beginPath(); ctx.ellipse(h, h, core * 1.26, core * 1.18, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = "rgba(255,238,205,.95)"; ctx.lineWidth = h * 0.03;
    ctx.beginPath(); ctx.arc(h, h, core * 1.07, 0, TAU); ctx.stroke();
    ctx.restore();
    function disk() {
      ctx.save(); ctx.translate(h, h); ctx.rotate(-0.12); ctx.scale(1, 0.17);
      var dg = ctx.createRadialGradient(0, 0, core * 1.02, 0, 0, h * 0.98);
      dg.addColorStop(0, "rgba(255,250,235,1)"); dg.addColorStop(0.18, "rgba(255,214,150,.95)");
      dg.addColorStop(0.45, "rgba(255,140,60,.75)"); dg.addColorStop(0.8, "rgba(190,60,20,.25)"); dg.addColorStop(1, "rgba(150,40,10,0)");
      ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(0, 0, h * 0.98, 0, TAU); ctx.fill(); ctx.restore();
    }
    disk();
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(h, h, core, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.rect(0, h, S, h); ctx.clip(); disk(); ctx.restore();
    return cv;
  }

  // Paints every body once and stores an image URL on each. Resolves when done.
  function paint() {
    var specs = bodySpecs();
    for (var l = 1; l <= BH; l++) {
      (function (b, l) {
        var S = clamp(Math.ceil(b.img * 264 / 32) * 32, 96, 256);
        var cv = l === BH ? paintBlackHole(256) : renderSphere(specs[l], S);
        // A data URL works everywhere, including Safari opening index.html straight from disk
        b.url = cv.toDataURL("image/png");
      })(BODIES[l], l);
    }
    return Promise.resolve();
  }

  return { BODIES: BODIES, BH: BH, paint: paint, levelFor: levelFor, bodyFor: bodyFor, nameFor: nameFor, isAnomaly: isAnomaly, rgba: rgba };
})();