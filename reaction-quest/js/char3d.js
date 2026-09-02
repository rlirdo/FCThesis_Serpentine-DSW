/* 蛇紋石改質反應探險 — 3D 主角 v1.1
   ── 為什麼從 SVG 換成 3D ────────────────────────────────────────
   v1.0 的迷宮主角是一張平面 SVG，轉向只能左右鏡射，走起來沒有「人」的感覺。
   v1.1 改成 A-Frame 程序化低多邊形角色：
     ・轉向 → Y 軸旋轉（平滑補間），真的會面向行進方向
     ・行走 → 上下起伏（bob）＋輕微左右擺（sway）
     ・待機 → 緩慢呼吸縮放
   ── 效能紀律（手機必須流暢）────────────────────────────────────
     ・所有球體／圓柱一律降段數（segments 12x8 / radial 10），單角色 < 2000 三角形
     ・不開陰影、不開後處理、antialias 關閉、pixelRatio 夾在 1.5
     ・a-scene 只有巴掌大（約 2.4 格），且探索模式與掃描模式的 a-scene 絕不同時存在
       （enterAR 時 destroy()，回到迷宮時 mount() 重建）
   ── 錨定方式 ────────────────────────────────────────────────
   角色不在 3D 世界裡移動，而是把整個 embedded a-scene 的容器 div 用 left/top
   移到迷宮格中心（與 v1.0 的 #hero 完全相同的座標算法）。這樣既不必重算投影，
   也讓「不被 D-pad 遮住」的 mazeRect() 執行期量測保證原封生效。 */
window.CHAR3D = (function () {

  /* 朝向：模型正面朝 +Z（面向鏡頭）。繞 Y 轉 θ 後正面 = (sinθ, 0, cosθ)。
     螢幕右 = +X、螢幕下 = +Z（朝鏡頭）→ down:0 right:90 left:-90 up:180 */
  const YAW = { down: 0, right: 90, left: -90, up: 180 };

  const SEG = 'segments-width="10" segments-height="7"';
  const CYL = 'segments-radial="8" segments-height="1"';

  const sph = (x, y, z, r, col, mat) =>
    '<a-sphere position="' + x + ' ' + y + ' ' + z + '" radius="' + r + '" ' +
    (mat ? 'material="' + mat + '"' : 'color="' + col + '"') + ' ' + SEG + '></a-sphere>';
  const cyl = (x, y, z, r, h, col, rot) =>
    '<a-cylinder position="' + x + ' ' + y + ' ' + z + '" radius="' + r + '" height="' + h +
    '" color="' + col + '" rotation="' + (rot || '0 0 0') + '" ' + CYL + '></a-cylinder>';
  const cone = (x, y, z, rb, rt, h, col, rot) =>
    '<a-cone position="' + x + ' ' + y + ' ' + z + '" radius-bottom="' + rb + '" radius-top="' + rt +
    '" height="' + h + '" color="' + col + '" rotation="' + (rot || '0 0 0') +
    '" segments-radial="8" segments-height="1"></a-cone>';
  /* 眼睛：白眼球＋深色瞳孔，一律放在 +Z 面，才會隨轉向一起被遮住／露出 */
  const eyes = (y, dx, r, z) =>
    sph(-dx, y, z, r, '#FFFFFF') + sph(dx, y, z, r, '#FFFFFF') +
    sph(-dx, y, z + r * 0.62, r * 0.48, '#0B1F3A') + sph(dx, y, z + r * 0.62, r * 0.48, '#0B1F3A');

  /* ══════════ 三位主角（人設沿用 v1.0，全部程序化幾何） ══════════ */
  const RIGS = {
    /* 泡泡 Mimi：半透明球體 ＋ 親水鬚髮（朝外）＋ 疏水小尾（朝下） */
    mimi: function () {
      let s = '';
      s += sph(0, 0.46, 0, 0.30, null,
        'color: #1C7293; opacity: 0.62; transparent: true; metalness: 0.05; roughness: 0.35');
      s += sph(0, 0.46, 0, 0.155, '#C99A3E');                       // 疏水核心透出來
      s += eyes(0.52, 0.105, 0.055, 0.255);
      s += cyl(0, 0.375, 0.265, 0.055, 0.012, '#0B1F3A', '90 0 0'); // 嘴（薄圓片）
      for (let k = 0; k < 5; k++) {                                  // 親水鬚髮
        const a = (-150 + k * 65) * Math.PI / 180;
        const deg = a * 180 / Math.PI;
        const x1 = Math.cos(a) * 0.30, y1 = 0.46 + Math.sin(a) * 0.30;
        const x2 = Math.cos(a) * 0.44, y2 = 0.46 + Math.sin(a) * 0.44;
        s += cyl((x1 + x2) / 2, (y1 + y2) / 2, 0, 0.017, 0.16, '#5FA98A', '0 0 ' + (-deg - 90));
        s += sph(x2, y2, 0, 0.045, '#5FA98A');
      }
      s += cone(0, 0.10, -0.03, 0.075, 0.012, 0.20, '#0B1F3A', '180 0 0');  // 疏水小尾
      s += cyl(0, 0.035, 0, 0.135, 0.05, '#0F3A55');                        // 底座
      return s;
    },

    /* 蛇紋喵：綠鱗紋貓、胸口 –OH 徽章 */
    serpy: function () {
      let s = '';
      s += sph(0, 0.30, 0, 0.235, '#2E7D5B');                        // 身體
      for (let k = 0; k < 4; k++)                                    // 鱗紋
        s += cyl(-0.13 + k * 0.085, 0.30 + (k % 2) * 0.07, 0.195, 0.045, 0.014, '#5FA98A', '90 0 32');
      s += sph(0, 0.665, 0, 0.205, '#2E7D5B');                       // 頭
      s += cone(-0.135, 0.83, 0, 0.085, 0.012, 0.17, '#2E7D5B', '0 0 18');   // 耳
      s += cone(0.135, 0.83, 0, 0.085, 0.012, 0.17, '#2E7D5B', '0 0 -18');
      s += cone(-0.135, 0.825, 0.03, 0.048, 0.01, 0.11, '#C99A3E', '0 0 18');
      s += cone(0.135, 0.825, 0.03, 0.048, 0.01, 0.11, '#C99A3E', '0 0 -18');
      s += eyes(0.70, 0.085, 0.048, 0.175);
      s += sph(0, 0.635, 0.20, 0.032, '#C99A3E');                    // 鼻
      s += cyl(-0.20, 0.635, 0.13, 0.008, 0.16, '#DDE6EA', '0 0 -78');
      s += cyl(0.20, 0.635, 0.13, 0.008, 0.16, '#DDE6EA', '0 0 78');
      s += cyl(0, 0.30, 0.225, 0.075, 0.022, '#C99A3E', '90 0 0');   // –OH 徽章
      s += sph(0, 0.30, 0.245, 0.038, '#F2D89A');
      s += cyl(0.24, 0.20, -0.06, 0.032, 0.30, '#2E7D5B', '18 0 -58');  // 尾
      s += sph(0.38, 0.32, -0.10, 0.05, '#5FA98A');
      s += cyl(0, 0.045, 0, 0.13, 0.06, '#1E4A38');
      return s;
    },

    /* 水滴 Aqua：水滴體（球＋上尖）＋ 氫鍵天線 */
    aqua: function () {
      let s = '';
      s += sph(0, 0.36, 0, 0.265, null,
        'color: #065A82; opacity: 0.80; transparent: true; metalness: 0.10; roughness: 0.25');
      s += cone(0, 0.70, 0, 0.20, 0.014, 0.34, '#065A82', '0 0 0');
      s += sph(-0.09, 0.44, 0.19, 0.055, '#9BD8F0');                 // 高光
      s += eyes(0.40, 0.095, 0.052, 0.225);
      s += cyl(0, 0.285, 0.235, 0.05, 0.014, '#0B1F3A', '90 0 0');
      s += cyl(-0.16, 0.80, 0, 0.014, 0.26, '#C99A3E', '0 0 -26');   // 氫鍵天線
      s += cyl(0.16, 0.80, 0, 0.014, 0.26, '#C99A3E', '0 0 26');
      s += sph(-0.235, 0.92, 0, 0.05, '#DDE6EA');
      s += sph(0.235, 0.92, 0, 0.05, '#DDE6EA');
      s += cyl(0, 0.045, 0, 0.145, 0.05, '#053A56');
      return s;
    }
  };

  const IDS = Object.keys(RIGS);
  function rigHTML(id) { return (RIGS[id] || RIGS.mimi)(); }

  /* ══════════ 場景建立 ══════════ */
  function makeScene(hostEl, id, opts) {
    const o = opts || {};
    const sc = document.createElement('a-scene');
    sc.setAttribute('embedded', '');
    sc.setAttribute('vr-mode-ui', 'enabled: false');
    sc.setAttribute('device-orientation-permission-ui', 'enabled: false');
    sc.setAttribute('renderer', 'alpha: true; antialias: false; colorManagement: true; precision: mediump');
    sc.setAttribute('background', 'transparent: true');
    sc.setAttribute('loading-screen', 'enabled: false');
    sc.innerHTML =
      '<a-entity class="c3d-cam" camera="fov: 46" position="0 0.50 1.85" rotation="-5 0 0" ' +
      'look-controls="enabled: false" wasd-controls="enabled: false"></a-entity>' +
      '<a-entity light="type: ambient; color: #FFFFFF; intensity: 0.92"></a-entity>' +
      '<a-entity light="type: directional; color: #FFFFFF; intensity: 0.55" position="1 2 1.4"></a-entity>' +
      '<a-entity class="c3d-yaw" rotation="0 ' + (o.yaw === undefined ? 0 : o.yaw) + ' 0">' +
      '<a-entity class="c3d-body">' + rigHTML(id) + '</a-entity></a-entity>';
    hostEl.appendChild(sc);
    /* ── A-Frame 1.5 的坑：同一頁建立多個 a-scene 時，後面的場景在 'loaded' 事件
       發生的當下 camera 系統可能還沒把我們自己的相機登記成 activeCameraEl，
       於是它自作主張注入一台預設相機（position 0 1.6 0、朝 -Z），
       並把我們的相機 active 設成 false —— 畫面就整片空白。
       這裡在 loaded 之後把注入的相機移除、強制把自己的相機設回 active。 */
    const fixCam = function () {
      try {
        const cam = sc.querySelector('.c3d-cam');
        if (!cam) return;
        const inj = sc.querySelector('[camera][aframe-injected]');
        if (inj && inj !== cam && inj.parentNode) inj.parentNode.removeChild(inj);
        cam.setAttribute('camera', 'active', true);
        if (sc.systems && sc.systems.camera) sc.systems.camera.setActiveCamera(cam);
        cam.play();
      } catch (e) { console.warn('[char3d] fixCam', e); }
    };
    if (sc.hasLoaded) fixCam(); else sc.addEventListener('loaded', fixCam, { once: true });
    const trim = function () {
      try {
        sc.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        sc.renderer.shadowMap.enabled = false;
      } catch (e) {}
    };
    if (sc.renderer) trim(); else sc.addEventListener('render-target-loaded', trim, { once: true });
    return sc;
  }

  function disposeScene(sc) {
    if (!sc) return;
    try {
      const r = sc.renderer;
      if (sc.parentNode) sc.parentNode.removeChild(sc);
      if (r && r.dispose) r.dispose();
      if (r && r.forceContextLoss) r.forceContextLoss();
    } catch (e) { console.warn('[char3d] dispose', e); }
  }

  /* ══════════ 迷宮主角（單一實例） ══════════ */
  const M = { scene: null, host: null, id: null, yaw: 0, target: 0,
              walk: 0, moving: false, raf: 0, t0: 0 };

  function mount(hostEl, charId) {
    if (M.scene && M.host === hostEl && M.id === charId) return M.scene;
    destroy();
    if (!window.AFRAME || !hostEl) return null;
    M.host = hostEl; M.id = charId;
    M.yaw = M.target = YAW.down;
    M.walk = 0; M.moving = false; M.t0 = performance.now();
    M.scene = makeScene(hostEl, charId, { yaw: YAW.down });
    if (!M.raf) loop();
    return M.scene;
  }

  function destroy() {
    if (M.raf) { cancelAnimationFrame(M.raf); M.raf = 0; }
    disposeScene(M.scene);
    M.scene = null; M.host = null; M.id = null; M.moving = false;
  }

  /* 轉向：把目標角拉到與現值同一圈，避免 -90 → 180 轉了 270 度 */
  function face(dir) {
    if (YAW[dir] === undefined) return M.target;
    let t = YAW[dir];
    while (t - M.target > 180) t -= 360;
    while (t - M.target < -180) t += 360;
    M.target = t;
    return t;
  }
  function setMoving(v) { M.moving = !!v; }

  function loop() {
    M.raf = requestAnimationFrame(loop);
    if (!M.scene) return;
    const yawEl = M.scene.querySelector('.c3d-yaw');
    const bodyEl = M.scene.querySelector('.c3d-body');
    if (!yawEl || !bodyEl || !yawEl.object3D || !bodyEl.object3D) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - M.t0) / 1000);
    M.t0 = now;

    const k = 1 - Math.pow(0.0005, dt);          // 約 120 ms 收斂
    M.yaw += (M.target - M.yaw) * k;
    if (Math.abs(M.target - M.yaw) < 0.15) M.yaw = M.target;
    yawEl.object3D.rotation.y = M.yaw * Math.PI / 180;

    if (M.moving) M.walk += dt * 9.5;
    const o = bodyEl.object3D;
    const amp = M.moving ? 1 : 0;
    o.position.y = Math.abs(Math.sin(M.walk)) * 0.075 * amp;   // 上下起伏
    o.rotation.z = Math.sin(M.walk * 0.5) * 0.10 * amp;        // 輕微左右擺
    const br = 1 + Math.sin(now / 900) * (M.moving ? 0.012 : 0.030);   // 待機呼吸
    o.scale.set(br, 2 - br, br);
  }

  /* ══════════ 選角 3D 預覽（離開畫面即銷毀，避免多個 WebGL context） ══════════ */
  const P = { list: [], raf: 0 };

  function mountPreviews(sel) {
    destroyPreviews();
    if (!window.AFRAME) return 0;
    Array.prototype.forEach.call(document.querySelectorAll(sel), function (host) {
      const id = host.dataset.char3d;
      if (!RIGS[id]) return;
      host.innerHTML = '';
      P.list.push({ sc: makeScene(host, id, { yaw: 0 }), ph: P.list.length * 1.9 });
    });
    if (P.list.length) spin();
    return P.list.length;
  }
  function spin() {
    P.raf = requestAnimationFrame(spin);
    const t = performance.now() / 1000;
    P.list.forEach(function (p, i) {
      const y = p.sc.querySelector('.c3d-yaw'), b = p.sc.querySelector('.c3d-body');
      if (y && y.object3D) y.object3D.rotation.y = (t * 0.55 + i * 0.7) % (Math.PI * 2);
      if (b && b.object3D) {
        b.object3D.position.y = Math.sin(t * 1.6 + p.ph) * 0.022;
        const br = 1 + Math.sin(t * 1.1 + p.ph) * 0.028;
        b.object3D.scale.set(br, 2 - br, br);
      }
    });
  }
  function destroyPreviews() {
    if (P.raf) { cancelAnimationFrame(P.raf); P.raf = 0; }
    P.list.forEach(function (p) { disposeScene(p.sc); });
    P.list = [];
  }

  /* ══════════ 驗收掛鉤 ══════════ */
  function polyCount(scene) {
    const sc = scene || M.scene;
    let tri = 0, meshes = 0;
    if (!sc || !sc.object3D) return { tri: 0, meshes: 0 };
    sc.object3D.traverse(function (o) {
      if (!o.isMesh || !o.geometry) return;
      meshes++;
      const g = o.geometry;
      tri += g.index ? g.index.count / 3
                     : (g.attributes && g.attributes.position ? g.attributes.position.count / 3 : 0);
    });
    return { tri: Math.round(tri), meshes: meshes };
  }
  function fpsSample(ms) {
    return new Promise(function (res) {
      let n = 0; const t0 = performance.now();
      const tick = function () {
        n++;
        const el = performance.now() - t0;
        if (el >= (ms || 3000)) return res(Math.round(n / (el / 1000)));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  return {
    IDS: IDS, YAW: YAW, mount: mount, destroy: destroy, face: face, setMoving: setMoving,
    rigHTML: rigHTML, makeScene: makeScene, disposeScene: disposeScene,
    mountPreviews: mountPreviews, destroyPreviews: destroyPreviews,
    polyCount: polyCount, fpsSample: fpsSample,
    scene: function () { return M.scene; },
    state: function () {
      return { id: M.id, yaw: M.yaw, target: M.target, moving: M.moving, mounted: !!M.scene };
    }
  };
})();
