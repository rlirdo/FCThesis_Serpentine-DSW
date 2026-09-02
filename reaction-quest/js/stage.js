/* 蛇紋石改質反應探險 — 懸浮舞台（卡片即舞台）v2.0
   ══════════════════════════════════════════════════════════════════
   ── 架構：一個場景、一條串流、兩種掛法 ──────────────────────────
   v1.x 是「走 2D 迷宮 → 到終點才開相機掃一次卡 → 回到 2D 教學頁」。
   v2.0 全程都在相機畫面裡，而且內容真的「站在卡片上」：

     單一 <a-scene>（整場只建一次，不隨關卡重建）
       ├─ <a-camera>                MindAR 只改投影矩陣，相機本體永遠在原點
       ├─ #anchor0  targetIndex 0   本關專屬關鍵圖片
       ├─ #anchor1  targetIndex 1   萬用卡（12 個 .mind 都內含，不必重編）
       ├─ #freeRig                  螢幕空間懸浮（fallback）＋陀螺儀視差
       └─ #holder → #stage          所有內容：主角、代幣、看板、關鍵物件、粒子

   #stage 的 object3D 會在 #anchor0／#anchor1／#freeRig 之間搬家
   （THREE 的 Object3D.add 會自動把物件從舊父節點移除，所以不會有第二份實例，
     DOM 完全不動 → A-Frame 元件不會被重新初始化 → 遊戲狀態永不重置）。

   ── 卡片座標系 ────────────────────────────────────────────────
   MindAR 的錨點空間：卡片寬 = 1 單位，卡面就是 XY 平面，+Z 指向卡片外。
   我們把 #stage 繞 X 轉 +90°，於是「模型的 Y 軸」對到「卡片外」＝ 站起來，
   而 stage 的 X／Z 兩軸剛好貼在卡面上，成為主角滑行的棋盤：
     X → 卡片左右　　Z → 卡片上下（+Z 是卡片影像的下緣方向）
   free 模式沿用同一組座標，只是把整塊棋盤往鏡頭前一擺、前傾 50°，
   所以「碰撞、邊界夾持、D-pad 語意」兩種模式共用同一份程式碼。

   ── 中文字為什麼走 canvas 貼圖 ───────────────────────────────
   A-Frame 的 <a-text> 用 MSDF 字型圖集，沒有中日韓字。
   所有看板、代幣標籤、題目與選項一律先畫在 canvas 上，
   再以 THREE.CanvasTexture 貼到平面 —— 中文完全正常，且可任意換字。 */
window.STAGE = (function () {

  var T = null;                     // AFRAME.THREE
  var sceneEl = null, camEl = null, hostEl = null;
  var anchor0 = null, anchor1 = null, freeRig = null, stageEl = null, uiEl = null;
  var mode = 'free';                // 'card' | 'free'
  var activeAnchor = 0;
  var raf = 0, last = 0;
  var hitObjects = [];              // 可點擊的 THREE 物件
  var mats = [];                    // stage 內所有材質（淡入淡出用）
  var fadeT = null;
  var switchLock = 0;               // 防抖：避免 found/lost 抖動造成的來回切換
  var noMind = false;               // 無相機降級：不啟動 MindAR
  var powerSave = false;
  var trackingOn = false;
  var expandedLevels = {};          // 每一關的「舞台展開」只播一次

  var C = { navy: '#0B1F3A', deep: '#065A82', teal: '#1C7293', green: '#2E7D5B',
            moss: '#5FA98A', gold: '#C99A3E', ink: '#1E293B', grey: '#64748B',
            paper: '#F5F9FA', white: '#FFFFFF', red: '#B03E34' };
  var FF = '"Microsoft JhengHei","Noto Sans TC","PingFang TC",sans-serif';

  /* 棋盤邊界（卡片寬 1 單位，留邊） */
  var LIM = 0.42;

  /* ══════════════ 主角 ══════════════ */
  var hero = {
    el: null, yawEl: null, bodyEl: null,
    x: 0, z: -0.38, tx: 0, tz: -0.38, y: 0.06,
    yaw: 0, tyaw: 0, moving: false, walk: 0,
    anim: 'idle', animT: 0
  };
  var tokens = [];                  // {group, mesh, label, got, bx, bz, phase}
  var particles = null, pAttr = null, pData = [], pCount = 0;
  var boards = [];                  // 目前的看板 mesh 陣列
  var keyObjEl = null, platform = null;
  var quizGroup = null;

  function log() {
    var a = ['[STAGE]'].concat(Array.prototype.slice.call(arguments));
    console.log.apply(console, a);
  }

  /* ══════════════ canvas 文字工具 ══════════════ */
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  /* 中文以「逐字量測」斷行（沒有空白可依，不能用 split(' ')） */
  function wrap(g, text, maxW) {
    var out = [], line = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === '\n') { out.push(line); line = ''; continue; }
      if (g.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; }
      else line += ch;
    }
    if (line) out.push(line);
    return out;
  }

  /* 畫一張看板：回傳 canvas（512 寬，高度自動） */
  function drawBoard(o) {
    var W = 640, PAD = 34;
    var cv = document.createElement('canvas');
    var g = cv.getContext('2d');
    var innerW = W - PAD * 2;
    /* 先量高度 */
    var lines = [];
    g.font = '600 25px ' + FF;
    (o.lines || []).forEach(function (s) {
      wrap(g, s, innerW).forEach(function (l) { lines.push(l); });
      lines.push('');
    });
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    g.font = 'bold 34px ' + FF;
    var tLines = o.title ? wrap(g, o.title, innerW) : [];
    var H = PAD * 2 + (o.kicker ? 30 : 0) + tLines.length * 42 + (tLines.length ? 14 : 0) +
            lines.length * 36 + (o.tag ? 40 : 0);
    H = Math.max(120, H);
    cv.width = W; cv.height = H;
    g = cv.getContext('2d');

    var dark = o.theme !== 'light';
    g.clearRect(0, 0, W, H);
    roundRect(g, 4, 4, W - 8, H - 8, 26);
    g.fillStyle = dark ? 'rgba(11,31,58,0.90)' : 'rgba(245,249,250,0.95)';
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = o.accent || C.moss;
    g.stroke();
    /* 左側色帶 */
    roundRect(g, 4, 4, 12, H - 8, 6);
    g.fillStyle = o.accent || C.moss; g.fill();

    var y = PAD + 6;
    if (o.kicker) {
      g.font = 'bold 20px ' + FF; g.fillStyle = o.accent || C.moss;
      g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText(o.kicker, PAD, y); y += 30;
    }
    if (tLines.length) {
      g.font = 'bold 34px ' + FF; g.fillStyle = dark ? '#FFFFFF' : C.navy;
      g.textAlign = 'left'; g.textBaseline = 'top';
      tLines.forEach(function (l) { g.fillText(l, PAD, y); y += 42; });
      y += 14;
    }
    g.font = '600 25px ' + FF; g.fillStyle = dark ? '#DCE7EC' : C.ink;
    lines.forEach(function (l) { g.fillText(l, PAD, y); y += 36; });
    if (o.tag) {
      g.font = 'bold 21px ' + FF;
      var tw = g.measureText(o.tag).width;
      roundRect(g, PAD, y + 4, tw + 26, 32, 16);
      g.fillStyle = C.gold; g.fill();
      g.fillStyle = C.navy; g.fillText(o.tag, PAD + 13, y + 10);
    }
    return cv;
  }

  /* 小標籤（代幣名、排序編號…）：canvas 貼齊文字寬度，字級才不會被留白稀釋 */
  function drawChip(text, accent, sub) {
    var g0 = document.createElement('canvas').getContext('2d');
    g0.font = 'bold 40px ' + FF;
    var w = Math.ceil(g0.measureText(text).width);
    var sw = 0;
    if (sub) { g0.font = '600 28px ' + FF; sw = Math.ceil(g0.measureText(sub).width); }
    var W = Math.max(w, sw) + 56, H = sub ? 128 : 80;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    roundRect(g, 3, 3, W - 6, H - 6, H / 2.6);
    g.fillStyle = 'rgba(11,31,58,0.88)'; g.fill();
    g.lineWidth = 4; g.strokeStyle = accent || C.gold; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 40px ' + FF; g.fillStyle = '#FFFFFF';
    g.fillText(text, W / 2, sub ? 44 : H / 2);
    if (sub) { g.font = '600 28px ' + FF; g.fillStyle = accent || C.gold;
               g.fillText(sub, W / 2, 92); }
    return cv;
  }

  function texFrom(cv) {
    var t = new T.CanvasTexture(cv);
    t.needsUpdate = true;
    if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace;
    else if (T.sRGBEncoding) t.encoding = T.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  }
  /* canvas → 面向鏡頭的懸浮平面 */
  function planeFrom(cv, width, opts) {
    var o = opts || {};
    var h = width * cv.height / cv.width;
    var geo = new T.PlaneGeometry(width, h);
    var mat = new T.MeshBasicMaterial({ map: texFrom(cv), transparent: true,
                                        side: T.DoubleSide, depthWrite: false });
    var m = new T.Mesh(geo, mat);
    m.renderOrder = o.order || 10;
    m.userData.faceCam = o.faceCam !== false;
    m.userData.baseOpacity = 1;
    return m;
  }

  /* ══════════════ 場景建立 ══════════════ */
  function buildSceneHTML(mindSrc, charId) {
    var mind = mindSrc
      ? ' mindar-image="imageTargetSrc: ' + mindSrc +
        '; autoStart: false; uiScanning: no; uiLoading: no; uiError: no' +
        '; filterMinCF: 0.0001; filterBeta: 0.005; missTolerance: 12; warmupTolerance: 1"'
      : '';
    return '<a-scene' + mind +
      ' embedded vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false"' +
      ' loading-screen="enabled: false" background="transparent: true"' +
      ' renderer="alpha: true; antialias: false; colorManagement: true; precision: mediump">' +
      '<a-camera id="rq-cam" fov="55" position="0 0 0" look-controls="enabled: false"' +
      ' wasd-controls="enabled: false" cursor="fuse: false"></a-camera>' +
      '<a-entity id="rq-a0" mindar-image-target="targetIndex: 0"></a-entity>' +
      '<a-entity id="rq-a1" mindar-image-target="targetIndex: 1"></a-entity>' +
      '<a-entity id="rq-free" position="0 0.06 -1.30"></a-entity>' +
      '<a-entity id="rq-holder">' +
        '<a-entity id="rq-ui"></a-entity>' +
        '<a-entity id="rq-stage">' +
          '<a-entity id="rq-hero-yaw"><a-entity id="rq-hero-body">' +
            (window.CHAR3D ? CHAR3D.rigHTML(charId) : '') +
          '</a-entity></a-entity>' +
          '<a-entity id="rq-keyobj" visible="false"></a-entity>' +
        '</a-entity>' +
      '</a-entity>' +
      '<a-entity light="type: ambient; color: #FFFFFF; intensity: 0.95"></a-entity>' +
      '<a-entity light="type: directional; color: #FFFFFF; intensity: 0.55" position="1 2 1.4"></a-entity>' +
      '</a-scene>';
  }

  /* opts: {host, mindSrc, charId, stream, onFound, onLost} */
  function init(opts) {
    T = window.AFRAME && AFRAME.THREE;
    if (!T) throw new Error('A-Frame 未載入');
    hostEl = opts.host;
    noMind = !opts.mindSrc;
    hostEl.innerHTML = buildSceneHTML(opts.mindSrc, opts.charId || 'mimi');
    sceneEl = hostEl.querySelector('a-scene');
    return new Promise(function (res) {
      if (sceneEl.hasLoaded) res(); else sceneEl.addEventListener('loaded', res, { once: true });
    }).then(function () {
      camEl = sceneEl.querySelector('#rq-cam');
      anchor0 = sceneEl.querySelector('#rq-a0');
      anchor1 = sceneEl.querySelector('#rq-a1');
      freeRig = sceneEl.querySelector('#rq-free');
      stageEl = sceneEl.querySelector('#rq-stage');
      uiEl = sceneEl.querySelector('#rq-ui');
      hero.yawEl = sceneEl.querySelector('#rq-hero-yaw');
      hero.bodyEl = sceneEl.querySelector('#rq-hero-body');
      keyObjEl = sceneEl.querySelector('#rq-keyobj');

      try {
        sceneEl.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        sceneEl.renderer.shadowMap.enabled = false;
      } catch (e) {}

      buildPlatform();
      buildParticles();
      syncFreeRig();
      setMode('free', false);
      bindTaps();
      hookAnchors(opts.onFound, opts.onLost);
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }

      if (!noMind) return startTracking(opts.stream);
      return true;
    });
  }

  /* ══════════════ 螢幕懸浮群組的距離校正 ══════════════
     MindAR 的世界單位是「目標圖片的像素」，它會把相機 near 設成 10、far 設成 1e5，
     fov 也改成相機實際視角。v2.0 原本把 #freeRig 放在 z = -1.30（A-Frame 預設 near 0.005
     的世界），MindAR 一啟動就整組落在近平面之內 → 被裁掉，畫面只剩相機影像。
     這裡改成「依 near 推距離、再依 fov 反推縮放」，使投影後的螢幕尺寸與調校時完全一致。 */
  var FREE_D0 = 1.30, FREE_FOV0 = 55, FREE_Y0 = 0.06;
  function syncFreeRig() {
    if (!freeRig || !sceneEl || !sceneEl.camera) return null;
    var cam = sceneEl.camera;
    var near = cam.near || 0.005;
    var d = Math.max(FREE_D0, near * 3);
    var fov = cam.fov || FREE_FOV0;
    var k = (d * Math.tan(fov * Math.PI / 360)) /
            (FREE_D0 * Math.tan(FREE_FOV0 * Math.PI / 360));
    freeRig.object3D.position.set(0, FREE_Y0 * k, -d);
    freeRig.object3D.scale.setScalar(k);
    return { d: d, k: k, near: near, fov: fov };
  }

  /* ══════════════ MindAR：整關持續追蹤 ══════════════ */
  function startTracking(stream) {
    var sys = sceneEl.systems['mindar-image-system'];
    if (!sys) throw new Error('MindAR 系統未載入');
    /* 沿用 v1.1 的單一串流策略：MindAR 不再自己 getUserMedia，
       直接用「開始冒險」手勢內預檢拿到的同一條 MediaStream。 */
    if (stream && stream.getVideoTracks && stream.getVideoTracks().length) {
      sys._startVideo = function () {
        var v = document.createElement('video');
        v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
        v.setAttribute('muted', ''); v.setAttribute('autoplay', '');
        v.muted = true; v.defaultMuted = true; v.playsInline = true;
        v.style.position = 'absolute'; v.style.top = '0px'; v.style.left = '0px';
        v.style.zIndex = '-2'; v.style.objectFit = 'cover';
        this.container = this.container || hostEl;
        this.container.appendChild(v);
        this.video = v;
        var self = this;
        var go = function () {
          v.setAttribute('width', v.videoWidth);
          v.setAttribute('height', v.videoHeight);
          try { self._startAR(); } catch (e) { log('_startAR error', e); }
        };
        v.addEventListener('loadedmetadata', go, { once: true });
        v.srcObject = stream;
        var p = v.play();
        if (p && p.then) p.then(function () {
          if (v.videoWidth && v.readyState >= 1 && !self.controller) go();
        }).catch(function (e) { log('mind video play rejected', e); });
      };
    }
    sceneEl.addEventListener('arReady', function () {
      var f = syncFreeRig();
      log('arReady, freeRig synced', f);
    });
    window.addEventListener('resize', function () { setTimeout(syncFreeRig, 60); });
    sys.start();
    trackingOn = true;
    log('tracking started');
    return true;
  }

  /* 換關：不重建場景、不動相機串流，只把 controller 換掉重掛新的 .mind */
  function retarget(mindSrc) {
    if (noMind || !sceneEl) return Promise.resolve(false);
    var sys = sceneEl.systems['mindar-image-system'];
    if (!sys || !sys.video) return Promise.resolve(false);
    try { sys.controller && sys.controller.stopProcessVideo(); } catch (e) {}
    try { sys.controller && sys.controller.dispose && sys.controller.dispose(); } catch (e) {}
    sys.imageTargetSrc = mindSrc;
    /* MindAR 的 _startAR 每次都會再掛一個 window resize 監聽器；
       換關十次就會累積十個。這裡在它執行期間暫時擋掉 resize 註冊。 */
    var origAdd = window.addEventListener;
    window.addEventListener = function (t2, f, o) {
      if (t2 === 'resize') return;
      return origAdd.call(window, t2, f, o);
    };
    return Promise.resolve()
      .then(function () { return sys._startAR(); })
      .then(function () {
        window.addEventListener = origAdd;
        trackingOn = true;
        syncFreeRig();
        log('retargeted →', mindSrc);
        return true;
      })
      .catch(function (e) {
        window.addEventListener = origAdd;
        log('retarget failed', e);
        return false;
      });
  }

  /* 省電模式：停止逐幀影像辨識，內容留在螢幕懸浮 */
  function setPowerSave(v) {
    powerSave = !!v;
    var sys = sceneEl && sceneEl.systems['mindar-image-system'];
    if (!sys || !sys.controller) return powerSave;
    if (powerSave) {
      try { sys.controller.stopProcessVideo(); } catch (e) {}
      trackingOn = false;
      setMode('free', true);
    } else if (sys.video) {
      try { sys.controller.processVideo(sys.video); trackingOn = true; } catch (e) {}
    }
    log('powerSave =', powerSave);
    return powerSave;
  }

  var foundCb = null, lostCb = null, everFound = false;
  function hookAnchors(onFound, onLost) {
    foundCb = onFound || null; lostCb = onLost || null;
    [[anchor0, 0], [anchor1, 1]].forEach(function (p) {
      if (!p[0]) return;
      p[0].addEventListener('targetFound', function () { onTargetFound(p[1]); });
      p[0].addEventListener('targetLost', function () { onTargetLost(p[1]); });
    });
  }
  function onTargetFound(idx) {
    activeAnchor = idx;
    everFound = true;
    log('targetFound', idx);
    if (powerSave && expandedLevels.any) return;
    if (mode !== 'card') setMode('card', true);
    if (foundCb) try { foundCb(idx); } catch (e) { log('onFound', e); }
  }
  function onTargetLost(idx) {
    log('targetLost', idx);
    if (mode !== 'free') setMode('free', true);
    if (lostCb) try { lostCb(idx); } catch (e) { log('onLost', e); }
  }

  /* ══════════════ 掛法切換（錨點 ⇄ 螢幕懸浮） ══════════════ */
  function setMode(m, animate) {
    if (!stageEl) return mode;
    var now = performance.now();
    if (m === mode && animate) return mode;
    if (animate && now - switchLock < 220) return mode;   // 抖動防護
    switchLock = now;
    mode = m;
    var parent = (m === 'card')
      ? (activeAnchor === 1 && anchor1 ? anchor1 : anchor0)
      : freeRig;
    parent.object3D.add(stageEl.object3D);                // THREE 會自動從舊父節點移除
    parent.object3D.add(uiEl.object3D);
    /* 無相機降級時錨點永遠是「未追蹤」狀態（visible=false），
       但我們仍要能以錨定版式呈現，所以手動打開可見性。 */
    if (noMind && m === 'card') parent.object3D.visible = true;
    var o = stageEl.object3D, u = uiEl.object3D;
    if (m === 'card') {
      /* 棋盤貼在卡面上；看板浮在卡片的上方偏外側 */
      o.position.set(0, 0, 0.015);
      o.rotation.set(Math.PI / 2, 0, 0);                  // 模型 Y 軸 → 卡片外，站起來
      o.scale.setScalar(1);
      u.position.set(0, 0.44, 0.62);
      u.rotation.set(0, 0, 0);
      u.scale.setScalar(0.85);
    } else {
      /* 棋盤前傾 52°（等於把卡片斜擺在鏡頭前）；看板改掛在固定距離，
         不隨棋盤傾斜，否則越高的看板會越靠近鏡頭而爆版。 */
      o.position.set(0, -0.10, 0);
      o.rotation.set(52 * Math.PI / 180, 0, 0);
      o.scale.setScalar(0.54);
      u.position.set(0, 0.30, 0.10);
      u.rotation.set(0, 0, 0);
      u.scale.setScalar(0.42);
    }
    if (animate) fadeIn(300);
    log('mode →', m);
    return mode;
  }

  function collectMats() {
    mats = [];
    if (!stageEl) return;
    [stageEl, uiEl].forEach(function (root) {
    if (!root) return;
    root.object3D.traverse(function (n) {
      if (!n.material) return;
      var arr = Array.isArray(n.material) ? n.material : [n.material];
      arr.forEach(function (mt) {
        if (mt.__baseOp === undefined) mt.__baseOp = (mt.opacity === undefined ? 1 : mt.opacity);
        mats.push(mt);
      });
    });
    });
  }
  function fadeIn(ms) {
    collectMats();
    if (fadeT) cancelAnimationFrame(fadeT);
    var t0 = performance.now();
    mats.forEach(function (mt) { mt.transparent = true; mt.opacity = 0; });
    var run = function () {
      var k = Math.min(1, (performance.now() - t0) / ms);
      mats.forEach(function (mt) { mt.opacity = mt.__baseOp * k; });
      if (k < 1) fadeT = requestAnimationFrame(run);
      else { fadeT = null; mats.forEach(function (mt) {
        mt.opacity = mt.__baseOp;
        if (mt.__baseOp >= 1 && !mt.__keepTransparent) mt.transparent = false;
      }); }
    };
    fadeT = requestAnimationFrame(run);
  }

  /* ══════════════ 全像平台（主角腳下） ══════════════ */
  function buildPlatform() {
    platform = new T.Group();
    var disc = new T.Mesh(
      new T.CircleGeometry(0.135, 28),
      new T.MeshBasicMaterial({ color: 0x1C7293, transparent: true, opacity: 0.20,
                                side: T.DoubleSide, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    disc.material.__keepTransparent = true;
    var ring = new T.Mesh(
      new T.RingGeometry(0.135, 0.155, 32),
      new T.MeshBasicMaterial({ color: 0x5FA98A, transparent: true, opacity: 0.55,
                                side: T.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.material.__keepTransparent = true;
    platform.add(disc); platform.add(ring);
    platform.position.set(0, 0.004, 0);
    platform.scale.setScalar(0.001);
    platform.userData.ring = ring;
    stageEl.object3D.add(platform);
  }

  /* ══════════════ 粒子（上限 200） ══════════════ */
  var PMAX = 200;
  function sprite() {
    var cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    var g = cv.getContext('2d');
    var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.7)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return texFrom(cv);
  }
  function buildParticles() {
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(PMAX * 3), col = new Float32Array(PMAX * 3);
    for (var i = 0; i < PMAX * 3; i++) { pos[i] = 0; col[i] = 1; }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    var mat = new T.PointsMaterial({ size: 0.035, map: sprite(), transparent: true,
                                     opacity: 0.95, depthWrite: false, vertexColors: true,
                                     blending: T.AdditiveBlending });
    mat.__keepTransparent = true;
    particles = new T.Points(geo, mat);
    particles.frustumCulled = false;
    pAttr = geo.attributes;
    pData = [];
    for (var k = 0; k < PMAX; k++) pData.push({ life: 0 });
    stageEl.object3D.add(particles);
  }
  function burst(x, y, z, n, colorHex, spread, up) {
    var c = new T.Color(colorHex || 0xC99A3E);
    var made = 0;
    for (var i = 0; i < PMAX && made < n; i++) {
      var p = pData[i];
      if (p.life > 0) continue;
      p.life = p.max = 0.7 + Math.random() * 0.7;
      p.x = x; p.y = y; p.z = z;
      var a = Math.random() * Math.PI * 2, r = (spread || 0.5) * (0.4 + Math.random() * 0.9);
      p.vx = Math.cos(a) * r; p.vz = Math.sin(a) * r;
      p.vy = (up === undefined ? 0.7 : up) * (0.5 + Math.random());
      p.r = c.r; p.g = c.g; p.b = c.b;
      made++;
    }
    pCount = Math.max(pCount, made);
  }
  function stepParticles(dt) {
    if (!pAttr) return;
    var pos = pAttr.position.array, col = pAttr.color.array, any = false;
    for (var i = 0; i < PMAX; i++) {
      var p = pData[i], o = i * 3;
      if (p.life <= 0) { pos[o] = 0; pos[o + 1] = -999; pos[o + 2] = 0; continue; }
      p.life -= dt; any = true;
      p.vy -= 1.05 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vx *= 0.97; p.vz *= 0.97;
      var k = Math.max(0, p.life / p.max);
      pos[o] = p.x; pos[o + 1] = p.y; pos[o + 2] = p.z;
      col[o] = p.r * k; col[o + 1] = p.g * k; col[o + 2] = p.b * k;
    }
    pAttr.position.needsUpdate = true;
    pAttr.color.needsUpdate = true;
    particles.visible = any;
  }

  /* ══════════════ 代幣 ══════════════ */
  var TOKEN_SPOTS = [[-0.30, -0.20], [0.31, 0.06], [-0.02, 0.31]];
  function clearTokens() {
    tokens.forEach(function (t2) { stageEl.object3D.remove(t2.group); disposeTree(t2.group); });
    tokens = [];
  }
  function setTokens(list) {
    clearTokens();
    (list || []).slice(0, 3).forEach(function (tk, i) {
      var sp = TOKEN_SPOTS[i];
      var gp = new T.Group();
      gp.position.set(sp[0], 0.30, sp[1]);
      var core = new T.Mesh(new T.IcosahedronGeometry(0.055, 1),
        new T.MeshStandardMaterial({ color: 0xC99A3E, emissive: 0x6B4A12,
                                     roughness: 0.35, metalness: 0.3 }));
      var halo = new T.Mesh(new T.RingGeometry(0.075, 0.095, 24),
        new T.MeshBasicMaterial({ color: 0x5FA98A, transparent: true, opacity: 0.7,
                                  side: T.DoubleSide, depthWrite: false }));
      halo.material.__keepTransparent = true;
      halo.userData.faceCam = true;
      gp.add(core); gp.add(halo);
      var cv = drawChip(tk.label, C.gold);
      var lab = planeFrom(cv, 0.26 * cv.width / 300, { order: 12 });
      /* 靠邊的代幣把標籤往畫面中央拉，才不會被螢幕邊緣切掉 */
      lab.position.set(-sp[0] * 0.55, 0.15, 0);
      lab.userData.faceCam = true;
      gp.add(lab);
      stageEl.object3D.add(gp);
      tokens.push({ group: gp, core: core, halo: halo, label: lab, got: false,
                    bx: sp[0], bz: sp[1], phase: i * 2.1, data: tk });
    });
    collectMats();
    return tokens.length;
  }
  function tokenState() {
    return tokens.map(function (t2) { return { k: t2.data.k, got: t2.got }; });
  }

  /* ══════════════ 看板 ══════════════ */
  function clearBoards() {
    boards.forEach(function (b) { uiEl.object3D.remove(b); disposeTree(b); });
    boards = [];
  }
  /* o: {kicker,title,lines,tag,accent,y,width} */
  function showBoard(o) {
    clearBoards();
    var cv = drawBoard(o);
    var w = o.width || 1.20;
    var m = planeFrom(cv, w, { order: 14 });
    var h = w * cv.height / cv.width;
    m.position.set(0, (o.y === undefined ? 0 : o.y) - h / 2, 0);
    uiEl.object3D.add(m);
    boards.push(m);
    collectMats();
    return m;
  }
  function showBoards(list, y0) {
    clearBoards();
    var y = y0 === undefined ? 0 : y0;
    list.forEach(function (o) {
      var cv = drawBoard(o);
      var w = o.width || 1.20;
      var m = planeFrom(cv, w, { order: 14 });
      var hgt = w * cv.height / cv.width;
      m.position.set(0, y - hgt / 2, 0);
      y -= hgt + 0.06;
      uiEl.object3D.add(m);
      boards.push(m);
    });
    collectMats();
    return boards.length;
  }

  /* ══════════════ 關鍵物件「脫出」 ══════════════ */
  function showKeyObject(visualKind) {
    if (!keyObjEl) return null;
    keyObjEl.innerHTML = window.VISUALS ? VISUALS.ar3d(visualKind) : '';
    keyObjEl.setAttribute('visible', 'true');
    keyObjEl.object3D.position.set(0, 0.05, -0.05);
    keyObjEl.object3D.scale.setScalar(0.05);
    var t0 = performance.now();
    var run = function () {
      var k = Math.min(1, (performance.now() - t0) / 900);
      var e = 1 - Math.pow(1 - k, 3);
      keyObjEl.object3D.position.y = 0.05 + e * 0.52;
      keyObjEl.object3D.scale.setScalar(0.05 + e * 0.50);
      keyObjEl.object3D.rotation.y = e * Math.PI * 2;
      if (k < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
    burst(0, 0.12, -0.05, 46, 0xC99A3E, 0.55, 1.0);
    setTimeout(function () { collectMats(); }, 60);
    return keyObjEl;
  }
  function hideKeyObject() {
    if (!keyObjEl) return;
    keyObjEl.setAttribute('visible', 'false');
    keyObjEl.innerHTML = '';
  }

  /* ══════════════ 舞台展開特效（每關只播一次） ══════════════ */
  function expandStage(levelKey) {
    if (expandedLevels[levelKey]) return false;
    expandedLevels[levelKey] = true;
    expandedLevels.any = true;
    platform.scale.setScalar(0.001);
    var t0 = performance.now();
    var run = function () {
      var k = Math.min(1, (performance.now() - t0) / 700);
      var e = 1 - Math.pow(1 - k, 3);
      platform.scale.setScalar(0.001 + e);
      if (k < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
    burst(0, 0.03, 0, 60, 0x5FA98A, 0.85, 1.1);
    hero.anim = 'drop'; hero.animT = 0;
    if (window.AUDIO) AUDIO.sfx('scanok');
    log('stage expanded for', levelKey);
    return true;
  }
  function stageWasExpanded(levelKey) { return !!expandedLevels[levelKey]; }

  /* ══════════════ D-pad ══════════════ */
  var held = {};
  var SPEED = 0.52;
  function press(dir) { held[dir] = true; }
  function release(dir) { held[dir] = false; }
  function releaseAll() { held = {}; }
  function heroPos() { return { x: hero.x, z: hero.z, tx: hero.tx, tz: hero.tz }; }
  function setHeroPos(x, z) { hero.x = hero.tx = x; hero.z = hero.tz = z; }

  /* ══════════════ 每幀 ══════════════ */
  var fpsN = 0, fpsT0 = 0, fpsVal = 0;
  var onCollect = null, onAllCollected = null;
  function setCollectHandlers(a, b) { onCollect = a; onAllCollected = b; }

  var camWorld = null;
  function tick(now) {
    raf = requestAnimationFrame(tick);
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    fpsN++;
    if (!fpsT0) fpsT0 = now;
    if (now - fpsT0 >= 1000) { fpsVal = Math.round(fpsN * 1000 / (now - fpsT0)); fpsN = 0; fpsT0 = now; }
    if (!stageEl) return;

    /* 主角：D-pad 推目標點，實際位置以 lerp 平滑跟上（不跳格） */
    var dx = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    var dz = (held.down ? 1 : 0) - (held.up ? 1 : 0);
    if (dx || dz) {
      var n = Math.sqrt(dx * dx + dz * dz);
      hero.tx += dx / n * SPEED * dt;
      hero.tz += dz / n * SPEED * dt;
      hero.tx = Math.max(-LIM, Math.min(LIM, hero.tx));
      hero.tz = Math.max(-LIM, Math.min(LIM, hero.tz));
      hero.tyaw = Math.atan2(dx, dz) * 180 / Math.PI;
      hero.moving = true;
    } else {
      hero.moving = false;
    }
    var k = 1 - Math.pow(0.0006, dt);
    hero.x += (hero.tx - hero.x) * k;
    hero.z += (hero.tz - hero.z) * k;
    var d = hero.tyaw - hero.yaw;
    while (d > 180) d -= 360; while (d < -180) d += 360;
    hero.yaw += d * (1 - Math.pow(0.0004, dt));

    if (hero.yawEl && hero.yawEl.object3D) {
      var yo = hero.yawEl.object3D;
      yo.position.set(hero.x, hero.y, hero.z);
      yo.rotation.y = hero.yaw * Math.PI / 180;
      yo.scale.setScalar(0.30);
    }
    if (hero.bodyEl && hero.bodyEl.object3D) {
      var bo = hero.bodyEl.object3D;
      hero.animT += dt;
      if (hero.moving) hero.walk += dt * 9;
      var amp = hero.moving ? 1 : 0;
      var y = Math.abs(Math.sin(hero.walk)) * 0.09 * amp;
      var rz = Math.sin(hero.walk * 0.5) * 0.11 * amp;
      var br = 1 + Math.sin(now / 900) * (hero.moving ? 0.012 : 0.032);
      var sx = br, sy = 2 - br;
      if (hero.anim === 'drop') {
        var kk = Math.min(1, hero.animT / 0.8);
        y += (1 - (1 - Math.pow(1 - kk, 3))) * 1.4;
        if (kk >= 1) hero.anim = 'idle';
      } else if (hero.anim === 'collect') {
        var kc = Math.min(1, hero.animT / 0.45);
        y += Math.sin(kc * Math.PI) * 0.22;
        sx = br * (1 + Math.sin(kc * Math.PI) * 0.18);
        if (kc >= 1) hero.anim = 'idle';
      } else if (hero.anim === 'celebrate') {
        y += Math.abs(Math.sin(hero.animT * 6)) * 0.20;
        rz = Math.sin(hero.animT * 6) * 0.28;
        if (hero.yawEl) hero.yawEl.object3D.rotation.y += dt * 3.2;
      }
      bo.position.y = y;
      bo.rotation.z = rz;
      bo.scale.set(sx, sy, sx);
    }

    /* 平台跟著主角 */
    if (platform) {
      platform.position.x += (hero.x - platform.position.x) * k;
      platform.position.z += (hero.z - platform.position.z) * k;
      if (platform.userData.ring) platform.userData.ring.rotation.z = now / 1400;
    }

    /* 代幣：緩慢漂浮＋碰撞收集 */
    for (var i = 0; i < tokens.length; i++) {
      var t2 = tokens[i];
      if (t2.got) continue;
      var ph = now / 1000 + t2.phase;
      t2.group.position.x = t2.bx + Math.sin(ph * 0.55) * 0.045;
      t2.group.position.z = t2.bz + Math.cos(ph * 0.42) * 0.045;
      t2.group.position.y = 0.30 + Math.sin(ph * 1.15) * 0.055;
      t2.core.rotation.y += dt * 1.4;
      t2.core.rotation.x += dt * 0.7;
      var ddx = t2.group.position.x - hero.x, ddz = t2.group.position.z - hero.z;
      if (ddx * ddx + ddz * ddz < 0.15 * 0.15) collectToken(i);
    }

    /* 看板／標籤面向鏡頭（billboard） */
    if (camEl && camEl.object3D) {
      if (!camWorld) camWorld = new T.Vector3();
      camEl.object3D.getWorldPosition(camWorld);
      [stageEl, uiEl].forEach(function (root) {
        root.object3D.traverse(function (n) {
          if (n.userData && n.userData.faceCam) n.lookAt(camWorld);
        });
      });
    }

    stepParticles(dt);
  }

  function collectToken(i) {
    var t2 = tokens[i];
    if (!t2 || t2.got) return;
    t2.got = true;
    burst(t2.group.position.x, t2.group.position.y, t2.group.position.z, 26, 0xC99A3E, 0.5, 0.9);
    stageEl.object3D.remove(t2.group);
    hero.anim = 'collect'; hero.animT = 0;
    if (window.AUDIO) AUDIO.sfx('coin');
    if (onCollect) try { onCollect(t2.data, tokens.filter(function (x) { return x.got; }).length); } catch (e) {}
    if (tokens.every(function (x) { return x.got; })) {
      if (window.AUDIO) AUDIO.sfx('unlock');
      if (onAllCollected) setTimeout(function () { try { onAllCollected(); } catch (e) {} }, 350);
    }
  }

  /* ══════════════ 點擊（自建 raycaster，不依賴 A-Frame cursor） ══════════════ */
  var ray = null, ndc = null;
  function bindTaps() {
    ray = new T.Raycaster(); ndc = new T.Vector2();
    var onTap = function (ev) {
      if (!hitObjects.length || !sceneEl || !sceneEl.camera) return;
      var pt = ev.changedTouches ? ev.changedTouches[0] : ev;
      var r = sceneEl.canvas ? sceneEl.canvas.getBoundingClientRect()
                             : { left: 0, top: 0, width: innerWidth, height: innerHeight };
      ndc.x = ((pt.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((pt.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, sceneEl.camera);
      var hits = ray.intersectObjects(hitObjects, true);
      if (!hits.length) return;
      var o = hits[0].object;
      while (o && !o.userData.onTap) o = o.parent;
      if (o && o.userData.onTap) {
        ev.preventDefault();
        o.userData.onTap(o, hits[0]);
      }
    };
    window.addEventListener('pointerup', onTap, { passive: false });
  }
  function registerHit(obj, fn) { obj.userData.onTap = fn; hitObjects.push(obj); }
  function clearHits() { hitObjects = []; }

  /* ══════════════ 題目群組 ══════════════ */
  var chainGroup = null;
  function newChainGroup() {
    clearChainGroup();
    chainGroup = new T.Group();
    stageEl.object3D.add(chainGroup);
    return chainGroup;
  }
  function clearChainGroup() {
    if (chainGroup) { stageEl.object3D.remove(chainGroup); disposeTree(chainGroup); }
    chainGroup = null;
  }
  function newQuizGroup() {
    clearQuizGroup();
    quizGroup = new T.Group();
    uiEl.object3D.add(quizGroup);
    return quizGroup;
  }
  function clearQuizGroup() {
    clearHits();
    if (quizGroup) { uiEl.object3D.remove(quizGroup); disposeTree(quizGroup); }
    quizGroup = null;
  }
  function disposeTree(root) {
    if (!root) return;
    root.traverse(function (n) {
      if (n.geometry) n.geometry.dispose();
      if (n.material) {
        var arr = Array.isArray(n.material) ? n.material : [n.material];
        arr.forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
  }

  /* ══════════════ 陀螺儀視差（只作用在 free 模式） ══════════════ */
  var gyro = { on: false, x: 0, y: 0, tx: 0, ty: 0, mode: 'none' };
  function enableGyro() {
    var apply = function () {
      gyro.on = true; gyro.mode = 'gyro';
      window.addEventListener('deviceorientation', function (e) {
        if (e.gamma === null || e.beta === null) return;
        gyro.tx = Math.max(-18, Math.min(18, e.gamma)) * 0.006;
        gyro.ty = Math.max(-18, Math.min(18, (e.beta || 0) - 45)) * 0.004;
      });
      if (!gyro.raf) gyro.raf = requestAnimationFrame(gyroLoop);
      log('gyro parallax on');
    };
    var DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      /* iOS 13+：必須在使用者手勢內呼叫 */
      return DOE.requestPermission().then(function (s) {
        if (s === 'granted') { apply(); return 'granted'; }
        touchParallax(); return 'denied';
      }).catch(function () { touchParallax(); return 'error'; });
    }
    if (DOE) { apply(); return Promise.resolve('granted'); }
    touchParallax();
    return Promise.resolve('unsupported');
  }
  /* 拒絕陀螺儀 → 退回觸控拖曳視差 */
  function touchParallax() {
    if (gyro.mode === 'touch') return;
    gyro.mode = 'touch'; gyro.on = true;
    var dragging = false, sx = 0, sy = 0, bx = 0, by = 0;
    window.addEventListener('pointerdown', function (e) {
      if (e.target && e.target.closest && e.target.closest('.hud, .ui')) return;
      dragging = true; sx = e.clientX; sy = e.clientY; bx = gyro.tx; by = gyro.ty;
    });
    window.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      gyro.tx = Math.max(-0.12, Math.min(0.12, bx + (e.clientX - sx) * 0.0004));
      gyro.ty = Math.max(-0.10, Math.min(0.10, by + (e.clientY - sy) * 0.0003));
    });
    window.addEventListener('pointerup', function () { dragging = false; });
    if (!gyro.raf) gyro.raf = requestAnimationFrame(gyroLoop);
    log('touch parallax on (gyro unavailable)');
  }
  function gyroLoop() {
    gyro.raf = requestAnimationFrame(gyroLoop);
    if (!freeRig || !freeRig.object3D) return;
    gyro.x += (gyro.tx - gyro.x) * 0.10;
    gyro.y += (gyro.ty - gyro.y) * 0.10;
    if (mode !== 'free') { freeRig.object3D.rotation.set(0, 0, 0); return; }
    freeRig.object3D.rotation.y = -gyro.x;
    freeRig.object3D.rotation.x = gyro.y;
  }

  /* ══════════════ 驗收掛鉤 ══════════════ */
  function stats() {
    var tri = 0, meshes = 0, objs = 0;
    [stageEl, uiEl].forEach(function (root) {
    if (root) root.object3D.traverse(function (o) {
      objs++;
      if (!o.isMesh || !o.geometry) return;
      meshes++;
      var g = o.geometry;
      tri += g.index ? g.index.count / 3
                     : (g.attributes && g.attributes.position ? g.attributes.position.count / 3 : 0);
    });
    });
    return { mode: mode, tri: Math.round(tri), meshes: meshes, objects: objs,
             fps: fpsVal, tokens: tokens.length,
             collected: tokens.filter(function (t2) { return t2.got; }).length,
             boards: boards.length, hits: hitObjects.length,
             tracking: trackingOn, powerSave: powerSave, gyro: gyro.mode,
             stageParent: stageEl ? (stageEl.object3D.parent && stageEl.object3D.parent.el
                                     ? stageEl.object3D.parent.el.id : 'none') : 'none' };
  }
  /* 驗證用：逐一走完真正的收集邏輯（含音效與回呼），不是直接改狀態 */
  function forceCollectAll() {
    for (var i = 0; i < tokens.length; i++) if (!tokens[i].got) collectToken(i);
    return tokens.length;
  }
  /* 驗證用：把主角瞬移到某個代幣旁，測真實碰撞 */
  function walkToToken(i) {
    var t2 = tokens[i];
    if (!t2) return false;
    hero.tx = hero.x = t2.group.position.x;
    hero.tz = hero.z = t2.group.position.z;
    return true;
  }
  function simulate(kind, idx) {
    var i = idx === undefined ? 1 : idx;
    var el = i === 1 ? anchor1 : anchor0;
    if (kind === 'found') {
      /* 真實追蹤時可見性由 MindAR 控制；模擬時要自己打開，否則桌機看不到卡片版式 */
      if (el) {
        el.object3D.visible = true;
        el.object3D.matrixAutoUpdate = true;
        /* 模擬一張「擺在鏡頭前」的卡片：MindAR 的世界單位是目標圖片像素，
           錨點的 postMatrix 會把內容放大成 targetImage.width（1200 px），
           所以這裡也用 scale 1200、距離 3800 px 來近似「卡片填滿約八成畫面」的姿態。 */
        if (trackingOn) {
          el.object3D.position.set(0, 0.10 * 1200, -3800);
          el.object3D.rotation.set(-0.35, 0, 0);
          el.object3D.scale.setScalar(1200);
        }
      }
      onTargetFound(i);
    } else {
      onTargetLost(i);
      if (el && trackingOn) el.object3D.visible = false;
    }
    return mode;
  }

  return {
    init: init, retarget: retarget, startTracking: startTracking, setPowerSave: setPowerSave,
    setMode: setMode, mode: function () { return mode; },
    setTokens: setTokens, clearTokens: clearTokens, tokenState: tokenState,
    showBoard: showBoard, showBoards: showBoards, clearBoards: clearBoards,
    showKeyObject: showKeyObject, hideKeyObject: hideKeyObject,
    expandStage: expandStage, stageWasExpanded: stageWasExpanded,
    press: press, release: release, releaseAll: releaseAll,
    heroPos: heroPos, setHeroPos: setHeroPos,
    heroAnim: function (a) { hero.anim = a; hero.animT = 0; },
    setCollectHandlers: setCollectHandlers,
    burst: burst, drawBoard: drawBoard, drawChip: drawChip, planeFrom: planeFrom, texFrom: texFrom,
    newQuizGroup: newQuizGroup, clearQuizGroup: clearQuizGroup,
    newChainGroup: newChainGroup, clearChainGroup: clearChainGroup,
    registerHit: registerHit, clearHits: clearHits, disposeTree: disposeTree,
    hitList: function () { return hitObjects; },
    enableGyro: enableGyro, touchParallax: touchParallax,
    fadeIn: fadeIn, collectMats: collectMats,
    stats: stats, simulate: simulate, syncFreeRig: syncFreeRig,
    forceCollectAll: forceCollectAll, walkToToken: walkToToken,
    THREE: function () { return T; },
    scene: function () { return sceneEl; },
    stageEl: function () { return stageEl; },
    uiEl: function () { return uiEl; },
    group: function () { return stageEl ? stageEl.object3D : null; },
    LIM: LIM, C: C
  };
})();
