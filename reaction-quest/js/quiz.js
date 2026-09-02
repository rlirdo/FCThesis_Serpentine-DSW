/* 蛇紋石改質反應探險 — 互動題引擎 v1.1
   ── 為什麼不再用純文字選擇題 ──────────────────────────────────
   v1.0 的每關兩題是 ABCD 文字選項，讀完教學面板其實就能猜到答案，
   學生「看過」但沒有「動手」。v1.1 全部改成兩種互動型態：
     ① AR 互動題（tap3d / drag3d）
        掃卡後的同一組 3D 反應式場景直接拿來作答：
        點選 3D 物件、或把離子拖到正確位置。答對 → 發光／歸位／爆閃；
        答錯 → 物件搖頭並顯示提示，可以重試。
     ② 動畫影片題（anim）
        先播 6–10 秒自繪反應動畫（自動播放、可重播、有進度條與時間軸），
        再要玩家點選「關鍵時刻」（時間軸）或「關鍵物件／段落」（畫面分區）。
     ③ 排序題（order）
        3–4 張步驟卡拖曳排成正確反應順序。
   ── 點擊怎麼實作 ────────────────────────────────────────────
   3D 物件的可點區不用 A-Frame raycaster，而是每幀把物件世界座標投影成
   螢幕座標，再把一個真正的 DOM 熱區疊上去（規格允許的「投影到 2D 的可點 hit 區」）。
   好處有三：手機觸控命中率高、標籤可以用繁體中文（MSDF 字型沒有中文）、
   而且可以用 pointer 事件序列自動化驗收。
   ── 免卡／跳過路徑 ──────────────────────────────────────────
   題目一律在自己的 #quiz-stage 裡建立浮動 3D 場景，與掃描與否無關，
   所以「掃描卡片」「免卡體驗」「跳過直接答題」三條路徑都能作答。 */
window.QUIZ = (function () {

  const $ = s => document.querySelector(s);
  const C = { navy: '#0B1F3A', deep: '#065A82', teal: '#1C7293', green: '#2E7D5B',
              moss: '#5FA98A', gold: '#C99A3E', red: '#B03E34', rust: '#8C4A2F',
              ice: '#78B2C8', white: '#F7FAFB', grey: '#64748B' };

  /* 目前這一題的執行期狀態 */
  const R = { q: null, scene: null, host: null, raf: 0, zones: [], done: false,
              onAnswer: null, chip: null, order: [], anim: null, wrongIds: [] };

  /* ═══════════ 共用 3D 場景 ═══════════ */
  const SEGS = 'segments-width="14" segments-height="10"';

  function shapeHTML(o) {
    const p = o.pos.join(' ');
    const col = o.color || C.teal;
    const op = o.opacity !== undefined
      ? ' material="color: ' + col + '; opacity: ' + o.opacity + '; transparent: true"' : ' color="' + col + '"';
    const rot = o.rot ? ' rotation="' + o.rot.join(' ') + '"' : '';
    const id = ' id="qo-' + o.id + '" class="qobj"';
    switch (o.shape) {
      case 'box':
        return '<a-box' + id + ' position="' + p + '"' + rot + ' width="' + (o.w || 0.3) +
               '" height="' + (o.h || 0.2) + '" depth="' + (o.d || 0.2) + '"' + op + '></a-box>';
      case 'cylinder':
        return '<a-cylinder' + id + ' position="' + p + '"' + rot + ' radius="' + (o.r || 0.12) +
               '" height="' + (o.h || 0.3) + '" segments-radial="14"' + op + '></a-cylinder>';
      case 'cone':
        return '<a-cone' + id + ' position="' + p + '"' + rot + ' radius-bottom="' + (o.r || 0.14) +
               '" radius-top="' + (o.rt || 0.01) + '" height="' + (o.h || 0.3) +
               '" segments-radial="14"' + op + '></a-cone>';
      case 'torus':
        return '<a-torus' + id + ' position="' + p + '"' + rot + ' radius="' + (o.r || 0.14) +
               '" radius-tubular="' + (o.rt || 0.02) + '" segments-radial="10" segments-tubular="18"' +
               op + '></a-torus>';
      case 'plate':
        return '<a-plane' + id + ' position="' + p + '"' + rot + ' width="' + (o.w || 0.4) +
               '" height="' + (o.h || 0.3) + '"' + op + '></a-plane>';
      default:
        return '<a-sphere' + id + ' position="' + p + '" radius="' + (o.r || 0.13) + '" ' +
               SEGS + op + '></a-sphere>';
    }
  }

  function build3D(hostEl, q) {
    const sc = document.createElement('a-scene');
    sc.setAttribute('embedded', '');
    sc.setAttribute('vr-mode-ui', 'enabled: false');
    sc.setAttribute('device-orientation-permission-ui', 'enabled: false');
    sc.setAttribute('renderer', 'alpha: true; antialias: false; colorManagement: true; precision: mediump');
    sc.setAttribute('background', 'transparent: true');
    sc.setAttribute('loading-screen', 'enabled: false');
    const deco = (q.deco || []).map(shapeHTML).join('');
    const objs = (q.objs || []).map(shapeHTML).join('');
    sc.innerHTML =
      '<a-entity class="c3d-cam" camera="fov: 48" position="0 0 2.35" look-controls="enabled: false" ' +
      'wasd-controls="enabled: false"></a-entity>' +
      '<a-entity light="type: ambient; color: #FFFFFF; intensity: 0.95"></a-entity>' +
      '<a-entity light="type: directional; color: #FFFFFF; intensity: 0.5" position="1 1.6 1.4"></a-entity>' +
      '<a-entity id="q-root"' + (q.spin ? ' animation="property: rotation; to: 0 360 0; loop: true; ' +
        'dur: 26000; easing: linear"' : '') + '>' + deco + objs + '</a-entity>';
    hostEl.appendChild(sc);
    /* 與 char3d 同樣的相機保險：避免 A-Frame 注入預設相機把畫面弄空 */
    const fixCam = function () {
      try {
        const cam = sc.querySelector('.c3d-cam');
        if (!cam) return;
        const inj = sc.querySelector('[camera][aframe-injected]');
        if (inj && inj !== cam && inj.parentNode) inj.parentNode.removeChild(inj);
        cam.setAttribute('camera', 'active', true);
        if (sc.systems && sc.systems.camera) sc.systems.camera.setActiveCamera(cam);
        cam.play();
      } catch (e) { console.warn('[quiz] fixCam', e); }
    };
    if (sc.hasLoaded) fixCam(); else sc.addEventListener('loaded', fixCam, { once: true });
    sc.addEventListener('render-target-loaded', function () {
      try { sc.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); } catch (e) {}
    }, { once: true });
    return sc;
  }

  function disposeScene() {
    if (R.raf) { cancelAnimationFrame(R.raf); R.raf = 0; }
    if (R.scene) {
      try {
        const r = R.scene.renderer;
        if (R.scene.parentNode) R.scene.parentNode.removeChild(R.scene);
        if (r && r.dispose) r.dispose();
        if (r && r.forceContextLoss) r.forceContextLoss();
      } catch (e) { console.warn('[quiz] dispose', e); }
    }
    R.scene = null;
  }

  /* 投影：把物件世界座標換成熱區的螢幕座標（每幀更新，含 spin 旋轉） */
  function projectLoop() {
    R.raf = requestAnimationFrame(projectLoop);
    project();
  }
  function project() {
    const sc = R.scene;
    if (!sc || !sc.camera || !window.THREE) return;
    const rect = sc.getBoundingClientRect();
    if (!rect.width) return;
    const cam = sc.camera;
    /* matrixWorldInverse 只有在 renderer.render() 之後才是對的。分頁不可見時
       requestAnimationFrame 停擺、從未 render 過，投影就會算出 NaN（物件正好落在
       相機平面上）或整個偏掉。這裡自己更新一次，投影在任何時刻都正確。 */
    sc.object3D.updateMatrixWorld(true);
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    const v = new THREE.Vector3(), v2 = new THREE.Vector3();
    const right = new THREE.Vector3();
    cam.matrixWorld.extractBasis(right, new THREE.Vector3(), new THREE.Vector3());
    R.zones.forEach(function (z) {
      const el = sc.querySelector('#qo-' + z.id);
      if (!el || !el.object3D) return;
      el.object3D.getWorldPosition(v);
      v2.copy(v).addScaledVector(right, z.radius3d);
      v.project(cam); v2.project(cam);
      const x = (v.x * 0.5 + 0.5) * rect.width;
      const y = (-v.y * 0.5 + 0.5) * rect.height;
      const x2 = (v2.x * 0.5 + 0.5) * rect.width;
      /* 相機投影矩陣要等第一次 render 之後才正確；在那之前算出來會是 NaN／Infinity。
         這時就維持 layoutFallback() 排好的預設位置，熱區仍然點得到、拖得到。 */
      if (!isFinite(x) || !isFinite(y) || !isFinite(x2)) return;
      const rad = Math.max(10, Math.abs(x2 - x));
      z.cx = x; z.cy = y; z.rpx = Math.max(rad, 26);
      z.px = x; z.py = y; z.rad = rad;
    });
    layoutLabels(rect);
  }

  /* ── 標籤排版 ──────────────────────────────────────────────
     熱區標籤掛在 3D 物件的正下方（物件本身才看得見），但兩個物件在螢幕上
     可能很近、也可能貼著邊。這一支負責兩件事，每幀重算：
       ① 水平夾住：整顆膠囊一定完整落在 3D 框內，不會被切掉
       ② 垂直去重疊：由上往下掃，水平投影有交集就往下推一列
     最後若整疊超出下緣，就把整組往上平移。物件的命中座標（cx/cy）不受影響，
     所以拖曳判定仍然以 3D 物件的真實位置為準。 */
  function layoutLabels(rect) {
    const items = [];
    R.zones.forEach(function (z) {
      if (z.px === undefined) return;
      const w = z.el.offsetWidth || 64, h = z.el.offsetHeight || 26;
      items.push({ z: z, w: w, h: h,
                   x: Math.max(w / 2 + 3, Math.min(rect.width - w / 2 - 3, z.px)),
                   y: z.py + z.rad + 8 });
    });
    /* 推開一次可能又撞到別人，所以重複掃到收斂為止（最多四回合） */
    for (let pass = 0; pass < 4; pass++) {
      items.sort(function (a, b) { return a.y - b.y; });
      let moved = false;
      for (let i = 1; i < items.length; i++) {
        for (let j = 0; j < i; j++) {
          const a = items[j], b = items[i];
          const near = Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 3;
          if (near && b.y < a.y + a.h + 3) { b.y = a.y + a.h + 3; moved = true; }
        }
      }
      if (!moved) break;
    }
    /* 拖曳題的下緣要留給那顆可拖的粒子，標籤不能壓到它 */
    const bottom = rect.height - 3 - (R.q && R.q.type === 'drag3d' ? 46 : 0);
    let over = 0;
    items.forEach(function (it) { over = Math.max(over, it.y + it.h - bottom); });
    items.forEach(function (it) {
      const y = Math.max(3, Math.min(bottom - it.h, it.y - over));
      it.z.el.style.left = it.x + 'px';
      it.z.el.style.top = y + 'px';
    });
  }

  /* 3D 還沒投影出來之前的預設熱區位置：沿著畫面均勻鋪開，永遠可點 */
  function layoutFallback(wrap) {
    const r = wrap.getBoundingClientRect();
    const n = R.zones.length || 1;
    R.zones.forEach(function (z, i) {
      const fx = (i + 1) / (n + 1), fy = 0.5 + (i % 2 ? 0.16 : -0.16);
      z.el.style.left = (fx * 100) + '%';
      z.el.style.top = ((fy + 0.10) * 100) + '%';
      z.cx = fx * r.width; z.cy = fy * r.height; z.rpx = 30;
    });
  }

  /* ═══════════ 題型 1／2：AR 互動題（點選 3D 物件 ／ 拖曳） ═══════════ */
  function renderTap(stage, q) {
    stage.innerHTML =
      '<div class="q3d-wrap"><div class="q3d-host"></div><div class="q3d-zones"></div>' +
      '<p class="q3d-cue">' + esc(q.cue || '點選畫面中的 3D 物件作答') + '</p></div>';
    const host = stage.querySelector('.q3d-host');
    const zwrap = stage.querySelector('.q3d-zones');
    R.scene = build3D(host, q);
    R.zones = (q.objs || []).filter(o => o.label).map(function (o) {
      const b = document.createElement('button');
      b.className = 'q3d-zone';
      b.type = 'button';
      b.dataset.id = o.id;
      b.textContent = o.label;
      zwrap.appendChild(b);
      const z = { id: o.id, el: b, obj: o, radius3d: o.r || Math.max(o.w || 0, o.h || 0) / 2 || 0.13 };
      b.addEventListener('click', function () { pick(o.id); });
      return z;
    });
    layoutFallback(stage.querySelector('.q3d-wrap'));
    projectLoop();
  }

  function renderDrag(stage, q) {
    stage.innerHTML =
      '<div class="q3d-wrap"><div class="q3d-host"></div><div class="q3d-zones"></div>' +
      '<div class="q3d-chip" id="q-chip">' + esc(q.chip.label) + '</div>' +
      '<p class="q3d-cue">' + esc(q.cue || '把下面的粒子拖到正確的位置') + '</p></div>';
    const host = stage.querySelector('.q3d-host');
    const zwrap = stage.querySelector('.q3d-zones');
    R.scene = build3D(host, q);
    R.zones = (q.objs || []).filter(o => o.label).map(function (o) {
      const b = document.createElement('div');
      b.className = 'q3d-zone drop';
      b.dataset.id = o.id;
      b.textContent = o.label;
      zwrap.appendChild(b);
      return { id: o.id, el: b, obj: o, radius3d: o.r || 0.16 };
    });
    layoutFallback(stage.querySelector('.q3d-wrap'));
    projectLoop();
    bindDrag(stage.querySelector('#q-chip'), stage.querySelector('.q3d-wrap'));
  }

  function bindDrag(chip, wrap) {
    R.chip = chip;
    let dragging = false, home = null;
    const start = function (e) {
      if (R.done) return;
      dragging = true;
      chip.classList.add('drag');
      if (!home) home = { l: chip.offsetLeft, t: chip.offsetTop };
      try { chip.setPointerCapture(e.pointerId); } catch (err) {}
      move(e);
      e.preventDefault();
    };
    const move = function (e) {
      if (!dragging) return;
      const r = wrap.getBoundingClientRect();
      chip.style.left = (e.clientX - r.left) + 'px';
      chip.style.top = (e.clientY - r.top) + 'px';
      chip.style.transform = 'translate(-50%,-50%)';
      const near = nearestZone(e.clientX - r.left, e.clientY - r.top);
      R.zones.forEach(z => z.el.classList.toggle('over', !!near && z.id === near.id));
    };
    const end = function (e) {
      if (!dragging) return;
      dragging = false;
      chip.classList.remove('drag');
      const r = wrap.getBoundingClientRect();
      const near = nearestZone(e.clientX - r.left, e.clientY - r.top);
      R.zones.forEach(z => z.el.classList.remove('over'));
      if (near) { pick(near.id); }
      else if (home) { chip.style.left = home.l + 'px'; chip.style.top = home.t + 'px'; chip.style.transform = ''; }
    };
    chip.addEventListener('pointerdown', start);
    chip.addEventListener('pointermove', move);
    chip.addEventListener('pointerup', end);
    chip.addEventListener('pointercancel', end);
  }

  function nearestZone(x, y) {
    let best = null, bd = 1e9;
    R.zones.forEach(function (z) {
      if (z.cx === undefined) return;
      const d = Math.hypot(z.cx - x, z.cy - y);
      if (d < bd) { bd = d; best = z; }
    });
    return (best && bd <= Math.max(52, best.rpx + 26)) ? best : null;
  }

  /* ═══════════ 題型 3：動畫影片題 ═══════════ */
  function renderAnim(stage, q) {
    const m = ANIMS.meta(q.anim);
    const ask = q.ask || 'time';
    stage.innerHTML =
      '<div class="qanim">' +
      '<canvas class="qanim-cv" width="680" height="380"></canvas>' +
      (ask === 'pick' ? '<div class="qanim-regions"></div>' : '') +
      '<div class="qanim-bar">' +
        '<button type="button" class="qanim-play">⏸ 暫停</button>' +
        '<div class="qanim-track"><div class="qanim-fill"></div><div class="qanim-head"></div>' +
        (ask === 'time' ? '<div class="qanim-marks"></div>' : '') + '</div>' +
        '<span class="qanim-time">0.0s</span>' +
        '<button type="button" class="qanim-replay">↻ 重播</button>' +
      '</div>' +
      '<p class="q3d-cue">' + esc(q.cue ||
        (ask === 'time' ? '看完動畫後，點時間軸上「那一刻」的位置' : '看完動畫後，點畫面中正確的那一段')) +
      '</p></div>';

    const cv = stage.querySelector('.qanim-cv');
    const ctx = cv.getContext('2d');
    const W = 340, H = 190;
    cv.width = W * 2; cv.height = H * 2;
    ctx.setTransform(2, 0, 0, 2, 0, 0);

    const track = stage.querySelector('.qanim-track');
    const fill = stage.querySelector('.qanim-fill');
    const head = stage.querySelector('.qanim-head');
    const tEl = stage.querySelector('.qanim-time');
    const playBtn = stage.querySelector('.qanim-play');

    const A = { p: 0, playing: true, dur: m.dur, t0: performance.now(), raf: 0, seen: false };
    R.anim = A;

    function paint() {
      ctx.clearRect(0, 0, W, H);
      ANIMS.draw(q.anim, ctx, A.p, W, H);
      fill.style.width = (A.p * 100) + '%';
      head.style.left = (A.p * 100) + '%';
      tEl.textContent = (A.p * A.dur).toFixed(1) + 's';
    }
    function tick() {
      A.raf = requestAnimationFrame(tick);
      if (A.playing) {
        const now = performance.now();
        A.p += (now - A.t0) / 1000 / A.dur;
        A.t0 = now;
        if (A.p >= 1) { A.p = 1; A.playing = false; A.seen = true; playBtn.textContent = '▶ 播放'; }
      }
      paint();
    }
    A.seek = function (p) { A.p = Math.max(0, Math.min(1, p)); A.t0 = performance.now(); paint(); };
    A.stop = function () { if (A.raf) cancelAnimationFrame(A.raf); A.raf = 0; };
    tick();

    playBtn.addEventListener('click', function () {
      A.playing = !A.playing; A.t0 = performance.now();
      playBtn.textContent = A.playing ? '⏸ 暫停' : '▶ 播放';
    });
    stage.querySelector('.qanim-replay').addEventListener('click', function () {
      A.p = 0; A.playing = true; A.t0 = performance.now(); playBtn.textContent = '⏸ 暫停';
    });

    if (ask === 'time') {
      /* 時間軸：先拖曳預覽（scrub），放開才算作答 */
      let scrubbing = false;
      const pOf = e => {
        const r = track.getBoundingClientRect();
        return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      };
      track.addEventListener('pointerdown', function (e) {
        if (R.done) return;
        scrubbing = true; A.playing = false; playBtn.textContent = '▶ 播放';
        try { track.setPointerCapture(e.pointerId); } catch (err) {}
        A.seek(pOf(e)); e.preventDefault();
      });
      track.addEventListener('pointermove', function (e) { if (scrubbing) A.seek(pOf(e)); });
      track.addEventListener('pointerup', function (e) {
        if (!scrubbing) return;
        scrubbing = false;
        A.seek(pOf(e));
        answerTime(A.p);
      });
      track.addEventListener('pointercancel', function () { scrubbing = false; });
      /* 刻度：讓玩家知道時間軸可以點 */
      const marks = stage.querySelector('.qanim-marks');
      for (let i = 1; i < 10; i++) {
        const s = document.createElement('i');
        s.style.left = (i * 10) + '%';
        marks.appendChild(s);
      }
    } else {
      const rw = stage.querySelector('.qanim-regions');
      (q.regions || []).forEach(function (rg) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'qanim-region';
        b.dataset.id = rg.id;
        b.style.left = (rg.x * 100) + '%';
        b.style.top = (rg.y * 100) + '%';
        b.style.width = (rg.w * 100) + '%';
        b.style.height = (rg.h * 100) + '%';
        b.innerHTML = '<span>' + esc(rg.label) + '</span>';
        b.addEventListener('click', function () { pick(rg.id); });
        rw.appendChild(b);
      });
    }
  }

  function answerTime(p) {
    const q = R.q;
    const m = ANIMS.meta(q.anim);
    const key = q.key !== undefined ? q.key : m.key;
    const tol = q.tol !== undefined ? q.tol : (m.tol || 0.08);
    const ok = Math.abs(p - key) <= tol;
    const stage = $('#quiz-stage');
    const head = stage.querySelector('.qanim-head');
    if (ok) {
      const mark = document.createElement('div');
      mark.className = 'qanim-key';
      mark.style.left = (key * 100) + '%';
      stage.querySelector('.qanim-track').appendChild(mark);
      if (head) head.classList.add('ok');
      finish(true);
    } else {
      if (head) { head.classList.remove('bad'); void head.offsetWidth; head.classList.add('bad'); }
      finish(false, p < key ? '再往後一點——那一刻還沒發生。' : '有點太後面了——關鍵變化在這之前就開始了。');
    }
  }

  /* ═══════════ 題型 4：步驟卡拖曳排序 ═══════════ */
  function renderOrder(stage, q) {
    R.order = q.cards.map(c => c.id);
    /* 固定亂序（同一題永遠一樣，可重現） */
    const shuffled = (q.shuffle || q.cards.map(c => c.id).slice().reverse());
    R.order = shuffled.slice();
    stage.innerHTML =
      '<div class="qorder"><div class="qorder-list"></div>' +
      '<button type="button" class="btn primary qorder-go">送出順序</button>' +
      '<p class="q3d-cue">' + esc(q.cue || '長按卡片上下拖曳，排成正確的反應順序') + '</p></div>';
    const list = stage.querySelector('.qorder-list');
    paintOrder(list, q);
    stage.querySelector('.qorder-go').addEventListener('click', function () {
      if (R.done) return;
      const ok = R.order.join(',') === q.answer.join(',');
      if (!ok) {
        let firstBad = -1;
        for (let i = 0; i < q.answer.length; i++) if (R.order[i] !== q.answer[i]) { firstBad = i; break; }
        const el = list.querySelector('[data-id="' + R.order[firstBad] + '"]');
        if (el) { el.classList.remove('bad'); void el.offsetWidth; el.classList.add('bad'); }
        finish(false, '第 ' + (firstBad + 1) + ' 張排錯了。' + (q.tipOrder || ''));
      } else {
        list.querySelectorAll('.qcard').forEach(function (e, i) {
          setTimeout(function () { e.classList.add('ok'); }, i * 120);
        });
        finish(true);
      }
    });
  }

  function paintOrder(list, q) {
    list.innerHTML = R.order.map(function (id, i) {
      const c = q.cards.find(x => x.id === id);
      return '<div class="qcard" data-id="' + id + '" draggable="false">' +
             '<span class="qcard-n">' + (i + 1) + '</span>' +
             '<span class="qcard-b"><b>' + esc(c.label) + '</b>' +
             (c.sub ? '<i>' + esc(c.sub) + '</i>' : '') + '</span>' +
             '<span class="qcard-grip">≡</span></div>';
    }).join('');
    list.querySelectorAll('.qcard').forEach(function (el) { bindCard(el, list, q); });
  }

  function bindCard(el, list, q) {
    let from = -1, dragging = false;
    el.addEventListener('pointerdown', function (e) {
      if (R.done) return;
      dragging = true;
      from = R.order.indexOf(el.dataset.id);
      el.classList.add('lift');
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });
    el.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      const cards = Array.from(list.querySelectorAll('.qcard'));
      const h = el.offsetHeight + 8;
      const lr = list.getBoundingClientRect();
      let to = Math.round((e.clientY - lr.top - h / 2) / h);
      to = Math.max(0, Math.min(cards.length - 1, to));
      const cur = R.order.indexOf(el.dataset.id);
      if (to !== cur) {
        R.order.splice(cur, 1);
        R.order.splice(to, 0, el.dataset.id);
        paintOrder(list, q);
        const again = list.querySelector('[data-id="' + el.dataset.id + '"]');
        if (again) {
          again.classList.add('lift');
          try { again.setPointerCapture(e.pointerId); } catch (err) {}
        }
      }
    });
    const up = function () { dragging = false; el.classList.remove('lift'); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  /* ═══════════ 作答判定與回饋 ═══════════ */
  function pick(id) {
    if (R.done) return false;
    const q = R.q;
    const o = (q.objs || []).concat(q.regions || []).find(x => x.id === id);
    if (!o) return false;
    if (o.correct) {
      glow(id);
      finish(true);
      return true;
    }
    shake(id);
    if (R.wrongIds.indexOf(id) < 0) R.wrongIds.push(id);
    finish(false, o.tip || q.tip);
    return false;
  }

  function zoneEl(id) { const z = R.zones.find(x => x.id === id); return z ? z.el : null; }

  function glow(id) {
    const el = R.scene && R.scene.querySelector('#qo-' + id);
    if (el) {
      el.setAttribute('animation__ok',
        'property: scale; from: 1 1 1; to: 1.35 1.35 1.35; dir: alternate; dur: 320; loop: 3');
      try { el.getObject3D('mesh').material.emissive.set('#C99A3E'); } catch (e) {}
    }
    const z = zoneEl(id) || document.querySelector('.qanim-region[data-id="' + id + '"]');
    if (z) z.classList.add('ok');
  }
  function shake(id) {
    const el = R.scene && R.scene.querySelector('#qo-' + id);
    if (el) {
      el.removeAttribute('animation__no');
      el.setAttribute('animation__no',
        'property: rotation; from: 0 -16 0; to: 0 16 0; dir: alternate; dur: 110; loop: 5');
    }
    const z = zoneEl(id) || document.querySelector('.qanim-region[data-id="' + id + '"]');
    if (z) { z.classList.remove('bad'); void z.offsetWidth; z.classList.add('bad'); }
  }

  function finish(ok, hintText) {
    if (ok) R.done = true;
    if (R.onAnswer) R.onAnswer(ok, hintText || R.q.tip);
    try { if (navigator.vibrate) navigator.vibrate(ok ? 60 : [40, 30, 40]); } catch (e) {}
  }

  function esc(t) {
    return String(t === undefined || t === null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ═══════════ 對外介面 ═══════════ */
  function render(stage, q, onAnswer) {
    teardown();
    R.q = q; R.onAnswer = onAnswer; R.done = false; R.zones = []; R.wrongIds = [];
    switch (q.type) {
      case 'drag3d': renderDrag(stage, q); break;
      case 'anim':   renderAnim(stage, q); break;
      case 'order':  renderOrder(stage, q); break;
      default:       renderTap(stage, q); break;
    }
    return R;
  }

  function teardown() {
    disposeScene();
    if (R.anim && R.anim.stop) R.anim.stop();
    R.anim = null; R.zones = []; R.chip = null; R.q = null; R.done = false;
  }

  /* 驗收掛鉤：允許程式化作答（真的走同一條判定路徑） */
  const test = {
    state: () => ({ type: R.q && R.q.type, done: R.done, order: R.order.slice(),
                    zones: R.zones.map(z => z.id), p: R.anim ? R.anim.p : null }),
    pick: pick,
    tapZone: function (id) { const e = zoneEl(id) || document.querySelector('.qanim-region[data-id="' + id + '"]'); if (e) e.click(); return !!e; },
    /* 用真的 pointer 事件序列把 chip 拖到某個熱區 —— 拖曳題的自動驗收 */
    dragTo: function (id) {
      const z = R.zones.find(x => x.id === id);
      if (!z || !R.chip) return false;
      const wrap = document.querySelector('.q3d-wrap');
      const wr = wrap.getBoundingClientRect();
      const cr = R.chip.getBoundingClientRect();
      const ev = (t, x, y) => R.chip.dispatchEvent(new PointerEvent(t, {
        bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch',
        clientX: x, clientY: y }));
      ev('pointerdown', cr.left + cr.width / 2, cr.top + cr.height / 2);
      ev('pointermove', wr.left + z.cx, wr.top + z.cy - 4);
      ev('pointermove', wr.left + z.cx, wr.top + z.cy);
      ev('pointerup', wr.left + z.cx, wr.top + z.cy);
      return true;
    },
    seek: function (p) { if (R.anim) R.anim.seek(p); return R.anim ? R.anim.p : null; },
    /* 在時間軸上以 pointer 事件點下某個進度（0–1） */
    tapTime: function (p) {
      const track = document.querySelector('.qanim-track');
      if (!track) return false;
      const r = track.getBoundingClientRect();
      const x = r.left + r.width * Math.max(0, Math.min(1, p));
      const y = r.top + r.height / 2;
      const ev = t => track.dispatchEvent(new PointerEvent(t, {
        bubbles: true, cancelable: true, pointerId: 9, pointerType: 'touch', clientX: x, clientY: y }));
      ev('pointerdown'); ev('pointermove'); ev('pointerup');
      return true;
    },
    keyOf: function (q) {
      const m = ANIMS.meta(q.anim);
      return { key: q.key !== undefined ? q.key : m.key, tol: q.tol !== undefined ? q.tol : m.tol };
    },
    setOrder: function (ids) {
      R.order = ids.slice();
      const list = document.querySelector('.qorder-list');
      if (list) paintOrder(list, R.q);
      return R.order.slice();
    },
    /* 用真的 pointer 事件把某張卡拖到指定位置 —— 排序題的自動驗收 */
    dragCard: function (id, to) {
      const list = document.querySelector('.qorder-list');
      const el = list && list.querySelector('[data-id="' + id + '"]');
      if (!el) return false;
      const lr = list.getBoundingClientRect();
      const h = el.offsetHeight + 8;
      const y = lr.top + to * h + h / 2;
      const x = lr.left + lr.width / 2;
      const send = (t, node, cy) => node.dispatchEvent(new PointerEvent(t, {
        bubbles: true, cancelable: true, pointerId: 11, pointerType: 'touch', clientX: x, clientY: cy }));
      send('pointerdown', el, el.getBoundingClientRect().top + h / 2);
      const now = list.querySelector('[data-id="' + id + '"]');
      send('pointermove', now, y);
      const now2 = list.querySelector('[data-id="' + id + '"]');
      send('pointerup', now2, y);
      return true;
    },
    submit: function () {
      const b = document.querySelector('.qorder-go');
      if (b) { b.click(); return true; }
      return false;
    },
    scene: () => R.scene,
    /* 同步跑一次投影：自動化驗收時 rAF 可能被瀏覽器節流（分頁不可見），
       先叫這一支把熱區座標算出來，拖曳／點擊模擬才有正確的目標位置。 */
    project: function () { project(); return R.zones.map(z => ({ id: z.id, cx: z.cx, cy: z.cy })); },
    zoneRects: () => R.zones.map(z => ({ id: z.id, cx: z.cx, cy: z.cy, rpx: z.rpx }))
  };

  return { render: render, teardown: teardown, pick: pick, C: C, test: test,
           state: () => ({ type: R.q && R.q.type, done: R.done }) };
})();
