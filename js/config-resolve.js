/* Fills defaults, validates config.js, and remaps pick triggers beyond picksAllowed. */
(function () {
  'use strict';
  var G = window.Garden, U = G.util;

  var BLENDS = {
    normal: 'source-over', 'source-over': 'source-over', multiply: 'multiply', screen: 'screen',
    overlay: 'overlay', darken: 'darken', lighten: 'lighten', 'soft-light': 'soft-light',
    'hard-light': 'hard-light', color: 'color', luminosity: 'luminosity'
  };

  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }

  G.resolveConfig = function (raw) {
    raw = raw || {};
    var cfg = Object.assign({}, raw);
    cfg.picksAllowed = Math.max(1, Math.round(num(raw.picksAllowed, 3)));
    cfg.speed = Math.max(0.05, num(raw.speed, 1));
    cfg.herName = raw.herName || '';
    cfg.requireAllPicks = !!raw.requireAllPicks;
    cfg.rememberProgress = !!raw.rememberProgress;
    cfg.phoneBuzz = raw.phoneBuzz && raw.phoneBuzz.src ? Object.assign({ gap: 3, vibrate: true }, raw.phoneBuzz) : null;
    cfg.ui = Object.assign({
      tapToBegin: 'tap anywhere to begin', newMessage: '1 new message', openMessage: 'Open message', messageFrom: '', continue: 'continue',
      chosen: 'chosen', picksLeft: '{n} left to choose', pickLeftOne: '1 left to choose', picksDone: 'all chosen',
      choose: 'choose this', unchoose: 'let this go', close: 'close', seeMyDay: 'see my day',
      reviewHeading: 'Your day', changeSomething: 'change something', confirm: 'confirm',
      summaryHeading: 'Your birthday', summaryIntro: '', send: 'send', sending: 'sending…', sent: 'sent',
      sendFailed: "The message didn't go through. Please take a screenshot of this.", tryAgain: 'try again',
      replay: 'watch it bloom again', muteOn: 'Sound on', muteOff: 'Sound off'
    }, raw.ui);
    cfg.pacing = Object.assign({ messageLineGap: 1.4, typing: 0.9, letterDelay: 1.5, letterLineGap: 1.2, letterPerChar: 0.03 }, raw.pacing);
    cfg.pickHues = Array.isArray(raw.pickHues) && raw.pickHues.length ? raw.pickHues : ['#b7cddb', '#a9c79a', '#e8aab6'];
    cfg.fx = Object.assign({ petals: 22, ambientPetals: 6, motes: 10, colors: ['#e8aab6', '#f1c4cb', '#e4a58e'] }, raw.fx);
    cfg.phoneMessage = Array.isArray(raw.phoneMessage) ? raw.phoneMessage : raw.phoneMessage ? [String(raw.phoneMessage)] : [];
    cfg.letter = Array.isArray(raw.letter) ? raw.letter : raw.letter ? [String(raw.letter)] : [];
    cfg.photo = raw.photo && raw.photo.src ? raw.photo : null;
    cfg.music = raw.music && raw.music.src ? raw.music : null;
    cfg.scene = Object.assign({ size: 2048, focal: [0.5, 0.42], safeArea: [900, 1100] }, raw.scene);
    cfg.reveal = Object.assign({
      maskScale: 0.5, stamps: 70, wetEdge: true, wetStrength: 0.35, sketchOpacity: 0.55,
      sketchLighten: 0.42, sketchDuration: 2.6, drainSlowdown: 1.35, crossfadeDuration: 3
    }, raw.reveal);
    cfg.reveal.maskScale = U.clamp(num(cfg.reveal.maskScale, 0.5), 0.1, 1);
    cfg.perf = Object.assign({ bestTier: 'medium', maxDpr: 1.5, maxCanvasPixels: 2000000, maxLoadWait: 15, assetTimeout: 12 }, raw.perf);
    cfg.paper = Object.assign({ grainOpacity: 0.55, grainSize: 220 }, raw.paper);
    cfg.palette = Object.assign({}, raw.palette);
    cfg.stagePaperTint = Object.assign({}, raw.stagePaperTint);
    cfg.brushes = Array.isArray(raw.brushes) ? raw.brushes.filter(Boolean) : [];
    cfg.activities = (Array.isArray(raw.activities) ? raw.activities : []).filter(function (a, i) {
      if (!a || !a.id || !a.title) { U.warn('activity #' + (i + 1) + ' needs an id and a title; skipped'); return false; }
      return true;
    });
    cfg.email = Object.assign({ web3formsAccessKey: '', subject: 'Birthday picks' }, raw.email);

    // Trigger list, in story order.
    var triggers = ['start', 'messageOpened', 'choicesShown'];
    for (var k = 1; k <= cfg.picksAllowed; k++) triggers.push('pick' + k);
    // One trigger per activity, fired while that activity is chosen: act:<id>.
    cfg.activities.forEach(function (a) { triggers.push('act:' + a.id); });
    triggers.push('confirmed', 'letterShown', 'sent');
    cfg.triggers = triggers;

    function remap(t, field, id) {
      if (t === null || t === undefined || t === '') return field === 'colorOn' ? 'confirmed' : null;
      if (/^act:/.test(t) && triggers.indexOf(t) < 0) {
        U.warn('layer "' + id + '": no activity with id "' + t.slice(4) + '"; this layer will stay hidden');
        return 'never';
      }
      var m = /^pick(\d+)$/.exec(t);
      if (m && +m[1] > cfg.picksAllowed) return 'confirmed';
      if (triggers.indexOf(t) < 0) {
        U.warn('layer "' + id + '": unknown trigger "' + t + '" for ' + field + '; using confirmed');
        return 'confirmed';
      }
      return t;
    }

    var seen = {};
    cfg.layers = (Array.isArray(raw.layers) ? raw.layers : []).map(function (l, i) {
      var id = l.id || 'layer' + i;
      if (seen[id]) U.warn('duplicate layer id "' + id + '"');
      seen[id] = true;
      var blend = BLENDS[l.blend || 'multiply'];
      if (!blend) { U.warn('layer "' + id + '": unknown blend "' + l.blend + '"; using multiply'); blend = 'multiply'; }
      return {
        id: id,
        index: i,
        image: l.image || 'placeholder:' + id,
        sketchImage: l.sketchImage || null,
        sketchOn: remap(l.sketchOn, 'sketchOn', id),
        colorOn: remap(l.colorOn, 'colorOn', id),
        delay: Math.max(0, num(l.delay, 0)),
        duration: Math.max(0.2, num(l.duration, 5)),
        sketchDelay: Math.max(0, num(l.sketchDelay, 0)),
        sketchDuration: Math.max(0.2, num(l.sketchDuration, cfg.reveal.sketchDuration)),
        origin: l.origin || 'center',
        brush: l.brush === undefined ? 'auto' : l.brush,
        blend: blend,
        opacity: U.clamp(num(l.opacity, 1), 0, 1)
      };
    });
    return cfg;
  };
})();
