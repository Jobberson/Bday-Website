/*
  Background music (optional: config.music). Browsers only allow sound after a tap,
  so start() is called from the first tap. Fades use Web Audio where possible,
  because iOS ignores audio.volume; on file:// (or if Web Audio fails) it falls back
  to the element's own volume / muted flag.
*/
(function () {
  'use strict';
  var G = window.Garden, U = G.util;
  var KEY = 'celeGarden.muted';
  var A = (G.audio = { enabled: false, started: false, muted: false });
  var mc, el, ctx = null, gain = null, tween = null, listeners = [];

  A.on = function (fn) { listeners.push(fn); };
  function emit() { listeners.forEach(function (fn) { try { fn(A); } catch (e) { /* ignore */ } }); }

  function level() { return A.muted ? 0 : U.clamp(mc.volume == null ? 0.6 : +mc.volume, 0, 1); }

  function ramp(v, secs) {
    secs = Math.max(0.01, secs || 0.01);
    if (gain) {
      var now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(v, now + secs);
      return;
    }
    // Element fallback: tween volume (desktop) and use `muted` so iOS also goes silent.
    clearInterval(tween);
    el.muted = v === 0 && A.muted;
    var from = el.volume, t0 = Date.now();
    tween = setInterval(function () {
      var k = Math.min(1, (Date.now() - t0) / (secs * 1000));
      try { el.volume = U.clamp(from + (v - from) * k, 0, 1); } catch (e) { /* ignore */ }
      if (k >= 1) clearInterval(tween);
    }, 50);
  }

  function setupGraph() {
    if (window.location.protocol === 'file:') return; // media from file:// would play silent
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      var src = ctx.createMediaElementSource(el);
      gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain);
      gain.connect(ctx.destination);
    } catch (e) { ctx = null; gain = null; }
  }

  A.init = function (cfg) {
    mc = cfg.music;
    if (!mc) return;
    A.enabled = true;
    A.muted = !!U.store.get(KEY);
    el = new Audio();
    el.preload = 'auto';
    el.loop = mc.loop !== false;
    el.addEventListener('error', function () {
      U.warn('could not load music "' + mc.src + '"; continuing without sound');
      A.enabled = false;
      emit();
    });
    el.src = mc.src;

    document.addEventListener('visibilitychange', function () {
      if (!A.started || !A.enabled) return;
      if (document.hidden) {
        ramp(0, 0.3);
        setTimeout(function () { if (document.hidden) el.pause(); }, 350);
      } else {
        if (ctx && ctx.state === 'suspended') ctx.resume();
        var p = el.play(); if (p && p.catch) p.catch(function () { /* ignore */ });
        ramp(level(), 1.2);
      }
    });
  };

  // Must run inside a tap handler.
  A.start = function () {
    if (!A.enabled || A.started) return;
    A.started = true;
    setupGraph();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    if (!gain) { try { el.volume = 0; } catch (e) { /* ignore */ } }
    var p = el.play();
    if (p && p.catch) p.catch(function (e) { U.warn('music could not start', e && e.message); A.started = false; emit(); });
    ramp(level(), mc.fadeIn == null ? 3 : mc.fadeIn);
    emit();
  };

  A.setMuted = function (m) {
    A.muted = !!m;
    U.store.set(KEY, A.muted);
    if (A.started) ramp(level(), A.muted ? (mc.fadeOut == null ? 1.5 : mc.fadeOut) / 2 : 1.2);
    emit();
  };
  A.toggle = function () { A.setMuted(!A.muted); };
})();
