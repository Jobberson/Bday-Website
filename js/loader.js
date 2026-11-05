/*
  Preloads every image asset during the VOID stage. It never hangs:
  - each asset has its own timeout; failures are logged and recorded, never thrown
  - `ready` resolves when everything settled OR after perf.maxLoadWait seconds
  - assets that finish after that are delivered later through onLate()
*/
(function () {
  'use strict';
  var G = window.Garden, U = G.util;

  var loader = (G.loader = {
    failures: [],   // { path, kind, id, reason }
    assets: {},     // key -> HTMLImageElement | null (failed)
    total: 0,
    done: 0,
    timedOut: false
  });
  var lateListeners = [];

  loader.onLate = function (fn) { lateListeners.push(fn); };

  function loadImage(path, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var finished = false;
      var timer = setTimeout(function () { finish(new Error('timed out after ' + timeoutMs / 1000 + 's')); }, timeoutMs);
      function finish(err) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        img.onload = img.onerror = null;
        if (err) reject(err); else resolve(img);
      }
      img.decoding = 'async';
      img.onload = function () {
        if (!img.naturalWidth) return finish(new Error('image has no size'));
        // decode() off the main thread where supported, so first draw doesn't stall.
        if (img.decode) img.decode().then(function () { finish(); }, function () { finish(); });
        else finish();
      };
      img.onerror = function () { finish(new Error('not found or not a valid image')); };
      img.src = path;
    });
  }
  loader.loadImage = loadImage;

  function isFile(p) { return typeof p === 'string' && p && p.indexOf('placeholder:') !== 0; }

  // Starts loading everything. Returns { ready: Promise }.
  loader.start = function (cfg, onProgress) {
    var jobs = [];
    cfg.layers.forEach(function (l) {
      if (isFile(l.image)) jobs.push({ key: 'layer:' + l.id, kind: 'layer', id: l.id, path: l.image });
      if (isFile(l.sketchImage)) jobs.push({ key: 'sketch:' + l.id, kind: 'sketch', id: l.id, path: l.sketchImage });
    });
    cfg.brushes.forEach(function (p, i) {
      if (isFile(p)) jobs.push({ key: 'brush:' + i, kind: 'brush', id: String(i), path: p });
    });
    if (cfg.photo && isFile(cfg.photo.src)) jobs.push({ key: 'photo', kind: 'photo', id: 'photo', path: cfg.photo.src });

    loader.total = jobs.length;
    loader.done = 0;
    var timeoutMs = Math.max(1, cfg.perf.assetTimeout) * 1000;
    var readyFired = false;

    var all = jobs.map(function (job) {
      return loadImage(job.path, timeoutMs).then(function (img) {
        loader.assets[job.key] = img;
        return img;
      }, function (err) {
        loader.assets[job.key] = null;
        var f = { path: job.path, kind: job.kind, id: job.id, reason: err.message };
        loader.failures.push(f);
        U.warn('could not load ' + job.kind + ' "' + job.path + '": ' + err.message + '; using fallback');
        return null;
      }).then(function (img) {
        loader.done++;
        if (onProgress) onProgress(loader.done / Math.max(1, loader.total));
        if (readyFired) {
          lateListeners.forEach(function (fn) {
            try { fn(job, img); } catch (e) { U.warn('late asset handler failed', e); }
          });
        }
      });
    });

    var ready = new Promise(function (resolve) {
      var timer = setTimeout(function () {
        loader.timedOut = loader.done < loader.total;
        if (loader.timedOut) U.warn('still loading after ' + cfg.perf.maxLoadWait + 's; continuing without the rest');
        readyFired = true;
        resolve();
      }, Math.max(1, cfg.perf.maxLoadWait) * 1000);
      Promise.all(all).then(function () {
        clearTimeout(timer);
        readyFired = true;
        resolve();
      });
    });
    if (!jobs.length && onProgress) onProgress(1);
    return { ready: ready };
  };

  // Whether an asset finished (successfully or not) by the time `ready` resolved.
  loader.has = function (key) { return Object.prototype.hasOwnProperty.call(loader.assets, key); };
})();
