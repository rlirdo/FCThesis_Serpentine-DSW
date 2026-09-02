/* 蛇紋石改質反應探險 — 主流程 v1.0
   ── 與第一款（花蓮綠色化學闖關 v1.4）的關係 ──────────────────────
   相機／追蹤／逃生管線（js/ar.js）原封沿用——那是手機實測踩過坑修出來的：
     acquireCamera() 手勢內取得串流、attachPreview、prefetchTarget、
     雙目標 .mind（本關卡＋萬用卡）、healthCheck 黑畫面判定、
     scanSuccess() 橫幅＋倒數、LINE openExternalBrowser 逃生、診斷面板。
   本作只改「探索模式」與「教學內容」：
     ・自由走動 → 格狀迷宮（DFS 隨機生成、每關固定 seed）
     ・單一目標點 → 先蒐集 3 個試劑／條件代幣才開啟終點
     ・新增陷阱格（違反綠色化學 → 退回起點並教一句原則）
     ・新增限時挑戰（可關閉）
     ・每關兩題大學程度問答
   ── 遮蔽保證 ─────────────────────────────────────────────
   迷宮的可視矩形一律在執行期由 mazeRect() 量測：上緣取 .hud-top 的下緣、
   下緣取 .hud-bottom 的上緣。所有格子（含主角、代幣、終點）都畫在這個矩形內，
   因此在任何螢幕尺寸下都不可能被方向鍵或掃描鈕蓋住。 */
(function () {
  const D = window.GAME_DATA;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const S = {
    char: null, mode: 12, queue: [], idx: 0,
    lessons: [], tries: 0, wrong: 0, started: null,
    timerOn: true
  };

  /* ───────── 畫面切換 ───────── */
  function show(id) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    const el = $('#' + id);
    if (el) el.scrollTop = 0;
    if (id !== 'scr-explore') stopTimer();
    /* WebGL context 是稀有資源：離開哪一頁就把那一頁的 a-scene 收掉 */
    if (window.CHAR3D) {
      if (id === 'scr-char') CHAR3D.mountPreviews('#char-list .char-3d');
      else CHAR3D.destroyPreviews();
      if (id !== 'scr-explore' && id !== 'scr-ar') CHAR3D.destroy();
    }
    if (id !== 'scr-quiz' && window.QUIZ) QUIZ.teardown();
  }
  function toast(msg, ms = 2400) {
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
  /* v1.1：選角改用會自轉的 3D 預覽（沒有 A-Frame 時退回原本的 SVG 圖） */
  function buildCharList() {
    const wrap = $('#char-list');
    const has3d = !!(window.AFRAME && window.CHAR3D);
    wrap.innerHTML = D.CHARS.map(c => `
      <button class="char-card" data-char="${c.id}">
        <div class="char-3d" data-char3d="${c.id}">${
          has3d ? '' : `<img src="assets/chars/${c.id}.svg" alt="${c.name}">`}</div>
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
    S.queue = mode === 6 ? D.SIX.slice() : D.LEVELS.map(l => l.n);
    S.idx = 0; S.lessons = []; S.tries = 0; S.wrong = 0;
    S.started = Date.now();
    const chk = $('#opt-timer');
    S.timerOn = chk ? chk.checked : true;
    enterLevel();
  }
  const cur = () => D.LEVELS.find(l => l.n === S.queue[S.idx]);

  /* ═══════════════════════════════════════════════════════════
     探索模式：格狀迷宮
     ═══════════════════════════════════════════════════════════ */
  const M = {
    maze: null,          // MAZE.gen 產出的資料
    from: 0,             // 目前所在格（整數索引）；t=0 時就站在它的中心
    dir: 'down',         // 目前身處的走廊方向（from → 相鄰格）
    t: 0,                // 走廊上的次格進度：0、1/3、2/3（到 1 立刻結算成新的 from）
    vx: 0, vy: 0,        // 視覺座標（格為單位的浮點數，平滑補間用）
    intent: null,        // 預轉向緩衝 { dir, at }
    raf: 0,              // 補間動畫的 rAF
    lastT: 0,
    got: [],             // 已蒐集的代幣索引
    rect: null,          // 目前的可視矩形與格子大小
    hold: 0,             // 長按重複移動的計時器
    holdDir: null,
    timer: 0, left: 0,   // 限時挑戰
    ready: false         // 三代幣到齊、終點開啟
  };
  const GAP = 8;         // 與 UI 之間的安全間距（px）

  /* ── v1.1 次格步進參數 ──────────────────────────────────────
     使用者實測回報：「每一步距離要再縮小」「轉彎時無法順利轉彎」。
     STEP  一次點按只前進 1/3 格（碰撞判定仍以「格」為單位）
     HOLD  按住時每 180 ms 走一次次格步
     GLIDE 每一次次格步的補間時間，必須短於 HOLD 才不會追撞
     BUFFER 預轉向緩衝的有效期：抵達路口前先按了垂直方向，記住這個意圖 */
  const STEP = 1 / 3, HOLD = 180, GLIDE = 130, BUFFER = 700;

  /* 可視矩形：上緣＝.hud-top 下緣、下緣＝.hud-bottom 上緣（執行期量測），
     所以主角／代幣／終點永遠不會被方向鍵或掃描鈕蓋住。
     v1.1 追加 headroom：3D 主角站在格中心、身高約一格，會往上長出去，
     因此先把上緣多留 0.72 格再配版，最上排的角色才不會被上方資訊列切到。
     0.72 是量出來的：容器高 1.9 格、鏡頭 fov 46 / 距離 1.85，角色從腳底（容器 81.8%）
     到頭頂（容器 20.1%）＝ 0.618 × 1.9 ＝ 1.173 格，扣掉半格的格心偏移剩 0.673 格，
     再留一點餘裕。 */
  function mazeRect() {
    const st = $('#stage').getBoundingClientRect();
    const top = $('.hud-top').getBoundingClientRect();
    const bot = $('.hud-bottom').getBoundingClientRect();
    const availTop = Math.max(0, top.bottom - st.top + GAP);
    const availBot = Math.max(availTop + 40, bot.top - st.top - GAP);
    const availH = Math.max(60, availBot - availTop);
    const availW = Math.max(60, st.width - 16);
    const m = M.maze;
    if (!m) return { x: 8, y: availTop, w: availW, h: availH, cell: 24, cols: 1, rows: 1, head: 0 };
    let cell = Math.max(14, Math.floor(Math.min(availW / m.cols, availH / m.rows)));
    for (let k = 0; k < 3; k++) {
      const head = Math.round(cell * 0.72);
      cell = Math.max(14, Math.floor(Math.min(availW / m.cols, (availH - head) / m.rows)));
    }
    const head = Math.round(cell * 0.72);
    const w = cell * m.cols, h = cell * m.rows;
    return {
      x: Math.round(st.width / 2 - w / 2),
      y: Math.round(availTop + head + Math.max(0, (availH - head - h) / 2)),
      w: w, h: h, cell: cell, cols: m.cols, rows: m.rows, head: head,
      availTop: availTop, availBot: availBot
    };
  }

  /* 牆壁：以 SVG 線段畫在每一格的四邊 */
  function renderMaze() {
    const m = M.maze, r = M.rect;
    const box = $('#maze');
    box.style.left = r.x + 'px';
    box.style.top = r.y + 'px';
    box.style.width = r.w + 'px';
    box.style.height = r.h + 'px';

    const svg = $('#maze-svg');
    svg.setAttribute('viewBox', '0 0 ' + r.w + ' ' + r.h);
    svg.setAttribute('width', r.w);
    svg.setAttribute('height', r.h);
    const c = r.cell;
    let s = '<defs>' +
      '<pattern id="ore" width="10" height="10" patternUnits="userSpaceOnUse">' +
      '<rect width="10" height="10" fill="#1E3A2E"/>' +
      '<path d="M0 7 l10 -4 M0 3 l10 4" stroke="#3D6B55" stroke-width="1.4" opacity=".85"/>' +
      '</pattern></defs>';
    // 路徑底色（半透明白，讓場景插畫仍看得見）
    s += '<rect x="0" y="0" width="' + r.w + '" height="' + r.h + '" rx="10" fill="#FFFFFF" opacity="0.30"/>';
    const wall = [];
    for (let y = 0; y < m.rows; y++) {
      for (let x = 0; x < m.cols; x++) {
        const cellv = m.cells[y * m.cols + x];
        const x0 = x * c, y0 = y * c;
        if (cellv & 1) wall.push([x0, y0, x0 + c, y0]);            // 上
        if (cellv & 2) wall.push([x0 + c, y0, x0 + c, y0 + c]);    // 右
        if (cellv & 4) wall.push([x0, y0 + c, x0 + c, y0 + c]);    // 下
        if (cellv & 8) wall.push([x0, y0, x0, y0 + c]);            // 左
      }
    }
    const tw = Math.max(3, Math.round(c * 0.16));
    wall.forEach(w => {
      s += '<line x1="' + w[0] + '" y1="' + w[1] + '" x2="' + w[2] + '" y2="' + w[3] +
           '" stroke="url(#ore)" stroke-width="' + tw + '" stroke-linecap="round" opacity="0.92"/>';
    });
    svg.innerHTML = s;

    // 代幣、陷阱
    const items = $('#maze-items');
    const L = cur();
    let h = '';
    m.traps.forEach((t, i) => {
      const tr = D.TRAPS[t.key];
      const p = cellPos(t.i);
      h += '<div class="mcell trap" data-trap="' + i + '" style="left:' + p.x + 'px;top:' + p.y +
           'px;width:' + c + 'px;height:' + c + 'px"><span style="font-size:' +
           Math.round(c * 0.46) + 'px">' + tr.icon + '</span></div>';
    });
    m.tokens.forEach((ti, i) => {
      const p = cellPos(ti);
      const tk = L.tokens[i] || { k: '?' };
      h += '<div class="mcell token' + (M.got.indexOf(i) >= 0 ? ' got' : '') + '" data-token="' + i +
           '" style="left:' + p.x + 'px;top:' + p.y + 'px;width:' + c + 'px;height:' + c +
           'px"><span style="font-size:' + fitFont(tk.k, c) + 'px">' + esc(tk.k) + '</span></div>';
    });
    items.innerHTML = h;

    // 終點
    const gp = cellPos(m.goal);
    const g = $('#goal');
    const gs = Math.round(c * 0.94);
    g.style.width = gs + 'px'; g.style.height = gs + 'px';
    g.style.left = (gp.x + c / 2) + 'px';
    g.style.top = (gp.y + c / 2) + 'px';

    // 主角（3D 場景容器；沒有 A-Frame 時退回 SVG 平面圖）
    const box3 = $('#hero3d');
    const hs3 = Math.round(c * 1.9);
    box3.style.width = hs3 + 'px';
    box3.style.height = hs3 + 'px';
    const hero = $('#hero');
    const hs = Math.round(c * 0.82);
    hero.style.width = hs + 'px';
    hero.style.height = hs + 'px';
    drawHero();
  }

  /* 代幣文字長短差很多（「T」到「AgNO₃」到「洗三次」都有），
     格子又會隨螢幕縮放，所以字級一律依「內容寬度 ÷ 可用寬度」算出來，
     不能寫死——否則小格子上的長標籤會被裁掉。CJK 以 1 個字寬計，
     ASCII 與上下標約 0.58 個字寬。 */
  /* 代幣代號是直接串進 innerHTML 的，含 < 或 > 就會被當成標籤吃掉
     （例如「<CMC」整個消失）。一律先跳脫。 */
  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function fitFont(txt, cell) {
    let w = 0;
    for (const ch of String(txt)) w += (ch.charCodeAt(0) < 0x2000 ? 0.58 : 1);
    const avail = cell * 0.76 - 4;
    return Math.max(8, Math.min(13, Math.floor(avail / Math.max(1, w))));
  }

  function cellPos(i) {
    const m = M.maze, c = M.rect.cell;
    return { x: (i % m.cols) * c, y: ((i / m.cols) | 0) * c };
  }

  /* ── 邏輯座標 ↔ 視覺座標 ──
     邏輯：from（格）＋ dir（走廊方向）＋ t（0、1/3、2/3）
     視覺：vx / vy 為格單位的浮點數，用固定速度追向邏輯目標，所以移動是連續的。 */
  const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const cx = i => M.maze ? (i % M.maze.cols) : 0;
  const cy = i => M.maze ? ((i / M.maze.cols) | 0) : 0;
  function goalXY() {
    const d = DIRV[M.dir] || [0, 1];
    return { x: cx(M.from) + d[0] * M.t, y: cy(M.from) + d[1] * M.t };
  }
  function neighbor(i, dir) {
    const d = DIRV[dir];
    return (cy(i) + d[1]) * M.maze.cols + (cx(i) + d[0]);
  }

  function drawHero() {
    if (!M.rect || !M.maze) return;
    const c = M.rect.cell;
    const px = M.vx * c + c / 2, py = M.vy * c + c / 2;
    const box3 = $('#hero3d');
    if (box3) { box3.style.left = px + 'px'; box3.style.top = py + 'px'; }
    const hero = $('#hero');
    if (hero) { hero.style.left = px + 'px'; hero.style.top = py + 'px'; }
  }

  /* 補間迴圈：把 vx/vy 以固定速度推向邏輯目標；到位就停掉 rAF（省電） */
  function glide() {
    M.raf = 0;
    if (!M.maze || !M.rect) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - (M.lastT || now)) / 1000);
    M.lastT = now;
    const g = goalXY();
    const speed = STEP / (GLIDE / 1000);          // 格/秒
    let dx = g.x - M.vx, dy = g.y - M.vy;
    const dist = Math.hypot(dx, dy);
    const mv = speed * dt;
    if (dist <= mv || dist < 0.0005) { M.vx = g.x; M.vy = g.y; }
    else { M.vx += dx / dist * mv; M.vy += dy / dist * mv; }
    drawHero();
    const arrived = (Math.abs(g.x - M.vx) < 0.0005 && Math.abs(g.y - M.vy) < 0.0005);
    if (window.CHAR3D) CHAR3D.setMoving(!arrived);
    if (!arrived) M.raf = requestAnimationFrame(glide);
  }
  function kick() { M.lastT = performance.now(); if (!M.raf) M.raf = requestAnimationFrame(glide); }
  function snapVisual() {
    const g = goalXY();
    M.vx = g.x; M.vy = g.y;
    drawHero();
    if (window.CHAR3D) CHAR3D.setMoving(false);
  }

  function enterLevel() {
    const L = cur();
    $('#stage').style.backgroundImage = 'url("' + L.scene + '")';
    $('#hero').src = 'assets/chars/' + S.char.id + '.svg';
    $('#hud-level').textContent = String(L.n).padStart(2, '0');
    $('#hud-place').textContent = L.place;
    $('#hud-prog').textContent = (S.idx + 1) + ' / ' + S.queue.length;
    $('#bubble-text').textContent = L.task;
    $('#btn-scan').classList.add('off');
    $('#trap-panel').classList.add('hidden');
    $('#goal').classList.remove('reached');
    $('#goal .goal-dot').textContent = '🔒';

    M.maze = MAZE.gen(L.maze);
    M.got = [];
    M.ready = false;
    M.from = M.maze.start;
    M.dir = 'down'; M.t = 0; M.intent = null;
    M.vx = cx(M.from); M.vy = cy(M.from);

    show('scr-explore');           // 先顯示才量得到版面尺寸
    M.rect = mazeRect();
    mountHero();
    renderMaze();
    snapVisual();
    updateTokenHud();
    startTimer(L);
  }

  /* 3D 主角：進迷宮時掛上、進掃描模式時銷毀（兩個 a-scene 絕不同時存在） */
  function mountHero() {
    const host = $('#hero3d');
    if (!host || !S.char) return null;
    const ok = window.CHAR3D && window.AFRAME ? CHAR3D.mount(host, S.char.id) : null;
    host.classList.toggle('off', !ok);
    $('#hero').classList.toggle('off', !!ok);      // 有 3D 就不顯示 SVG 退路
    if (ok) CHAR3D.face(M.dir);
    return ok;
  }
  function unmountHero() {
    if (window.CHAR3D) CHAR3D.destroy();
    const host = $('#hero3d');
    if (host) host.classList.add('off');
    $('#hero').classList.remove('off');
  }

  function updateTokenHud() {
    $('#hud-token').textContent = M.got.length + ' / 3';
    $('#hud-token').classList.toggle('full', M.got.length >= 3);
  }

  /* ── 限時挑戰 ── */
  function startTimer(L) {
    stopTimer();
    const lim = (S.timerOn && L.maze.limit) ? L.maze.limit : 0;
    const el = $('#hud-timer');
    if (!lim) { el.classList.add('hidden'); return; }
    M.left = lim;
    el.classList.remove('hidden');
    paintTimer();
    M.timer = setInterval(() => {
      M.left--;
      paintTimer();
      if (M.left <= 0) {
        stopTimer();
        backToStart();
        toast('時間到！退回起點重新計時——代幣會保留。', 3200);
        startTimer(cur());
      }
    }, 1000);
  }
  function paintTimer() {
    const el = $('#hud-timer');
    const mm = String(Math.floor(M.left / 60)).padStart(2, '0');
    const ss = String(M.left % 60).padStart(2, '0');
    el.textContent = mm + ':' + ss;
    el.classList.toggle('warn', M.left <= 30);
  }
  function stopTimer() { if (M.timer) { clearInterval(M.timer); M.timer = 0; } }

  function backToStart() {
    M.from = M.maze.start;
    M.dir = 'down'; M.t = 0; M.intent = null;
    snapVisual();
    if (window.CHAR3D) CHAR3D.face('down');
    checkGoal();
  }

  /* ═══════════════════════════════════════════════════════════
     v1.1 次格步進 ＋ 預轉向緩衝（cornering assist）
     ── 狀態機 ────────────────────────────────────────────────
       from  目前所在格；t = 0 時角色就站在它的正中心
       dir   目前佔用的走廊方向（from → 相鄰格，該走廊必定是通的）
       t     0 / 1/3 / 2/3；一旦到 1 就立刻結算成「抵達相鄰格」（from 換人、t 歸零）
     ── 按下一個方向時 ────────────────────────────────────────
       ① t = 0（站在格中心）：該方向通 → 轉向並走 1/3 格；不通 → 撞牆回饋
       ② 與 dir 同向：t += 1/3（到 1 就結算抵達，並觸發陷阱／代幣／終點判定）
       ③ 與 dir 反向：t -= 1/3（退回；到 0 就回到格中心）
       ④ 與 dir 垂直：記下「意圖」，這就是預轉向緩衝——
          ・若此刻剛好在格中心且該方向可通 → 立刻轉
          ・若正在走 → 等抵達下一個格中心時自動轉（並吸附到中心）
          ・若停在走廊中段 → 先吸附到最近的格中心（t ≥ 0.5 前進、否則後退），再轉
     這樣就不會再出現「按了方向卻沒轉、卡在轉角」的情形；
     碰撞判定全程仍以「格」為單位，與 v1.0 完全一致。 */

  function bump() {
    ['#hero3d', '#hero'].forEach(sel => {
      const el = $(sel);
      if (!el) return;
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    });
    try { if (navigator.vibrate) navigator.vibrate(18); } catch (e) {}
  }

  function canMove() {
    if (!M.maze || !$('#scr-explore').classList.contains('active')) return false;
    if (!$('#trap-panel').classList.contains('hidden')) return false;   // 陷阱說明中不能動
    return true;
  }

  function faceDir(dir) {
    M.dir = dir;
    if (window.CHAR3D) CHAR3D.face(dir);
    const d = DIRV[dir];
    if (d[0]) $('#hero').classList.toggle('flip', d[0] < 0);
  }

  /* 抵達相鄰格：結算 from／t，並觸發該格的陷阱、代幣、終點判定 */
  function arrive() {
    M.from = neighbor(M.from, M.dir);
    M.t = 0;
    const i = M.from;
    const tr = M.maze.traps.find(t => t.i === i);
    if (tr) { M.intent = null; kick(); hitTrap(tr); return true; }
    const ti = M.maze.tokens.indexOf(i);
    if (ti >= 0 && M.got.indexOf(ti) < 0) pickToken(ti);
    checkGoal();
    tryTurn();                                   // 預轉向：抵達路口就自動轉
    kick();
    return true;
  }

  /* 把 t 推到目標值（>=1 就結算抵達） */
  function setT(nt) {
    if (nt >= 1 - 1e-9) return arrive();
    M.t = Math.max(0, Math.round(nt * 3) / 3);
    kick();
    return true;
  }

  /* 吸附到最近的格中心：t >= 0.5 前進到下一格，否則退回原格 */
  function settle() {
    if (!M.maze) return false;
    if (M.t === 0) return true;
    if (M.t >= 0.5) return arrive();
    M.t = 0; kick();
    return true;
  }

  /* 消化預轉向緩衝。回傳是否真的轉了。 */
  function tryTurn() {
    const it = M.intent;
    if (!it) return false;
    if (performance.now() - it.at > BUFFER) { M.intent = null; return false; }
    if (M.t !== 0) return false;                 // 還沒走到格中心，等抵達再說
    if (!MAZE.open(M.maze, cx(M.from), cy(M.from), it.dir)) return false;
    M.intent = null;
    faceDir(it.dir);
    return setT(STEP);
  }

  /* 對外的單次「按一下方向鍵」。回傳是否有任何位移或轉向。 */
  function press(dir) {
    if (!canMove() || !DIRV[dir]) return false;
    if (M.t === 0) {
      if (!MAZE.open(M.maze, cx(M.from), cy(M.from), dir)) {
        /* 站在格中心卻撞牆：如果緩衝裡有別的可通方向，順手幫他轉過去 */
        M.intent = { dir: dir, at: performance.now() };
        if (tryTurn()) return true;
        M.intent = null;
        bump();
        return false;
      }
      faceDir(dir);
      return setT(STEP);
    }
    if (dir === M.dir) return setT(M.t + STEP);
    if (dir === OPP[M.dir]) return setT(M.t - STEP);
    /* 垂直方向＝轉向意圖 */
    M.intent = { dir: dir, at: performance.now() };
    if (tryTurn()) return true;
    if (M.hold) return true;                     // 正在長按前進 → 等抵達路口自動轉
    /* 停在走廊中段：先吸附到最近格中心，再轉 */
    settle();
    if (tryTurn()) return true;
    if (!MAZE.open(M.maze, cx(M.from), cy(M.from), dir)) { M.intent = null; bump(); return false; }
    return true;
  }

  /* v1.0 相容名稱：整格移動（測試與舊呼叫點用），內部走三次次格步 */
  function step(dir) {
    let ok = false;
    for (let k = 0; k < 3; k++) ok = press(dir) || ok;
    return ok;
  }

  function pickToken(ti) {
    const L = cur();
    M.got.push(ti);
    updateTokenHud();
    const el = $('#maze-items .token[data-token="' + ti + '"]');
    if (el) el.classList.add('got');
    const tk = L.tokens[ti];
    $('#token-pop-k').textContent = tk.k;
    $('#token-pop-t').textContent = tk.label + '　' + tk.tip;
    const pop = $('#token-pop');
    pop.classList.remove('hidden');
    clearTimeout(pickToken._t);
    pickToken._t = setTimeout(() => pop.classList.add('hidden'), 2600);
    try { if (navigator.vibrate) navigator.vibrate(40); } catch (e) {}
    if (M.got.length >= 3) {
      $('#bubble-text').textContent = L.hint;
      $('#goal').classList.add('open');
      $('#goal .goal-dot').textContent = '!';
      toast('三個代幣到齊，終點已開啟！');
    }
  }

  function hitTrap(tr) {
    const info = D.TRAPS[tr.key];
    stopTimer();
    $('#trap-ico').textContent = info.icon;
    $('#trap-name').textContent = '踩到「' + info.name + '」';
    $('#trap-msg').textContent = info.msg;
    $('#trap-panel').classList.remove('hidden');
    try { if (navigator.vibrate) navigator.vibrate([60, 40, 60]); } catch (e) {}
  }
  function closeTrap() {
    $('#trap-panel').classList.add('hidden');
    backToStart();
    startTimer(cur());
  }

  function checkGoal() {
    const L = cur();
    const i = M.from;
    const atGoal = (i === M.maze.goal);
    const ok = atGoal && M.got.length >= 3;
    M.ready = ok;
    $('#goal').classList.toggle('reached', ok);
    if (ok) {
      $('#bubble-text').textContent = L.hint;
      $('#btn-scan').classList.remove('off');
    } else {
      $('#btn-scan').classList.add('off');
      if (atGoal && M.got.length < 3) {
        $('#bubble-text').textContent = '終點還鎖著——先把三個代幣蒐集齊（目前 ' +
          M.got.length + ' / 3）。' + L.tokens.filter((t, k) => M.got.indexOf(k) < 0)
          .map(t => t.label).join('、') + ' 還沒拿到。';
      } else if (M.got.length >= 3) {
        $('#bubble-text').textContent = L.hint;
      } else {
        $('#bubble-text').textContent = L.task;
      }
    }
  }

  function relayoutExplore() {
    if (!$('#scr-explore').classList.contains('active') || !M.maze) return;
    M.rect = mazeRect();
    renderMaze();
    snapVisual();
  }

  /* 停手之後的中心吸附：若已經走過半格（t ≥ 1/2），自動補完剩下的距離站到格中心，
     這樣「看起來已經站在代幣格上、卻沒撿到」的落差就不會發生；
     只走了 1/3 格則維持原地，那才是次格步進要的細膩手感。 */
  function scheduleSettle() {
    clearTimeout(scheduleSettle._t);
    scheduleSettle._t = setTimeout(() => {
      if (M.hold || !canMove()) return;
      if (M.t >= 0.5) arrive();
    }, 250);
  }

  /* 方向鍵：觸控 ＋ 滑鼠 ＋ 鍵盤。
     按一下走 1/3 格；長按每 180 ms 續走一次次格步（＝連續慢走）。 */
  function bindDpad() {
    $$('.dbtn').forEach(b => {
      const dir = b.dataset.dir;
      const on = e => {
        e.preventDefault();
        press(dir);
        clearInterval(M.hold);
        M.holdDir = dir;
        M.hold = setInterval(() => press(dir), HOLD);
      };
      const off = e => {
        if (e) e.preventDefault();
        clearInterval(M.hold); M.hold = 0; M.holdDir = null;
        scheduleSettle();
      };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointerleave', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('touchstart', on, { passive: false });
      b.addEventListener('touchend', off);
    });
    const KEY = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right',
                  w:'up', s:'down', a:'left', d:'right' };
    let downKey = null;
    addEventListener('keydown', e => {
      const k = KEY[e.key]; if (!k) return;
      e.preventDefault();
      if (downKey === k) return;                 // 系統自動重複交給我們自己的計時器
      downKey = k;
      press(k);
      clearInterval(M.hold);
      M.holdDir = k;
      M.hold = setInterval(() => press(k), HOLD);
    });
    addEventListener('keyup', e => {
      const k = KEY[e.key]; if (!k) return;
      e.preventDefault();
      if (downKey === k) downKey = null;
      clearInterval(M.hold); M.hold = 0; M.holdDir = null;
      scheduleSettle();
    });
  }

  /* ═══════════ 掃描模式記憶 ═══════════ */
  const MODE_KEY = 'srq.scanMode';
  const MODES = ['scan', 'nocard', 'skip'];
  function loadMode() {
    try {
      const v = localStorage.getItem(MODE_KEY);
      return MODES.indexOf(v) >= 0 ? v : null;
    } catch (e) { return null; }
  }
  function saveMode(m) {
    if (MODES.indexOf(m) < 0) return false;
    try { localStorage.setItem(MODE_KEY, m); return true; }
    catch (e) { console.warn('[mode] localStorage 不可用，這次不記憶', e); return false; }
  }
  function markLastMode() {
    const last = loadMode();
    $$('.mode-btn').forEach(b => b.classList.toggle('last', b.dataset.mode === last));
    return last;
  }

  /* ───────── AR 模式 ───────── */
  function enterAR() {
    const L = cur();
    stopTimer();
    /* 探索模式與掃描模式的 a-scene 絕不同時存在：先把 3D 主角整個銷毀，
       WebGL context 與 rAF 都收回，MindAR 的 a-scene 才有完整資源可用。 */
    unmountHero();
    clearSuccess();
    hideNoCard();
    $('#ar-intro-title').textContent = '關卡 ' + L.n + '：' + L.title;
    $('#ar-lead').innerHTML =
      '用<b>「萬用卡」</b>可以一張玩到底；有十二張卡片組的話，本關請掃<b>第 ' + L.n + ' 號卡</b>。';
    $('#fb-img').src = 'assets/targets/level' + String(L.n).padStart(2, '0') + '.png?v=1.1';
    markLastMode();
    $('#ar-intro').classList.remove('hidden');
    $('#ar-fallback').classList.add('hidden');
    $('#ar-teach').classList.add('hidden');
    $('#ar-scanning').classList.add('hidden');
    show('scr-ar');
  }

  /* ═══════════ 掃描成功 → 教學（沿用 v1.2 修好的銜接） ═══════════ */
  const AUTO_SEC = 4;
  const SUC = { timer: 0, left: 0, level: null, entering: false, foundAt: 0, index: null };

  function clearSuccess() {
    if (SUC.timer) { clearInterval(SUC.timer); SUC.timer = 0; }
    SUC.left = 0; SUC.level = null; SUC.entering = false; SUC.foundAt = 0; SUC.index = null;
    $('#ar-success').classList.add('hidden');
    $('#ar-success-count').textContent = '';
    $('#ar-success-mark').textContent = '✓ 掃描成功！';
  }

  function scanSuccess(L, index) {
    if (SUC.level || SUC.entering) return;      // 只認第一次
    SUC.level = L || cur();
    SUC.foundAt = Date.now();
    SUC.index = (index === undefined) ? null : index;
    stopHealthCheck();
    $('#ar-scanning').classList.add('hidden');
    $('#ar-success-mark').textContent =
      index === 1 ? '✓ 掃到萬用卡！' : index === 0 ? '✓ 掃到第 ' + SUC.level.n + ' 號卡！' : '✓ 掃描成功！';
    $('#ar-success').classList.remove('hidden');
    try { if (navigator.vibrate) navigator.vibrate(80); } catch (e) {}
    SUC.left = AUTO_SEC;
    $('#ar-success-count').textContent = SUC.left + '…';
    SUC.timer = setInterval(() => {
      SUC.left--;
      if (SUC.left <= 0) { enterTeachFromScan(); return; }
      $('#ar-success-count').textContent = SUC.left + '…';
    }, 1000);
  }

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

  const GRACE = 12;
  function healthCheck() {
    return new Promise(resolve => {
      let left = GRACE, blackShown = false;
      AR.resetProbe();
      scanWait(true, '正在等待相機畫面… ' + left + ' 秒');
      healthCheck._keep = () => { left = GRACE; scanHint(''); blackShown = false; };
      const timer = setInterval(() => {
        const st = AR.probe();
        if (st.hasFrame && st.bright) {
          clearInterval(timer); healthCheck._t = 0; healthCheck._keep = null;
          scanWait(false); scanHint('');
          scanStatus('對準關鍵圖片，讓整張圖填滿方框');
          return resolve({ ok: true });
        }
        if (st.black && !blackShown) {
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

  /* ── 相機預檢：按鈕手勢內立刻 getUserMedia，再背景載 .mind ── */
  async function startCamera() {
    const L = cur();
    saveMode('scan');
    clearSuccess();
    hideNoCard();
    $('#ar-intro').classList.add('hidden');
    $('#ar-fallback').classList.add('hidden');
    $('#ar-scanning').classList.remove('hidden');
    $('#ar-scanning').classList.remove('plain');
    scanHint(''); scanWait(false);
    scanStatus('正在開啟相機…');

    const pf = AR.preflight();
    if (!pf.ok) {
      console.warn('[AR] preflight failed:', pf);
      AR.queryPermission();
      return failCamera(pf);
    }

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

    try { await AR.attachPreview($('#cam-preview'), stream); } catch (e) { console.warn(e); }
    AR.queryPermission();
    scanStatus('相機已開啟，正在載入辨識資料…');

    let mindSrc;
    try { mindSrc = await AR.prefetchTarget(L); }
    catch (e) { mindSrc = null; }

    scanStatus('正在啟動 AR…');
    try {
      await AR.start(L, {
        host: $('#ar-host'), stream: stream, mindSrc: mindSrc,
        onFound: index => scanSuccess(L, index),
        onLost: () => { /* no-op by design */ }
      });
      await AR.repatch();
    } catch (e) {
      console.warn('[AR] start failed:', e);
      const info = e && e.__info ? e.__info
        : { reason: 'AR 引擎啟動失敗：' + (e && e.message ? e.message : e),
            guide: '請按「重試相機」，或改用「圖片模式」完成這一關。' };
      return failCamera(info);
    }

    const hc = await healthCheck();
    if (!hc.ok) {
      console.warn('[AR] health check failed:', hc);
      return failCamera(hc);
    }
    let n = 0;
    const swap = setInterval(() => {
      if (AR.mindReady()) { clearInterval(swap); AR.hidePreview(); }
      else if (++n > 20) clearInterval(swap);
    }, 250);
    toast('相機已啟動：本關卡片或萬用卡，掃到哪一張都算過關');
  }

  /* ═══════════ 免卡體驗模式 ═══════════ */
  const NOCARD = { on: false, tiltBound: null, photoUrl: null };

  function hideNoCard() {
    NOCARD.on = false;
    $('#ar-nocard').classList.add('hidden');
    $('#nocard-photo').classList.add('hidden');
    if (NOCARD.tiltBound) { removeEventListener('deviceorientation', NOCARD.tiltBound); NOCARD.tiltBound = null; }
    const t = $('#nocard-tilt');
    if (t) t.style.transform = '';
    if (NOCARD.photoUrl) { try { URL.revokeObjectURL(NOCARD.photoUrl); } catch (e) {} NOCARD.photoUrl = null; }
  }

  function buildNoCard(L) {
    $('#nocard-kicker').textContent = '免卡體驗 · 關卡 ' + L.n + ' · ' + L.en;
    $('#nocard-title').textContent = L.ar.title;
    $('#nocard-visual').innerHTML = VISUALS.svg(L.ar.visual);
    $('#nocard-points').innerHTML = L.ar.points.map(p => '<li>' + p + '</li>').join('');
  }

  function bindTilt() {
    if (NOCARD.tiltBound) return false;
    if (typeof DeviceOrientationEvent === 'undefined') return false;
    if (typeof DeviceOrientationEvent.requestPermission === 'function') return false;  // iOS：不啟用、不彈窗
    const el = $('#nocard-tilt');
    NOCARD.tiltBound = e => {
      if (!NOCARD.on) return;
      const g = Math.max(-24, Math.min(24, e.gamma || 0));
      const b = Math.max(-24, Math.min(24, (e.beta || 0) - 45));
      el.style.transform = 'translate3d(' + (g * 0.5).toFixed(1) + 'px,' + (b * 0.35).toFixed(1) + 'px,0)';
    };
    addEventListener('deviceorientation', NOCARD.tiltBound, true);
    return true;
  }

  async function startNoCard() {
    const L = cur();
    saveMode('nocard');
    clearSuccess();
    hideNoCard();
    $('#ar-intro').classList.add('hidden');
    $('#ar-fallback').classList.add('hidden');
    $('#ar-scanning').classList.remove('hidden');
    $('#ar-scanning').classList.add('plain');
    scanHint(''); scanWait(false);
    scanStatus('正在開啟相機…');

    const pf = AR.preflight();
    if (!pf.ok) { AR.queryPermission(); return failCamera(pf); }

    let stream;
    try {
      stream = await AR.acquireCamera();
    } catch (e) {
      await AR.queryPermission();
      return failCamera(AR.explain(e));
    }
    try { await AR.attachPreview($('#cam-preview'), stream); } catch (e) { console.warn(e); }
    AR.queryPermission();
    scanStatus('相機已開啟');

    const hc = await healthCheck();
    if (!hc.ok) return failCamera(hc);

    $('#ar-scanning').classList.add('hidden');
    $('#ar-scanning').classList.remove('plain');
    buildNoCard(L);
    NOCARD.on = true;
    $('#ar-nocard').classList.remove('hidden');
    bindTilt();
    toast('這是免卡體驗：教學內容直接疊在你眼前的實景上');
  }

  function svgToImage(kind) {
    let s = VISUALS.svg(kind);
    if (!s) return Promise.resolve(null);
    const m = /viewBox="0 0 (\d+) (\d+)"/.exec(s);
    const w = m ? +m[1] : 340, h = m ? +m[2] : 190;
    const ns = /xmlns=/.test(s) ? '' : 'xmlns="http://www.w3.org/2000/svg" ';
    s = s.replace('<svg ', '<svg ' + ns + 'width="' + w + '" height="' + h + '" ');
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
    return new Promise(res => {
      const im = new Image();
      im.onload = () => res({ img: im, w: w, h: h });
      im.onerror = () => res(null);
      im.src = url;
    });
  }

  function wrapText(ctx, text, maxW) {
    const out = [];
    let line = '';
    for (const ch of String(text)) {
      if (ch === '\n') { out.push(line); line = ''; continue; }
      const t = line + ch;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = ch; }
      else line = t;
    }
    if (line) out.push(line);
    return out;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  async function composeNoCardPhoto(L) {
    const v = $('#cam-preview');
    if (!v || !v.videoWidth) throw new Error('相機畫面尚未就緒');
    const W = Math.min(v.videoWidth, 1440);
    const H = Math.round(W * v.videoHeight / v.videoWidth);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.drawImage(v, 0, 0, W, H);

    const FF = '"Microsoft JhengHei","Noto Sans TC",sans-serif';
    const pad = Math.round(W * 0.05);
    const panelW = W - pad * 2;
    const inner = panelW - pad;

    ctx.font = 'bold ' + Math.round(W * 0.042) + 'px ' + FF;
    const titleLines = wrapText(ctx, L.ar.title, inner);
    ctx.font = Math.round(W * 0.028) + 'px ' + FF;
    const ptLines = [];
    L.ar.points.forEach(p => wrapText(ctx, '・' + p, inner).forEach(l => ptLines.push(l)));

    const vis = await svgToImage(L.ar.visual);
    let visW = vis ? inner : 0;
    let visH = vis ? Math.round(vis.h * visW / vis.w) : 0;

    const lhT = Math.round(W * 0.055), lhP = Math.round(W * 0.042);
    const kickH = Math.round(W * 0.05);
    const topPad = pad * 0.75, botPad = pad * 0.9;

    let lines = ptLines.slice();
    const contentH = () => topPad + kickH + titleLines.length * lhT +
      (vis ? visH + pad * 0.5 : 0) + lines.length * lhP + botPad;
    const maxH = H - pad * 1.6;
    if (vis && contentH() > maxH) {
      const room = Math.max(Math.round(H * 0.16), visH - (contentH() - maxH));
      if (room < visH) { visH = room; visW = Math.round(vis.w * visH / vis.h); }
    }
    while (lines.length > 1 && contentH() > maxH) lines.pop();

    const panelH = Math.min(contentH(), maxH);
    const py = Math.max(pad * 0.6, Math.round((H - panelH) / 2));

    ctx.fillStyle = 'rgba(11,31,58,0.74)';
    roundRect(ctx, pad, py, panelW, panelH, Math.round(W * 0.03));
    ctx.fill();
    ctx.strokeStyle = 'rgba(201,154,62,0.85)';
    ctx.lineWidth = Math.max(2, Math.round(W * 0.004));
    ctx.stroke();

    let y = py + topPad;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#5FA98A';
    ctx.font = 'bold ' + Math.round(W * 0.026) + 'px ' + FF;
    ctx.fillText('關卡 ' + L.n + ' · ' + L.en, pad + pad * 0.5, y);
    y += kickH;

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold ' + Math.round(W * 0.042) + 'px ' + FF;
    titleLines.forEach(l => { ctx.fillText(l, pad + pad * 0.5, y); y += lhT; });

    if (vis) {
      const vx = Math.round(pad + (panelW - visW) / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.94)';
      roundRect(ctx, vx, y, visW, visH, Math.round(W * 0.014));
      ctx.fill();
      ctx.drawImage(vis.img, vx, y, visW, visH);
      y += visH + pad * 0.5;
    }

    ctx.fillStyle = '#E2EEF4';
    ctx.font = Math.round(W * 0.028) + 'px ' + FF;
    lines.forEach(l => { ctx.fillText(l, pad + pad * 0.5, y); y += lhP; });

    const fh = Math.round(W * 0.062);
    ctx.fillStyle = 'rgba(11,31,58,0.82)';
    ctx.fillRect(0, H - fh, W, fh);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold ' + Math.round(W * 0.026) + 'px ' + FF;
    ctx.textBaseline = 'middle';
    ctx.fillText('蛇紋石改質反應探險 · 關卡 ' + L.n + ' ' + L.title, Math.round(W * 0.03), H - fh / 2);
    ctx.fillStyle = '#C99A3E';
    ctx.textAlign = 'right';
    ctx.fillText(new Date().toLocaleDateString('zh-TW'), W - Math.round(W * 0.03), H - fh / 2);
    ctx.textAlign = 'left';

    return cv;
  }

  async function shootNoCard() {
    const L = cur();
    let cv;
    try { cv = await composeNoCardPhoto(L); }
    catch (e) { console.warn('[nocard] compose failed', e); return toast('相機畫面還沒準備好，請稍等一下再拍'); }

    const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
    if (!blob) return toast('這個瀏覽器無法產生照片，請直接截圖');
    if (NOCARD.photoUrl) { try { URL.revokeObjectURL(NOCARD.photoUrl); } catch (e) {} }
    NOCARD.photoUrl = URL.createObjectURL(blob);
    const name = '蛇紋石改質反應探險_關卡' + L.n + '_' +
                 new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.png';
    $('#nocard-photo-img').src = NOCARD.photoUrl;
    const a = $('#nocard-dl');
    a.href = NOCARD.photoUrl;
    a.setAttribute('download', name);
    $('#nocard-photo').classList.remove('hidden');
    try { if (navigator.vibrate) navigator.vibrate(40); } catch (e) {}
    return blob;
  }

  function showTeach(L) {
    $('#ar-scanning').classList.add('hidden');
    $('#ar-scanning').classList.remove('plain');
    $('#ar-intro').classList.add('hidden');
    $('#ar-fallback').classList.add('hidden');
    hideNoCard();
    $('#teach-en').textContent = L.en;
    $('#teach-title').textContent = L.ar.title;
    $('#teach-hypo').classList.toggle('hidden', !L.hypo);
    $('#teach-eq').textContent = L.ar.eq || '';
    $('#teach-visual').innerHTML = VISUALS.svg(L.ar.visual);
    $('#teach-points').innerHTML = L.ar.points.map(p => '<li>' + p + '</li>').join('');
    $('#ar-teach').classList.remove('hidden');
  }

  /* ───────── 問答（每關兩題） ───────── */
  const Q = { i: 0 };

  function enterQuiz() {
    Q.i = 0;
    paintQuiz();
    show('scr-quiz');
  }

  /* v1.1：每關兩題一律取用互動題資料（QUIZ_DATA）；
     data.js 裡的 v1.0 文字選擇題保留為最後的降級退路。 */
  function quizList(L) {
    return (window.QUIZ_DATA && QUIZ_DATA[L.n]) || L.quiz;
  }
  const KIND = {
    tap3d: 'AR 互動題 ・ 點選 3D 物件',
    drag3d: 'AR 互動題 ・ 拖曳到正確位置',
    'anim/time': '動畫影片題 ・ 點出關鍵時刻',
    'anim/pick': '動畫影片題 ・ 點出關鍵段落',
    order: '互動排序題 ・ 步驟卡拖曳排序'
  };
  function kindOf(q) { return KIND[q.type + (q.ask ? '/' + q.ask : '')] || '互動題'; }

  function paintQuiz() {
    const L = cur(), list = quizList(L), q = list[Q.i];
    $('#quiz-level').textContent = '關卡 ' + L.n + '　' + L.title;
    $('#quiz-step').textContent = '第 ' + (Q.i + 1) + ' 題 / 共 ' + list.length + ' 題';
    $('#quiz-kind').textContent = kindOf(q);
    $('#quiz-hypo').classList.toggle('hidden', !q.hypo);
    $('#quiz-q').textContent = q.q;
    $('#quiz-fb').className = 'quiz-fb hidden';
    $('#quiz-fb').innerHTML = '';
    $('#btn-quiz-next').classList.add('hidden');
    QUIZ.render($('#quiz-stage'), q, onQuizAnswer);
    $('#scr-quiz').scrollTop = 0;
  }

  /* 互動題的判定回呼：答對 → 解析＋繼續；答錯 → 提示，可以重試（不扣機會，只計次） */
  function onQuizAnswer(ok, hint) {
    const L = cur(), list = quizList(L), q = list[Q.i];
    S.tries++;
    const fb = $('#quiz-fb');
    if (ok) {
      fb.className = 'quiz-fb ok';
      fb.innerHTML = '<b>答對了！</b>' + q.why;
      const last = Q.i >= list.length - 1;
      $('#btn-quiz-next').classList.remove('hidden');
      $('#btn-quiz-next').textContent = last ? '過關！' : '下一題 ▶';
    } else {
      S.wrong++;
      fb.className = 'quiz-fb bad';
      fb.innerHTML = '<b>再想一下</b>' + (hint || q.tip || '再看一次動畫或轉一轉場景。');
      try { fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
    }
  }

  function quizNext() {
    const L = cur();
    if (Q.i < quizList(L).length - 1) { Q.i++; paintQuiz(); return; }
    QUIZ.teardown();
    enterLesson();
  }

  /* ───────── 關卡結算 ───────── */
  function enterLesson() {
    const L = cur();
    S.lessons.push({ n: L.n, title: L.title, lesson: L.lesson });
    $('#lesson-kicker').textContent = '關卡 ' + L.n + ' 完成 ・ ' + L.en;
    $('#lesson-text').textContent = L.lesson;
    const last = S.idx >= S.queue.length - 1;
    $('#lesson-sub').textContent = last
      ? '所有關卡都完成了，來看八式完整反應鏈。'
      : '進度 ' + (S.idx + 1) + ' / ' + S.queue.length + '　下一關：' +
        D.LEVELS.find(l => l.n === S.queue[S.idx + 1]).title;
    $('#btn-lesson-next').textContent = last ? '看八式反應鏈' : '前往下一關';
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
    const total = S.queue.length * 2;                 // 每關兩題
    const acc = S.tries ? Math.round((total / S.tries) * 100) : 100;
    $('#finish-sub').textContent =
      '你和' + S.char.name + '一起走完 ' + S.queue.length + ' 座迷宮、答完 ' + total +
      ' 題，用了大約 ' + mins + ' 分鐘，答題正確率 ' + Math.min(100, acc) + '%。';
    $('#badge-hero').src = 'assets/chars/' + S.char.id + '.svg';
    $('#badge-name').textContent = S.char.name + '　完成認證';
    $('#badge-meta').textContent =
      S.queue.length + ' 關全破 ・ 正確率 ' + Math.min(100, acc) + '% ・ ' + new Date().toLocaleDateString('zh-TW');
    $('#chain-list').innerHTML = D.CHAIN.map(c => `
      <div class="chain-item ${c.status}">
        <span class="ch-n">${c.n}</span>
        <div class="ch-body">
          <b>${c.name}</b>
          <code>${c.eq}</code>
          <span class="ch-kind">${c.kind}${c.status === 'hypo' ? '　·　研究假說（待驗證）' : ''}</span>
        </div>
      </div>`).join('');
    $('#summary-list').innerHTML = D.SUMMARY
      .map(s => `<div class="sum-item"><b>${s.k}</b><span>${s.t}</span></div>`).join('');
    $('#lesson-recap').innerHTML = S.lessons
      .map(l => `<li><b>關卡 ${l.n}　${l.title}</b>：${l.lesson}</li>`).join('');
    show('scr-finish');
  }

  async function share() {
    const total = S.queue.length * 2;
    const acc = S.tries ? Math.min(100, Math.round((total / S.tries) * 100)) : 100;
    const text = '我完成了「蛇紋石改質反應探險」' + S.queue.length + ' 關！\n' +
      '主角：' + S.char.name + '　正確率 ' + acc + '%\n' +
      '層狀矽酸鹽・微胞水相・八式反應鏈・研究假說的界線\n' +
      '（國立東華大學自然資源與環境學系 仿生與環境工作坊）';
    try {
      if (navigator.share) { await navigator.share({ title: '蛇紋石改質反應探險', text, url: location.href }); return; }
    } catch (e) {}
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
    $('#btn-trap-ok').addEventListener('click', closeTrap);

    $('#btn-scan').addEventListener('click', enterAR);
    $('#btn-mode-scan').addEventListener('click', startCamera);
    $('#btn-mode-nocard').addEventListener('click', startNoCard);
    $('#btn-mode-skip').addEventListener('click', () => {
      saveMode('skip');
      showTeach(cur());
      toast('已跳過掃描，教學內容照樣完整');
    });
    $('#btn-ar-back').addEventListener('click', async () => {
      stopHealthCheck(); clearSuccess(); hideNoCard(); await AR.stop();
      show('scr-explore'); mountHero(); relayoutExplore(); startTimer(cur());
    });

    $('#btn-nocard-shot').addEventListener('click', shootNoCard);
    $('#btn-nocard-go').addEventListener('click', async () => {
      const L = cur();
      hideNoCard();
      await AR.stop();
      showTeach(L);
    });
    $('#btn-nocard-back').addEventListener('click', async () => {
      hideNoCard();
      await AR.stop();
      $('#ar-intro').classList.remove('hidden');
      markLastMode();
    });
    $('#btn-nocard-photo-close').addEventListener('click', () => {
      $('#nocard-photo').classList.add('hidden');
    });
    $('#btn-scan-cancel').addEventListener('click', async () => {
      stopHealthCheck();
      clearSuccess();
      hideNoCard();
      await AR.stop();
      $('#ar-scanning').classList.add('hidden');
      $('#ar-scanning').classList.remove('plain');
      $('#ar-intro').classList.remove('hidden');
      markLastMode();
    });
    $('#btn-ar-teach').addEventListener('click', enterTeachFromScan);
    $('#btn-keep-wait').addEventListener('click', () => {
      if (!healthCheck._keep) return;
      healthCheck._keep();
      toast('好，再多等 ' + GRACE + ' 秒');
    });
    $('#btn-fb-view').addEventListener('click', () => showTeach(cur()));
    $('#btn-fb-skip').addEventListener('click', () => { showTeach(cur()); toast('已跳過掃描，教學內容照樣完整'); });
    $('#btn-fb-retry').addEventListener('click', () => { startCamera(); });
    $('#btn-copy-diag').addEventListener('click', copyDiag);
    $('#btn-to-quiz').addEventListener('click', async () => { await AR.stop(); enterQuiz(); });
    $('#btn-quiz-next').addEventListener('click', quizNext);
    $('#btn-lesson-next').addEventListener('click', nextLevel);
    $('#btn-share').addEventListener('click', share);
    $('#btn-restart').addEventListener('click', () => {
      S.char = null; $('#btn-char-next').disabled = true;
      $$('.char-card').forEach(x => x.classList.remove('sel')); show('scr-title');
    });

    $('#inapp-close').addEventListener('click', () => {
      $('#inapp-banner').classList.add('hidden');
      document.body.classList.remove('has-banner');
    });

    bindDpad();
    addEventListener('resize', relayoutExplore);
    addEventListener('orientationchange', () => setTimeout(relayoutExplore, 250));
    addEventListener('pagehide', () => { stopHealthCheck(); clearSuccess(); hideNoCard(); stopTimer(); AR.stop(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { stopHealthCheck(); clearSuccess(); hideNoCard(); AR.stop(); }
    });
  }

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
      } catch (e2) {}
      toast('請長按下方文字方塊全選複製', 3600);
    }
  }

  function inAppBanner() {
    const info = AR.detectInApp(navigator.userAgent);
    if (!info.inApp) return;
    let tip = info.tip;
    if (info.app === 'line') {
      if (!/openExternalBrowser=1/.test(location.search)) return;
      tip = '已嘗試自動改用外部瀏覽器但仍在 LINE 內。請點右下角選單（⋯）→「用其他瀏覽器開啟」，' +
            '或複製網址後貼到 Safari／Chrome，相機才能使用。';
    }
    $('#inapp-text').textContent = '你正在「' + info.name + '」的內建瀏覽器中。' + tip;
    $('#inapp-banner').classList.remove('hidden');
    document.body.classList.add('has-banner');
  }

  /* 測試掛鉤：讓自動化驗證可以驅動流程（不影響一般玩法） */
  window.__game = {
    state: S, show, cur, startRun, enterAR, showTeach, enterQuiz, quizNext,
    enterLesson, nextLevel, enterFinish,
    // 題目（v1.1 互動題）
    quizList, kindOf, paintQuiz, onQuizAnswer,
    quizIndex: () => Q.i,
    setQuizIndex: k => { Q.i = k; paintQuiz(); return Q.i; },
    // 迷宮
    maze: () => M.maze,
    rect: () => M.rect,
    pos: () => ({ x: cx(M.from), y: cy(M.from), cell: M.from, dir: M.dir, t: M.t,
                  vx: M.vx, vy: M.vy, intent: M.intent && M.intent.dir,
                  got: M.got.slice(), ready: M.ready }),
    // v1.1 次格步進
    press, settle, tryTurn, arrive, snapVisual, scheduleSettle,
    STEP, HOLD, GLIDE, BUFFER,
    /* 中心吸附誤差：t=0 時角色的畫素座標與該格中心的距離（應為 0） */
    centerError: () => {
      if (!M.rect || !M.maze) return null;
      const c = M.rect.cell;
      const box = $('#hero3d');
      const px = parseFloat(box.style.left), py = parseFloat(box.style.top);
      return Math.hypot(px - (cx(M.from) * c + c / 2), py - (cy(M.from) * c + c / 2));
    },
    mountHero, unmountHero,
    step, relayout: relayoutExplore, mazeRect,
    setChar: id => { S.char = D.CHARS.find(c => c.id === id) || D.CHARS[0]; return S.char; },
    gotoLevel: n => { const k = S.queue.indexOf(n); if (k >= 0) { S.idx = k; enterLevel(); } return S.idx; },
    setTimerOn: v => { S.timerOn = !!v; },
    collectAll: () => {
      M.maze.tokens.forEach((t, i) => { if (M.got.indexOf(i) < 0) M.got.push(i); });
      updateTokenHud(); renderMaze(); checkGoal(); return M.got.slice();
    },
    teleport: i => {
      M.from = i; M.t = 0; M.intent = null;
      snapVisual(); checkGoal(); return { x: cx(i), y: cy(i) };
    },
    teleportGoal: () => { return window.__game.teleport(M.maze.goal); },
    hitTrap, closeTrap, pickToken, backToStart, startTimer, stopTimer,
    timerLeft: () => M.left,
    // AR 驗收
    startCamera, failCamera, copyDiag, inAppBanner,
    healthCheck, stopHealthCheck, scanStatus, scanHint, scanWait,
    scanSuccess, enterTeachFromScan, clearSuccess, successState: () => Object.assign({}, SUC),
    loadMode, saveMode, markLastMode, MODE_KEY,
    startNoCard, buildNoCard, hideNoCard, shootNoCard, composeNoCardPhoto,
    svgToImage, wrapText, bindTilt,
    nocardState: () => Object.assign({}, NOCARD)
  };

  bind();
  boot();
})();
