/* v2.0 本機驗證腳本：貼進頁面 console 執行，回傳 JSON 報告 */
window.RQV = (function () {
  var errs = [];
  var origErr = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); origErr.apply(console, arguments); };
  window.addEventListener('error', function (e) { errs.push('window.onerror: ' + e.message); });
  window.addEventListener('unhandledrejection', function (e) { errs.push('unhandledrejection: ' + e.reason); });
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /* 螢幕投影：把 stage 內的物件投到 CSS px，用來檢查是否被 HUD 遮住 */
  function project(v3) {
    var sc = STAGE.scene();
    var p = v3.clone().project(sc.camera);
    var r = sc.canvas.getBoundingClientRect();
    return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
  }
  function heroScreen() {
    var T = STAGE.THREE();
    var st = STAGE.stageEl().object3D;
    var pts = [], L = STAGE.LIM;
    [[-L, -L], [L, -L], [-L, L], [L, L], [0, 0]].forEach(function (c) {
      [0.02, 0.32, 0.42].forEach(function (y) {
        var v = new T.Vector3(c[0], y, c[1]);
        st.updateWorldMatrix(true, false);
        pts.push(project(st.localToWorld(v)));
      });
    });
    var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
    return { x1: Math.min.apply(null, xs), x2: Math.max.apply(null, xs),
             y1: Math.min.apply(null, ys), y2: Math.max.apply(null, ys) };
  }
  function rectOf(sel) {
    var e = document.querySelector(sel);
    if (!e || e.classList.contains('hidden') || e.offsetParent === null) return null;
    var r = e.getBoundingClientRect();
    return { x1: r.left, y1: r.top, x2: r.right, y2: r.bottom };
  }
  function overlap(a, b) {
    if (!a || !b) return 0;
    var w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
    var h = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
    return (w > 0 && h > 0) ? Math.round(w * h) : 0;
  }

  async function playLevel(tag, report) {
    var n = RQ.level().n;
    /* 收集三個代幣：真的把主角走過去，觸發碰撞邏輯 */
    for (var i = 0; i < 3; i++) { STAGE.walkToToken(i); await sleep(200); }
    var afterWalk = STAGE.stats().collected;
    if (afterWalk < 3) { report.warn.push(tag + ' L' + n + ' 碰撞收集只拿到 ' + afterWalk + '/3，改用強制收集'); STAGE.forceCollectAll(); }
    else if (!report.collisionOK) report.collisionOK = true;
    await sleep(1800);
    if (RQ.phase() !== 'teach') report.warn.push(tag + ' L' + n + ' 未進入 teach，phase=' + RQ.phase());
    /* 教學看板 4 張 */
    var guard = 0;
    while (RQ.phase() === 'teach' && guard++ < 10) { RQ.next(); await sleep(120); }
    /* 兩題 */
    for (var qi = 0; qi < 2; qi++) {
      if (RQ.phase() === 'clear' || RQ.phase() === 'finish') break;
      await sleep(200);
      var hits = STAGE.stats().hits;
      if (!hits) report.warn.push(tag + ' L' + n + ' Q' + (qi + 1) + ' 沒有可點擊物件');
      /* 直接觸發正確答案的 onTap（模擬玩家點對） */
      /* 第一關第一題先故意點錯，驗證 wrong 音效與提示回饋 */
      if (!report.wrongTested) {
        var wrongFired = tapWrong();
        if (wrongFired) { report.wrongTested = true; await sleep(600); }
      }
      var okFired = tapCorrect();
      if (!okFired) report.warn.push(tag + ' L' + n + ' Q' + (qi + 1) + ' 找不到正解熱區，改用強制推進');
      await sleep(700);
      if (RQ.phase() === 'answered') { RQ.next(); await sleep(250); }
    }
    guard = 0;
    while (RQ.phase() !== 'clear' && RQ.phase() !== 'finish' && guard++ < 12) { RQ.next(); await sleep(180); }
    return n;
  }

  /* 從註冊的熱區中找出「正確」的那一個並觸發它 */
  function tapCorrect() {
    var qs = QUIZ_DATA[RQ.level().n], q = qs[RQ.S.quizI];
    var fired = false;
    var list = STAGE.hitList();
    if (q.type === 'anim' && q.ask !== 'pick') {
      var meta = ANIMS.meta(q.anim);
      var bar = list[list.length - 1];
      if (bar && bar.userData.onTap) { bar.userData.onTap(bar, { uv: { x: meta.key } }); fired = true; }
      return fired;
    }
    var want = null;
    if (q.type === 'order') {
      /* 依正解順序逐一點 */
      q.answer.forEach(function (id) {
        var idx = (q.shuffle || []).indexOf(id);
        var m = list[idx];
        if (m && m.userData.onTap) { m.userData.onTap(m); fired = true; }
      });
      return fired;
    }
    var arr = (q.type === 'anim') ? q.regions : q.objs;
    var order = [];
    (arr || []).forEach(function (o) { if (o.label !== undefined) order.push(o); });
    var ci = order.map(function (o) { return !!o.correct; }).indexOf(true);
    if (ci >= 0 && list[ci] && list[ci].userData.onTap) { list[ci].userData.onTap(list[ci], {}); fired = true; }
    return fired;
  }

  /* 故意點一個錯的熱區 */
  function tapWrong() {
    var qs = QUIZ_DATA[RQ.level().n], q = qs[RQ.S.quizI];
    if (q.type !== 'tap3d' && q.type !== 'drag3d') return false;
    var list = STAGE.hitList();
    var order = (q.objs || []).filter(function (o) { return o.label !== undefined; });
    var wi = order.map(function (o) { return !!o.correct; }).indexOf(false);
    if (wi >= 0 && list[wi] && list[wi].userData.onTap) { list[wi].userData.onTap(list[wi], {}); return true; }
    return false;
  }

  async function run(route) {
    var report = { route: route, levels: [], warn: [], errs: errs, audio: null,
                   occlusion: null, modeSwitch: null, fps: null, tri: null };
    RQ.S.route = route;
    document.querySelector('#btn-start').click();
    await sleep(2500);
    report.audioAtStart = AUDIO.state();

    /* 遮蔽檢查（收集階段） */
    var hb = heroScreen();
    report.occlusion = {
      playfield: hb,
      dpad: rectOf('.dpad'),
      actNext: rectOf('#btn-next'),
      actNoCard: rectOf('#btn-nocard'),
      overlapDpad: overlap(hb, rectOf('.dpad')),
      overlapAct: overlap(hb, rectOf('#btn-next')) + overlap(hb, rectOf('#btn-nocard'))
    };

    /* 錨定切換壓測：found/lost 交替 5 次，狀態與物件數必須不變 */
    var before = STAGE.stats();
    var seq = [];
    for (var k = 0; k < 5; k++) {
      STAGE.simulate('found', 1); await sleep(300);
      seq.push({ m: STAGE.mode(), o: STAGE.stats().objects, c: STAGE.stats().collected, p: STAGE.stats().stageParent });
      STAGE.simulate('lost', 1); await sleep(300);
      seq.push({ m: STAGE.mode(), o: STAGE.stats().objects, c: STAGE.stats().collected, p: STAGE.stats().stageParent });
    }
    report.modeSwitch = { before: { objects: before.objects, collected: before.collected }, seq: seq };

    /* 邊界夾持：四方向各壓 20 步 */
    var clamp = {};
    ['left', 'right', 'up', 'down'].forEach(function (d) { clamp[d] = null; });
    for (var di = 0; di < 4; di++) {
      var d = ['left', 'right', 'up', 'down'][di];
      STAGE.press(d); await sleep(2200); STAGE.release(d);
      var hp = STAGE.heroPos();
      clamp[d] = { x: +hp.tx.toFixed(3), z: +hp.tz.toFixed(3),
                   inside: Math.abs(hp.tx) <= STAGE.LIM + 1e-6 && Math.abs(hp.tz) <= STAGE.LIM + 1e-6 };
    }
    report.clamp = clamp;

    /* 走完全部關卡 */
    var guard = 0;
    while (RQ.phase() !== 'finish' && guard++ < 40) {
      var n = await playLevel('R' + route, report);
      report.levels.push({ n: n, phase: RQ.phase() });
      if (RQ.phase() === 'clear') { RQ.next(); await sleep(700); }
      else break;
    }
    await sleep(1200);
    report.finalPhase = RQ.phase();
    report.badgeVisible = !document.querySelector('#badge-layer').classList.contains('hidden');
    var st = STAGE.stats();
    report.fps = st.fps; report.tri = st.tri; report.objects = st.objects;
    report.audio = { state: AUDIO.state(), bgm: AUDIO.current(),
                     bgmSeq: AUDIO.log.bgm.map(function (x) { return x.name; }),
                     sfxSet: Array.from(new Set(AUDIO.log.sfx.map(function (x) { return x.name; }))) };
    report.errs = errs.slice();
    return report;
  }
  return { run: run, heroScreen: heroScreen, rectOf: rectOf, overlap: overlap, errs: errs };
})();
'RQV ready';
