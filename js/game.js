/* 花蓮綠色化學闖關 — 主流程 */
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
    $('#ar-intro-title').textContent = '關卡 ' + L.n + '：' + L.title;
    $('#fb-img').src = 'assets/targets/level' + String(L.n).padStart(2, '0') + '.png';
    $('#ar-intro').classList.remove('hidden');
    $('#ar-fallback').classList.add('hidden');
    $('#ar-teach').classList.add('hidden');
    $('#ar-scanning').classList.add('hidden');
    show('scr-ar');
  }

  async function startCamera() {
    const L = cur();
    $('#ar-intro').classList.add('hidden');
    $('#ar-scanning').classList.remove('hidden');
    try {
      await AR.start(L, { host: $('#ar-host'), onFound: () => { AR.stop(); showTeach(L); } });
      toast('相機已啟動，請對準關鍵圖片');
    } catch (e) {
      console.warn('[AR] start failed:', e);
      await AR.stop();
      $('#ar-scanning').classList.add('hidden');
      $('#ar-fallback').classList.remove('hidden');
      toast('相機無法啟動：' + (e && e.message ? e.message : e), 4200);
    }
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
      await AR.stop(); show('scr-explore'); startLoop();
    });
    $('#btn-scan-cancel').addEventListener('click', async () => {
      await AR.stop();
      $('#ar-scanning').classList.add('hidden');
      $('#ar-intro').classList.remove('hidden');
    });
    $('#btn-fb-view').addEventListener('click', () => showTeach(cur()));
    $('#btn-fb-skip').addEventListener('click', () => { showTeach(cur()); toast('已跳過掃描，教學內容照樣完整'); });
    $('#btn-fb-retry').addEventListener('click', () => {
      $('#ar-fallback').classList.add('hidden');
      $('#ar-intro').classList.remove('hidden');
    });
    $('#btn-to-quiz').addEventListener('click', async () => { await AR.stop(); enterQuiz(); });
    $('#btn-quiz-next').addEventListener('click', enterLesson);
    $('#btn-lesson-next').addEventListener('click', nextLevel);
    $('#btn-share').addEventListener('click', share);
    $('#btn-restart').addEventListener('click', () => { S.char = null; $('#btn-char-next').disabled = true;
      $$('.char-card').forEach(x => x.classList.remove('sel')); show('scr-title'); });

    bindDpad();
    addEventListener('resize', relayoutExplore);
    addEventListener('orientationchange', () => setTimeout(relayoutExplore, 250));
    addEventListener('pagehide', () => AR.stop());
    document.addEventListener('visibilitychange', () => { if (document.hidden) AR.stop(); });
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
    gotoLevel: n => { S.idx = S.queue.indexOf(n); enterLevel(); }
  };

  bind();
  boot();
})();
