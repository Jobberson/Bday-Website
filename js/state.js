/* Saved progress: { stage, picks:[activity ids in order], sent }. Never throws. */
(function () {
  'use strict';
  var G = window.Garden, U = G.util;
  var KEY = 'celeGarden.v1';
  var STAGES = ['void', 'message', 'choices', 'review', 'bloom', 'letter', 'send', 'done'];

  var state = (G.state = {
    stages: STAGES,
    data: { stage: 'void', picks: [], sent: false }
  });

  state.load = function () {
    var d = U.store.get(KEY);
    if (d && typeof d === 'object' && STAGES.indexOf(d.stage) >= 0) {
      state.data = {
        stage: d.stage,
        picks: Array.isArray(d.picks) ? d.picks.filter(function (x) { return typeof x === 'string'; }) : [],
        sent: !!d.sent
      };
    }
    return state.data;
  };
  state.save = function () { U.store.set(KEY, state.data); };
  state.clear = function () {
    U.store.remove(KEY);
    state.data = { stage: 'void', picks: [], sent: false };
  };

  // Which triggers have fired by a given stage + number of picks.
  state.triggersFor = function (cfg, data) {
    var i = STAGES.indexOf(data.stage);
    var out = ['start'];
    if (i >= 1) out.push('messageOpened');
    if (i >= 2) {
      out.push('choicesShown');
      var n = i >= 4 ? cfg.picksAllowed : Math.min(data.picks.length, cfg.picksAllowed);
      for (var k = 1; k <= n; k++) out.push('pick' + k);
    }
    if (i >= 4) out.push('confirmed');
    if (i >= 5) out.push('letterShown');
    if (i >= 7 || data.sent) out.push('sent');
    return out;
  };
})();
