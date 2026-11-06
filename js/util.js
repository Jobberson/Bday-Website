/* Small shared helpers: easing, seeded randomness, noise, storage, URL flags. */
(function () {
  'use strict';
  var G = (window.Garden = window.Garden || {});
  var U = (G.util = {});

  U.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  // Works for edge0 > edge1 too (inverted ramp).
  U.smoothstep = function (e0, e1, x) {
    var t = U.clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };

  U.ease = {
    linear: function (t) { return t; },
    outQuad: function (t) { return 1 - (1 - t) * (1 - t); },
    outCubic: function (t) { var u = 1 - t; return 1 - u * u * u; },
    outSine: function (t) { return Math.sin((t * Math.PI) / 2); },
    inOutSine: function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; },
    inOutCubic: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  };

  // Deterministic RNG (mulberry32) so placeholder art and reveals repeat exactly.
  U.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  U.hash = function (str) {
    var h = 2166136261 >>> 0;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  // 2D value noise in [0,1] with smooth interpolation, plus fbm.
  U.noise2D = function (seed) {
    var r = U.rng(seed);
    var perm = new Uint8Array(512);
    var vals = new Float32Array(256);
    var i;
    for (i = 0; i < 256; i++) { perm[i] = i; vals[i] = r(); }
    for (i = 255; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp;
    }
    for (i = 0; i < 256; i++) perm[i + 256] = perm[i];
    function v(x, y) { return vals[perm[(perm[x & 255] + y) & 511]]; }
    function n(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y);
      var xf = x - xi, yf = y - yi;
      var u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
      var a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
    }
    n.fbm = function (x, y, oct) {
      var sum = 0, amp = 0.5, f = 1, norm = 0;
      for (var o = 0; o < (oct || 4); o++) {
        sum += amp * n(x * f, y * f);
        norm += amp; amp *= 0.5; f *= 2.03;
      }
      return sum / norm;
    };
    return n;
  };

  U.hexToRgb = function (hex) {
    hex = String(hex).replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  U.rgba = function (hex, a) {
    var c = U.hexToRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  };

  U.makeCanvas = function (w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  };
  // Explicitly free a canvas's backing store (matters on iOS Safari).
  U.releaseCanvas = function (c) {
    if (c) { c.width = 0; c.height = 0; }
  };

  // localStorage that never throws (private mode, quota, disabled storage).
  U.store = {
    get: function (key) {
      try { var s = window.localStorage.getItem(key); return s ? JSON.parse(s) : null; }
      catch (e) { return null; }
    },
    set: function (key, val) {
      try { window.localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ }
    },
    remove: function (key) {
      try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
  };

  var params;
  try { params = new URLSearchParams(window.location.search); } catch (e) { params = null; }
  U.flags = {
    debug: !!(params && params.has('debug')),
    reset: !!(params && params.has('reset'))
  };

  U.reducedMotion = function () {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  };

  U.warn = function () {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[garden]');
    console.warn.apply(console, args);
  };

  // Tiny DOM builder: el('p', { class: 'x', text: 'hi', on: { click: fn } }, [children]).
  U.el = function (tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'on') Object.keys(v).forEach(function (ev) { e.addEventListener(ev, v[ev]); });
      else if (k === 'style') Object.keys(v).forEach(function (p) { e.style.setProperty(p, v[p]); });
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  };

  // '{n} left' + {n: 2} -> '2 left'. Unknown {keys} are left as they are.
  U.fill = function (s, vars) {
    return String(s == null ? '' : s).replace(/\{(\w+)\}/g, function (m, k) {
      return vars && vars[k] !== undefined ? String(vars[k]) : m;
    });
  };

  U.wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  U.nextFrame = function () { return new Promise(function (r) { requestAnimationFrame(r); }); };
})();
