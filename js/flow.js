/*
  The story, stage by stage:
    void → message → choices → review → bloom → letter → send → done
  Each stage is one panel in #ui. Progress is saved after every step; on reload the
  current stage is shown straight away (instant), with the garden already in place.
*/
(function () {
  'use strict';
  var G = window.Garden, U = G.util, el = U.el;
  var flow = (G.flow = { stage: null });
  var cfg, ui, root, live, muteBtn, current = null, timers = [], phone = null;

  // ---------------------------------------------------------------- helpers
  function ms(s) { return (Math.max(0, s) / G.speed) * 1000; }
  function later(fn, s) { var id = setTimeout(fn, ms(s)); timers.push(id); return id; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function fill(s, vars) { return U.fill(s, Object.assign({ picks: flow.maxPicks(), name: cfg.herName }, vars)); }

  function announce(msg) {
    live.textContent = '';
    setTimeout(function () { live.textContent = msg; }, 60);
  }

  function setStage(stage) {
    flow.stage = stage;
    G.state.data.stage = stage;
    G.state.save();
    document.body.setAttribute('data-stage', stage);
  }

  function focusIn(node) {
    var f = node && node.querySelector('[data-focus]');
    if (f) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 80);
  }

  // Swap the visible panel. The old one fades out and is removed.
  function show(node, instant) {
    var old = current;
    current = node;
    if (old) {
      old.classList.remove('in');
      old.classList.add('out');
      old.setAttribute('aria-hidden', 'true');
      old.inert = true;
      if (old._destroy) old._destroy();
      setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, 1000);
    }
    if (!node) return;
    root.appendChild(node);
    if (instant) node.classList.add('in', 'instant');
    else { void node.offsetWidth; requestAnimationFrame(function () { node.classList.add('in'); }); }
    if (instant) setTimeout(function () { node.classList.remove('instant'); }, 50);
  }

  function hueFor(i) { return cfg.pickHues[i % cfg.pickHues.length]; }
  function activity(id) { return cfg.activities.filter(function (a) { return a.id === id; })[0]; }

  function pickList() {
    return el('ol', { class: 'picklist' }, flow.picks().map(function (id, i) {
      var a = activity(id) || { title: id };
      return el('li', {}, [
        el('span', { class: 'dot', 'aria-hidden': 'true', style: { '--hue': hueFor(i) } }),
        el('span', { class: 'txt' }, [
          el('span', { class: 't', text: a.title }),
          a.shortDescription ? el('span', { class: 'd', text: a.shortDescription }) : null
        ])
      ]);
    }));
  }

  // ---------------------------------------------------------------- picks API (used by cards.js)
  flow.picks = function () { return G.state.data.picks.slice(); };
  flow.maxPicks = function () { return Math.max(1, Math.min(cfg.picksAllowed, cfg.activities.length)); };
  flow.canReview = function () {
    var n = G.state.data.picks.length;
    return n >= (cfg.requireAllPicks ? flow.maxPicks() : 1);
  };
  flow.choose = function (id, origin) {
    var d = G.state.data;
    if (d.picks.indexOf(id) >= 0 || d.picks.length >= flow.maxPicks()) return false;
    d.picks.push(id);
    G.state.save();
    G.triggers.firePick({ origin: origin });
    G.triggers.fire('act:' + id, { origin: origin }); // this activity's own detail in the garden
    return true;
  };
  flow.unchoose = function (id) {
    var d = G.state.data, i = d.picks.indexOf(id);
    if (i < 0) return false;
    d.picks.splice(i, 1);
    G.state.save();
    G.triggers.undoLastPick(); // the garden always reflects how many are chosen
    G.triggers.undo('act:' + id);
    return true;
  };

  // ---------------------------------------------------------------- VOID + MESSAGE: the phone
  var PHONE_SVG =
    '<svg class="phone-ink" viewBox="0 0 200 400" aria-hidden="true" focusable="false">' +
    '<path class="frame" pathLength="1" d="M34 4H166A30 30 0 0 1 196 34V366A30 30 0 0 1 166 396H34A30 30 0 0 1 4 366V34A30 30 0 0 1 34 4Z"/>' +
    '<path class="detail" pathLength="1" d="M84 21H116"/>' +
    '<path class="detail" pathLength="1" d="M82 381H118"/>' +
    '</svg>';

  // VOID begins with one tap on the blank paper ("turn your sound on…"), because
  // browsers only allow sound after a tap. Then the phone appears and buzzes.
  var begun = false, isReady = false;

  function buildPhone(open) {
    var notif = el('p', { class: 'notif' }, [el('span', { class: 'dot', 'aria-hidden': 'true' }), ui.newMessage]);
    var thread = el('div', { class: 'thread', 'aria-live': 'polite' });
    var cont = el('button', { type: 'button', class: 'btn primary cont', text: ui.continue, on: { click: toChoices } });
    var screen = el('div', { class: 'screen' }, [
      notif,
      ui.messageFrom ? el('p', { class: 'from', text: ui.messageFrom }) : null,
      thread,
      el('div', { class: 'phone-actions' }, [cont])
    ]);
    var body = el('div', { class: 'phone-body' }, [screen]);
    body.insertAdjacentHTML('afterbegin', PHONE_SVG);
    var hit = el('button', { type: 'button', class: 'phone-hit', 'aria-label': ui.openMessage + ' (' + ui.newMessage + ')', disabled: true, 'data-focus': '' });
    hit.addEventListener('click', openMessage);
    var asleep = !open && !begun;
    var ph = el('div', { class: 'phone' + (open ? ' open' : '') + (asleep ? ' asleep' : '') }, [body, open ? null : hit]);
    var begin = asleep ? el('button', { type: 'button', class: 'begin', 'data-focus': '', on: { click: onBegin } }, [
      el('span', { text: ui.tapToBegin })
    ]) : null;
    var node = el('section', { class: 'stage stage-phone' }, [begin, ph]);
    phone = { node: node, ph: ph, hit: hit, begin: begin, thread: thread, cont: cont, ink: body.querySelectorAll('path'), shown: 0 };
    return node;
  }

  function onBegin() {
    if (begun || !phone) return;
    begun = true;
    G.audio.unlockBuzz(); // inside the tap: the buzz may play from now on
    var b = phone.begin;
    b.classList.add('gone');
    b.disabled = true;
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 1200);
    phone.ph.classList.remove('asleep');
    if (isReady) phoneReady(false); // otherwise it inks in as loading finishes
  }

  // The drawn phone shakes in time with each buzz.
  function shake(secs) {
    if (!phone) return;
    var ph = phone.ph;
    ph.classList.remove('buzzing');
    void ph.offsetWidth;
    ph.classList.add('buzzing');
    clearTimeout(ph._buzzT);
    ph._buzzT = setTimeout(function () { ph.classList.remove('buzzing'); }, Math.max(0.4, secs - 0.15) * 1000);
  }

  // Loading progress draws the phone in ink (never fully until ready).
  function setInk(p) {
    if (!phone) return;
    phone.shown = Math.max(phone.shown, p);
    var v = phone.shown;
    phone.ph.style.setProperty('--ink-alpha', (0.2 + 0.8 * v).toFixed(3));
    Array.prototype.forEach.call(phone.ink, function (path, i) {
      // the small details are drawn last
      var k = i === 0 ? U.clamp(v / 0.8, 0, 1) : U.clamp((v - 0.8) / 0.2, 0, 1);
      path.style.strokeDashoffset = String(1 - k);
    });
  }

  function phoneReady(instant) {
    if (!phone) return;
    setInk(1);
    var go = function () {
      if (!phone || flow.stage !== 'void') return;
      phone.ph.classList.add('ready');
      phone.hit.disabled = false;
      G.audio.buzzStart(shake);
      announce(ui.newMessage);
      focusIn(phone.node);
    };
    if (instant) go(); else later(go, 1.4 * G.speed); // let the ink finish (real seconds)
  }

  function openMessage() {
    if (flow.stage !== 'void' || !phone || phone.hit.disabled) return;
    G.audio.buzzStop();
    phone.ph.classList.remove('buzzing');
    phone.hit.disabled = true;
    phone.hit.remove();
    phone.ph.classList.add('open');
    setStage('message');
    G.triggers.fire('messageOpened');
    playThread(false);
  }

  function bubble(text) { return el('p', { class: 'bubble', text: text }); }

  function playThread(instant) {
    var lines = cfg.phoneMessage.map(function (l) { return fill(l); });
    var th = phone.thread;
    if (instant) {
      lines.forEach(function (l) { var b = bubble(l); b.classList.add('in'); th.appendChild(b); });
      phone.cont.classList.add('show');
      focusIn(phone.node);
      phone.cont.setAttribute('data-focus', '');
      return;
    }
    var t = 1.1;
    lines.forEach(function (l) {
      var typing = el('p', { class: 'bubble typing', 'aria-hidden': 'true' }, [el('i'), el('i'), el('i')]);
      later(function () { th.appendChild(typing); void typing.offsetWidth; typing.classList.add('in'); }, t);
      t += cfg.pacing.typing;
      later(function () {
        var b = bubble(l);
        typing.replaceWith(b);
        void b.offsetWidth;
        b.classList.add('in');
      }, t);
      t += cfg.pacing.messageLineGap;
    });
    later(function () {
      phone.cont.classList.add('show');
      try { phone.cont.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }, t - cfg.pacing.messageLineGap + 1.0);
  }

  function toChoices() {
    if (flow.stage !== 'message') return;
    // The music starts with the choices. This runs inside the "continue" tap,
    // which is what lets iOS play sound.
    G.audio.start();
    showMute();
    clearTimers();
    setStage('choices');
    G.triggers.fire('choicesShown');
    G.fx.ambient(cfg, false); // the garden starts breathing as soon as it appears
    phone = null;
    showChoices(false);
  }

  // ---------------------------------------------------------------- CHOICES
  function showChoices(instant) {
    var node = G.cards.build(cfg, flow, instant);
    show(node, instant);
    focusIn(node);
  }

  flow.toReview = function () {
    if (flow.stage !== 'choices' || !flow.canReview()) return;
    setStage('review');
    showReview(false);
  };

  // ---------------------------------------------------------------- REVIEW
  function showReview(instant) {
    var change = el('button', { type: 'button', class: 'btn quiet', text: ui.changeSomething, on: {
      click: function () { if (flow.stage !== 'review') return; setStage('choices'); showChoices(false); }
    } });
    var confirm = el('button', { type: 'button', class: 'btn primary', text: ui.confirm, on: { click: toBloom } });
    var node = el('section', { class: 'stage stage-review' }, [
      el('div', { class: 'panel' }, [
        el('h2', { text: ui.reviewHeading, tabindex: '-1', 'data-focus': '' }),
        pickList(),
        el('div', { class: 'actions' }, [change, confirm])
      ])
    ]);
    show(node, instant);
    focusIn(node);
  }

  // ---------------------------------------------------------------- BLOOM
  function toBloom() {
    if (flow.stage !== 'review') return;
    setStage('bloom');
    show(null);
    G.triggers.fire('confirmed');
    G.fx.petals(cfg);
    G.audio.swell(true);
    afterBloom();
  }

  function afterBloom() {
    // Wait until every reveal has finished painting, then a breath, then the letter.
    var poll = function () {
      if (flow.stage !== 'bloom') return;
      if (G.triggers.busy()) { timers.push(setTimeout(poll, 300)); return; }
      later(function () { if (flow.stage === 'bloom') toLetter(); }, cfg.pacing.letterDelay);
    };
    timers.push(setTimeout(poll, 600));
  }

  // ---------------------------------------------------------------- LETTER
  function toLetter() {
    setStage('letter');
    G.triggers.fire('letterShown');
    G.fx.ambient(cfg, true); // drifting petals join after the bloom
    showLetter(false);
  }

  function showLetter(instant) {
    var lines = cfg.letter.map(function (l) { return el('p', { class: 'line', text: fill(l) }); });
    var photo = null;
    if (cfg.photo && G.loader.assets.photo) {
      photo = el('figure', { class: 'polaroid' }, [
        el('img', { src: cfg.photo.src, alt: cfg.photo.alt || '', decoding: 'async' }),
        cfg.photo.caption ? el('figcaption', { text: cfg.photo.caption }) : null
      ]);
    }
    var cont = el('button', { type: 'button', class: 'btn primary cont', text: ui.continue, on: { click: toSend } });
    var actions = el('div', { class: 'actions' }, [cont]);
    var paper = el('article', { class: 'letter', tabindex: '-1' }, lines.concat([photo, actions]));
    var node = el('section', { class: 'stage stage-letter' }, [paper]);
    show(node, instant);

    var reveal = function (n) {
      n.classList.add('in');
      if (paper.scrollHeight > paper.clientHeight + 4) {
        try { n.scrollIntoView({ block: 'nearest', behavior: U.reducedMotion() ? 'auto' : 'smooth' }); } catch (e) { /* ignore */ }
      }
    };
    if (instant) {
      lines.forEach(function (n) { n.classList.add('in'); });
      if (photo) photo.classList.add('in');
      actions.classList.add('in');
      cont.setAttribute('data-focus', '');
      focusIn(node);
      return;
    }
    var t = 0.9;
    lines.forEach(function (n, i) {
      later(function () { reveal(n); }, t);
      t += cfg.pacing.letterLineGap + cfg.pacing.letterPerChar * (cfg.letter[i] || '').length;
    });
    if (photo) { later(function () { reveal(photo); }, t); t += 1.6; }
    later(function () {
      reveal(actions);
      try { cont.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }, t);
  }

  // ---------------------------------------------------------------- SEND + DONE
  function toSend() {
    if (flow.stage !== 'letter') return;
    clearTimers();
    G.audio.swell(false);
    setStage('send');
    showSend(false);
  }

  function showSend(instant) {
    var status = el('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
    var btn = el('button', { type: 'button', class: 'btn primary', text: ui.send });
    var panel = el('div', { class: 'panel summary' }, [
      el('h2', { text: fill(ui.summaryHeading), tabindex: '-1', 'data-focus': '' }),
      ui.summaryIntro ? el('p', { class: 'intro', text: fill(ui.summaryIntro) }) : null,
      pickList(),
      status,
      el('div', { class: 'actions' }, [btn])
    ]);
    btn.addEventListener('click', function () {
      if (G.send.inFlight || G.state.data.sent) return;
      btn.disabled = true;
      btn.textContent = ui.sending;
      panel.classList.remove('failed');
      status.textContent = '';
      G.send.submit(cfg, flow.picks()).then(function (res) {
        if (flow.stage !== 'send') return;
        if (res.ok) {
          G.state.data.sent = true;
          G.state.save();
          btn.remove();
          status.textContent = ui.sent;
          panel.classList.add('sent');
          G.triggers.fire('sent');
          later(toDone, 1.8);
        } else {
          panel.classList.add('failed');
          status.textContent = ui.sendFailed;
          btn.disabled = false;
          btn.textContent = ui.tryAgain;
        }
      });
    });
    var node = el('section', { class: 'stage stage-send' }, [panel]);
    show(node, instant);
    focusIn(node);
  }

  function toDone() {
    setStage('done');
    showDone(false);
  }

  function showDone(instant) {
    var again = ui.replay ? el('button', { type: 'button', class: 'btn quiet replay', text: ui.replay, on: { click: replay } }) : null;
    var node = el('section', { class: 'stage stage-done' }, [
      el('div', { class: 'done-box' }, [
        el('p', { class: 'closing', tabindex: '-1', 'data-focus': '', text: fill(cfg.closingLine) }),
        again
      ])
    ]);
    show(node, instant);
    focusIn(node);
  }

  // "watch it bloom again": replays the garden from the blank page with her picks.
  // Only the picture replays; nothing is saved or sent again.
  function replay() {
    if (flow.stage !== 'done' || flow.replaying) return;
    flow.replaying = true;
    clearTimers();
    G.fx.stop();
    show(null);
    // Fade the finished garden away, then start again from the blank page.
    var canvas = document.getElementById('scene');
    canvas.style.opacity = '0';
    timers.push(setTimeout(function () {
      G.triggers.applyInstant(['start']);
      canvas.style.opacity = '';
    }, 1500));
    var seq = [['messageOpened', 1.6 * G.speed + 1.4], ['choicesShown', 2.6]];
    flow.picks().forEach(function (id, i) { seq.push(['pick', i ? 4 : 3.4, id]); });
    seq.push(['confirmed', 4.5]);
    var t = 0;
    seq.forEach(function (s) {
      t += s[1];
      later(function () {
        if (s[0] === 'pick') { G.triggers.firePick({}); G.triggers.fire('act:' + s[2]); return; }
        G.triggers.fire(s[0]);
        if (s[0] === 'choicesShown') G.fx.ambient(cfg, false);
        if (s[0] === 'confirmed') { G.fx.petals(cfg); G.audio.swell(true); }
      }, t);
    });
    function finish() {
      if (!flow.replaying) return;
      if (G.triggers.busy()) { timers.push(setTimeout(finish, 300)); return; }
      G.triggers.fire('letterShown');
      G.triggers.fire('sent');
      flow.replaying = false;
      G.audio.swell(false);
      G.fx.ambient(cfg, true);
      showDone(false);
    }
    later(finish, t + 1);
  }

  // ---------------------------------------------------------------- sound toggle
  // Music belongs to every stage from the choices on.
  function musicStage(stage) { return ['void', 'message'].indexOf(stage) < 0; }

  var ICON_ON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path class="wave" d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.6a7.6 7.6 0 0 1 0 10.8"/></svg>';
  var ICON_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path class="wave" d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';

  function renderMute() {
    if (!muteBtn) return;
    var on = !G.audio.muted;
    muteBtn.innerHTML = on ? ICON_ON : ICON_OFF;
    muteBtn.setAttribute('aria-label', on ? ui.muteOn : ui.muteOff);
    muteBtn.setAttribute('aria-pressed', on ? 'false' : 'true');
    muteBtn.title = on ? ui.muteOn : ui.muteOff;
    muteBtn.hidden = !G.audio.enabled;
  }
  function showMute() {
    if (!muteBtn || !G.audio.enabled) return;
    muteBtn.classList.add('show');
    renderMute();
  }

  // ---------------------------------------------------------------- boot + restore
  flow.init = function (config) {
    cfg = config;
    window.addEventListener('pointerdown', function () { document.body.classList.add('pointer-input'); }, true);
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Tab' || e.key.indexOf('Arrow') === 0) document.body.classList.remove('pointer-input');
    }, true);
    ui = cfg.ui;
    root = document.getElementById('ui');
    live = el('p', { class: 'sr-only', 'aria-live': 'polite' });
    document.body.appendChild(live);

    G.audio.init(cfg);
    if (G.audio.enabled) {
      muteBtn = el('button', { type: 'button', class: 'mute', hidden: true, on: { click: function () { G.audio.toggle(); } } });
      document.body.appendChild(muteBtn);
      G.audio.on(renderMute);
      renderMute();
    }

    flow.stage = G.state.data.stage;
    document.body.setAttribute('data-stage', flow.stage);
    if (flow.stage === 'void') {
      show(buildPhone(false), true);
      focusIn(current);
      setInk(0.08);
      window.addEventListener('garden:progress', function (e) {
        if (flow.stage === 'void') setInk(0.08 + 0.72 * (e.detail || 0));
      });
    }
  };

  // Called once assets are in and the benchmark is done.
  flow.ready = function () {
    isReady = true;
    if (flow.stage === 'void' && phone) { if (begun) phoneReady(false); }
    else flow.restore();
    // Returning visitors past the message: sound starts on their first tap anywhere.
    if (musicStage(flow.stage)) {
      var first = function () {
        window.removeEventListener('pointerdown', first, true);
        window.removeEventListener('keydown', first, true);
        G.audio.start();
        showMute();
      };
      window.addEventListener('pointerdown', first, true);
      window.addEventListener('keydown', first, true);
    }
  };

  // Show whatever stage the saved state says, instantly (reload / debug jump).
  flow.restore = function () {
    clearTimers();
    G.fx.stop();
    G.audio.buzzStop();
    flow.replaying = false;
    document.getElementById('scene').style.opacity = '';
    var stage = G.state.data.stage;
    if (stage === 'send' && G.state.data.sent) { stage = 'done'; G.state.data.stage = 'done'; G.state.save(); }
    flow.stage = stage;
    document.body.setAttribute('data-stage', stage);
    if (musicStage(stage)) showMute();
    var after = ['letter', 'send', 'done'].indexOf(stage) >= 0;
    if (after || ['choices', 'review', 'bloom'].indexOf(stage) >= 0) G.fx.ambient(cfg, after);
    G.audio.swell(stage === 'bloom' || stage === 'letter');
    phone = null;
    switch (stage) {
      case 'void': begun = false; show(buildPhone(false), true); break;
      case 'message': show(buildPhone(true), true); playThread(true); break;
      case 'choices': showChoices(true); break;
      case 'review': showReview(true); break;
      case 'bloom': show(null); afterBloom(); break;
      case 'letter': showLetter(true); break;
      case 'send': showSend(true); break;
      default: showDone(true);
    }
  };
})();
