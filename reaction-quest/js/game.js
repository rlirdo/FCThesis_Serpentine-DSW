/* 蛇紋石改質反應探險 — 流程控制 v2.0（全程懸浮式 AR）
   ══════════════════════════════════════════════════════════════════
   與 v1.1 的差別，一句話：**沒有任何一頁 2D 文字了**。
   從按下「開始冒險」的那一刻起，背景永遠是相機實景，
   所有內容（主角、代幣、對話看板、關鍵物件、反應動畫、題目、總結）
   都以 3D 懸浮物件呈現在同一個相機畫面裡，而且優先錨定在卡片上方。

   一關的節奏（15–30 秒收集 ＋ 教學 ＋ 兩題）：
     進關 → 追蹤本關 .mind → 第一次 targetFound 播「舞台展開」
          → 對話看板說任務 → D-pad 讓主角在卡面滑行收集三個代幣
          → 集滿 → 關鍵物件從卡片「脫出」升起 → 懸浮教學看板 ×4
          → 兩題懸浮互動題 → 主角跳舞＋彩帶＋過關音樂 → 下一關
   全破 → 八式反應鏈環繞主角旋轉（已證／假說分色）＋ 完成徽章截圖 */
(function () {

  var V = '2.0';
  var BASIC = [1, 3, 5, 8, 12];
  var ADV = [1, 3, 5, 6, 7, 8, 9, 10, 11, 12];

  var S = {
    charId: 'mimi', route: 5, list: BASIC, idx: 0, level: null,
    phase: 'title', step: 0, quizI: 0, tries: 0,
    noCam: false, started: false, camErr: null,
    stats: { right: 0, wrong: 0, t0: 0 }
  };

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  function show(el) { if (el) el.classList.remove('hidden'); }
  function hide(el) { if (el) el.classList.add('hidden'); }
  function screen(id) {
    $$('.screen').forEach(function (s) { s.classList.remove('active'); });
    if (id) { var e = $('#' + id); if (e) e.classList.add('active'); }
  }
  function toast(msg, ms) {
    var t = $('#toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(t.__h);
    t.__h = setTimeout(function () { t.classList.remove('on'); }, ms || 2400);
  }
  function hint(msg) { $('#hud-hint').textContent = msg || ''; }
  function veil(on) {
    var v = $('#veil');
    if (on) v.classList.add('on'); else v.classList.remove('on');
  }

  function levelByN(n) {
    return GAME_DATA.LEVELS.filter(function (l) { return l.n === n; })[0];
  }

  /* ══════════ 標題頁 ══════════ */
  function buildTitle() {
    var row = $('#char-row');
    row.innerHTML = '';
    GAME_DATA.CHARS.forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'pick-card char' + (c.id === S.charId ? ' on' : '');
      b.dataset.char = c.id;
      b.innerHTML = '<span class="pick-t">' + c.name + '</span>' +
                    '<span class="pick-d">' + c.trait + '</span>';
      b.style.borderColor = c.color;
      row.appendChild(b);
    });
    row.addEventListener('click', function (e) {
      var b = e.target.closest('[data-char]');
      if (!b) return;
      S.charId = b.dataset.char;
      $$('#char-row .pick-card').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
    });
    $$('.pick-card[data-mode]').forEach(function (b) {
      if (parseInt(b.dataset.mode, 10) === S.route) b.classList.add('on');
      b.addEventListener('click', function () {
        $$('.pick-card[data-mode]').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        S.route = parseInt(b.dataset.mode, 10);
      });
    });
  }

  /* ══════════ 啟動（唯一的使用者手勢：所有需要手勢的事都在這裡做完） ══════════ */
  function onStart() {
    /* ① AudioContext 必須在手勢的同步堆疊內解鎖（iOS 硬規） */
    AUDIO.unlock();
    /* ② 陀螺儀權限也必須在手勢內請求（iOS 13+） */
    try { STAGE.enableGyro(); } catch (e) { console.warn('[GAME] gyro', e); }
    /* ③ 相機：同一個手勢內立刻 getUserMedia，使用者馬上看得到畫面 */
    var pf = AR.preflight();
    if (!pf.ok) { S.camErr = pf; return boot(null); }
    AR.acquireCamera().then(function (stream) {
      return AR.attachPreview($('#cam-preview'), stream).then(function () { return stream; });
    }).then(function (stream) {
      boot(stream);
    }).catch(function (e) {
      S.camErr = AR.explain(e);
      console.warn('[GAME] camera failed →', S.camErr);
      boot(null);
    });
  }

  function boot(stream) {
    S.started = true;
    S.noCam = !stream;
    S.list = S.route === 10 ? ADV : BASIC;
    S.idx = 0;
    S.stats = { right: 0, wrong: 0, t0: Date.now() };
    screen(null);
    show($('#hud'));
    syncMuteBtn();
    var first = levelByN(S.list[0]);
    var mindSrc = stream ? AR.targetPath(first) : null;
    if (!stream) document.body.classList.add('nocam');
    STAGE.init({ host: $('#ar-host'), mindSrc: mindSrc, charId: S.charId,
                 stream: stream, onFound: onFound, onLost: onLost })
      .then(function () {
        STAGE.setCollectHandlers(onCollect, onAllCollected);
        startLevel(0);
      })
      .catch(function (e) {
        console.error('[GAME] STAGE.init failed', e);
        toast('3D 場景啟動失敗：' + (e && e.message ? e.message : e), 5000);
      });
    if (S.camErr) {
      toast('相機沒開起來，改用場景背景繼續玩。可在右上角「?」看診斷。', 5000);
    }
  }

  /* ══════════ 錨定事件 ══════════ */
  function onFound(idx) {
    var key = 'L' + S.level.n;
    if (!STAGE.stageWasExpanded(key)) {
      STAGE.expandStage(key);
      toast(idx === 1 ? '萬用卡辨識成功——舞台展開！' : '本關卡片辨識成功——舞台展開！');
      hide($('#btn-nocard'));
    }
    hint('全像模式：內容站在卡片上，手機繞著卡片走看看。');
  }
  function onLost() {
    hint('卡片離開畫面了——已切換成螢幕懸浮，把卡片放回畫面可回到全像模式。');
  }

  /* ══════════ 關卡 ══════════ */
  function startLevel(i) {
    S.idx = i;
    S.level = levelByN(S.list[i]);
    S.phase = 'collect';
    S.quizI = 0; S.tries = 0;
    var L = S.level;
    $('#hud-level').textContent = String(L.n).padStart(2, '0');
    $('#hud-place').textContent = L.place;
    $('#hud-token').textContent = '0 / 3';
    document.documentElement.style.setProperty('--scene', 'url(' + L.scene + ')');
    $('#scene-bg').style.backgroundImage = 'url(' + L.scene + ')';

    veil(true);
    var go = function () {
      STAGE.hideKeyObject();
      QUIZ3D.close();
      STAGE.setHeroPos(0, -0.38);
      STAGE.heroAnim('idle');
      STAGE.setTokens(L.tokens);
      STAGE.showBoard({
        kicker: String(L.n).padStart(2, '0') + ' / ' + L.en,
        title: L.title,
        lines: [L.task],
        tag: L.hypo ? '研究假說（待驗證）' : null,
        accent: L.hypo ? STAGE.C.gold : STAGE.C.moss,
        y: 0.30
      });
      AUDIO.bgm('explore');
      hint(S.noCam ? '沒有相機也能玩：用方向鍵收集三個代幣。'
                   : '把萬用卡放進畫面，主角就會站上去；先收集三個代幣。');
      show($('#hud'));
      hide($('#btn-next')); hide($('#btn-replay'));
      dpadEnabled(true);
      veil(false);
      /* 六秒還沒看到卡片就把免卡解鎖露出來 */
      clearTimeout(S.__nc);
      if (!S.noCam) {
        S.__nc = setTimeout(function () {
          if (!STAGE.stageWasExpanded('L' + L.n)) show($('#btn-nocard'));
        }, 6000);
      } else {
        STAGE.expandStage('L' + L.n);
      }
    };

    if (!S.noCam && i > 0) STAGE.retarget(AR.targetPath(L)).then(go);
    else setTimeout(go, 260);
  }

  function onCollect(tk, n) {
    $('#hud-token').textContent = n + ' / 3';
    toast('取得：' + tk.label + '　' + tk.tip, 2600);
  }
  function onAllCollected() {
    if (S.phase !== 'collect') return;
    S.phase = 'reveal';
    dpadEnabled(false);
    STAGE.releaseAll();
    var L = S.level;
    AUDIO.bgm('scan');
    STAGE.clearBoards();
    STAGE.showKeyObject(L.ar.visual);
    hint('三個代幣到齊——本關的關鍵物件從卡片上升起來了。');
    setTimeout(function () {
      S.phase = 'teach'; S.step = 0;
      AUDIO.bgm('teach');
      teachStep();
    }, 1200);
  }

  /* 懸浮教學：關鍵物件在上、看板在下，一次一張 */
  function teachBoards() {
    var L = S.level, out = [];
    out.push({ kicker: '教學 · ' + L.en, title: L.ar.title, lines: [L.ar.eq],
               tag: L.hypo ? '研究假說（待驗證）' : null,
               accent: L.hypo ? STAGE.C.gold : STAGE.C.teal });
    (L.ar.points || []).forEach(function (p, i) {
      out.push({ kicker: '重點 ' + (i + 1) + ' / ' + L.ar.points.length,
                 lines: [p], accent: STAGE.C.moss });
    });
    return out;
  }
  function teachStep() {
    var list = teachBoards();
    if (S.step >= list.length) { S.phase = 'quiz'; S.quizI = 0; askQuiz(); return; }
    var b = list[S.step];
    b.y = 0.30; b.width = 1.24;
    STAGE.showBoard(b);
    hint('第 ' + (S.step + 1) + ' / ' + list.length + ' 張——看完按「繼續」。');
    show($('#btn-next'));
    $('#btn-next').textContent = (S.step === list.length - 1) ? '開始答題 ▶' : '繼續 ▶';
  }

  /* ══════════ 兩題懸浮互動題 ══════════ */
  function askQuiz() {
    var qs = (window.QUIZ_DATA && QUIZ_DATA[S.level.n]) || [];
    if (S.quizI >= qs.length) return levelClear();
    var q = qs[S.quizI];
    S.tries = 0;
    AUDIO.bgm('quiz');
    STAGE.hideKeyObject();
    STAGE.showBoard({
      kicker: '第 ' + (S.quizI + 1) + ' 題 / 共 ' + qs.length + '　' + kindName(q),
      lines: [q.q, '（' + cueOf(q) + '）'],
      tag: q.hypo ? '研究假說（待驗證）' : null,
      accent: q.hypo ? STAGE.C.gold : STAGE.C.teal,
      y: 0.48, width: 1.24
    });
    hide($('#btn-next'));
    if (q.type === 'anim') show($('#btn-replay')); else hide($('#btn-replay'));
    hint('用手指直接點畫面裡的懸浮物件作答。');
    QUIZ3D.ask(q, { onAnswer: onAnswer });
  }
  /* v2.0 的互動方式改為「點選」，v1.1 資料裡的拖曳提示要換掉 */
  var CUE = {
    drag3d: '點選正確的位置，手上的碎片會自己飛過去',
    order: '依正確順序，一張一張點選卡片',
    tap3d: '用手指直接點畫面裡的懸浮物件',
    animtime: '點懸浮時間軸上的那一刻',
    animpick: '點畫面中正確的那一格'
  };
  function cueOf(q) {
    if (q.type === 'anim') return CUE[q.ask === 'pick' ? 'animpick' : 'animtime'];
    return CUE[q.type] || q.cue || '';
  }
  function kindName(q) {
    if (q.type === 'anim') return q.ask === 'pick' ? '動畫・點區塊' : '動畫・點時刻';
    if (q.type === 'order') return '排序・依序點選';
    if (q.type === 'drag3d') return 'AR・送到定位';
    return 'AR・點選物件';
  }
  function onAnswer(ok, msg) {
    var qs = QUIZ_DATA[S.level.n], q = qs[S.quizI];
    if (!ok) {
      S.tries++;
      S.stats.wrong++;
      STAGE.showBoard({ kicker: '再想一下', lines: [msg || q.tip || '再試一次。'],
                        accent: STAGE.C.red, y: 0.48, width: 1.24 });
      hint('再試一次——點另一個看看。');
      if (S.tries >= 2) {
        setTimeout(function () { revealAnswer(q); }, 1400);
      }
      return;
    }
    S.stats.right++;
    revealAnswer(q);
  }
  function revealAnswer(q) {
    QUIZ3D.close();
    STAGE.showBoard({ kicker: '為什麼', title: '答案解析', lines: [q.why],
                      tag: q.hypo ? '研究假說（待驗證）' : null,
                      accent: STAGE.C.moss, y: 0.34, width: 1.24 });
    hide($('#btn-replay'));
    show($('#btn-next'));
    $('#btn-next').textContent = (S.quizI < 1) ? '下一題 ▶' : '完成本關 ▶';
    hint('讀完按「繼續」。');
    S.phase = 'answered';
  }

  /* ══════════ 過關 ══════════ */
  function levelClear() {
    S.phase = 'clear';
    QUIZ3D.close();
    STAGE.hideKeyObject();
    AUDIO.bgm('win');
    AUDIO.sfx('clear');
    STAGE.heroAnim('celebrate');
    var p = STAGE.heroPos();
    for (var i = 0; i < 4; i++) {
      (function (k) {
        setTimeout(function () {
          STAGE.burst(p.x, 0.35, p.z, 40, [0xC99A3E, 0x5FA98A, 0x1C7293, 0xFFFFFF][k], 0.7, 1.2);
        }, k * 260);
      })(i);
    }
    STAGE.showBoard({ kicker: '第 ' + S.level.n + ' 關完成', title: '過關！',
                      lines: [S.level.lesson], accent: STAGE.C.gold, y: 0.34, width: 1.24 });
    hint('這一關學到的重點已經浮在畫面上了。');
    show($('#btn-next'));
    $('#btn-next').textContent = (S.idx + 1 < S.list.length) ? '前往下一關 ▶' : '看總結 ▶';
  }

  /* ══════════ 全破：八式反應鏈環繞主角旋轉 ══════════ */
  var chainRaf = 0;
  function finish() {
    S.phase = 'finish';
    QUIZ3D.close();
    STAGE.clearBoards();
    STAGE.hideKeyObject();
    STAGE.clearTokens();
    AUDIO.bgm('win');
    AUDIO.sfx('allclear');
    STAGE.heroAnim('celebrate');
    dpadEnabled(false);
    document.querySelector('.dpad').style.display = 'none';
    STAGE.setHeroPos(0, -0.26);
    var T = STAGE.THREE();
    var g = STAGE.newChainGroup();
    g.position.set(0, 0, -0.26);          // 以主角為圓心
    var ring = [];
    GAME_DATA.CHAIN.forEach(function (c, i) {
      var hypo = c.status === 'hypo';
      var cv = STAGE.drawBoard({
        kicker: c.n + '　' + c.kind, title: c.name, lines: [c.eq],
        tag: hypo ? '研究假說（待驗證）' : null,
        accent: hypo ? STAGE.C.gold : STAGE.C.moss
      });
      var m = STAGE.planeFrom(cv, 0.40, { order: 18 });
      g.add(m);
      ring.push({ m: m, a: i / GAME_DATA.CHAIN.length * Math.PI * 2 });
    });
    var t0 = performance.now();
    var spin = function () {
      chainRaf = requestAnimationFrame(spin);
      var t = (performance.now() - t0) / 1000;
      ring.forEach(function (r) {
        var a = r.a + t * 0.32;
        r.m.position.set(Math.sin(a) * 0.54, 0.30 + Math.sin(a * 2 + t) * 0.05, Math.cos(a) * 0.54);
        r.m.material.opacity = 0.30 + 0.70 * Math.max(0, Math.cos(a));
        r.m.material.transparent = true;
        r.m.renderOrder = Math.cos(a) > 0 ? 22 : 8;
      });
    };
    spin();
    STAGE.showBoard({ kicker: 'MISSION COMPLETE', title: '八式反應鏈全解',
                      lines: ['第四式與第五式標為研究假說（待驗證）：有文獻基礎、有驗證方法，也有可能被推翻——這才叫科學。'],
                      accent: STAGE.C.gold, y: 0.62, width: 1.24 });
    hint('八式反應鏈正繞著你的主角旋轉。金色＝研究假說，綠色＝已確立。');
    var mins = Math.max(1, Math.round((Date.now() - S.stats.t0) / 60000));
    $('#badge-name').textContent =
      (GAME_DATA.CHARS.filter(function (c) { return c.id === S.charId; })[0] || {}).name || '';
    $('#badge-meta').textContent =
      (S.route === 10 ? '進階版 10 關' : '基礎版 5 關') + '　答對 ' + S.stats.right +
      ' 題　用時約 ' + mins + ' 分鐘';
    show($('#badge-layer'));
    hide($('#btn-next'));
  }

  /* ══════════ 繼續按鈕：一顆按鈕串起所有階段 ══════════ */
  function onNext() {
    if (S.phase === 'teach') { S.step++; return teachStep(); }
    if (S.phase === 'answered') {
      if (S.quizI < 1) { S.quizI++; S.phase = 'quiz'; return askQuiz(); }
      return levelClear();
    }
    if (S.phase === 'clear') {
      hide($('#btn-next'));
      if (S.idx + 1 < S.list.length) return startLevel(S.idx + 1);
      return finish();
    }
  }

  /* ══════════ D-pad ══════════ */
  var dpadOn = true;
  function dpadEnabled(v) {
    dpadOn = !!v;
    $('.dpad').classList.toggle('off', !v);
    if (!v) STAGE.releaseAll();
  }
  function bindDpad() {
    $$('.dbtn[data-dir]').forEach(function (b) {
      var dir = b.dataset.dir;
      var down = function (e) { e.preventDefault(); if (dpadOn) { STAGE.press(dir); b.classList.add('on'); } };
      var up = function (e) { e.preventDefault(); STAGE.release(dir); b.classList.remove('on'); };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    });
    window.addEventListener('keydown', function (e) {
      var m = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
      if (m && dpadOn) { STAGE.press(m); e.preventDefault(); }
    });
    window.addEventListener('keyup', function (e) {
      var m = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
      if (m) STAGE.release(m);
    });
  }

  /* ══════════ HUD 其他按鈕 ══════════ */
  function syncMuteBtn() {
    var b = $('#btn-mute');
    b.textContent = AUDIO.isMuted() ? '♪̸' : '♪';
    b.classList.toggle('off', AUDIO.isMuted());
  }
  function bindHud() {
    $('#btn-next').addEventListener('click', onNext);
    $('#btn-mute').addEventListener('click', function () { AUDIO.toggle(); syncMuteBtn(); });
    $('#btn-power').addEventListener('click', function () {
      var on = STAGE.setPowerSave(!$('#btn-power').classList.contains('on'));
      $('#btn-power').classList.toggle('on', on);
      toast(on ? '省電模式：已停止逐幀辨識，內容改為螢幕懸浮。' : '省電模式關閉：恢復卡片追蹤。');
    });
    $('#btn-diag').addEventListener('click', function () {
      var d = $('#fb-diag');
      if (S.camErr) {
        show(d); $('#fb-reason').textContent = S.camErr.reason || '';
        $('#fb-guide').textContent = S.camErr.guide || '';
      } else hide(d);
      $('#diag-box').value = AR.diagText() + '\n\n【舞台】' + JSON.stringify(STAGE.stats()) +
        '\n【音訊】state=' + AUDIO.state() + '　bgm=' + AUDIO.current() +
        '　muted=' + AUDIO.isMuted();
      show($('#diag-box'));
      screen('scr-diag');
    });
    $('#btn-copy-diag').addEventListener('click', function () {
      var t = $('#diag-box');
      t.select();
      try { document.execCommand('copy'); toast('診斷資訊已複製'); } catch (e) {}
    });
    $('#btn-retry-cam').addEventListener('click', function () { location.reload(); });
    $('#btn-no-cam').addEventListener('click', function () { screen(null); });
    $('#btn-replay').addEventListener('click', function () { QUIZ3D.replay(); });
    $('#btn-nocard').addEventListener('click', function () {
      var b = $('#btn-nocard'), n = 3;
      b.disabled = true;
      b.textContent = '解鎖中… ' + n;
      var iv = setInterval(function () {
        n--;
        if (n > 0) { b.textContent = '解鎖中… ' + n; return; }
        clearInterval(iv);
        b.disabled = false; b.textContent = '免卡解鎖';
        hide(b);
        STAGE.expandStage('L' + S.level.n);
        toast('免卡解鎖完成——內容以螢幕懸浮方式呈現。');
      }, 1000);
    });
    $('#btn-howto').addEventListener('click', function () { screen('scr-howto'); });
    $$('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () {
        var g = b.dataset.go;
        if (g === 'back') { screen(S.started ? null : 'scr-title'); return; }
        screen(g);
      });
    });
    $('#btn-restart').addEventListener('click', function () { location.reload(); });
    $('#btn-shot').addEventListener('click', shot);
    $('#btn-shot-close').addEventListener('click', function () { hide($('#shot-box')); });
    $('#inapp-close').addEventListener('click', function () { hide($('#inapp-banner')); });
  }

  /* 完成徽章截圖：相機畫面 ＋ 立即重繪的 3D 疊層 ＋ 徽章文字 */
  function shot() {
    try {
      var W = 900, H = 1200;
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var g = cv.getContext('2d');
      g.fillStyle = '#0B1F3A'; g.fillRect(0, 0, W, H);
      var v = document.querySelector('#ar-host video') || $('#cam-preview');
      if (v && v.videoWidth) {
        var s = Math.max(W / v.videoWidth, H / v.videoHeight);
        var dw = v.videoWidth * s, dh = v.videoHeight * s;
        g.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh);
      }
      var sc = STAGE.scene();
      if (sc && sc.renderer && sc.camera) {
        sc.renderer.render(sc.object3D, sc.camera);            // 同一 tick 內讀取才有內容
        var c3 = sc.canvas;
        if (c3) {
          var s2 = Math.max(W / c3.width, H / c3.height);
          g.drawImage(c3, (W - c3.width * s2) / 2, (H - c3.height * s2) / 2,
                      c3.width * s2, c3.height * s2);
        }
      }
      g.fillStyle = 'rgba(11,31,58,0.86)';
      g.fillRect(0, H - 330, W, 330);
      g.fillStyle = '#C99A3E'; g.font = 'bold 34px "Microsoft JhengHei",sans-serif';
      g.textAlign = 'center';
      g.fillText('MISSION COMPLETE', W / 2, H - 268);
      g.fillStyle = '#FFFFFF'; g.font = 'bold 48px "Microsoft JhengHei",sans-serif';
      g.fillText('蛇紋石改質反應探險', W / 2, H - 202);
      g.font = 'bold 32px "Microsoft JhengHei",sans-serif';
      g.fillText($('#badge-name').textContent, W / 2, H - 150);
      g.fillStyle = '#DCE7EC'; g.font = '26px "Microsoft JhengHei",sans-serif';
      g.fillText($('#badge-meta').textContent, W / 2, H - 106);
      g.font = '22px "Microsoft JhengHei",sans-serif';
      g.fillText('國立東華大學自然資源與環境學系 ・ 仿生與環境工作坊', W / 2, H - 58);
      var url = cv.toDataURL('image/png');
      $('#shot-img').src = url;
      $('#shot-dl').href = url;
      show($('#shot-box'));
    } catch (e) {
      console.warn('[GAME] shot', e);
      toast('截圖失敗，可以直接用手機的螢幕截圖功能。');
    }
  }

  /* ══════════ 內建瀏覽器提示 ══════════ */
  function inappBanner() {
    var info = AR.detectInApp(navigator.userAgent);
    if (!info.inApp) return;
    $('#inapp-text').textContent = '目前在 ' + info.name + ' 的內建瀏覽器：' + info.tip;
    show($('#inapp-banner'));
  }

  /* ══════════ 啟動 ══════════ */
  function ready() {
    buildTitle();
    bindDpad();
    bindHud();
    inappBanner();
    $('#btn-start').addEventListener('click', onStart);
    console.log('[GAME] v' + V + ' ready');
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', ready);
  else ready();

  /* ══════════ 驗收掛鉤（自動化測試用） ══════════ */
  window.RQ = {
    V: V, S: S, BASIC: BASIC, ADV: ADV,
    start: function (route, charId) {
      if (route) S.route = route;
      if (charId) S.charId = charId;
      $('#btn-start').click();
    },
    next: onNext,
    level: function () { return S.level; },
    phase: function () { return S.phase; },
    /* 走完真正的碰撞收集邏輯（含音效與回呼），供流程壓測 */
    grabAll: function () { return STAGE.forceCollectAll(); },
    walkToToken: function (i) { return STAGE.walkToToken(i); },
    tokens: function () { return STAGE.tokenState(); },
    stats: function () { return STAGE.stats(); },
    audio: function () {
      return { state: AUDIO.state(), bgm: AUDIO.current(), muted: AUDIO.isMuted(),
               log: AUDIO.log };
    },
    finish: finish,
    goLevel: startLevel,
    unlockNoCard: function () { $('#btn-nocard').click(); },
    simulate: function (k, i) { return STAGE.simulate(k, i); }
  };
})();
