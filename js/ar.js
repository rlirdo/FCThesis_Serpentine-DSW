/* AR 掃描模組（MindAR image tracking ＋ A-Frame）v1.1
   ── v1.1 相機可靠性大修 ──────────────────────────────────────────
   1. 【手勢鏈】按鈕 click 內「立刻」呼叫 getUserMedia，先把畫面接到自己的
      <video id="cam-preview">，使用者馬上看得到相機活著；.mind 在背景載入。
      v1.0 的流程是「先載 .mind（600–800KB）→ 才由 MindAR 內部開相機」，
      在行動網路下早已脫離使用者手勢，iOS 會拒絕播放 → 黃框內全黑。
   2. 【同一條串流】接手時不再讓 MindAR 自己 getUserMedia（會二次要求裝置、
      Android 常見 NotReadableError），改為覆寫 system._startVideo，
      把預檢拿到的 MediaStream 直接餵給 MindAR 的 video。全程零中斷、零黑閃。
   3. 【強制播放】MindAR 建立的 video 一律補 playsinline / webkit-playsinline /
      muted 並主動呼叫 play()（攔截 rejection 並記錄）。
   4. 【診斷】權限狀態、getUserMedia 錯誤名稱、videoWidth×Height、畫面平均亮度
      全部收進 diag，供「複製診斷資訊」一鍵回報。
   5. 【內建瀏覽器】LINE 自動導向外部瀏覽器；FB / IG / 微信顯示逃生指引。 */
window.AR = (function () {

  const VERSION = '1.1';

  let host = null, sceneEl = null, running = false, onFoundCb = null, mo = null;
  let camStream = null;          // 預檢取得、之後交給 MindAR 的同一條串流
  let previewEl = null;          // 我們自己的 <video id="cam-preview">
  let mindVideo = null;          // MindAR 建立的 <video>
  let darkRun = 0;               // 連續判定為黑畫面的秒數

  const diag = {
    version: VERSION,
    ua: (navigator.userAgent || ''),
    inApp: null,
    secure: null,
    permission: 'unknown',
    stage: 'idle',
    errorName: null,
    errorMsg: null,
    playError: null,
    retriedAnyCamera: false,
    videoW: 0, videoH: 0,
    brightness: -1,
    paused: null,
    readyState: null,
    trackLabel: null,
    trackSettings: null
  };

  function log(...a) { console.log('[AR]', ...a); }

  /* ═══════════ C. 內建瀏覽器（in-app WebView）偵測 ═══════════
     純函式，只吃 UA 字串，方便單元測試。 */
  function detectInApp(ua) {
    const u = String(ua || '');
    if (/\bLine\/\d/i.test(u) || /\bLIFF\//i.test(u))
      return { inApp: true, app: 'line', name: 'LINE', escape: 'auto',
               tip: 'LINE 內建瀏覽器不支援相機，將自動改用外部瀏覽器開啟。' };
    if (/FBAN|FBAV|FB_IAB|FB4A|FBIOS/i.test(u))
      return { inApp: true, app: 'facebook', name: 'Facebook', escape: 'menu',
               tip: '此 App 內建瀏覽器不支援相機，請點右上角選單 →「以瀏覽器開啟」。' };
    if (/Instagram/i.test(u))
      return { inApp: true, app: 'instagram', name: 'Instagram', escape: 'menu',
               tip: '此 App 內建瀏覽器不支援相機，請點右上角選單 →「以瀏覽器開啟」。' };
    if (/MicroMessenger/i.test(u))
      return { inApp: true, app: 'wechat', name: '微信 WeChat', escape: 'menu',
               tip: '此 App 內建瀏覽器不支援相機，請點右上角選單 →「在瀏覽器開啟」。' };
    return { inApp: false, app: null, name: null, escape: null, tip: null };
  }

  /* LINE 專用逃生：同網址加上 openExternalBrowser=1，LINE 會改用外部瀏覽器開啟。
     純函式，方便單元測試：
       ・非 LINE UA → null（不導向）
       ・已帶 openExternalBrowser=1 → null（防無限重導）
       ・其餘 → 回傳「保留原本 query 與 hash、補上參數」的完整網址字串 */
  function externalBrowserUrl(href, ua) {
    const info = detectInApp(ua === undefined ? navigator.userAgent : ua);
    if (!info.inApp || info.app !== 'line') return null;
    let url;
    try { url = new URL(String(href)); } catch (e) { return null; }
    if (url.searchParams.get('openExternalBrowser') === '1') return null;
    url.searchParams.set('openExternalBrowser', '1');   // 自動保留既有 query 與 #hash
    return url.toString();
  }

  /* 回傳實際導向的網址（沒導向則回 null）。doRedirect=false 只計算不導向，供測試用。 */
  function escapeInAppBrowser(href, ua, doRedirect) {
    const info = detectInApp(ua === undefined ? navigator.userAgent : ua);
    diag.inApp = info.app;
    const target = externalBrowserUrl(href === undefined ? location.href : href, ua);
    if (!target) return null;
    log('LINE in-app browser → redirect to external browser:', target);
    if (doRedirect !== false) location.replace(target);
    return target;
  }

  /* ═══════════ 事前檢查 ═══════════ */
  function preflight() {
    const secure = window.isSecureContext ||
      location.protocol === 'https:' ||
      ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
    diag.secure = secure;
    if (!secure) return { ok: false, code: 'INSECURE',
      reason: '需要 HTTPS 才能開啟相機。',
      guide: '請改用 https:// 開頭的網址（或 localhost）開啟本頁。' };
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const info = detectInApp(navigator.userAgent);
      return { ok: false, code: 'NO_API',
        reason: info.inApp
          ? ('目前在 ' + info.name + ' 的內建瀏覽器中，無法存取相機。')
          : '這個瀏覽器不支援相機存取（navigator.mediaDevices 不存在）。',
        guide: info.inApp ? info.tip : '請改用 Safari（iPhone）或 Chrome（Android）開啟本頁。' };
    }
    return { ok: true };
  }

  /* 相機權限狀態（不支援 Permissions API 就回 unsupported） */
  async function queryPermission() {
    try {
      if (!navigator.permissions || !navigator.permissions.query) {
        diag.permission = 'unsupported'; return 'unsupported';
      }
      const st = await navigator.permissions.query({ name: 'camera' });
      diag.permission = st.state;             // granted / denied / prompt
      return st.state;
    } catch (e) {
      diag.permission = 'unsupported';
      return 'unsupported';
    }
  }

  /* ═══════════ D. 錯誤 → 中文訊息 ═══════════ */
  const OPEN_GUIDE =
    'iPhone Safari：設定 App →「Safari」→「相機」→ 選「允許」，或點網址列左側「ᴀA」→ 網站設定。' +
    '　Android Chrome：點網址列左側鎖頭 → 權限 → 相機 → 允許，然後重新整理。';

  function explain(err) {
    const name = (err && (err.name || err.constructor && err.constructor.name)) || 'Error';
    const raw = (err && err.message) || String(err);
    diag.errorName = name; diag.errorMsg = raw;
    switch (name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
      case 'SecurityError':
        return { code: name, reason: '相機權限被拒絕，瀏覽器不讓本頁使用鏡頭。',
                 guide: '請到瀏覽器設定開啟相機權限後重新整理。' + OPEN_GUIDE };
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return { code: name, reason: '找不到可用的鏡頭（這台裝置沒有相機，或系統未提供）。',
                 guide: '請改用有相機的手機，或直接使用下方「圖片模式」完成這一關。' };
      case 'NotReadableError':
      case 'TrackStartError':
      case 'AbortError':
        return { code: name, reason: '鏡頭正被其他 App 佔用，或系統暫時無法讀取。',
                 guide: '請關閉相機、視訊通話、其他瀏覽器分頁後，再按「再試一次相機」。' };
      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        return { code: name, reason: '鏡頭規格不符（找不到後鏡頭），已自動改用任意鏡頭重試仍失敗。',
                 guide: '請改用手機的預設相機瀏覽器，或使用「圖片模式」。' };
      case 'TypeError':
        return { code: name, reason: '瀏覽器不支援相機存取介面。',
                 guide: '請改用 Safari（iPhone）或 Chrome（Android）開啟本頁。' };
      default:
        return { code: name, reason: '相機啟動失敗：' + raw, guide: OPEN_GUIDE };
    }
  }

  /* ═══════════ A / F. 手勢內即時取得相機串流 ═══════════ */
  async function acquireCamera() {
    diag.stage = 'getUserMedia';
    // ideal 而非 exact：部分 Android 只有單鏡頭，exact 會直接失敗
    const wanted = { audio: false, video: { facingMode: { ideal: 'environment' } } };
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(wanted);
    } catch (e) {
      const n = e && e.name;
      diag.errorName = n; diag.errorMsg = e && e.message;
      if (n === 'OverconstrainedError' || n === 'ConstraintNotSatisfiedError') {
        log('OverconstrainedError → 降級為 {video:true} 重試');
        diag.retriedAnyCamera = true;
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      } else {
        throw e;
      }
    }
    diag.stage = 'streamReady';
    diag.errorName = diag.errorName || null;
    try {
      const t = stream.getVideoTracks()[0];
      if (t) {
        diag.trackLabel = t.label || '(no label)';
        const s = t.getSettings ? t.getSettings() : {};
        diag.trackSettings = [s.width, s.height, s.facingMode].filter(Boolean).join('×');
      }
    } catch (e) { /* 取不到就算了 */ }
    camStream = stream;
    return stream;
  }

  /* 把串流接到我們自己的預覽 video（立即有畫面） */
  async function attachPreview(el, stream) {
    previewEl = el;
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');
    el.setAttribute('autoplay', '');
    el.setAttribute('muted', '');
    el.muted = true; el.defaultMuted = true; el.playsInline = true;
    el.srcObject = stream || camStream;
    el.classList.remove('hidden');
    try { await el.play(); }
    catch (e) { diag.playError = (e && e.name) || String(e); log('preview play rejected', e); }
    return el;
  }

  function hidePreview() {
    if (previewEl) previewEl.classList.add('hidden');
  }

  function stopStream() {
    try {
      if (camStream && camStream.getTracks) camStream.getTracks().forEach(t => t.stop());
    } catch (e) { /* ignore */ }
    camStream = null;
  }

  /* ═══════════ D. 黑畫面偵測：4×4 canvas 平均亮度 ═══════════ */
  let _bcv = null;
  function brightnessOf(v) {
    if (!v || !v.videoWidth || !v.videoHeight) return -1;
    if (!_bcv) { _bcv = document.createElement('canvas'); _bcv.width = 4; _bcv.height = 4; }
    try {
      const ctx = _bcv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(v, 0, 0, 4, 4);
      const d = ctx.getImageData(0, 0, 4, 4).data;
      let s = 0;
      for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      return s / 16;
    } catch (e) { return -1; }
  }

  /* 目前實際在跑的 video：優先 MindAR 的，其次我們的預覽 */
  function activeVideo() {
    if (mindVideo && mindVideo.isConnected && mindVideo.videoWidth) return mindVideo;
    if (previewEl && previewEl.videoWidth) return previewEl;
    return mindVideo || previewEl || null;
  }

  /* 每次呼叫回報一次串流健康度；連續 3 次（每秒一次）亮度 < 6 判定黑畫面 */
  const DARK_LEVEL = 6, DARK_HITS = 3;
  function probe() {
    const v = activeVideo();
    const b = brightnessOf(v);
    diag.videoW = v ? v.videoWidth : 0;
    diag.videoH = v ? v.videoHeight : 0;
    diag.brightness = Math.round(b * 10) / 10;
    diag.paused = v ? v.paused : null;
    diag.readyState = v ? v.readyState : null;
    if (b >= 0 && b < DARK_LEVEL) darkRun++; else if (b >= DARK_LEVEL) darkRun = 0;
    return {
      video: v,
      hasFrame: !!(v && v.videoWidth > 0 && v.readyState >= 2),
      width: diag.videoW, height: diag.videoH,
      brightness: b, bright: b >= DARK_LEVEL,
      darkRun: darkRun, black: darkRun >= DARK_HITS,
      paused: diag.paused
    };
  }
  function resetProbe() { darkRun = 0; }

  /* ═══════════ 診斷文字（供「複製診斷資訊」） ═══════════ */
  function diagText() {
    const L = [];
    L.push('花蓮綠色化學闖關 — 相機診斷資訊');
    L.push('版本：v' + VERSION);
    L.push('時間：' + new Date().toLocaleString('zh-TW'));
    L.push('網址：' + location.href);
    L.push('瀏覽器 UA：' + diag.ua);
    const ia = detectInApp(diag.ua);
    L.push('內建瀏覽器：' + (ia.inApp ? ia.name : '否（一般瀏覽器）'));
    L.push('安全內容(HTTPS)：' + (diag.secure === null ? '未檢查' : (diag.secure ? '是' : '否')));
    L.push('相機權限狀態：' + diag.permission);
    L.push('流程階段：' + diag.stage);
    L.push('錯誤名稱：' + (diag.errorName || '（無）'));
    L.push('錯誤訊息：' + (diag.errorMsg || '（無）'));
    L.push('play() 失敗：' + (diag.playError || '（無）'));
    L.push('降級任意鏡頭重試：' + (diag.retriedAnyCamera ? '是' : '否'));
    L.push('鏡頭裝置：' + (diag.trackLabel || '（未取得）') +
           (diag.trackSettings ? '（' + diag.trackSettings + '）' : ''));
    L.push('影像尺寸：' + diag.videoW + ' × ' + diag.videoH);
    L.push('畫面平均亮度：' + diag.brightness + '（<6 視為全黑）');
    L.push('video.paused：' + diag.paused + '　readyState：' + diag.readyState);
    const st = selfTest();
    L.push('A-Frame：' + (st.aframe ? st.aframeVersion : '未載入') +
           '　MindAR：' + (st.mindar ? 'OK' : '未載入'));
    L.push('螢幕：' + screen.width + '×' + screen.height +
           '　視窗：' + innerWidth + '×' + innerHeight + '　DPR：' + (devicePixelRatio || 1));
    return L.join('\n');
  }
  function diagData() { return Object.assign({}, diag); }

  /* ═══════════ 背景載入 .mind（轉成 blob URL，MindAR 就不必再抓一次） ═══════════ */
  const mindCache = {};
  function targetPath(level) {
    return 'targets/level' + String(level.n).padStart(2, '0') + '.mind';
  }
  async function prefetchTarget(level) {
    const path = targetPath(level);
    if (mindCache[path]) return mindCache[path];
    diag.stage = 'loadTarget';
    try {
      const r = await fetch(path, { cache: 'force-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      mindCache[path] = url;
      log('target prefetched', path, blob.size, 'bytes');
      return url;
    } catch (e) {
      log('target prefetch failed, fall back to direct path:', e);
      return path;      // 讓 MindAR 自己抓，仍可運作
    }
  }

  /* ═══════════ B. 強制修補所有 video 元素 ═══════════ */
  function fixVideo(v) {
    if (!v) return;
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.setAttribute('muted', '');
    v.setAttribute('autoplay', '');
    v.muted = true; v.defaultMuted = true; v.playsInline = true;
  }
  function forcePlay(v) {
    if (!v) return Promise.resolve(false);
    fixVideo(v);
    const p = v.play();
    if (!p || !p.catch) return Promise.resolve(true);
    return p.then(() => true).catch(e => {
      diag.playError = (e && e.name) || String(e);
      log('video.play() rejected:', e);
      return false;
    });
  }
  function watchVideos() {
    document.querySelectorAll('video').forEach(fixVideo);
    const m = new MutationObserver(ms => {
      ms.forEach(x => x.addedNodes.forEach(n => {
        if (n.tagName === 'VIDEO') { fixVideo(n); forcePlay(n); }
        else if (n.querySelectorAll) n.querySelectorAll('video').forEach(v => { fixVideo(v); forcePlay(v); });
      }));
    });
    m.observe(document.body, { childList: true, subtree: true });
    return m;
  }

  /* ═══════════ 啟動 MindAR ═══════════
     opts: { host, onFound, stream, mindSrc } —— stream 為預檢已取得的串流，
     有的話就直接餵給 MindAR，完全不再呼叫第二次 getUserMedia。 */
  async function start(level, opts) {
    const pf = preflight();
    if (!pf.ok) { const e = new Error(pf.reason); e.__info = pf; throw e; }

    host = opts.host;
    onFoundCb = opts.onFound;
    const mindSrc = opts.mindSrc || targetPath(level);
    if (opts.stream) camStream = opts.stream;

    await stop({ keepStream: true });
    mo = watchVideos();
    diag.stage = 'sceneLoad';

    sceneEl = document.createElement('a-scene');
    sceneEl.setAttribute('mindar-image',
      'imageTargetSrc: ' + mindSrc +
      '; autoStart: false; uiScanning: no; uiLoading: no; uiError: no; filterMinCF: 0.0001; filterBeta: 0.005');
    sceneEl.setAttribute('color-space', 'sRGB');
    sceneEl.setAttribute('renderer', 'colorManagement: true, physicallyCorrectLights');
    sceneEl.setAttribute('vr-mode-ui', 'enabled: false');
    sceneEl.setAttribute('device-orientation-permission-ui', 'enabled: false');
    sceneEl.setAttribute('embedded', '');

    sceneEl.innerHTML =
      '<a-assets></a-assets>' +
      '<a-camera position="0 0 0" look-controls="enabled: false" cursor="fuse: false"></a-camera>' +
      '<a-entity id="ar-target" mindar-image-target="targetIndex: 0">' +
      '<a-entity position="0 0 0" rotation="0 0 0" scale="0.8 0.8 0.8">' +
      VISUALS.ar3d(level.ar.visual) +
      '</a-entity></a-entity>' +
      '<a-entity light="type: ambient; intensity: 0.9"></a-entity>' +
      '<a-entity light="type: directional; intensity: 0.55" position="1 2 1"></a-entity>';

    host.appendChild(sceneEl);

    const tgt = sceneEl.querySelector('#ar-target');
    tgt.addEventListener('targetFound', () => {
      log('targetFound level', level.n);
      if (onFoundCb) { const cb = onFoundCb; onFoundCb = null; cb(); }
    });
    tgt.addEventListener('targetLost', () => log('targetLost'));

    await new Promise(res => {
      if (sceneEl.hasLoaded) return res();
      sceneEl.addEventListener('loaded', res, { once: true });
    });

    const sys = sceneEl.systems['mindar-image-system'];
    if (!sys) throw new Error('MindAR 系統未載入（mindar-image-system 不存在）。');

    /* ── 關鍵：把 MindAR 的 _startVideo 換成「用我們手上的串流」 ──
       原版會自己再 getUserMedia 一次：在 iOS 上這已脫離使用者手勢，
       在 Android 上則常因鏡頭尚未釋放而拿到 NotReadableError。 */
    if (camStream && camStream.getVideoTracks && camStream.getVideoTracks().length) {
      const stream = camStream;
      sys._startVideo = function () {
        const v = document.createElement('video');
        fixVideo(v);
        v.style.position = 'absolute';
        v.style.top = '0px';
        v.style.left = '0px';
        v.style.zIndex = '-2';
        this.container = this.container || (this.el.sceneEl && this.el.sceneEl.parentNode) || host;
        this.container.appendChild(v);
        this.video = v;
        mindVideo = v;
        const go = () => {
          v.setAttribute('width', v.videoWidth);
          v.setAttribute('height', v.videoHeight);
          diag.stage = 'mindarAR';
          try { this._startAR(); } catch (e) { log('_startAR error', e); }
        };
        v.addEventListener('loadedmetadata', go, { once: true });
        v.srcObject = stream;
        forcePlay(v).then(ok => {
          log('mindar video play:', ok, v.videoWidth + '×' + v.videoHeight);
          // 少數瀏覽器在 srcObject 指定前就已有 metadata，補跑一次
          if (v.videoWidth && v.readyState >= 1 && !this.controller) go();
        });
      };
    }

    log('starting mindar, target =', mindSrc);
    diag.stage = 'mindarStart';
    sys.start();                       // 同步函式，不回傳 Promise

    // 立刻再補一次 video 修補（MindAR 用原生路徑時也吃得到）
    setTimeout(() => {
      const v = mindVideo || (sys.video) || host.querySelector('video');
      if (v) { mindVideo = v; forcePlay(v); }
    }, 0);

    running = true;
    setTimeout(() => { if (mo) { mo.disconnect(); mo = null; } }, 8000);
    return true;
  }

  /* 每次進入掃描都重新修補一次（B） */
  function repatch() {
    const v = mindVideo || (sceneEl && sceneEl.systems &&
      sceneEl.systems['mindar-image-system'] && sceneEl.systems['mindar-image-system'].video) ||
      (host && host.querySelector('video'));
    if (v) { mindVideo = v; return forcePlay(v); }
    return Promise.resolve(false);
  }

  /* MindAR 的 stop()/pause() 會直接存取 this.controller 與 this.video。
     相機從未成功啟動時 controller 是 undefined，而 A-Frame 在場景被移除時
     還會自己呼叫一次 system.pause()，於是丟出未攔截的 TypeError。
     先塞一個安全替身，讓後續所有生命週期呼叫都變成無動作。 */
  const NOOP_CONTROLLER = {
    stopProcessVideo() {}, processVideo() {}, dispose() {},
    getProjectionMatrix() { return null; }
  };

  async function stop(opts) {
    const keep = !!(opts && opts.keepStream);
    onFoundCb = null;
    if (mo) { try { mo.disconnect(); } catch (e) {} mo = null; }
    if (sceneEl) {
      const sys = sceneEl.systems && sceneEl.systems['mindar-image-system'];
      if (sys) {
        if (!sys.controller) sys.controller = NOOP_CONTROLLER;
        if (!keep) {
          try {
            if (sys.video && sys.video.srcObject && sys.video.srcObject.getTracks)
              sys.video.srcObject.getTracks().forEach(t => t.stop());
          } catch (e) { log('track stop', e); }
        }
        try { sys.pause(); } catch (e) { log('pause', e); }
        try { sys.video && sys.video.remove(); } catch (e) {}
        try { sys.controller.dispose && sys.controller.dispose(); } catch (e) {}
        sys.controller = NOOP_CONTROLLER;   // 之後 A-Frame 再呼叫也安全
        // mindar-image 元件的 remove() 會再呼叫一次 system.stop()，
        // 而該實作直接存取 video.srcObject.getTracks()，此時已是 null。
        // 我們已自行收拾乾淨，把這兩個方法換成無動作即可。
        sys.stop = function () {};
        sys.pause = function () {};
      }
      try { sceneEl.parentNode && sceneEl.parentNode.removeChild(sceneEl); } catch (e) {}
      sceneEl = null;
    }
    mindVideo = null;
    if (!keep) {
      // 保險：關掉任何殘留的相機串流（含我們的預覽）
      document.querySelectorAll('video').forEach(v => {
        if (v.srcObject && v.srcObject.getTracks) {
          v.srcObject.getTracks().forEach(t => t.stop());
          v.srcObject = null;
        }
      });
      stopStream();
      hidePreview();
      resetProbe();
      diag.stage = 'stopped';
    }
    running = false;
  }

  /* 給測試報告用：確認函式庫本身是否可用（不開相機） */
  function selfTest() {
    return {
      version: VERSION,
      aframe: !!window.AFRAME,
      aframeVersion: window.AFRAME ? window.AFRAME.version : null,
      mindar: !!(window.MINDAR && window.MINDAR.IMAGE),
      compiler: !!(window.MINDAR && window.MINDAR.IMAGE && window.MINDAR.IMAGE.Compiler),
      systemRegistered: !!(window.AFRAME && AFRAME.systems && AFRAME.systems['mindar-image-system']),
      componentRegistered: !!(window.AFRAME && AFRAME.components && AFRAME.components['mindar-image-target']),
      secureContext: preflight().ok,
      preflight: preflight(),
      inApp: detectInApp(navigator.userAgent)
    };
  }

  return {
    VERSION, start, stop, selfTest, preflight, repatch,
    detectInApp, escapeInAppBrowser, externalBrowserUrl, queryPermission, explain,
    acquireCamera, attachPreview, hidePreview, stopStream,
    mindReady: () => !!(mindVideo && mindVideo.isConnected && mindVideo.videoWidth > 0),
    prefetchTarget, targetPath,
    probe, resetProbe, brightnessOf, diagText, diagData,
    get running() { return running; },
    get stream() { return camStream; }
  };
})();

/* 內建瀏覽器逃生：越早越好（LINE 直接改用外部瀏覽器開啟） */
try { window.AR.escapeInAppBrowser(); } catch (e) { console.warn('[AR] in-app check', e); }
