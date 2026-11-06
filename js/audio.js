/*
  Background music (optional: config.music).

  - All fades go through Web Audio (a master GainNode), because iOS ignores
    audio.volume. The AudioContext is created and resumed on the first tap.
  - iOS silent switch: navigator.audioSession.type = 'playback' where supported.
  - Short tracks (≤ 2 min) are decoded once into an AudioBuffer and looped without
    gaps between loopStart and loopEnd, optionally crossfading the end into the start.
  - Long tracks are streamed through two <audio> elements that crossfade at the
    loop point, so the whole file is never held in memory (iPhone memory budget).
  - From file:// (where Web Audio can't read local media) it falls back to a plain
    looping <audio> element.
  - Nothing here can block or delay the garden; any failure hides the sound toggle
    and the site continues silently.
*/
(function () {
  'use strict';
  var G = window.Garden, U = G.util;
  var KEY = 'celeGarden.muted';
  var SHORT = 120; // seconds: up to this, decode into memory
  var A = (G.audio = { enabled: false, started: false, muted: false, mode: null });
  var mc, listeners = [];
  var ctx = null, master = null, swellOn = false;
  var duration = null, bytesP = null, pending = false;
  var loopTimer = null, sources = [];        // buffer mode
  var els = [], elGains = [], active = 0;    // stream / plain modes
  var tween = null, hiddenTimer = null;

  A.on = function (fn) { listeners.push(fn); };
  function emit() { listeners.forEach(function (fn) { try { fn(A); } catch (e) { /* ignore */ } }); }

  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function level() {
    if (A.muted) return 0;
    var v = U.clamp(num(mc.volume, 0.6), 0, 1);
    return Math.min(1, v * (swellOn ? 1 + num(mc.swell, 0) : 1));
  }
  function fileProtocol() { return window.location.protocol === 'file:'; }

  function fail(msg, e) {
    U.warn(msg + (e ? ': ' + (e.message || e) : '') + '; continuing without sound');
    A.enabled = false;
    stopAll();
    emit();
  }

  // ---------------------------------------------------------------- volume
  function ramp(v, secs) {
    secs = Math.max(0.02, secs || 0.02);
    if (master) {
      var g = master.gain, now = ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(v, now + secs);
      return;
    }
    // Plain element: tween volume (desktop) and use `muted` so iOS also goes silent.
    var el = els[0];
    if (!el) return;
    clearInterval(tween);
    if (v > 0) el.muted = false;
    var from = el.volume, t0 = Date.now();
    tween = setInterval(function () {
      var k = Math.min(1, (Date.now() - t0) / (secs * 1000));
      try { el.volume = U.clamp(from + (v - from) * k, 0, 1); } catch (e) { /* iOS: read-only */ }
      if (k >= 1) { clearInterval(tween); if (v === 0) el.muted = true; }
    }, 50);
  }

  // ---------------------------------------------------------------- setup
  A.init = function (cfg) {
    A.buzzInit(cfg);
    document.addEventListener('visibilitychange', onVisibility);
    mc = cfg.music;
    if (!mc) return;
    A.enabled = true;
    A.muted = !!U.store.get(KEY);

    // Learn the duration (metadata only), after the garden is ready so the song
    // never competes with the artwork for bandwidth.
    window.addEventListener('garden:ready', function () {
      var probe = new Audio();
      probe.preload = 'metadata';
      probe.muted = true;
      probe.addEventListener('loadedmetadata', function () {
        duration = probe.duration;
        probe.removeAttribute('src');
        try { probe.load(); } catch (e) { /* ignore */ }
        if (!fileProtocol() && isFinite(duration) && duration <= SHORT) prefetch();
      });
      probe.addEventListener('error', function () { fail('could not load music "' + mc.src + '"'); });
      probe.src = mc.src;
    }, { once: true });

  };

  function prefetch() {
    if (bytesP) return;
    bytesP = fetch(mc.src).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.arrayBuffer();
    });
    bytesP.catch(function () { /* reported when used */ });
  }

  // Must run inside a tap handler (iOS only allows sound after a gesture).
  A.start = function () {
    if (!A.enabled || A.started) return;
    A.started = true;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* ignore */ }

    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC && !fileProtocol()) {
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);
        if (ctx.state !== 'running') ctx.resume();
        // Unlock iOS output by playing one silent sample inside the gesture.
        var s = ctx.createBufferSource();
        s.buffer = ctx.createBuffer(1, 1, 22050);
        s.connect(ctx.destination);
        s.start(0);
      } catch (e) { ctx = null; master = null; }
    }

    if (!ctx) A.mode = 'plain';
    else if (bytesP && !mc.stream) A.mode = 'buffer'; // mc.stream: force streaming (testing)
    else A.mode = 'stream'; // long track, or the metadata hasn't arrived yet

    try {
      if (A.mode === 'buffer') startBuffer();
      else startElements();
    } catch (e) { fail('music could not start', e); return; }
    emit();
  };

  // ---------------------------------------------------------------- short tracks: AudioBuffer
  function decode(ab) {
    return new Promise(function (resolve, reject) {
      var p = ctx.decodeAudioData(ab, resolve, reject); // callback form for older Safari
      if (p && p.then) p.then(resolve, reject);
    });
  }

  function loopPoints(dur) {
    var ls = U.clamp(num(mc.loopStart, 0), 0, dur);
    var le = num(mc.loopEnd, 0);
    le = le > ls ? Math.min(le, dur) : dur;
    return [ls, le];
  }

  function startBuffer() {
    pending = true;
    bytesP.then(decode).then(function (buf) {
      pending = false;
      if (!A.enabled) return;
      var lp = loopPoints(buf.duration), xf = Math.max(0, num(mc.loopCrossfade, 0));
      xf = Math.min(xf, (lp[1] - lp[0]) / 2);
      if (!xf) {
        var src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.loopStart = lp[0];
        src.loopEnd = lp[1];
        src.connect(master);
        src.start(0, 0);
        sources.push({ src: src });
      } else {
        crossfadeLoop(buf, lp[0], lp[1], xf);
      }
      ramp(level(), num(mc.fadeIn, 4));
    }).catch(function (e) { pending = false; fail('could not decode music "' + mc.src + '"', e); });
  }

  // Each pass plays to loopEnd; there the next pass starts at loopStart (fading in)
  // while the old one rings on past loopEnd (fading out). Rhythm stays aligned.
  function crossfadeLoop(buf, ls, le, xf) {
    var nextEnd = null;
    function pass(when, offset, fadeIn) {
      var src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = buf;
      src.connect(g);
      g.connect(master);
      if (fadeIn) { g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(1, when + xf); }
      src.start(when, offset);
      var end = when + (le - offset);
      g.gain.setValueAtTime(1, end);
      g.gain.linearRampToValueAtTime(0, end + xf);
      src.stop(end + xf + 0.05);
      var item = { src: src, gain: g };
      sources.push(item);
      src.onended = function () { sources.splice(sources.indexOf(item), 1); };
      nextEnd = end;
    }
    pass(ctx.currentTime + 0.05, 0, false);
    // Schedule the next pass a little ahead of time (timers are coarse).
    loopTimer = setInterval(function () {
      if (ctx.state === 'running' && ctx.currentTime > nextEnd - 1.5) pass(nextEnd, ls, true);
    }, 250);
  }

  // ---------------------------------------------------------------- long tracks: streamed elements
  function makeEl() {
    var el = new Audio();
    el.preload = 'auto';
    el.src = mc.src;
    el.addEventListener('error', function () { fail('could not play music "' + mc.src + '"'); });
    return el;
  }

  function startElements() {
    if (A.mode === 'plain') {
      var p0 = makeEl();
      p0.loop = true;
      p0.volume = 0;
      els = [p0];
      playEl(p0);
      ramp(level(), num(mc.fadeIn, 4));
      return;
    }
    els = [makeEl(), makeEl()];
    elGains = els.map(function (el) {
      var g = ctx.createGain();
      ctx.createMediaElementSource(el).connect(g);
      g.connect(master);
      return g;
    });
    elGains[1].gain.value = 0;
    playEl(els[0]);
    // Unlock the second element inside the gesture too, so it may play later.
    var p = els[1].play();
    if (p && p.then) p.then(function () { els[1].pause(); }, function () { /* ignore */ });
    else els[1].pause();
    ramp(level(), num(mc.fadeIn, 4));

    var xf = Math.max(0.05, num(mc.loopCrossfade, 0));
    loopTimer = setInterval(function () {
      var cur = els[active], other = els[1 - active];
      var dur = isFinite(cur.duration) ? cur.duration : duration;
      if (!dur || cur.paused) return;
      var lp = loopPoints(dur);
      if (cur.currentTime < lp[1] - xf) return;
      try { other.currentTime = lp[0]; } catch (e) { /* ignore */ }
      playEl(other);
      var now = ctx.currentTime;
      elGains[1 - active].gain.cancelScheduledValues(now);
      elGains[1 - active].gain.setValueAtTime(0, now);
      elGains[1 - active].gain.linearRampToValueAtTime(1, now + xf);
      elGains[active].gain.setValueAtTime(1, now);
      elGains[active].gain.linearRampToValueAtTime(0, now + xf);
      var old = cur;
      setTimeout(function () { old.pause(); }, xf * 1000 + 100);
      active = 1 - active;
    }, 50);
  }

  function playEl(el) {
    var p = el.play();
    if (p && p.catch) p.catch(function (e) { if (e && e.name !== 'AbortError') U.warn('music could not start', e.message); });
  }

  function stopAll() {
    clearInterval(loopTimer);
    clearInterval(tween);
    sources.forEach(function (s) { try { s.src.stop(); } catch (e) { /* ignore */ } });
    sources = [];
    els.forEach(function (el) { try { el.pause(); } catch (e) { /* ignore */ } });
  }

  // ---------------------------------------------------------------- the phone buzz (VOID)
  // A short buzz on a loop: buzz, `gap` seconds of silence, buzz… until stopped.
  // onRing(seconds) is called at every buzz so the drawn phone can shake in time.
  var buzz = { el: null, on: false, timer: null, onRing: null, dur: 2, gap: 3, vibrate: false };

  A.buzzInit = function (cfg) {
    var b = cfg.phoneBuzz;
    if (!b) return;
    buzz.gap = Math.max(0, num(b.gap, 3));
    buzz.vibrate = b.vibrate !== false;
    var el = new Audio();
    el.preload = 'auto';
    el.addEventListener('loadedmetadata', function () { if (isFinite(el.duration) && el.duration > 0) buzz.dur = el.duration; });
    el.addEventListener('error', function () { U.warn('could not load phone buzz "' + b.src + '"; the phone will shake silently'); buzz.el = null; });
    el.addEventListener('ended', function () { if (buzz.on) next(buzz.gap); });
    el.src = b.src;
    buzz.el = el;
  };

  // Call inside the first tap: iOS only lets an element play later if it played in a tap.
  A.unlockBuzz = function () {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* ignore */ }
    var el = buzz.el;
    if (!el || buzz.unlocked) return;
    buzz.unlocked = true;
    el.muted = true;
    var p = el.play();
    var done = function () { if (!buzz.on) { el.pause(); el.currentTime = 0; } el.muted = false; };
    if (p && p.then) p.then(done, function () { el.muted = false; });
    else done();
  };

  // navigator.vibrate is only allowed after a real tap (and doesn't exist on iPhone).
  function canVibrate() {
    var act = navigator.userActivation;
    return !!navigator.vibrate && (!act || act.hasBeenActive);
  }

  function next(afterSecs) {
    clearTimeout(buzz.timer);
    buzz.timer = setTimeout(ring, afterSecs * 1000);
  }

  function ring() {
    if (!buzz.on || document.hidden) return;
    if (buzz.onRing) { try { buzz.onRing(buzz.dur); } catch (e) { /* ignore */ } }
    if (buzz.vibrate && canVibrate()) { try { navigator.vibrate([380, 160, 380, 160, 380]); } catch (e) { /* ignore */ } }
    var el = buzz.el;
    if (!el) { next(buzz.dur + buzz.gap); return; }
    el.muted = false;
    try { el.currentTime = 0; } catch (e) { /* ignore */ }
    var p = el.play();
    // No sound allowed? Keep the same rhythm for the shaking anyway.
    if (p && p.catch) p.catch(function () { if (buzz.on) next(buzz.dur + buzz.gap); });
  }

  A.buzzStart = function (onRing) {
    if (buzz.on) return;
    buzz.on = true;
    buzz.onRing = onRing;
    ring();
  };

  A.buzzStop = function () {
    buzz.on = false;
    clearTimeout(buzz.timer);
    if (buzz.el) { try { buzz.el.pause(); } catch (e) { /* ignore */ } }
    if (canVibrate()) { try { navigator.vibrate(0); } catch (e) { /* ignore */ } }
  };

  // ---------------------------------------------------------------- page hidden / shown
  function onVisibility() {
    // The buzz pauses while the tab is hidden and picks up again on return.
    if (buzz.on) {
      clearTimeout(buzz.timer);
      if (document.hidden) { if (buzz.el) buzz.el.pause(); }
      else next(0.6);
    }
    if (!A.started || !A.enabled) return;
    clearTimeout(hiddenTimer);
    if (document.hidden) {
      var out = Math.min(num(mc.fadeOut, 1.5), 1);
      ramp(0, out);
      hiddenTimer = setTimeout(function () {
        if (!document.hidden) return;
        if (ctx) ctx.suspend();
        if (A.mode !== 'buffer') els.forEach(function (el) { el.wasPlaying = !el.paused; el.pause(); });
      }, out * 1000 + 100);
    } else {
      resume();
      ramp(level(), 1.5);
    }
  }

  function resume() {
    if (ctx && ctx.state !== 'running') {
      var p = ctx.resume();
      // iOS can refuse without a gesture: try again on the next tap.
      if (p && p.then) p.then(function () { /* ok */ }, function () { /* ignore */ });
      window.addEventListener('pointerdown', function () { if (ctx.state !== 'running') ctx.resume(); }, { once: true, capture: true });
    }
    if (A.mode !== 'buffer') els.forEach(function (el) { if (el.wasPlaying) { el.wasPlaying = false; playEl(el); } });
  }

  // ---------------------------------------------------------------- controls
  A.setMuted = function (m) {
    A.muted = !!m;
    U.store.set(KEY, A.muted);
    if (A.started && !pending) ramp(level(), 1);
    emit();
  };
  A.toggle = function () { A.setMuted(!A.muted); };

  // For the debug panel / tests.
  A.debug = function () {
    return {
      mode: A.mode, state: ctx ? ctx.state : null, time: ctx ? +ctx.currentTime.toFixed(2) : null,
      gain: master ? +master.gain.value.toFixed(3) : els[0] ? +els[0].volume.toFixed(3) : null,
      buzz: { on: buzz.on, playing: !!(buzz.el && !buzz.el.paused), t: buzz.el ? +buzz.el.currentTime.toFixed(2) : null },
      sources: sources.length, elements: els.map(function (el) { return el.paused ? 'paused' : +el.currentTime.toFixed(1); })
    };
  };

  // Gentle swell during the final bloom and the letter (config.music.swell).
  A.swell = function (on) {
    if (swellOn === !!on) return;
    swellOn = !!on;
    if (A.started && !pending && num(mc && mc.swell, 0)) ramp(level(), on ? 5 : 3);
  };
})();
