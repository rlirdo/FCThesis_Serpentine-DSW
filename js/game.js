/* 花蓮綠色化學闖關 — 主流程 v1.2 */
(function () {
  const D = window.GAME_DATA;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  /* 每關的目標點與起點（畫面百分比）。
     場景 SVG 為 640×480，直式手機以 background-size:cover 顯示時「垂直是完整對應的」，
     所以這裡的 y% 直接等於 SVG 的 y/480；x 會左右裁切，故一律取中段（20–80%）。
     BAND 是該關的可行走垂直範圍，避免主角走到天空或海裡。 */
  const GOALS = {
    1:{x:72,y:68},  2:{x:74,y:68},  3:{x:72,y:68},  4:{x:26,y:66},  5:{x:68,y:65},
    6:{x:52,y:64},  7:{x:52,y:68},  8:{x:52,y:65},  9:{x:24,y:64}, 10:{x:50,y:64}
  };
  const STARTS = {
    1:{x:20,y:70},  2:{x:18,y:70},  3:{x:18,y:70},  4:{x:78,y:70},  5:{x:16,y:65},
    6:{x:18,y:60},  7:{x:16,y:70},  8:{x:16,y:70},  9:{x:76,y:70}, 10:{x:18,y:70}
  };
  /* 場景地形的可行走範圍（%）。實際下緣還會被 walkLimits() 依 UI 位置再收窄。 */
  const BAND = {
    1:{a:64,b:92},  2:{a:63,b:92},  3:{a:64,b:94},  4:{a:63,b:92},  5:{a:60,b:70},
    6:{a:56,b:70},  7:{a:60,b:92},  8:{a:60,b:88},  9:{a:57,b:92}, 10:{a:60,b:94}
  };
  const REACH = 9;              // 觸發半徑（百分比距離）
  const SPEED = 26;             // 每秒移動百分比

  const S = {
    char: null, mode: 10, queue: [], idx: 0,
    lessons: [], tries: 0, wrong: 0, started: null
  };

  /* ───────── 畫面切換 ───────── */
  function show(id) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    const el = $('#' + id);
    if (el) el.scrollTop = 0;
    if (id !== 'scr-explore') stopLoop();
  }
  function toast(msg, ms = 2200) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), ms);
  }

  /* ───────── 預載 ───────── */
  function preload(urls, onProgress) {
    let done = 0;
    return Promise.all(urls.map(u => new Promise(res => {
      const i = new Image();
      const fin = () => { done++; onProgress && onProgress(done, urls.length); res(); };
      i.onload = fin; i.onerror = fin; i.src = u;
    })));
  }

  async function boot() {
    const msg = $('#load-msg');
    const urls = D.CHARS.map(c => 'assets/chars/' + c.id + '.svg')
      .concat(D.LEVELS.map(l => l.scene));
    await preload(urls, (a, b) => { msg.textContent = '正在準備素材… ' + a + ' / ' + b; });
    msg.textContent = '準備完成';
    const st = window.AR ? AR.selfTest() : {};
    console.log('[selfTest]', st);
    if (!st.mindar) console.warn('[AR] MindAR 未載入，AR 掃描將無法使用（可走降級路徑）');
    inAppBanner();
    if (window.AR) AR.queryPermission();
    buildCharList();
    setTimeout(() => show('scr-title'), 260);
  }

  /* ───────── 主角選擇 ───────── */
  function buildCharList() {
    const wrap = $('#char-list');
    wrap.innerHTML = D.CHARS.map(c => `
      <button class="char-card" data-char="${c.id}">
        <img src="assets/chars/${c.id}.svg" alt="${c.name}">
        <div class="char-info">
          <h3>${c.name}</h3>
          <p class="ct" style="color:${c.color}">${c.title}</p>
          <p>${c.desc}</p>
          <span class="trait">${c.trait}</span>
        </div>
      </button>`).join('');
    wrap.querySelectorAll('.char-card').forEach(b => b.addEventListener('click', () => {
      wrap.querySelectorAll('.char-card').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
      S.char = D.CHARS.find(c => c.id === b.dataset.char);
      $('#btn-char-next').disabled = false;
    }));
  }

  /* ───────── 開局 ───────── */
  function startRun(mode) {
    S.mode = mode;
    S.queue = mode === 5 ? D.FIVE.slice() : D.LEVELS.map(l => l.n);
    S.idx = 0; S.lessons = []; S.tries = 0; S.wrong = 0;
    S.started = Date.now();
    enterLevel();
  }
  const cur = () => D.LEVELS.find(l => l.n === S.queue[S.idx]);

  /* ───────── 探索模式 ───────── */
  const P = { x: 20, y: 80, dir: {}, reached: false, raf: 0, last: 0 };

  /* 可行走範圍：BAND 只描述「場景地形」，但方向鍵與對白框是固定像素高度，
     在不同螢幕上佔的百分比不同（375×812 約 18%，414×896 約 17%），
     所以下緣（與上緣）必須在執行期依實際版面量測，不能寫死成百分比。
     否則主角會走進方向鍵底下被蓋住。 */
  const UI_GAP = 10;          // 與 UI 之間的安全間距（px）
  const GOAL_R = 42;          // 目標點半徑（px，.goal 為 84×84 且置中對齊）

  function walkLimits() {
    const b = BAND[cur().n] || { a: 30, b: 94 };
    const st = $('#stage').getBoundingClientRect();
    if (!st.height) return { a: b.a, b: b.b, goalMax: b.b };
    const pct = px => (px / st.height) * 100;

    const bottomUI = $('.hud-bottom').getBoundingClientRect();
    const topUI = $('.hud-top').getBoundingClientRect();
    const heroH = $('#hero').offsetHeight || 110;

    // 主角以「腳底」定位（transform: translate(-50%,-100%)），
    // 故腳底不得越過下方 UI 上緣；頭頂不得被上方對白框蓋住。
    let lo = Math.max(b.a, pct(topUI.bottom - st.top + UI_GAP + heroH));
    let hi = Math.min(b.b, pct(bottomUI.top - st.top - UI_GAP));
    // 目標點以「圓心」定位，底緣要再多留一個半徑
    let goalMax = Math.min(b.b, pct(bottomUI.top - st.top - UI_GAP - GOAL_R));

    if (lo > hi) lo = hi;                     // 極端矮螢幕的保險
    if (goalMax < lo) goalMax = lo;
    return { a: lo, b: hi, goalMax: goalMax };
  }

  /* 目標點座標：x 不變，y 依實際版面下修，確保永遠不與方向鍵重疊 */
  function goalPos() {
    const g = GOALS[cur().n], lim = walkLimits();
    return { x: g.x, y: Math.max(lim.a, Math.min(g.y, lim.goalMax)) };
  }

  function layoutGoal() {
    const g = goalPos();
    $('#goal').style.left = g.x + '%';
    $('#goal').style.top = g.y + '%';
  }

  function enterLevel() {
    const L = cur();
    $('#stage').style.backgroundImage = 'url("' + L.scene + '")';
    $('#hero').src = 'assets/chars/' + S.char.id + '.svg';
    $('#hud-level').textContent = String(L.n).padStart(2, '0');
    $('#hud-place').textContent = L.place;
    $('#hud-prog').textContent = (S.idx + 1) + ' / ' + S.queue.length;
    $('#bubble-text').textContent = L.task;
    const st = STARTS[L.n];
    $('#goal').classList.remove('reached');
    $('#goal .goal-dot').textContent = '?';
    P.x = st.x; P.y = st.y; P.reached = false; P.dir = {};
    $('#btn-scan').classList.add('off');
    show('scr-explore');         // 先顯示才量得到版面尺寸
    layoutGoal();
    const lim = walkLimits();
    P.y = Math.max(lim.a, Math.min(P.y, lim.b));
    drawHero();
    startLoop();
  }

  function drawHero() {
    const h = $('#hero');
    h.style.left = P.x + '%';
    h.style.top = P.y + '%';
  }

  function startLoop() {
    stopLoop();
    P.last = performance.now();
    const step = now => {
      const dt = Math.min((now - P.last) / 1000, 0.05); P.last = now;
      let dx = 0, dy = 0;
      if (P.dir.left) dx -= 1;
      if (P.dir.right) dx += 1;
      if (P.dir.up) dy -= 1;
      if (P.dir.down) dy += 1;
      if (dx || dy) {
        const n = Math.hypot(dx, dy) || 1;
        const lim = walkLimits();
        P.x = Math.max(6, Math.min(94, P.x + dx / n * SPEED * dt));
        P.y = Math.max(lim.a, Math.min(lim.b, P.y + dy / n * SPEED * dt));
        if (dx) $('#hero').classList.toggle('flip', dx < 0);
        drawHero();
        checkGoal();
      }
      P.raf = requestAnimationFrame(step);
    };
    P.raf = requestAnimationFrame(step);
  }
  function stopLoop() { if (P.raf) cancelAnimationFrame(P.raf); P.raf = 0; }

  function checkGoal() {
    const L = cur(), g = goalPos();
    const d = Math.hypot(P.x - g.x, P.y - g.y);
    const inRange = d < REACH;
    if (inRange && !P.reached) {
      P.reached = true;
      $('#goal').classList.add('reached');
      $('#goal .goal-dot').textContent = '!';
      $('#bubble-text').textContent = L.hint;
      $('#btn-scan').classList.remove('off');
    } else if (!inRange && P.reached) {
      P.reached = false;
      $('#goal').classList.remove('reached');
      $('#goal .goal-dot').textContent = '?';
      $('#bubble-text').textContent = L.task;
      $('#btn-scan').classList.add('off');
    }
  }

  /* 轉向、視窗尺寸變動時重新套用限制（方向鍵的百分比高度會改變） */
  function relayoutExplore() {
    if (!$('#scr-explore').classList.contains('active') || !S.char) return;
    layoutGoal();
    const lim = walkLimits();
    P.y = Math.max(lim.a, Math.min(P.y, lim.b));
    drawHero();
    checkGoal();
  }

  /* 方向鍵：觸控 ＋ 滑鼠 ＋ 鍵盤 */
  function bindDpad() {
    $$('.dbtn').forEach(b => {
      const d = b.dataset.dir;
      const on = e => { e.preventDefault(); P.dir[d] = true; };
      const off = e => { e.preventDefault(); P.dir[d] = false; };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointerleave', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('touchstart', on, { passive: false });
      b.addEventListener('touchend', off);
    });
    const KEY = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right',
                  w:'up', s:'down', a:'left', d:'right' };
    addEventListener('keydown', e => { const k = KEY[e.key]; if (k) { P.dir[k] = true; e.preventDefault(); } });
    addEventListener('keyup',   e => { const k = KEY[e.key]; if (k) { P.dir[k] = false; e.preventDefault(); } });
  }

  /* ───────── AR 模式 ───────── */
  function enterAR() {
    const L = cur();
    stopLoop();
    clearSuccess();
    $('#ar-intro-title').textContent = '關卡 ' + L.n + '：' + L.title;
    $('#fb-img').src = 'assets/targets/level' + String(L.n).padStart(2, '0') + '.png';
    $('#ar-intro').classList.remove('hidden');
    $('#ar-fallback').classList.add('hidden');
    $('#ar-teach').classList.add('hidden');
    $('#ar-scanning').classList.add('hidden');
    show('scr-ar');
  }

  /* ═══════════ v1.2 掃描成功 → 教學 ═══════════
     v1.1 的斷點：AR.start() 把 onFound 存起來後才 await stop({keepStream:true})，
     而 stop() 會無條件清掉 callback，於是 MindAR 讓 3D 內容浮現、遊戲卻停在原地。
     ar.js 已修好銜接；這裡把「掃到之後」做成明確、不會漏接的兩條路：
       ・4 秒倒數自動進入（橫幅顯示 4…3…2…1）
       ・隨時可按底部大按鈕「進入教學 ▶」立刻進入
     targetLost 一律不重置倒數、不收回按鈕 —— 掃到就算數。 */
  const AUTO_SEC = 4;
  const SUC = { timer: 0, left: 0, level: null, entering: false, foundAt: 0 };

  function clearSuccess() {
    if (SUC.timer) { clearInterval(SUC.timer); SUC.timer = 0; }
    SUC.left = 0; SUC.level = null; SUC.entering = false; SUC.foundAt = 0;
    $('#ar-success').classList.add('hidden');
    $('#ar-success-count').textContent = '';
  }

  /* targetFound 的唯一入口。注意：這裡刻意「不」呼叫 AR.stop()，
     讓 3D 疊加內容在倒數的 4 秒內繼續顯示給玩家看。 */
  function scanSuccess(L) {
    if (SUC.level || SUC.entering) return;      // 只認第一次
    SUC.level = L || cur();
    SUC.foundAt = Date.now();
    stopHealthCheck();
    $('#ar-scanning').classList.add('hidden');  // 收起準心，露出 AR 疊加畫面
    $('#ar-success').classList.remove('hidden');
    try { if (navigator.vibrate) navigator.vibrate(80); } catch (e) { /* 不支援就略過 */ }
    SUC.left = AUTO_SEC;
    $('#ar-success-count').textContent = SUC.left + '…';
    SUC.timer = setInterval(() => {
      SUC.left--;
      if (SUC.left <= 0) { enterTeachFromScan(); return; }
      $('#ar-success-count').textContent = SUC.left + '…';
    }, 1000);
  }

  /* 進教學：先徹底停掉 MindAR 與相機串流（相機燈熄滅），再顯示教學面板。 */
  async function enterTeachFromScan() {
    if (SUC.entering) return;
    SUC.entering = true;
    if (SUC.timer) { clearInterval(SUC.timer); SUC.timer = 0; }
    const L = SUC.level || cur();
    $('#ar-success').classList.add('hidden');
    $('#ar-success-count').textContent = '';
    try { await AR.stop(); } catch (e) { console.warn('[AR] stop on teach', e); }
    showTeach(L);
    SUC.level = null; SUC.entering = false; SUC.left = 0;
  }

  /* ── 掃描面板的狀態列 ── */
  function scanStatus(txt) { $('#scan-status').textContent = txt; }
  function scanHint(txt) {
    const el = $('#scan-hint');
    if (!txt) { el.classList.add('hidden'); el.textContent = ''; return; }
    el.textContent = txt; el.classList.remove('hidden');
  }
  function scanWait(show, txt) {
    $('#scan-wait').classList.toggle('hidden', !show);
    if (txt) $('#scan-count').textContent = txt;
  }

  /* ── 降級：顯示原因 ＋ 三個選項（不自動跳轉） ── */
  async function failCamera(info) {
    await AR.stop();
    $('#ar-scanning').classList.add('hidden');
    scanHint(''); scanWait(false);
    $('#fb-title').textContent = info && info.reason ? '相機無法使用' : '沒有相機也能繼續';
    if (info && info.reason) {
      $('#fb-reason').textContent = info.reason;
      $('#fb-guide').textContent = info.guide || '';
      $('#fb-diag').classList.remove('hidden');
    } else {
      $('#fb-diag').classList.add('hidden');
    }
    $('#diag-box').classList.add('hidden');
    $('#ar-fallback').classList.remove('hidden');
    $('#ar-intro').classList.add('hidden');
  }

  /* ── E. 串流健康檢查：12 秒寬限 ＋ 倒數 ＋「繼續等待」；亮度 > 6 立即解除 ── */
  const GRACE = 12;
  function healthCheck() {
    return new Promise(resolve => {
      let left = GRACE, blackShown = false;
      AR.resetProbe();
      scanWait(true, '正在等待相機畫面… ' + left + ' 秒');
      healthCheck._keep = () => { left = GRACE; scanHint(''); blackShown = false; };
      const timer = setInterval(() => {
        const st = AR.probe();
        if (st.hasFrame && st.bright) {                 // 有畫面且不是全黑 → 解除
          clearInterval(timer); healthCheck._t = 0; healthCheck._keep = null;
          scanWait(false); scanHint('');
          scanStatus('對準關鍵圖片，讓整張圖填滿方框');
          return resolve({ ok: true });
        }
        if (st.black && !blackShown) {                  // 連續 3 秒亮度 < 6
          blackShown = true;
          scanHint('相機已開但畫面全黑——若手機有鏡頭蓋請打開；或改用圖片模式。');
        }
        left--;
        scanWait(true, '正在等待相機畫面… ' + left + ' 秒');
        if (left <= 0) {
          clearInterval(timer); healthCheck._t = 0; healthCheck._keep = null;
          const st2 = AR.probe();
          resolve({
            ok: false,
            reason: st2.hasFrame
              ? '相機已開啟，但畫面持續全黑（平均亮度 ' + Math.round(st2.brightness * 10) / 10 + '）。'
              : '相機串流沒有送出任何畫面（影像尺寸 ' + st2.width + '×' + st2.height + '）。',
            guide: st2.hasFrame
              ? '若手機有鏡頭保護蓋或貼紙請移除；或改用下方「圖片模式」完成這一關。'
              : '請確認沒有其他 App 正在使用相機，然後按「重試相機」；或改用「圖片模式」。'
          });
        }
      }, 1000);
      healthCheck._t = timer;
    });
  }
  function stopHealthCheck() {
    if (healthCheck._t) { clearInterval(healthCheck._t); healthCheck._t = 0; }
    healthCheck._keep = null;
    scanWait(false); scanHint('');
  }

  /* ── A. 相機預檢：按鈕手勢內立刻 getUserMedia，再背景載 .mind ── */
  async function startCamera() {
    const L = cur();
    clearSuccess();
    $('#ar-intro').classList.add('hidden');
    $('#ar-fallback').classList.add('hidden');
    $('#ar-scanning').classList.remove('hidden');
    scanHint(''); scanWait(false);
    scanStatus('正在開啟相機…');

    // 0) 環境預檢（HTTPS／API 是否存在）
    const pf = AR.preflight();
    if (!pf.ok) {
      console.warn('[AR] preflight failed:', pf);
      AR.queryPermission();
      return failCamera(pf);
    }

    // 1) 手勢內「立刻」取得串流 —— 不先做任何 await，避免 iOS 手勢鏈斷裂
    let stream;
    try {
      stream = await AR.acquireCamera();
    } catch (e) {
      console.warn('[AR] getUserMedia failed:', e);
      await AR.queryPermission();
      const info = AR.explain(e);
      if (AR.diagData().permission === 'denied' && info.code !== 'NotAllowedError') {
        info.reason = '相機權限被拒，請到瀏覽器設定開啟。' + info.reason;
      }
      return failCamera(info);
    }

    // 2) 立即接到自己的預覽 video —— 使用者馬上看到相機活了
    try { await AR.attachPreview($('#cam-preview'), stream); } catch (e) { console.warn(e); }
    AR.queryPermission();
    scanStatus('相機已開啟，正在載入辨識資料…');

    // 3) 背景載入 .mind（600–800KB），轉成 blob URL 讓 MindAR 直接取用
    let mindSrc;
    try { mindSrc = await AR.prefetchTarget(L); }
    catch (e) { mindSrc = null; }

    // 4) 交棒給 MindAR：沿用同一條串流，不再第二次 getUserMedia
    scanStatus('正在啟動 AR…');
    try {
      await AR.start(L, {
        host: $('#ar-host'), stream: stream, mindSrc: mindSrc,
        onFound: () => scanSuccess(L),
        // v1.2：追蹤中斷刻意不做任何事 —— 已經掃到就算數，手持晃動不懲罰玩家
        onLost: () => { /* no-op by design */ }
      });
      await AR.repatch();               // B. 每次進掃描都強制修補 video
    } catch (e) {
      console.warn('[AR] start failed:', e);
      const info = e && e.__info ? e.__info
        : { reason: 'AR 引擎啟動失敗：' + (e && e.message ? e.message : e),
            guide: '請按「重試相機」，或改用「圖片模式」完成這一關。' };
      return failCamera(info);
    }

    // 5) 健康檢查（有畫面就把預覽收起來，交給 MindAR 的 video）
    const hc = await healthCheck();
    if (!hc.ok) {
      console.warn('[AR] health check failed:', hc);
      return failCamera(hc);
    }
    // MindAR 自己的 video 接手（會 cover 縮放）之後才收起預覽，避免中間閃黑
    // 若 MindAR 遲遲沒接手（>5 秒），就讓預覽留著 —— 至少畫面不是黑的
    let n = 0;
    const swap = setInterval(() => {
      if (AR.mindReady()) { clearInterval(swap); AR.hidePreview(); }
      else if (++n > 20) clearInterval(swap);
    }, 250);
    toast('相機已啟動，請對準關鍵圖片');
  }

  function showTeach(L) {
    $('#ar-scanning').classList.add('hidden');
    $('#ar-intro').classList.add('hidden');
    $('#ar-fallback').classList.add('hidden');
    $('#teach-en').textContent = L.en;
    $('#teach-title').textContent = L.ar.title;
    $('#teach-visual').innerHTML = VISUALS.svg(L.ar.visual);
    $('#teach-points').innerHTML = L.ar.points.map(p => '<li>' + p + '</li>').join('');
    $('#ar-teach').classList.remove('hidden');
  }

  /* ───────── 問答 ───────── */
  function enterQuiz() {
    const L = cur();
    $('#quiz-level').textContent = '關卡 ' + L.n + '　' + L.title;
    $('#quiz-q').textContent = L.quiz.q;
    $('#quiz-opts').innerHTML = L.quiz.opts
      .map((o, i) => `<button class="opt" data-i="${i}">${'ABCD'[i]}．${o}</button>`).join('');
    $('#quiz-fb').className = 'quiz-fb hidden';
    $('#quiz-fb').innerHTML = '';
    $('#btn-quiz-next').classList.add('hidden');
    $$('#quiz-opts .opt').forEach(b => b.addEventListener('click', () => answer(+b.dataset.i)));
    show('scr-quiz');
  }

  function answer(i) {
    const L = cur(), q = L.quiz;
    S.tries++;
    const fb = $('#quiz-fb');
    if (i === q.a) {
      $$('#quiz-opts .opt').forEach(b => {
        b.disabled = true;
        if (+b.dataset.i === q.a) b.classList.add('ok');
      });
      fb.className = 'quiz-fb ok';
      fb.innerHTML = '<b>答對了！</b>' + q.why;
      $('#btn-quiz-next').classList.remove('hidden');
      $('#btn-quiz-next').textContent = '過關！';
    } else {
      S.wrong++;
      const b = $('#quiz-opts .opt[data-i="' + i + '"]');
      b.classList.add('bad'); b.disabled = true;
      fb.className = 'quiz-fb bad';
      fb.innerHTML = '<b>再想一下</b>' + q.tip;
      fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /* ───────── 關卡結算 ───────── */
  function enterLesson() {
    const L = cur();
    S.lessons.push({ n: L.n, title: L.title, lesson: L.lesson });
    $('#lesson-kicker').textContent = '關卡 ' + L.n + ' 完成 ・ ' + L.en;
    $('#lesson-text').textContent = L.lesson;
    const last = S.idx >= S.queue.length - 1;
    $('#lesson-sub').textContent = last
      ? '所有關卡都完成了，來看看你的成果。'
      : '進度 ' + (S.idx + 1) + ' / ' + S.queue.length + '　下一關：' +
        D.LEVELS.find(l => l.n === S.queue[S.idx + 1]).title;
    $('#btn-lesson-next').textContent = last ? '看我的成果' : '前往下一關';
    show('scr-lesson');
  }

  function nextLevel() {
    if (S.idx >= S.queue.length - 1) return enterFinish();
    S.idx++;
    enterLevel();
  }

  /* ───────── 全破 ───────── */
  function enterFinish() {
    const mins = Math.max(1, Math.round((Date.now() - S.started) / 60000));
    const acc = S.tries ? Math.round((S.queue.length / S.tries) * 100) : 100;
    $('#finish-sub').textContent =
      '你和' + S.char.name + '一起走完 ' + S.queue.length + ' 關，用了大約 ' + mins +
      ' 分鐘，答題正確率 ' + acc + '%。';
    $('#badge-hero').src = 'assets/chars/' + S.char.id + '.svg';
    $('#badge-name').textContent = S.char.name + '　完成認證';
    $('#badge-meta').textContent =
      S.queue.length + ' 關全破 ・ 正確率 ' + acc + '% ・ ' + new Date().toLocaleDateString('zh-TW');
    $('#summary-list').innerHTML = D.SUMMARY
      .map(s => `<div class="sum-item"><b>${s.k}</b><span>${s.t}</span></div>`).join('');
    $('#lesson-recap').innerHTML = S.lessons
      .map(l => `<li><b>關卡 ${l.n}　${l.title}</b>：${l.lesson}</li>`).join('');
    show('scr-finish');
  }

  async function share() {
    const acc = S.tries ? Math.round((S.queue.length / S.tries) * 100) : 100;
    const text = '我完成了「花蓮綠色化學闖關」' + S.queue.length + ' 關！\n' +
      '主角：' + S.char.name + '　正確率 ' + acc + '%\n' +
      '在地資源再利用・循環經濟・綠色化學・環境永續・環境教育\n' +
      '（國立東華大學自然資源與環境學系 仿生與環境工作坊）';
    try {
      if (navigator.share) { await navigator.share({ title: '花蓮綠色化學闖關', text, url: location.href }); return; }
    } catch (e) { /* 使用者取消分享，忽略 */ }
    try {
      await navigator.clipboard.writeText(text + '\n' + location.href);
      toast('完成徽章文字已複製，可貼到任何地方分享');
    } catch (e) {
      toast('請長按選取上方徽章截圖分享');
    }
  }

  /* ───────── 事件綁定 ───────── */
  function bind() {
    $('#btn-start').addEventListener('click', () => show('scr-char'));
    $('#btn-howto').addEventListener('click', () => show('scr-howto'));
    $$('[data-go]').forEach(b => b.addEventListener('click', () => show(b.dataset.go)));
    $('#btn-char-next').addEventListener('click', () => { if (S.char) show('scr-mode'); });
    $$('.mode-card').forEach(b => b.addEventListener('click', () => startRun(+b.dataset.mode)));

    $('#btn-scan').addEventListener('click', enterAR);
    // iOS 要求 getUserMedia 必須在使用者手勢中呼叫 —— 因此綁在按鈕的 click 上
    $('#btn-cam').addEventListener('click', startCamera);
    $('#btn-nocam').addEventListener('click', () => {
      $('#ar-intro').classList.add('hidden');
      $('#ar-fallback').classList.remove('hidden');
    });
    $('#btn-ar-back').addEventListener('click', async () => {
      stopHealthCheck(); clearSuccess(); await AR.stop(); show('scr-explore'); startLoop();
    });
    $('#btn-scan-cancel').addEventListener('click', async () => {
      stopHealthCheck();
      clearSuccess();
      await AR.stop();
      $('#ar-scanning').classList.add('hidden');
      $('#ar-intro').classList.remove('hidden');
    });
    // v1.2 掃描成功後的大型主按鈕：立刻進入教學（不必等倒數跑完）
    $('#btn-ar-teach').addEventListener('click', enterTeachFromScan);
    $('#btn-keep-wait').addEventListener('click', () => {
      if (!healthCheck._keep) return;                   // 倒數已結束就別再給假回饋
      healthCheck._keep();                              // 倒數歸零重數
      toast('好，再多等 ' + GRACE + ' 秒');
    });
    $('#btn-fb-view').addEventListener('click', () => showTeach(cur()));
    $('#btn-fb-skip').addEventListener('click', () => { showTeach(cur()); toast('已跳過掃描，教學內容照樣完整'); });
    // 重試相機：click 本身就是使用者手勢，直接重跑預檢流程
    $('#btn-fb-retry').addEventListener('click', () => { startCamera(); });
    $('#btn-copy-diag').addEventListener('click', copyDiag);
    $('#btn-to-quiz').addEventListener('click', async () => { await AR.stop(); enterQuiz(); });
    $('#btn-quiz-next').addEventListener('click', enterLesson);
    $('#btn-lesson-next').addEventListener('click', nextLevel);
    $('#btn-share').addEventListener('click', share);
    $('#btn-restart').addEventListener('click', () => { S.char = null; $('#btn-char-next').disabled = true;
      $$('.char-card').forEach(x => x.classList.remove('sel')); show('scr-title'); });

    $('#inapp-close').addEventListener('click', () => {
      $('#inapp-banner').classList.add('hidden');
      document.body.classList.remove('has-banner');
    });

    bindDpad();
    addEventListener('resize', relayoutExplore);
    addEventListener('orientationchange', () => setTimeout(relayoutExplore, 250));
    addEventListener('pagehide', () => { stopHealthCheck(); clearSuccess(); AR.stop(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { stopHealthCheck(); clearSuccess(); AR.stop(); }
    });
  }

  /* ── D. 複製診斷資訊 ── */
  async function copyDiag() {
    const text = AR.diagText();
    const box = $('#diag-box');
    box.value = text;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        toast('診斷資訊已複製，請貼給我們', 3200);
        return;
      }
      throw new Error('no clipboard api');
    } catch (e) {
      box.classList.remove('hidden');
      box.focus(); box.select();
      try {
        if (document.execCommand && document.execCommand('copy')) {
          toast('診斷資訊已複製，請貼給我們', 3200); return;
        }
      } catch (e2) { /* 交給使用者手動複製 */ }
      toast('請長按下方文字方塊全選複製', 3600);
    }
  }

  /* ── C. 內建瀏覽器橫幅 ── */
  function inAppBanner() {
    const info = AR.detectInApp(navigator.userAgent);
    if (!info.inApp) return;
    let tip = info.tip;
    if (info.app === 'line') {
      if (!/openExternalBrowser=1/.test(location.search)) return;   // 正在自動導向，先不顯示
      // 已經帶了參數卻還在 LINE 裡（舊版 LINE 不吃這個參數）→ 給手動逃生指引
      tip = '已嘗試自動改用外部瀏覽器但仍在 LINE 內。請點右下角選單（⋯）→「用其他瀏覽器開啟」，' +
            '或複製網址後貼到 Safari／Chrome，相機才能使用。';
    }
    $('#inapp-text').textContent = '你正在「' + info.name + '」的內建瀏覽器中。' + tip;
    $('#inapp-banner').classList.remove('hidden');
    document.body.classList.add('has-banner');
  }

  /* 測試掛鉤：讓自動化驗證可以驅動流程（不影響一般玩法） */
  window.__game = {
    state: S, show, cur, startRun, enterAR, showTeach, enterQuiz, answer,
    enterLesson, nextLevel, enterFinish,
    move: (dir, ms) => new Promise(r => { P.dir[dir] = true; setTimeout(() => { P.dir[dir] = false; r(); }, ms); }),
    teleportToGoal: () => { const g = goalPos(); P.x = g.x; P.y = g.y; drawHero(); checkGoal(); },
    pos: () => ({ x: P.x, y: P.y, reached: P.reached }),
    // 以下供自動化驗收使用
    limits: walkLimits,
    goalPos: goalPos,
    relayout: relayoutExplore,
    setPos: (x, y) => {
      const lim = walkLimits();
      P.x = Math.max(6, Math.min(94, x));
      P.y = Math.max(lim.a, Math.min(lim.b, y));
      drawHero(); checkGoal();
      return { x: P.x, y: P.y };
    },
    gotoLevel: n => { S.idx = S.queue.indexOf(n); enterLevel(); },
    // v1.1 相機診斷驗收用
    startCamera, failCamera, copyDiag, inAppBanner,
    healthCheck, stopHealthCheck, scanStatus, scanHint, scanWait,
    // v1.2 掃描成功銜接驗收用
    scanSuccess, enterTeachFromScan, clearSuccess, successState: () => Object.assign({}, SUC)
  };

  bind();
  boot();
})();
