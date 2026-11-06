/* Boot: config → paper → brushes → preload (VOID) → benchmark → restore → ready. */
(function () {
  'use strict';
  var G = window.Garden, U = G.util;

  var raw = window.GARDEN_CONFIG;
  if (!raw) { U.warn('config.js did not load'); return; }
  var cfg = (G.config = G.resolveConfig(raw));
  G.speed = cfg.speed;
  G.ready = false;
  if (cfg.ui.pageTitle) document.title = cfg.ui.pageTitle;

  if (U.flags.reset) {
    G.state.clear();
    // Drop ?reset from the address bar so a later reload keeps progress.
    try {
      var url = new URL(window.location.href);
      url.searchParams.delete('reset');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (e) { /* ignore */ }
  }
  G.state.load();

  function emit(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) { /* ignore */ }
  }

  function placeholderOrMissing(id) {
    return G.placeholders.has(id) ? { placeholder: id } : { missing: true };
  }

  function sourceFor(def) {
    var src;
    if (def.image.indexOf('placeholder:') === 0) {
      var name = def.image.slice(12);
      if (G.placeholders.has(name)) src = { placeholder: name };
      else {
        G.loader.failures.push({ path: def.image, kind: 'layer', id: def.id, reason: 'no placeholder with that name' });
        src = { missing: true };
      }
    } else {
      var key = 'layer:' + def.id;
      if (!G.loader.has(key)) src = { pending: true };
      else src = G.loader.assets[key] ? { image: G.loader.assets[key] } : placeholderOrMissing(def.id);
    }
    var sk = G.loader.assets['sketch:' + def.id];
    if (sk) src.sketchImage = sk;
    return src;
  }

  function boot() {
    G.paper.init(document.getElementById('grain'), cfg);
    G.brushes.init();
    var canvas = document.getElementById('scene');
    G.scene.init(canvas, cfg);
    G.triggers.init(cfg);
    G.flow.init(cfg); // draws the faint phone right away; it inks in as loading progresses

    var load = G.loader.start(cfg, function (p) {
      G.loadProgress = p;
      emit('garden:progress', p);
    });

    return load.ready.then(function () {
      G.brushes.useFiles(cfg.brushes.map(function (p, i) { return G.loader.assets['brush:' + i] || null; }));
      cfg.layers.forEach(function (def) { G.scene.setSource(def.id, sourceFor(def)); });

      // Anything that arrives after the max wait joins at its current state.
      G.loader.onLate(function (job, img) {
        if (job.kind === 'layer') G.scene.provide(job.id, img ? { image: img } : placeholderOrMissing(job.id));
        else if (job.kind === 'sketch') G.scene.provideSketch(job.id, img);
      });

      return G.bench.run();
    }).then(function () {
      G.triggers.applyInstant(G.state.triggersFor(cfg, G.state.data));
      G.ready = true;
      emit('garden:ready');
      G.flow.ready();
      if (U.flags.debug) G.debug.init();
    });
  }

  try {
    boot().catch(function (e) { U.warn('boot failed', e); });
  } catch (e) {
    U.warn('boot failed', e);
  }
})();
