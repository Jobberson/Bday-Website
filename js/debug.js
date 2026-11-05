/* ?debug panel (for Pedro only): triggers, stages, replay, speed, tier, perf + asset report. */
(function () {
  'use strict';
  var G = window.Garden, U = G.util;
  var dbg = (G.debug = { tapOrigin: null });
  var panel, statsEl, assetsEl, trigBtns = {}, replayTimers = [];

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'on') Object.keys(attrs.on).forEach(function (ev) { e.addEventListener(ev, attrs.on[ev]); });
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function btn(label, fn, cls) { return el('button', { type: 'button', class: cls || '', text: label, on: { click: fn } }); }
  function section(title, kids) { return el('section', {}, [el('h3', { text: title })].concat(kids)); }

  function fireOpts() { return dbg.tapOrigin ? { forceOrigin: dbg.tapOrigin, origin: dbg.tapOrigin } : {}; }

  function refreshTriggers() {
    Object.keys(trigBtns).forEach(function (t) { trigBtns[t].classList.toggle('on', G.triggers.isFired(t)); });
  }

  function cancelReplay() { replayTimers.forEach(clearTimeout); replayTimers = []; }

  function replay() {
    cancelReplay();
    G.triggers.reset();
    var cfg = G.config, seq = [['start', 0.4], ['messageOpened', 1.2], ['choicesShown', 3.5]];
    for (var k = 1; k <= cfg.picksAllowed; k++) seq.push(['pick' + k, k === 1 ? 4.5 : 7]);
    seq.push(['confirmed', 8]);
    var t = 0;
    seq.forEach(function (s) {
      t += s[1];
      replayTimers.push(setTimeout(function () { G.triggers.fire(s[0], fireOpts()); }, (t / G.speed) * 1000));
    });
  }

  function jumpStage(stage) {
    cancelReplay();
    var cfg = G.config, picks = [];
    var i = G.state.stages.indexOf(stage);
    var n = i >= 3 ? cfg.picksAllowed : i === 2 ? G.state.data.picks.length : 0;
    for (var k = 0; k < Math.min(n, cfg.activities.length); k++) picks.push(cfg.activities[k].id);
    G.state.data = { stage: stage, picks: picks, sent: i >= 7 };
    G.state.save();
    G.triggers.applyInstant(G.state.triggersFor(cfg, G.state.data));
  }

  function speedRow() {
    var label = el('span', { class: 'val', text: G.speed.toFixed(2) + '×' });
    var input = el('input', { type: 'range', min: '-2', max: '2', step: '0.05', value: String(Math.log2(G.speed)), 'aria-label': 'Speed' });
    input.addEventListener('input', function () {
      G.speed = Math.pow(2, +input.value);
      label.textContent = G.speed.toFixed(2) + '×';
    });
    return el('div', { class: 'row' }, [input, label]);
  }

  function assetsReport() {
    var L = G.loader, lines = [];
    L.failures.forEach(function (f) { lines.push('✗ ' + f.kind + ' ' + f.path + ': ' + f.reason); });
    G.scene.layers().forEach(function (ly) {
      if (ly.pending) lines.push('… still loading: ' + ly.def.image);
      else if (ly.missing) lines.push('✗ layer "' + ly.id + '" skipped (no image, no placeholder)');
      else if (ly.placeholder && ly.def.image.indexOf('placeholder:') !== 0) lines.push('↺ "' + ly.id + '" is showing its placeholder');
    });
    var ok = L.total - L.failures.length;
    lines.unshift(ok + '/' + L.total + ' files loaded' + (L.timedOut ? ' (gave up waiting after ' + G.config.perf.maxLoadWait + 's)' : ''));
    assetsEl.textContent = lines.join('\n');
    assetsEl.classList.toggle('bad', L.failures.length > 0);
  }

  function statsLoop() {
    var s = G.scene.stats, info = G.scene.info(), mem = G.scene.memory();
    var dts = s.dts, cpus = s.cpus;
    var avgDt = dts.length ? dts.reduce(function (a, b) { return a + b; }, 0) / dts.length : 0;
    var avgCpu = cpus.length ? cpus.reduce(function (a, b) { return a + b; }, 0) / cpus.length : 0;
    var maxDt = dts.length ? Math.max.apply(null, dts) : 0;
    var b = G.bench.result || {};
    var bt = (b.tests || []).map(function (t) {
      return '  ' + t.tier + ': cpu ' + t.cpuMed + '/' + t.cpuP90 + 'ms, frame ' + t.dtMed + '/' + t.dtP90 + 'ms' + (t.capped30 ? ' [30fps cap]' : '') + (t.ok ? ' ok' : ' slow');
    }).join('\n');
    statsEl.textContent =
      'fps (last anim) ' + (avgDt ? (1000 / avgDt).toFixed(0) : '–') + '  worst ' + maxDt.toFixed(1) + 'ms\n' +
      'draw cpu ' + avgCpu.toFixed(2) + 'ms  (last ' + s.lastCpu.toFixed(2) + ')\n' +
      'canvas ' + info.W + '×' + info.H + ' @' + info.eff.toFixed(2) + '  mask ' + info.mW + '×' + info.mH + '\n' +
      'tier ' + info.tier + ' (' + (b.reason || '') + ')\n' + (bt ? bt + '\n' : '') +
      'memory ≈ ' + mem.totalMB.toFixed(0) + ' MB (layers ' + mem.layersMB.toFixed(0) + ', sketches ' + mem.sketches + ', caches ' + mem.caches + ')\n' +
      'speed ' + G.speed.toFixed(2) + '×  picks ' + G.triggers.pickCount() + '/' + G.config.picksAllowed;
    assetsReport();
  }

  dbg.init = function () {
    var cfg = G.config;
    var trigRows = cfg.triggers.map(function (t) {
      var fire = btn(t, function () { G.triggers.fire(t, fireOpts()); refreshTriggers(); }, 'trig');
      trigBtns[t] = fire;
      var undo = btn('↺', function () { G.triggers.undo(t); refreshTriggers(); }, 'undo');
      undo.setAttribute('aria-label', 'Undo ' + t);
      return el('div', { class: 'trow' }, [fire, undo]);
    });

    var stageSel = el('select', { 'aria-label': 'Stage' }, G.state.stages.map(function (s) { return el('option', { value: s, text: s }); }));
    stageSel.value = G.state.data.stage;

    var tapBox = el('input', { type: 'checkbox', id: 'dbg-tap' });
    var tapLabel = el('span', { class: 'val', text: 'off' });
    tapBox.addEventListener('change', function () {
      if (!tapBox.checked) { dbg.tapOrigin = null; tapLabel.textContent = 'off'; }
      else tapLabel.textContent = 'tap the scene…';
    });
    window.addEventListener('pointerdown', function (e) {
      if (!tapBox.checked || panel.contains(e.target)) return;
      dbg.tapOrigin = [e.clientX, e.clientY];
      var sp = G.scene.screenToScene(e.clientX, e.clientY);
      tapLabel.textContent = 'scene ' + sp[0] + ', ' + sp[1];
    });

    statsEl = el('pre', { class: 'stats' });
    assetsEl = el('pre', { class: 'assets' });

    var body = el('div', { class: 'body' }, [
      section('Stats', [statsEl]),
      section('Speed', [speedRow()]),
      section('Triggers', [el('div', { class: 'tgrid' }, trigRows),
        el('div', { class: 'row' }, [
          btn('+ pick', function () { G.triggers.firePick(fireOpts()); refreshTriggers(); }),
          btn('− last pick', function () { G.triggers.undoLastPick(); refreshTriggers(); }),
          btn('replay all', function () { replay(); })
        ])]),
      section('Origin', [el('label', { class: 'row', for: 'dbg-tap' }, [tapBox, el('span', { text: ' use tap as paint origin ' }), tapLabel])]),
      section('Stage', [el('div', { class: 'row' }, [stageSel,
        btn('jump', function () { jumpStage(stageSel.value); refreshTriggers(); }),
        btn('reset all', function () { cancelReplay(); G.state.clear(); G.triggers.reset(); refreshTriggers(); })])]),
      section('Quality tier', [el('div', { class: 'row' }, ['high', 'medium', 'crossfade'].map(function (t) {
        return btn(t, function () { G.scene.setTier(t); });
      }))]),
      section('Assets', [assetsEl])
    ]);

    var toggle = btn('debug', function () { panel.classList.toggle('collapsed'); }, 'toggle');
    toggle.setAttribute('aria-expanded', 'true');
    panel = el('aside', { class: 'dbg', 'aria-label': 'Debug panel' }, [toggle, body]);
    document.body.appendChild(panel);
    G.triggers.on(refreshTriggers);
    refreshTriggers();
    statsLoop();
    setInterval(statsLoop, 500);

    // URL helpers for tuning: ?debug&instant=choicesShown,pick1&fire=pick2&gap=3&speed=0.5&tier=medium
    var q;
    try { q = new URLSearchParams(window.location.search); } catch (e) { return; }
    if (q.has('collapsed')) panel.classList.add('collapsed');
    if (q.get('speed')) G.speed = Math.max(0.05, +q.get('speed') || 1);
    if (q.get('tier')) G.scene.setTier(q.get('tier'));
    if (q.get('instant')) G.triggers.applyInstant(['start'].concat(q.get('instant').split(',')));
    if (q.get('fire')) {
      var gap = (+q.get('gap') || 0) * 1000;
      q.get('fire').split(',').forEach(function (t, i) {
        setTimeout(function () { G.triggers.fire(t, fireOpts()); refreshTriggers(); }, i * gap);
      });
    }
    refreshTriggers();
  };
})();
