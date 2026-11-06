/*
  CHOICES stage: the activity cards, the detail sheet, the picks counter.
  A chosen card fills with watercolour from where it was tapped, in the hue of
  its pick slot, and the garden paints from that same spot.
*/
(function () {
  'use strict';
  var G = window.Garden, U = G.util, el = U.el;
  var cards = (G.cards = {});

  cards.build = function (cfg, flow, instant) {
    var ui = cfg.ui;
    var counter = el('p', { class: 'counter', 'aria-live': 'polite' });
    var see = el('button', { type: 'button', class: 'btn primary see', text: ui.seeMyDay, on: { click: function () { flow.toReview(); } } });
    var list = el('ul', { class: 'cards', role: 'list' });
    var byId = {};

    cfg.activities.forEach(function (a, i) {
      var wash = el('span', { class: 'wash', 'aria-hidden': 'true' });
      var mark = el('span', { class: 'mark', text: ui.chosen });
      var card = el('button', { type: 'button', class: 'card', 'aria-haspopup': 'dialog', 'data-id': a.id }, [
        wash,
        el('span', { class: 'title', text: a.title }),
        a.shortDescription ? el('span', { class: 'short', text: a.shortDescription }) : null,
        mark
      ]);
      card.addEventListener('click', function (e) {
        var r = card.getBoundingClientRect();
        // Tap point (keyboard "clicks" have no position: use the card's centre).
        var x = e.detail ? e.clientX : r.left + r.width / 2;
        var y = e.detail ? e.clientY : r.top + r.height / 2;
        openSheet(a, card, x, y);
      });
      var li = el('li', { style: { '--i': String(i) } }, [card]);
      list.appendChild(li);
      byId[a.id] = { card: card, wash: wash, activity: a };
    });

    var node = el('section', { class: 'stage stage-choices' + (instant ? '' : ' entering'), 'aria-label': ui.seeMyDay }, [
      counter,
      el('div', { class: 'cards-scroll' }, [list]),
      el('div', { class: 'actions' }, [see])
    ]);

    function refresh(animate) {
      var picks = flow.picks(), max = flow.maxPicks(), left = Math.max(0, max - picks.length);
      counter.textContent = left === 0 ? ui.picksDone : left === 1 ? ui.pickLeftOne : U.fill(ui.picksLeft, { n: left });
      node.classList.toggle('full', left === 0);
      see.classList.toggle('show', flow.canReview());
      see.tabIndex = flow.canReview() ? 0 : -1;
      see.setAttribute('aria-hidden', flow.canReview() ? 'false' : 'true');
      Object.keys(byId).forEach(function (id) {
        var c = byId[id], k = picks.indexOf(id), on = k >= 0;
        if (on) c.wash.style.setProperty('--hue', cfg.pickHues[k % cfg.pickHues.length]);
        if (!animate) c.wash.classList.add('instant');
        c.card.classList.toggle('chosen', on);
        c.card.setAttribute('aria-label', c.activity.title + (on ? ' (' + ui.chosen + ')' : ''));
        if (!animate) { void c.wash.offsetWidth; c.wash.classList.remove('instant'); }
      });
    }
    refresh(false);
    node._refresh = refresh;

    // ---------------------------------------------------------------- detail sheet
    var sheetWrap = null, lastFocus = null;

    function closeSheet() {
      if (!sheetWrap) return;
      var w = sheetWrap;
      sheetWrap = null;
      w.classList.remove('open');
      document.removeEventListener('keydown', onKey, true);
      setTimeout(function () { if (w.parentNode) w.parentNode.removeChild(w); }, 450);
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    }

    function onKey(e) {
      if (!sheetWrap) return;
      if (e.key === 'Escape') { e.preventDefault(); closeSheet(); return; }
      if (e.key === 'Tab') {
        var f = Array.prototype.filter.call(sheetWrap.querySelectorAll('button'), function (b) { return !b.disabled; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }

    function openSheet(a, card, x, y) {
      closeSheet();
      lastFocus = card;
      var picks = flow.picks(), chosen = picks.indexOf(a.id) >= 0;
      var full = picks.length >= flow.maxPicks();
      var titleId = 'sheet-title-' + a.id;
      var primary = el('button', {
        type: 'button', class: 'btn primary',
        text: chosen ? ui.unchoose : full ? ui.picksDone : ui.choose,
        disabled: !chosen && full
      });
      var close = el('button', { type: 'button', class: 'btn quiet', text: ui.close, on: { click: closeSheet } });
      primary.addEventListener('click', function () {
        var c = byId[a.id], r = card.getBoundingClientRect();
        if (chosen) {
          flow.unchoose(a.id);
        } else {
          // Wash starts where she tapped the card.
          c.wash.style.setProperty('--ox', U.clamp(((x - r.left) / r.width) * 100, 0, 100).toFixed(0) + '%');
          c.wash.style.setProperty('--oy', U.clamp(((y - r.top) / r.height) * 100, 0, 100).toFixed(0) + '%');
          flow.choose(a.id, [x, y]);
        }
        refresh(true);
        closeSheet();
      });
      var sheet = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId }, [
        el('h2', { id: titleId, text: a.title }),
        el('p', { class: 'long', text: a.longDescription || a.shortDescription || '' }),
        el('div', { class: 'actions' }, [close, primary])
      ]);
      sheetWrap = el('div', { class: 'sheet-wrap' }, [sheet]);
      sheetWrap.addEventListener('click', function (e) { if (e.target === sheetWrap) closeSheet(); });
      document.getElementById('ui').appendChild(sheetWrap);
      document.addEventListener('keydown', onKey, true);
      void sheetWrap.offsetWidth;
      sheetWrap.classList.add('open');
      (primary.disabled ? close : primary).focus({ preventScroll: true });
    }

    node._destroy = function () { closeSheet(); };
    return node;
  };
})();
