/*
  Triggers: named story moments (start, messageOpened, choicesShown, pick1…N,
  confirmed, letterShown, sent). Firing one schedules every layer whose sketchOn /
  colorOn matches, honouring per-layer delays and the global speed.
  Picks are by ORDER: pick k fires `pickK`; unpicking always undoes the latest pick.
*/
(function () {
  'use strict';
  var G = window.Garden;
  var trig = (G.triggers = { fired: [] });
  var cfg, pending = [], listeners = [];

  trig.init = function (config) {
    cfg = config;
    G.scene.setTicker(tick);
  };

  trig.on = function (fn) { listeners.push(fn); };
  function emit(type, name) {
    listeners.forEach(function (fn) { try { fn(type, name); } catch (e) { /* ignore */ } });
  }

  // Called by the scene loop with speed-scaled seconds. Returns true while work is pending.
  function tick(sdt) {
    if (!pending.length) return false;
    var due = [];
    pending = pending.filter(function (p) {
      p.remaining -= sdt;
      if (p.remaining <= 0) { due.push(p); return false; }
      return true;
    });
    due.forEach(function (p) { p.fn(); });
    return pending.length > 0;
  }

  function schedule(trigger, idx, kind, delay, fn) {
    if (delay <= 0) { fn(); return; }
    pending.push({ trigger: trigger, idx: idx, kind: kind, remaining: delay, fn: fn });
    G.scene.wake();
  }

  function cancel(trigger, idx, kind) {
    pending = pending.filter(function (p) {
      return !(p.trigger === trigger && p.idx === idx && p.kind === kind);
    });
  }

  function resolveOrigin(def, opts) {
    opts = opts || {};
    if (opts.forceOrigin) return { screen: opts.forceOrigin };
    if (def.origin === 'fromCard') return opts.origin ? { screen: opts.origin } : null;
    if (Array.isArray(def.origin)) return { scene: def.origin };
    return null; // 'center'
  }

  trig.isFired = function (name) { return trig.fired.indexOf(name) >= 0; };

  // True while any reveal is scheduled or still painting.
  trig.busy = function () {
    if (pending.length) return true;
    return G.scene.layers().some(function (l) { var s = G.scene.layerState(l.id); return s && s.animating; });
  };

  // opts.origin: [x, y] screen CSS px (used by 'fromCard' layers)
  // opts.forceOrigin: [x, y] screen CSS px for every layer (debug)
  trig.fire = function (name, opts) {
    if (trig.isFired(name)) return false;
    // Confirming with fewer picks than allowed: the unused picks bloom with the finale,
    // so the garden always ends fully colored.
    if (name === 'confirmed') {
      trig.autoPicks = [];
      for (var k = trig.pickCount() + 1; k <= cfg.picksAllowed; k++) {
        if (trig.fire('pick' + k, {})) trig.autoPicks.push('pick' + k);
      }
    }
    trig.fired.push(name);
    var t = G.paper.tintFor(cfg, name);
    if (t) G.scene.setTint(t, 2.5);
    cfg.layers.forEach(function (def) {
      if (def.sketchOn === name) {
        schedule(name, def.index, 'sketch', def.sketchDelay, function () { G.scene.startSketch(def.index, 1); });
      }
      if (def.colorOn === name) {
        var origin = resolveOrigin(def, opts);
        schedule(name, def.index, 'color', def.delay, function () { G.scene.startColor(def.index, 1, { origin: origin }); });
      }
    });
    emit('fire', name);
    return true;
  };

  trig.undo = function (name) {
    var i = trig.fired.indexOf(name);
    if (i < 0) return false;
    trig.fired.splice(i, 1);
    cfg.layers.forEach(function (def) {
      if (def.colorOn === name) {
        cancel(name, def.index, 'color');
        var st = G.scene.layerState(def.id);
        if (st && (st.color > 0 || st.animating)) G.scene.startColor(def.index, -1);
      }
      if (def.sketchOn === name) {
        cancel(name, def.index, 'sketch');
        G.scene.startSketch(def.index, -1);
      }
    });
    if (name === 'confirmed') {
      (trig.autoPicks || []).forEach(function (p) { trig.undo(p); });
      trig.autoPicks = [];
    }
    G.scene.setTint(G.paper.tintForFired(cfg, trig.fired), 2.5);
    emit('undo', name);
    return true;
  };

  // ---- picks (by order) ----
  trig.pickCount = function () {
    var n = 0;
    for (var k = 1; k <= cfg.picksAllowed; k++) if (trig.isFired('pick' + k)) n = k;
    return n;
  };
  trig.firePick = function (opts) {
    var n = trig.pickCount();
    if (n >= cfg.picksAllowed) return false;
    return trig.fire('pick' + (n + 1), opts);
  };
  trig.undoLastPick = function () {
    var n = trig.pickCount();
    return n > 0 ? trig.undo('pick' + n) : false;
  };

  // Jump straight to the state implied by a list of fired triggers (restore / debug).
  trig.applyInstant = function (list) {
    pending = [];
    trig.autoPicks = [];
    trig.fired = list.slice();
    cfg.layers.forEach(function (def) {
      var sk = def.sketchOn && list.indexOf(def.sketchOn) >= 0 ? 1 : 0;
      var co = list.indexOf(def.colorOn) >= 0 ? 1 : 0;
      G.scene.setInstant(def.index, sk, co);
    });
    G.scene.setTint(G.paper.tintForFired(cfg, list), 0);
    G.scene.renderNow();
    emit('instant', null);
  };

  trig.reset = function () { trig.applyInstant([]); };
})();
