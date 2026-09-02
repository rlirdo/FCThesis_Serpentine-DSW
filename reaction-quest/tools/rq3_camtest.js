/* v2.0 相機路徑驗證：用 canvas.captureStream() 假造一條真的 MediaStream，
   讓 MindAR 走完整條路（_startVideo → _startAR → addImageTargets → processVideo），
   藉此在沒有實體鏡頭的桌機上驗證：
     ・單一串流交給 MindAR、影片持續播放且畫面不變黑
     ・換關 retarget()：controller 換掉、.mind 重掛、場景不重建
     ・targetFound／targetLost 交替時內容在錨點與螢幕懸浮之間搬家 */
window.RQCAM = (function () {
  var cv = document.createElement('canvas');
  cv.width = 640; cv.height = 480;
  var g = cv.getContext('2d');
  var t = 0;
  function paint() {
    t += 0.02;
    var gr = g.createLinearGradient(0, 0, 640, 480);
    gr.addColorStop(0, 'hsl(' + ((t * 40) % 360) + ',60%,55%)');
    gr.addColorStop(1, 'hsl(' + ((t * 40 + 120) % 360) + ',60%,35%)');
    g.fillStyle = gr; g.fillRect(0, 0, 640, 480);
    g.fillStyle = '#fff';
    g.fillRect(200 + Math.sin(t) * 120, 180, 160, 120);
    requestAnimationFrame(paint);
  }
  paint();
  var stream = cv.captureStream(30);

  function install() {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true, writable: true,
      value: function () { return Promise.resolve(stream); }
    });
    return 'fake camera installed, tracks=' + stream.getVideoTracks().length;
  }

  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  async function run() {
    var rep = { errs: [], samples: [], retarget: [], modes: [] };
    window.addEventListener('error', function (e) { rep.errs.push(String(e.message)); });
    install();
    RQ.S.route = 10;
    document.querySelector('#btn-start').click();
    await sleep(6000);

    var sys = STAGE.scene().systems['mindar-image-system'];
    rep.mindarStarted = !!(sys && sys.video);
    rep.hasController = !!(sys && sys.controller);
    rep.imageTargetSrc = sys && sys.imageTargetSrc;
    rep.videoCount = document.querySelectorAll('#ar-host video').length;
    rep.previewCount = document.querySelectorAll('video').length;
    var v = document.querySelector('#ar-host video');
    rep.video = v ? { w: v.videoWidth, h: v.videoHeight, paused: v.paused,
                      readyState: v.readyState,
                      tracks: v.srcObject ? v.srcObject.getVideoTracks().map(function (x) { return x.readyState; }) : [] } : null;
    rep.sameStream = !!(v && v.srcObject === document.querySelector('#cam-preview').srcObject);

    /* 每 100 ms 取樣畫面亮度，連續 3 秒；期間交替 found／lost */
    for (var i = 0; i < 30; i++) {
      if (i === 5) STAGE.simulate('found', 1);
      if (i === 12) STAGE.simulate('lost', 1);
      if (i === 18) STAGE.simulate('found', 0);
      if (i === 24) STAGE.simulate('lost', 0);
      var p = AR.probe();
      rep.samples.push({ b: Math.round(p.brightness * 10) / 10, paused: p.paused,
                         w: p.width, mode: STAGE.mode() });
      await sleep(100);
    }
    rep.minBrightness = Math.min.apply(null, rep.samples.map(function (s) { return s.b; }));
    rep.anyPaused = rep.samples.some(function (s) { return s.paused; });
    rep.anyZeroWidth = rep.samples.some(function (s) { return !s.w; });

    /* 換關：retarget 三次，記錄 controller 是否換新、.mind 是否更新 */
    for (var k = 1; k <= 3; k++) {
      var before = sys.controller;
      var lv = GAME_DATA.LEVELS.filter(function (l) { return l.n === RQ.ADV[k]; })[0];
      var ok = await STAGE.retarget(AR.targetPath(lv));
      await sleep(400);
      rep.retarget.push({ level: lv.n, ok: ok, src: sys.imageTargetSrc,
                          controllerSwapped: sys.controller !== before,
                          sceneStillOne: document.querySelectorAll('#ar-host a-scene').length,
                          videoStillOne: document.querySelectorAll('#ar-host video').length,
                          videoPaused: document.querySelector('#ar-host video').paused,
                          objects: STAGE.stats().objects });
    }
    rep.stats = STAGE.stats();
    rep.diag = AR.diagText().split('\n').slice(0, 3).join(' | ');
    return rep;
  }
  return { install: install, run: run, stream: stream };
})();
'RQCAM ready';
