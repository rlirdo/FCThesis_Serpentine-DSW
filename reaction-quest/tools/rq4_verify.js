/* v2.1 四項修正驗證腳本：貼進頁面 console 執行
   RQV4.audio()        ── 音訊：離開／背景一定停
   RQV4.bgmSwitch()    ── 過關 jingle 播一輪自停、切下一關舊軌歸零
   RQV4.finishSilence()── 全破 3 秒後 RMS = 0
   RQV4.layoutAll()    ── 主角放大＋防重疊（逐關、逐主角、逐畫面尺寸）
   RQV4.title()        ── 首頁選角對比度與零相交 */
window.RQV4 = (function () {
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function (e) { errs.push('onerror: ' + e.message); });
  window.addEventListener('unhandledrejection', function (e) { errs.push('rejection: ' + e.reason); });
  var oe = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); oe.apply(console, arguments); };

  /* ══════ 計時器監控：monkey-patch 記錄存活的 interval / timeout ══════ */
  var live = { iv: {}, to: {} };
  (function () {
    var si = window.setInterval, ci = window.clearInterval;
    var st = window.setTimeout, ct = window.clearTimeout;
    window.setInterval = function (f, d) { var id = si.apply(window, arguments); live.iv[id] = d; return id; };
    window.clearInterval = function (id) { delete live.iv[id]; return ci.apply(window, arguments); };
    window.setTimeout = function (f, d) {
      var id;
      var a = Array.prototype.slice.call(arguments);
      a[0] = function () { delete live.to[id]; return f.apply(this, arguments); };
      id = st.apply(window, a); live.to[id] = d; return id;
    };
    window.clearTimeout = function (id) { delete live.to[id]; return ct.apply(window, arguments); };
  })();
  function timerCount() { return { intervals: Object.keys(live.iv).length, timeouts: Object.keys(live.to).length }; }

  /* ══════ 隱藏頁面模擬 ══════ */
  function fakeHidden(v) {
    window.__fakeHidden = !!v;          // 測試腳手架的旗標
    try {
      Object.defineProperty(document, 'hidden', { configurable: true, get: function () { return v; } });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: function () { return v ? 'hidden' : 'visible'; } });
    } catch (e) { errs.push('fakeHidden ' + e); }
  }
  function snap(tag) {
    return { tag: tag, state: AUDIO.state(), bgm: AUDIO.current(),
             rms: +(AUDIO.rms() || 0).toFixed(6),
             liveVoices: AUDIO.liveVoices(), hasTimer: AUDIO.hasTimer(), timers: timerCount() };
  }

  async function audio() {
    var out = { steps: [] };
    AUDIO.bgm('explore');
    await sleep(1200);
    out.steps.push(snap('bgm playing'));

    /* ① visibilitychange → hidden（＋ pagehide） */
    fakeHidden(true);
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pagehide'));
    await sleep(1500);
    out.steps.push(snap('hidden +1.5s'));
    out.hiddenOK = (AUDIO.state() === 'suspended') && (AUDIO.current() === null) && AUDIO.liveVoices() === 0;

    /* ② 回到前景：不可自動續播 */
    fakeHidden(false);
    document.dispatchEvent(new Event('visibilitychange'));
    await sleep(1200);
    out.steps.push(snap('foreground (no auto resume)'));
    out.noAutoResume = (AUDIO.current() === null);

    /* ③ 使用者手勢後才續播 */
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await sleep(900);
    out.steps.push(snap('after user gesture'));
    out.gestureResume = (AUDIO.state() === 'running' && AUDIO.current() !== null);
    return out;
  }

  async function bgmSwitch() {
    var out = {};
    AUDIO.bgm('explore'); await sleep(800);
    out.before = { bgm: AUDIO.current(), voices: AUDIO.liveVoices() };
    AUDIO.bgm('win', { once: true }); await sleep(600);
    out.win = { bgm: AUDIO.current(), voices: AUDIO.liveVoices(), dur: +AUDIO.trackDur('win').toFixed(3) };
    await sleep(Math.round(AUDIO.trackDur('win') * 1000) + 900);
    out.afterOnce = { bgm: AUDIO.current(), voices: AUDIO.liveVoices(),
                      hasTimer: AUDIO.hasTimer(), rms: +(AUDIO.rms() || 0).toFixed(6) };
    out.onceStops = (AUDIO.current() === null && AUDIO.liveVoices() === 0);
    AUDIO.bgm('explore'); await sleep(700);
    out.next = { bgm: AUDIO.current(), rms: +(AUDIO.rms() || 0).toFixed(6) };
    return out;
  }

  async function finishSilence() {
    RQ.finish();
    var t0 = performance.now(), samples = [];
    while (performance.now() - t0 < 6000) {
      await sleep(250);
      samples.push({ t: Math.round(performance.now() - t0), rms: +(AUDIO.rms() || 0).toFixed(6) });
    }
    var at3 = samples.filter(function (s) { return s.t >= 3000; });
    return { samples: samples, bgm: AUDIO.current(), voices: AUDIO.liveVoices(),
             maxRmsAfter3s: Math.max.apply(null, at3.map(function (s) { return s.rms; })),
             silentAfter3s: at3.every(function (s) { return s.rms < 1e-4; }) };
  }

  /* ══════ 佈局 ══════ */
  async function layoutOnce() {
    STAGE.relayout(20);
    await sleep(120);
    STAGE.relayout(20);
    await sleep(80);
    return STAGE.rectReport();
  }
  async function layoutAll(levels) {
    var out = [];
    var list = levels || RQ.S.list;
    for (var i = 0; i < list.length; i++) {
      RQ.goLevel(i);
      await sleep(700);
      var collect = await layoutOnce();
      RQ.grabAll();
      await sleep(2800);
      var teach = await layoutOnce();
      out.push({ n: RQ.level().n,
                 collect: { ratio: collect.heroRatio, overlaps: collect.overlaps,
                            tokens: collect.tokens.filter(Boolean).length, boards: collect.boards.length },
                 teach: { ratio: teach.heroRatio, overlaps: teach.overlaps,
                          key: !!teach.key, boards: teach.boards.length } });
    }
    return out;
  }

  /* ══════ 答錯救援 ══════ */
  async function retryFlow() {
    var out = { steps: [] };
    /* 需先進到 quiz 階段 */
    var guard = 0;
    while (RQ.phase() !== 'quiz' && guard++ < 20) {
      if (RQ.phase() === 'collect') RQ.grabAll();
      else RQ.next();
      await sleep(400);
    }
    out.phaseAtStart = RQ.phase();
    var sfx0 = AUDIO.log.sfx.length;
    RQ.answer(false);
    await sleep(400);
    out.steps.push({ tag: 'wrong #1', phase: RQ.phase(), rescue: RQ.rescue(),
                     sfx: AUDIO.log.sfx.slice(sfx0).map(function (x) { return x.name; }) });
    var hitsBefore = STAGE.stats().hits;
    sfx0 = AUDIO.log.sfx.length;
    RQ.retry();
    await sleep(500);
    out.steps.push({ tag: 'retry #1', phase: RQ.phase(), rescue: RQ.rescue(),
                     hitsBefore: hitsBefore, hitsAfter: STAGE.stats().hits,
                     sfx: AUDIO.log.sfx.slice(sfx0).map(function (x) { return x.name; }) });
    RQ.answer(false);
    await sleep(400);
    out.steps.push({ tag: 'wrong #2', phase: RQ.phase(), rescue: RQ.rescue() });
    RQ.answer(true);
    await sleep(500);
    out.steps.push({ tag: 'correct', phase: RQ.phase(), rescue: RQ.rescue() });
    return out;
  }

  /* ══════ 首頁選角 ══════ */
  function lum(rgb) {
    var f = function (c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  }
  function parseRGB(s) {
    var m = String(s).match(/rgba?\(([^)]+)\)/);
    if (!m) return [0, 0, 0, 1];
    var p = m[1].split(',').map(function (x) { return parseFloat(x); });
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  function overRGB(fg, a, bg) {
    return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a)];
  }
  function contrast(a, b) {
    var l1 = lum(a), l2 = lum(b);
    return +((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2);
  }
  async function title() {
    var pageBg = [11, 31, 58];        // .screen.dark 是漸層，取 navy 當底
    var cards = Array.prototype.slice.call(document.querySelectorAll('#char-row .pick-card.char'));
    var res = { pairs: [], rects: [], overlaps: [], gaps: [], solid: [] };
    for (var ci = 0; ci < cards.length; ci++) {
      var c = cards[ci];
      c.click();
      await sleep(300);              // 等 150 ms 過渡跑完再讀 computed style
      var rows = cards.map(function (x) {
        var cs = getComputedStyle(x);
        var bg = parseRGB(cs.backgroundColor);
        var op = parseFloat(cs.opacity);
        var eff = overRGB([bg[0], bg[1], bg[2]], (bg[3] === undefined ? 1 : bg[3]) * op, pageBg);
        return { id: x.dataset.char, on: x.classList.contains('on'),
                 bg: cs.backgroundColor, opacity: op,
                 border: cs.borderTopWidth + ' ' + cs.borderTopColor,
                 transform: cs.transform,
                 ok: x.querySelector('.pick-ok') ? getComputedStyle(x.querySelector('.pick-ok')).display : 'none',
                 effective: eff.map(function (v) { return Math.round(v); }),
                 solidRGB: [bg[0], bg[1], bg[2]] };
      });
      var on = rows.filter(function (r) { return r.on; })[0];
      var offs = rows.filter(function (r) { return !r.on; });
      res.pairs.push({
        selected: c.dataset.char,
        selBg: on.bg, selBorder: on.border, selTransform: on.transform, selBadge: on.ok,
        selEff: on.effective,
        vs: offs.map(function (o) {
          return { id: o.id, eff: o.effective,
                   contrastComposited: contrast(on.effective, o.effective),
                   contrastSolid: contrast(on.solidRGB, o.solidRGB) };
        }),
        minContrastComposited: Math.min.apply(null, offs.map(function (o) { return contrast(on.effective, o.effective); })),
        minContrastSolid: Math.min.apply(null, offs.map(function (o) { return contrast(on.solidRGB, o.solidRGB); }))
      });
      /* 每一種選取狀態都量一次矩形（被選的那張放大 1.04，間距會被吃掉一點） */
      var rr = cards.map(function (x) {
        var r = x.getBoundingClientRect();
        return { id: x.dataset.char, x1: +r.left.toFixed(1), y1: +r.top.toFixed(1),
                 x2: +r.right.toFixed(1), y2: +r.bottom.toFixed(1),
                 w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
      });
      var st = { selected: c.dataset.char, rects: rr, gaps: [], overlaps: [] };
      for (var a = 0; a < rr.length; a++)
        for (var b2 = a + 1; b2 < rr.length; b2++) {
          var ww = Math.min(rr[a].x2, rr[b2].x2) - Math.max(rr[a].x1, rr[b2].x1);
          var hh = Math.min(rr[a].y2, rr[b2].y2) - Math.max(rr[a].y1, rr[b2].y1);
          if (ww > 0 && hh > 0) st.overlaps.push({ a: rr[a].id, b: rr[b2].id, area: Math.round(ww * hh) });
        }
      for (var g = 0; g + 1 < rr.length; g++) st.gaps.push(+(rr[g + 1].x1 - rr[g].x2).toFixed(1));
      res.solid.push(st);
    }
    var rs = cards.map(function (c) {
      var r = c.getBoundingClientRect();
      return { id: c.dataset.char, x1: +r.left.toFixed(1), y1: +r.top.toFixed(1),
               x2: +r.right.toFixed(1), y2: +r.bottom.toFixed(1),
               w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
    });
    res.rects = rs;
    for (var i = 0; i < rs.length; i++)
      for (var j = i + 1; j < rs.length; j++) {
        var w = Math.min(rs[i].x2, rs[j].x2) - Math.max(rs[i].x1, rs[j].x1);
        var h = Math.min(rs[i].y2, rs[j].y2) - Math.max(rs[i].y1, rs[j].y1);
        if (w > 0 && h > 0) res.overlaps.push({ a: rs[i].id, b: rs[j].id, area: Math.round(w * h) });
      }
    for (var k = 0; k + 1 < rs.length; k++) res.gaps.push(+(rs[k + 1].x1 - rs[k].x2).toFixed(1));
    var allGaps = [], allOv = 0;
    res.solid.forEach(function (s) { allGaps = allGaps.concat(s.gaps); allOv += s.overlaps.length; });
    res.minGapAllStates = Math.min.apply(null, allGaps);
    res.overlapsAllStates = allOv;
    res.clean = res.overlaps.length === 0 && allOv === 0;
    res.minContrastComposited = Math.min.apply(null, res.pairs.map(function (p) { return p.minContrastComposited; }));
    res.minContrastSolid = Math.min.apply(null, res.pairs.map(function (p) { return p.minContrastSolid; }));
    return res;
  }

  return { audio: audio, bgmSwitch: bgmSwitch, finishSilence: finishSilence,
           layoutOnce: layoutOnce, layoutAll: layoutAll, retryFlow: retryFlow, title: title,
           snap: snap, timerCount: timerCount, fakeHidden: fakeHidden,
           errs: errs, sleep: sleep, contrast: contrast };
})();
'RQV4 ready';
