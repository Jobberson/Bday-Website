/*
  Emails her picks through Web3Forms. Never throws: resolves { ok, reason }.
  Only one request can be in flight, and nothing is sent again once it succeeded.
  An empty access key goes straight down the failure path (screenshot message).
*/
(function () {
  'use strict';
  var G = window.Garden, U = G.util;
  var S = (G.send = { inFlight: false });
  var ENDPOINT = 'https://api.web3forms.com/submit';
  var TIMEOUT = 15000;

  function pickLines(cfg, picks) {
    return picks.map(function (id, i) {
      var a = cfg.activities.filter(function (x) { return x.id === id; })[0];
      return (i + 1) + '. ' + (a ? a.title + (a.shortDescription ? ' (' + a.shortDescription + ')' : '') : id);
    });
  }
  S.pickLines = pickLines;

  S.submit = function (cfg, picks) {
    if (G.state.data.sent) return Promise.resolve({ ok: true, reason: 'already sent' });
    if (S.inFlight) return Promise.resolve({ ok: false, reason: 'busy', busy: true });
    S.inFlight = true;

    var key = (cfg.email.web3formsAccessKey || '').trim();
    var done = function (res) { S.inFlight = false; return res; };
    if (!key) {
      U.warn('email.web3formsAccessKey is empty, so nothing was sent');
      return U.wait(1200).then(function () { return done({ ok: false, reason: 'no access key' }); });
    }

    var lines = pickLines(cfg, picks);
    var body = {
      access_key: key,
      subject: cfg.email.subject || 'Birthday picks',
      from_name: cfg.email.fromName || 'Birthday garden',
      name: cfg.herName || 'her',
      message: (cfg.herName || 'She') + ' chose:\n\n' + lines.join('\n') +
        '\n\n(sent from the birthday garden, ' + new Date().toString() + ')',
      picks: lines.join(' | '),
      botcheck: ''
    };

    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, TIMEOUT);
    var req;
    try {
      req = fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: ctl ? ctl.signal : undefined
      });
    } catch (e) {
      clearTimeout(timer);
      return Promise.resolve(done({ ok: false, reason: e.message }));
    }
    return req.then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        if (res.ok && json && json.success !== false) return { ok: true };
        return { ok: false, reason: (json && json.message) || 'HTTP ' + res.status };
      });
    }, function (e) {
      return { ok: false, reason: e && e.name === 'AbortError' ? 'timed out' : (e && e.message) || 'network error' };
    }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) U.warn('sending failed: ' + res.reason);
      return done(res);
    });
  };
})();
