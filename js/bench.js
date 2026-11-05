/*
  Hidden benchmark, run during the VOID stage before anything is shown.
  Renders the worst case (3 simultaneous reveals) to the real canvas while it is
  invisible, then picks a quality tier: high → medium → crossfade.

  iOS Low Power Mode caps rAF at 30fps: a steady ~33ms cadence is treated as a cap,
  not as slowness, so the decision leans on CPU time per frame.
*/
(function () {
  'use strict';
  var G = window.Garden, U = G.util;
  var FRAMES = 52, WARMUP = 10;

  function median(a) { var s = a.slice().sort(function (x, y) { return x - y; }); return s.length ? s[Math.floor(s.length / 2)] : 0; }
  function pct(a, q) { var s = a.slice().sort(function (x, y) { return x - y; }); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : 0; }
  function std(a) {
    if (!a.length) return 0;
    var m = a.reduce(function (x, y) { return x + y; }, 0) / a.length;
    return Math.sqrt(a.reduce(function (x, y) { return x + (y - m) * (y - m); }, 0) / a.length);
  }

  var aborted = false;

  function measure() {
    return new Promise(function (resolve) {
      if (aborted) { resolve(null); return; }
      var count = G.scene.bench.begin(3);
      if (!count) { G.scene.bench.end(); resolve(null); return; }
      var i = 0, lastT = null, dts = [], cpus = [];
      function f(now) {
        if (aborted) { G.scene.bench.end(); resolve(null); return; }
        var p = 0.15 + 0.7 * (i / FRAMES);
        var cpu = G.scene.bench.frame(p);
        if (i >= WARMUP) {
          cpus.push(cpu);
          if (lastT !== null) dts.push(now - lastT);
        }
        lastT = now;
        i++;
        if (i < FRAMES + WARMUP) requestAnimationFrame(f);
        else { G.scene.bench.end(); resolve({ dts: dts, cpus: cpus }); }
      }
      requestAnimationFrame(f);
    });
  }

  function judge(m) {
    var cpuMed = median(m.cpus), cpuP90 = pct(m.cpus, 0.9);
    var dtMed = median(m.dts), dtP90 = pct(m.dts, 0.9), dtStd = std(m.dts);
    var capped30 = dtMed > 27 && dtMed < 40 && dtStd < 4.5;
    var budget = capped30 ? 33.3 : 16.7;
    var cpuOk = cpuMed < budget * 0.55 && cpuP90 < budget * 0.9;
    // Long, irregular frames (not a steady cap) mean the GPU is struggling.
    var cadenceOk = capped30 || dtP90 < 26;
    return {
      ok: cpuOk && cadenceOk, capped30: capped30,
      cpuMed: +cpuMed.toFixed(2), cpuP90: +cpuP90.toFixed(2),
      dtMed: +dtMed.toFixed(2), dtP90: +dtP90.toFixed(2), dtStd: +dtStd.toFixed(2)
    };
  }

  G.bench = {
    result: null,
    // Leaves the scene built at the chosen tier. Resolves with the tier name.
    run: function () {
      var canvas = document.getElementById('scene');
      var log = [];
      function done(tier, reason) {
        canvas.classList.remove('benching');
        G.bench.result = { tier: tier, reason: reason, tests: log };
        return tier;
      }
      if (U.reducedMotion()) {
        G.scene.setTier('crossfade');
        return Promise.resolve(done('crossfade', 'prefers-reduced-motion'));
      }
      canvas.classList.add('benching');
      var tiers = ['high', 'medium'];
      function tryTier(i) {
        if (i >= tiers.length) {
          G.scene.setTier('crossfade');
          return Promise.resolve(done('crossfade', 'benchmark too slow'));
        }
        G.scene.setTier(tiers[i]);
        return U.nextFrame().then(measure).then(function (m) {
          if (aborted) return tiers[i];
          if (!m) return done(tiers[i], 'nothing to measure');
          var j = judge(m);
          j.tier = tiers[i];
          log.push(j);
          if (j.ok) return done(tiers[i], j.capped30 ? 'passed (30fps cap detected)' : 'passed');
          return tryTier(i + 1);
        });
      }
      aborted = false;
      // rAF pauses in background tabs: never let the benchmark hold up the experience.
      var timeout = new Promise(function (resolve) {
        setTimeout(function () { resolve('timeout'); }, 5000);
      });
      var work = tryTier(0).catch(function (e) {
        U.warn('benchmark failed, using medium', e);
        G.scene.setTier('medium');
        return done('medium', 'benchmark error');
      });
      return Promise.race([work, timeout]).then(function (r) {
        if (r !== 'timeout') return r;
        aborted = true;
        G.scene.bench.end(); // restore layer states now; later calls are no-ops
        G.scene.setTier('medium');
        return done('medium', 'benchmark timed out (tab hidden?)');
      });
    }
  };
})();
