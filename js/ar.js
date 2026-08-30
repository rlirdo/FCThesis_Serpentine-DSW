/* AR 掃描模組（MindAR image tracking ＋ A-Frame）
   相容性重點：
   1. 必須由使用者手勢（按鈕 click）才呼叫 getUserMedia —— iOS Safari 的硬性要求。
   2. video 需 playsinline / webkit-playsinline / muted / autoplay，否則 iOS 會全螢幕接管。
   3. 後鏡頭：facingMode "environment"（MindAR 內建即為此設定）。
   4. 相機失敗一律走降級路徑，不讓玩家卡關。 */
window.AR = (function () {

  let host, sceneEl, running = false, onFoundCb = null, watchdog = null;

  function log(...a) { console.log('[AR]', ...a); }

  /* iOS 舊版另需 webkit-playsinline；MindAR 建立 video 後補上屬性 */
  function patchVideos() {
    const fix = v => {
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.setAttribute('muted', '');
      v.setAttribute('autoplay', '');
      v.muted = true;
      v.playsInline = true;
    };
    document.querySelectorAll('video').forEach(fix);
    const mo = new MutationObserver(ms => {
      ms.forEach(m => m.addedNodes.forEach(n => {
        if (n.tagName === 'VIDEO') fix(n);
        else if (n.querySelectorAll) n.querySelectorAll('video').forEach(fix);
      }));
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return mo;
  }

  /* 事前檢查：沒有 HTTPS / 沒有 mediaDevices 就不用試了 */
  function preflight() {
    const secure = window.isSecureContext ||
      location.protocol === 'https:' ||
      ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
    if (!secure) return { ok: false, reason: '需要 HTTPS 才能開啟相機。請用 https:// 或 localhost 開啟本頁。' };
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
      return { ok: false, reason: '這個瀏覽器不支援相機存取（navigator.mediaDevices 不存在）。' };
    return { ok: true };
  }

  /* 啟動：務必在使用者手勢（click）內呼叫 */
  async function start(level, opts) {
    const pf = preflight();
    if (!pf.ok) throw new Error(pf.reason);

    host = opts.host;
    onFoundCb = opts.onFound;
    const id = String(level.n).padStart(2, '0');
    const mindSrc = 'targets/level' + id + '.mind';

    await stop();
    const mo = patchVideos();

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

    log('starting mindar, target =', mindSrc);
    // 逾時保護：15 秒內沒跑起來就走降級路徑
    const timeout = new Promise((_, rej) =>
      watchdog = setTimeout(() => rej(new Error('相機或追蹤資料載入逾時（15 秒）。')), 15000));
    await Promise.race([sys.start(), timeout]);
    clearTimeout(watchdog); watchdog = null;

    // MindAR 的 start() 在相機被拒絕／被佔用時仍可能 resolve，
    // 影像卻永遠不會進來（videoWidth 一直是 0）。這裡實測確認真的有畫面，
    // 否則使用者會卡在一片黑的掃描畫面上。
    const ok = await waitForStream(8000);
    if (!ok) {
      await stop();
      throw new Error('相機沒有畫面，可能是未允許權限，或被其他 App 佔用。');
    }

    running = true;
    setTimeout(() => mo.disconnect(), 4000);
    log('mindar running, video ready');
    return true;
  }

  /* 等待相機真的送出畫面（videoWidth > 0） */
  function waitForStream(ms) {
    const t0 = Date.now();
    return new Promise(res => {
      const tick = () => {
        const v = document.querySelector('video');
        if (v && v.videoWidth > 0 && v.readyState >= 2) return res(true);
        if (Date.now() - t0 > ms) return res(false);
        setTimeout(tick, 250);
      };
      tick();
    });
  }

  /* MindAR 的 stop()/pause() 會直接存取 this.controller 與 this.video。
     相機從未成功啟動時 controller 是 undefined，而 A-Frame 在場景被移除時
     還會自己呼叫一次 system.pause()，於是丟出未攔截的 TypeError。
     先塞一個安全替身，讓後續所有生命週期呼叫都變成無動作。 */
  const NOOP_CONTROLLER = {
    stopProcessVideo() {}, processVideo() {}, dispose() {},
    getProjectionMatrix() { return null; }
  };

  async function stop() {
    if (watchdog) { clearTimeout(watchdog); watchdog = null; }
    onFoundCb = null;
    if (sceneEl) {
      const sys = sceneEl.systems && sceneEl.systems['mindar-image-system'];
      if (sys) {
        if (!sys.controller) sys.controller = NOOP_CONTROLLER;
        try {
          if (sys.video && sys.video.srcObject && sys.video.srcObject.getTracks)
            sys.video.srcObject.getTracks().forEach(t => t.stop());
        } catch (e) { log('track stop', e); }
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
    // 保險：關掉任何殘留的相機串流
    document.querySelectorAll('video').forEach(v => {
      if (v.srcObject && v.srcObject.getTracks) {
        v.srcObject.getTracks().forEach(t => t.stop());
        v.srcObject = null;
      }
    });
    running = false;
  }

  /* 給測試報告用：確認函式庫本身是否可用（不開相機） */
  function selfTest() {
    return {
      aframe: !!window.AFRAME,
      aframeVersion: window.AFRAME ? window.AFRAME.version : null,
      mindar: !!(window.MINDAR && window.MINDAR.IMAGE),
      compiler: !!(window.MINDAR && window.MINDAR.IMAGE && window.MINDAR.IMAGE.Compiler),
      systemRegistered: !!(window.AFRAME && AFRAME.systems['mindar-image-system']),
      componentRegistered: !!(window.AFRAME && AFRAME.components['mindar-image-target']),
      secureContext: preflight().ok,
      preflight: preflight()
    };
  }

  return { start, stop, selfTest, preflight, get running() { return running; } };
})();
