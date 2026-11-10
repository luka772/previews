/* VB-TEC · Dagklok. Page-local choreography on top of the untouched engine.
   Reads the engine's published --sc-p per act and the day clip's own
   currentTime. Everything bespoke lives here. */
window.__DK_RUN__ = function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var P = function (el) { return parseFloat(getComputedStyle(el).getPropertyValue('--sc-p')) || 0; };

  // Re-measure once fonts and media have settled (engine sizes acts at mount).
  function relayout() { dispatchEvent(new Event('resize')); }
  addEventListener('load', relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);

  /* ------------------------------------------------------ day clock ----- */
  var CLIP_LEN = 19;
  // The clip is three legs: 9:00 to 13:00, 13:00 to 19:30, 19:30 to 22:30.
  function hourFromClip(t) {
    if (t <= 6.2) return 9 + (t / 6.2) * 4;
    if (t <= 12.4) return 13 + ((t - 6.2) / 6.2) * 6.5;
    return 19.5 + ((t - 12.4) / 6.6) * 3;
  }
  var sections = $$('.dk > section[data-hour]');
  var dag = $('#dag');
  var video = $('#dag video');
  var bar = $('#bar');
  var timeEl = $('#clockTime');
  var navLinks = $$('.clock__nav a');

  function dagClipTime() {
    if (video && !reduce && video.readyState >= 1 && video.currentTime > 0) return video.currentTime;
    return clamp(P(dag), 0, 1) * CLIP_LEN;
  }

  function currentHour() {
    var mid = innerHeight * 0.45, h = 6.5;
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i], r = s.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) {
        var spec = s.getAttribute('data-hour');
        if (spec === 'clip') return hourFromClip(dagClipTime());
        var ab = spec.split(' ').map(parseFloat);
        var f = clamp((mid - r.top) / Math.max(1, r.height), 0, 1);
        return ab[0] + (ab[1] - ab[0]) * f;
      }
      if (r.top > mid) break;
      var last = s.getAttribute('data-hour');
      if (last !== 'clip') h = parseFloat(last.split(' ')[1]); else h = 22.5;
    }
    return h;
  }
  function fmt(h) {
    var m = Math.round(h * 60) % (24 * 60);
    m = Math.round(m / 5) * 5;
    var hh = Math.floor(m / 60) % 24, mm = m % 60;
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }

  /* ------------------------------------------ energy model (illustrative) */
  // A sunny day in an ordinary family home. Units are relative, not kW.
  function sun(h) { return h < 7 || h > 20.5 ? 0 : Math.pow(Math.sin(Math.PI * (h - 7) / 13.5), 1.3); }
  function houseLoad(h) { return 0.16 + (h > 17.5 && h < 22.5 ? 0.22 : 0) + (h > 11.5 && h < 13.5 ? 0.06 : 0); }
  function hpLoad(h) { return h < 9 ? 0.2 : h < 16 ? 0.1 : 0.2; }
  function carWant(h) { return (h > 11 && h < 15.5) ? 0.35 : (h > 20.6 ? 0.3 : 0); }

  var STEP = 0.05, T0 = 6, T1 = 24, table = [];
  (function build() {
    var soc = 0.18, CAP = 3.2;
    for (var h = T0; h <= T1 + 1e-6; h += STEP) {
      var pv = sun(h), load = houseLoad(h), hp = hpLoad(h), car = carWant(h);
      var f = { src: pv > 0.02 ? 'dak' : 'batterij', dakHuis: 0, dakWp: 0, dakBat: 0, dakAuto: 0, dakNet: 0,
                batHuis: 0, batWp: 0, batAuto: 0, netHuis: 0, soc: soc };
      var need = load + hp;
      var fromPv = Math.min(pv, need);
      f.dakHuis = Math.min(pv, load);
      f.dakWp = Math.max(0, fromPv - f.dakHuis);
      var surplus = pv - fromPv;
      if (surplus > 0) {
        f.dakAuto = Math.min(surplus, car * 0.8);
        surplus -= f.dakAuto;
        var room = (1 - soc) * CAP / STEP;
        f.dakBat = Math.min(surplus * 0.9, room, 0.6);
        surplus -= f.dakBat;
        f.dakNet = surplus;
        soc = Math.min(1, soc + f.dakBat * STEP / CAP);
      }
      var deficit = need - fromPv;
      if (deficit > 0 || (pv < 0.02 && car > 0)) {
        var avail = soc * CAP / STEP;
        var d = Math.min(deficit, avail);
        f.batHuis = d * (load / need); f.batWp = d - f.batHuis;
        var ca = (pv < 0.02) ? Math.min(car, Math.max(0, avail - d), 0.45) : 0;
        f.batAuto = ca;
        soc = Math.max(0.05, soc - (d + ca) * STEP / CAP);
        f.netHuis = Math.max(0, deficit - d);
      }
      f.soc = soc;
      table.push(f);
    }
  })();
  function flowsAt(h) { return table[clamp(Math.round((h - T0) / STEP), 0, table.length - 1)]; }

  /* ------------------------------------------------------- flow map ----- */
  // Node positions in the clip's own pixel space (1600 x 900).
  var N = {
    dak: [700, 330], huis: [535, 560], wp: [398, 612], bat: [1316, 606],
    auto: [1150, 600], net: [1462, 556]
  };
  var LABEL = { dak: 'Zonnepanelen', huis: 'Huis', wp: 'Warmtepomp', bat: 'Thuisbatterij', auto: 'Auto', net: 'Net' };
  var TAGPOS = { dak: '', huis: 'tag--below', wp: 'tag--below', bat: '', auto: '', net: '' };
  var EDGES = [
    ['dakHuis', 'dak', 'huis', -40], ['dakWp', 'dak', 'wp', -70], ['dakBat', 'dak', 'bat', -120],
    ['dakAuto', 'dak', 'auto', -60], ['dakNet', 'dak', 'net', -180],
    ['batHuis', 'bat', 'huis', 90], ['batWp', 'bat', 'wp', 130], ['batAuto', 'bat', 'auto', -18],
    ['netHuis', 'net', 'huis', 150]
  ];
  var flowBox = $('#flow'), svg = $('#flowSvg'), NS = 'http://www.w3.org/2000/svg';
  var edgeEls = {};
  if (svg) {
    svg.setAttribute('viewBox', '0 0 1600 900');
    EDGES.forEach(function (e) {
      var a = N[e[1]], b = N[e[2]];
      var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 + e[3];
      var d = 'M' + a[0] + ' ' + a[1] + ' Q' + mx + ' ' + my + ' ' + b[0] + ' ' + b[1];
      var g = document.createElementNS(NS, 'g');
      ['track', 'halo', 'live'].forEach(function (c) {
        var p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('class', c); g.appendChild(p);
      });
      svg.appendChild(g);
      edgeEls[e[0]] = { g: g, halo: g.children[1], live: g.children[2] };
    });
    Object.keys(N).forEach(function (k) {
      var c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', N[k][0]); c.setAttribute('cy', N[k][1]);
      c.setAttribute('r', 7); c.setAttribute('class', 'node'); c.setAttribute('vector-effect', 'non-scaling-stroke'); svg.appendChild(c);
      var t = document.createElement('span'); t.className = 'tag ' + TAGPOS[k]; t.textContent = LABEL[k];
      t.style.left = (N[k][0] / 16) + '%'; t.style.top = (N[k][1] / 9) + '%'; t.dataset.node = k;
      flowBox.appendChild(t);
    });
  }
  // Fit the overlay to the clip as it is actually drawn (object-fit: cover).
  function fitFlow() {
    if (!flowBox) return;
    var media = (video && video.classList.contains('sc-has-clip')) ? video : $('#dag .sc-stage__poster');
    var stage = flowBox.parentElement.getBoundingClientRect();
    var r = media.getBoundingClientRect();
    var cs = getComputedStyle(media), pos = cs.objectPosition.split(' ');
    var px = parseFloat(pos[0]) / 100, py = parseFloat(pos[1] || '50%') / 100;
    if (isNaN(px)) px = 0.5; if (isNaN(py)) py = 0.5;
    var s = Math.max(r.width / 1600, r.height / 900), w = 1600 * s, h = 900 * s;
    flowBox.style.left = (r.left - stage.left + (r.width - w) * px) + 'px';
    flowBox.style.top = (r.top - stage.top + (r.height - h) * py) + 'px';
    flowBox.style.width = w + 'px'; flowBox.style.height = h + 'px';
    flowBox.style.clipPath = 'inset(' + Math.max(0, -((r.height - h) * py)) + 'px ' + Math.max(0, -((r.width - w) * (1 - px))) + 'px ' +
      Math.max(0, -((r.height - h) * (1 - py))) + 'px ' + Math.max(0, -((r.width - w) * px)) + 'px)';
  }
  addEventListener('resize', fitFlow);

  var meters = { huis: $('#m-huis'), wp: $('#m-wp'), bat: $('#m-bat'), auto: $('#m-auto'), net: $('#m-net') };
  var socCell = $('#socCell');
  var dash = 0, lastT = performance.now();
  function drawFlow(hour, dt) {
    var f = flowsAt(hour);
    dash -= dt * 0.06;
    EDGES.forEach(function (e) {
      var v = f[e[0]] || 0, el = edgeEls[e[0]];
      if (!el) return;
      var on = v > 0.015;
      var w = on ? 1.6 + v * 11 : 0;
      el.live.style.strokeWidth = w; el.halo.style.strokeWidth = on ? w + 3 : 0;
      el.live.style.opacity = on ? clamp(0.45 + v * 1.6, 0, 1) : 0;
      el.live.style.strokeDashoffset = reduce ? 0 : dash * (0.6 + v);
    });
    var total = f.dakHuis + f.batHuis + f.netHuis + f.dakWp + f.batWp + f.dakBat + f.dakAuto + f.batAuto + f.dakNet || 1;
    var set = function (m, v) { if (m) m.style.setProperty('--v', clamp(v / Math.max(total, 0.5), 0, 1).toFixed(3)); };
    set(meters.huis, f.dakHuis + f.batHuis + f.netHuis);
    set(meters.wp, f.dakWp + f.batWp);
    set(meters.bat, f.dakBat);
    set(meters.auto, f.dakAuto + f.batAuto);
    set(meters.net, f.dakNet);
    if (socCell) socCell.style.setProperty('--soc', f.soc.toFixed(3));
    var h2 = $('.readout h2');
    if (h2) h2.textContent = f.src === 'dak' ? 'Waar gaat de zonnestroom nu naartoe?' : 'Nu draait het huis op de batterij';
  }

  // Reduced motion: no clip is fetched, so swap the poster by time of day.
  var DKB = (window.__DK_BASE__ || '') + '/dagklok/img/';
  var rmPosters = [DKB + 'dag-0.webp', DKB + 'dag-6.2.webp', DKB + 'dag-12.4.webp', DKB + 'dag-18.95.webp'];
  var poster = $('#dag .sc-stage__poster'), posterIdx = 0;
  function reducedPoster() {
    var p = clamp(P(dag), 0, 1), i = p < 0.2 ? 0 : p < 0.5 ? 1 : p < 0.78 ? 2 : 3;
    if (i !== posterIdx && poster) { poster.src = rmPosters[i]; posterIdx = i; }
  }

  /* ----------------------------------------------------- hero planes ---- */
  var hero = $('#ochtend');
  var planes = hero ? {
    lucht: $('.plane--lucht', hero), back: $('.hero__back', hero), huis: $('.plane--huis', hero),
    mist: $('.hero__mist', hero), haag: $('.plane--haag', hero), front: $('.hero__front', hero)
  } : null;
  var mx = 0, my = 0, tx = 0, ty = 0;
  if (fine && !reduce && hero) {
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5; ty = (e.clientY - r.top) / r.height - 0.5;
    });
    hero.addEventListener('pointerleave', function () { tx = 0; ty = 0; });
  }
  function drawHero() {
    if (!planes || reduce) return;
    var r = hero.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    var p = clamp(P(hero), 0, 1);
    // exit: once the stage unpins, keep separating as it leaves
    var e = p >= 1 ? clamp(-r.bottom / innerHeight + 1, 0, 1) : 0;
    var k = p + e * 0.5;
    mx += (tx - mx) * 0.08; my += (ty - my) * 0.08;
    planes.lucht.style.transform = 'translate3d(' + (mx * -6) + 'px,' + (k * -24 + my * -4) + 'px,0) scale(' + (1.02 + k * 0.02) + ')';
    planes.back.style.transform = 'translate3d(' + (mx * -10) + 'px,' + (k * -70) + 'px,0)';
    planes.back.style.opacity = String(clamp(1 - Math.max(0, k - 0.55) * 2.2, 0, 1));
    planes.huis.style.transform = 'translate3d(' + (mx * -14) + 'px,' + (k * 10 + my * -3) + 'px,0) scale(' + (1 + k * 0.05) + ')';
    planes.mist.style.transform = 'translate3d(' + (k * 60 + mx * -22) + 'px,0,0)';
    planes.mist.style.opacity = String(clamp(1 - k * 0.8, 0.2, 1));
    planes.haag.style.transform = 'translate3d(' + (mx * -30) + 'px,' + (k * 40 + my * -6) + 'px,0) scale(' + (1 + k * 0.14) + ')';
    planes.front.style.transform = 'translate3d(0,' + (k * -24) + 'px,0)';
  }

  /* -------------------------------------------------- rail settle ------- */
  var parts = $$('#rail > *');
  function drawRail() {
    if (reduce) return;
    parts.forEach(function (el, i) {
      if (i === 0) return;
      var r = el.getBoundingClientRect();
      var s = clamp((innerWidth - r.left) / (innerWidth * 0.32), 0, 1);
      el.style.setProperty('--settle', s.toFixed(3));
    });
  }

  /* ------------------------------------------------ real counters ------- */
  var counts = $$('#bedrijven [data-num]'), pro = $('#bedrijven');
  var nf = new Intl.NumberFormat('nl-BE');
  function drawCounts() {
    var p = clamp(P(pro), 0, 1);
    counts.forEach(function (c) {
      var at = c.getAttribute('data-at').split(' ').map(parseFloat), n = +c.getAttribute('data-num');
      var f = reduce ? 1 : clamp((p - at[0]) / (at[1] - at[0]), 0, 1);
      f = 1 - Math.pow(1 - f, 3);
      var txt = nf.format(Math.round(n * f));
      if (c.textContent !== txt) c.textContent = txt;
    });
  }

  /* --------------------------------------------------- bar state -------- */
  var offerte = $('#offerte');
  var navMap = { ochtend: ['ochtend', 'factuur'], dag: ['dag'], systeem: ['systeem'], bedrijven: ['bedrijven', 'offerte'] };
  function drawBar(hour) {
    if (timeEl) { var t = fmt(hour); if (timeEl.textContent !== t) timeEl.textContent = t; }
    document.documentElement.style.setProperty('--day', clamp((hour - 6.5) / 17, 0, 1).toFixed(4));
    if (!bar) return;
    bar.classList.toggle('is-scrolled', scrollY > 8);
    var probe = bar.offsetHeight * 0.5, onDark = false, current = null;
    sections.forEach(function (s) {
      var r = s.getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) onDark = s.classList.contains('dark');
      if (r.top <= innerHeight * 0.45 && r.bottom > innerHeight * 0.45) current = s.id;
    });
    bar.classList.toggle('on-dark', onDark);
    navLinks.forEach(function (a) {
      a.setAttribute('aria-current', String((navMap[a.dataset.moment] || []).indexOf(current) > -1));
    });
    var or = offerte.getBoundingClientRect();
    bar.classList.toggle('cta-off', or.top < innerHeight * 0.6);
  }

  /* ---------------------------------------------------- the loop -------- */
  function frame(now) {
    if (!document.body.contains(dag)) return;
    var dt = Math.min(64, now - lastT); lastT = now;
    var hour = currentHour();
    drawBar(hour);
    drawHero();
    var dr = dag.getBoundingClientRect();
    if (dr.bottom > 0 && dr.top < innerHeight) {
      fitFlow();
      drawFlow(hourFromClip(dagClipTime()), dt);
      if (reduce) reducedPoster();
    }
    drawRail();
    drawCounts();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ----------------------------------- selection carries into the form -- */
  var picks = $$('[data-pick]');
  function syncPick(val, on) {
    var box = $('#form input[name="interesse"][value="' + val + '"]');
    if (box) box.checked = on;
  }
  picks.forEach(function (b) {
    b.addEventListener('click', function () {
      var on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      syncPick(b.dataset.pick, on);
    });
  });
  $$('#form input[name="interesse"]').forEach(function (box) {
    box.addEventListener('change', function () {
      var b = $('[data-pick="' + box.value + '"]'); if (b) b.setAttribute('aria-pressed', String(box.checked));
    });
  });
  $$('a[data-type="bedrijf"]').forEach(function (a) {
    a.addEventListener('click', function () { var r = $('#form input[name="type"][value="bedrijf"]'); if (r) r.checked = true; });
  });

  // Arriving from the welcome page's business choice: preset the form.
  if (location.hash === '#bedrijven') {
    var rb = $('#form input[name="type"][value="bedrijf"]'); if (rb) rb.checked = true;
  }

  /* ---------------------------- form: opens a filled-in e-mail to VB-TEC -- */
  var form = $('#form'), status = $('#formStatus');
  if (form) form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    var fd = new FormData(form);
    var lines = [
      'Offerteaanvraag via de website',
      'Voor: ' + (fd.get('type') === 'bedrijf' ? 'bedrijf' : 'thuis'),
      'Naam: ' + fd.get('voornaam') + ' ' + fd.get('achternaam'),
      'E-mail: ' + fd.get('email'),
      'Telefoon: ' + fd.get('telefoon'),
      'Interesse: ' + (fd.getAll('interesse').join(', ') || 'nog niet gekozen'),
      '', String(fd.get('vraag') || '')
    ];
    var href = 'mailto:info@vbtec.be?subject=' + encodeURIComponent('Offerteaanvraag') + '&body=' + encodeURIComponent(lines.join('\n'));
    status.hidden = false;
    status.innerHTML = '';
    status.append('Bijna klaar: uw aanvraag staat klaar in uw mailprogramma. Druk daar nog op Verzenden. ');
    var a = document.createElement('a'); a.href = href; a.textContent = 'Opent er niets? Klik hier';
    a.style.fontWeight = '700';
    status.append(a, ' of bel +32 51 15 31 12.');
    location.href = href;
  });
};
