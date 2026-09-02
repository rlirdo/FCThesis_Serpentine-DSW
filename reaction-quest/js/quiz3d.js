/* 蛇紋石改質反應探險 — 懸浮互動題 v2.0
   v1.1 的四種題型（tap3d／drag3d／order／anim）原封沿用同一份 QUIZ_DATA，
   只是舞台從「2D 網頁」搬到「卡片上方的懸浮 AR」：
     tap3d  → 3D 物件直接漂在卡片上方，用手指點
     drag3d → 手上的分子碎片跟著懸浮，點目標位置把它送過去
     order  → 四張懸浮卡片，依序點選
     anim   → 十段 Canvas 反應動畫貼成懸浮螢幕，
              ask:'time' 在懸浮時間軸上點關鍵時刻、ask:'pick' 點畫面中的區塊
   所有中文一律 canvas 貼圖（A-Frame 的 <a-text> 沒有中日韓字型）。 */
window.QUIZ3D = (function () {

  var T = null, G = null;            // THREE、目前題目群組
  var CO = { navy: '#0B1F3A', deep: '#065A82', teal: '#1C7293', green: '#2E7D5B',
             moss: '#5FA98A', gold: '#C99A3E', red: '#B03E34', ice: '#78B2C8',
             silver: '#DDE6EA', grey: '#9AA3AD', white: '#FFFFFF' };
  var SC = 0.42;                     // quizdata 座標 → 卡片單位
  var Y0 = -0.42;
  var SCRW = 1.20;                   // 懸浮動畫螢幕寬度（UI 空間）                    // 題目舞台在 UI 空間的中心高度（看板掛在 0 以下）
  var animRaf = 0, animState = null;
  var cb = null;                     // 作答回呼 {onAnswer(ok, msg)}

  function hex(c) { return new T.Color(c).getHex(); }

  function shapeOf(o) {
    var col = hex(o.color || CO.teal);
    var op = o.opacity === undefined ? 1 : o.opacity;
    var mat = new T.MeshStandardMaterial({ color: col, roughness: 0.42, metalness: 0.12,
                                           transparent: op < 1, opacity: op });
    var g;
    switch (o.shape) {
      case 'box': g = new T.BoxGeometry((o.w || 0.3) * SC, (o.h || 0.3) * SC, (o.d || 0.3) * SC); break;
      case 'cylinder': g = new T.CylinderGeometry((o.r || 0.1) * SC, (o.r || 0.1) * SC,
                                                  (o.h || 0.3) * SC, 12); break;
      case 'torus': g = new T.TorusGeometry((o.r || 0.3) * SC, (o.rt || 0.02) * SC, 8, 28); break;
      case 'plate': g = new T.PlaneGeometry((o.w || 1) * SC, (o.h || 1) * SC);
        mat = new T.MeshBasicMaterial({ color: col, transparent: true,
                                        opacity: op, side: T.DoubleSide, depthWrite: false }); break;
      default: g = new T.SphereGeometry((o.r || 0.12) * SC, 14, 10);
    }
    var m = new T.Mesh(g, mat);
    var p = o.pos || [0, 0, 0];
    m.position.set(p[0] * SC, Y0 + p[1] * SC, (p[2] || 0) * SC);
    if (o.rot) m.rotation.set(o.rot[0] * Math.PI / 180, o.rot[1] * Math.PI / 180,
                              o.rot[2] * Math.PI / 180);
    return m;
  }

  function labelFor(mesh, text, accent) {
    var cv = STAGE.drawChip(text, accent || CO.gold);
    var lab = STAGE.planeFrom(cv, 0.26 * cv.width / 300, { order: 16 });
    lab.position.copy(mesh.position);
    lab.position.y += 0.13;
    lab.position.z += 0.02;
    G.add(lab);
    return lab;
  }

  function panel(text, sub, w, accent) {
    var cv = STAGE.drawBoard({ title: text, lines: sub ? [sub] : [], accent: accent || CO.teal });
    return STAGE.planeFrom(cv, w || 0.44, { order: 16 });
  }

  /* ══════════ 主入口 ══════════ */
  function ask(q, handlers) {
    T = STAGE.THREE();
    cb = handlers || {};
    stopAnim();
    G = STAGE.newQuizGroup();
    switch (q.type) {
      case 'tap3d': return tap3d(q);
      case 'drag3d': return drag3d(q);
      case 'order': return order(q);
      case 'anim': return anim(q);
      default: return tap3d(q);
    }
  }
  function close() { stopAnim(); STAGE.clearQuizGroup(); G = null; }

  function judge(ok, obj, msg) {
    if (window.AUDIO) AUDIO.sfx(ok ? 'right' : 'wrong');
    if (ok && obj) STAGE.burst(obj.position.x, obj.position.y, obj.position.z, 34, 0x5FA98A, 0.45, 0.9);
    if (cb.onAnswer) cb.onAnswer(ok, msg);
  }

  /* ══════════ 型態一：點選 3D 物件 ══════════ */
  function tap3d(q) {
    (q.deco || []).forEach(function (d) { G.add(shapeOf(d)); });
    (q.objs || []).forEach(function (o) {
      var m = shapeOf(o);
      G.add(m);
      if (!o.label) return;
      labelFor(m, o.label, o.correct ? CO.moss : CO.teal);
      STAGE.registerHit(m, function () {
        judge(!!o.correct, m, o.correct ? null : (o.tip || q.tip));
      });
    });
    if (q.spin) G.userData.spin = 0.25;
    return true;
  }

  /* ══════════ 型態二：把手上的碎片送到正確位置 ══════════ */
  function drag3d(q) {
    (q.deco || []).forEach(function (d) { G.add(shapeOf(d)); });
    /* 手上的碎片：懸在舞台前方，跟著微微漂浮 */
    var chipCv = STAGE.drawChip(q.chip ? q.chip.label : '碎片', CO.gold, '手上的碎片');
    var chip = STAGE.planeFrom(chipCv, 0.34 * chipCv.width / 300, { order: 18 });
    chip.position.set(0, Y0 - 0.46, 0.22);
    G.add(chip);
    G.userData.chip = chip;
    (q.objs || []).forEach(function (o) {
      var m = shapeOf(o);
      G.add(m);
      if (!o.label) return;
      labelFor(m, o.label, o.correct ? CO.moss : CO.teal);
      STAGE.registerHit(m, function () {
        /* 碎片飛過去，再判定 —— 保留「拖過去放」的動作語意 */
        var from = chip.position.clone(), t0 = performance.now();
        var run = function () {
          var k = Math.min(1, (performance.now() - t0) / 420);
          var e = 1 - Math.pow(1 - k, 3);
          chip.position.lerpVectors(from, m.position, e);
          chip.scale.setScalar(1 - e * 0.45);
          if (k < 1) requestAnimationFrame(run);
          else judge(!!o.correct, m, o.correct ? null : (o.tip || q.tip));
        };
        requestAnimationFrame(run);
      });
    });
    return true;
  }

  /* ══════════ 型態三：依序點選（排序） ══════════ */
  function order(q) {
    var picked = [];
    var cards = (q.shuffle || q.cards.map(function (c) { return c.id; })).map(function (id) {
      return q.cards.filter(function (c) { return c.id === id; })[0];
    });
    var y = Y0 + 0.20;
    cards.forEach(function (c, i) {
      var cv = STAGE.drawBoard({ title: c.label, lines: c.sub ? [c.sub] : [], accent: CO.teal });
      var m = STAGE.planeFrom(cv, 1.10, { order: 16 });
      var h = 1.10 * cv.height / cv.width;
      m.position.set(0, y, -0.02 - i * 0.001);
      y -= h + 0.025;
      G.add(m);
      STAGE.registerHit(m, function () {
        if (picked.indexOf(c.id) >= 0) return;
        picked.push(c.id);
        m.position.x = 0.12;
        m.scale.setScalar(0.88);
        var badge = STAGE.planeFrom(
          STAGE.drawChip(String(picked.length), CO.gold), 0.14, { order: 18 });
        badge.position.set(m.position.x - 0.60, m.position.y, m.position.z + 0.02);
        G.add(badge);
        if (window.AUDIO) AUDIO.sfx('coin');
        if (picked.length === cards.length) {
          var ok = picked.join(',') === q.answer.join(',');
          setTimeout(function () { judge(ok, m, ok ? null : (q.tipOrder || q.tip)); }, 250);
        }
      });
    });
    return true;
  }

  /* ══════════ 型態四：懸浮動畫螢幕 ══════════ */
  function anim(q) {
    var meta = window.ANIMS ? ANIMS.meta(q.anim) : { dur: 8 };
    var W = 512, H = 288;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g2 = cv.getContext('2d');
    var tex = STAGE.texFrom(cv);
    var scr = new T.Mesh(new T.PlaneGeometry(SCRW, SCRW * H / W),
      new T.MeshBasicMaterial({ map: tex, transparent: true, side: T.DoubleSide,
                                depthWrite: false }));
    scr.renderOrder = 14;
    scr.position.set(0, Y0 - 0.06, -0.06);
    G.add(scr);

    /* 邊框 */
    var frame = new T.Mesh(new T.PlaneGeometry(SCRW + 0.05, SCRW * H / W + 0.05),
      new T.MeshBasicMaterial({ color: hex(CO.navy), transparent: true, opacity: 0.85,
                                side: T.DoubleSide, depthWrite: false }));
    frame.renderOrder = 13;
    frame.position.copy(scr.position); frame.position.z -= 0.005;
    G.add(frame);

    animState = { p: 0, dur: meta.dur || 8, t0: performance.now(), tex: tex,
                  ctx: g2, kind: q.anim, W: W, H: H, playing: true, answered: false };
    var loop = function () {
      animRaf = requestAnimationFrame(loop);
      if (!animState) return;
      if (animState.playing) {
        var el = (performance.now() - animState.t0) / 1000;
        animState.p = (el % animState.dur) / animState.dur;
      }
      if (window.ANIMS) ANIMS.draw(animState.kind, animState.ctx, animState.p,
                                   animState.W, animState.H);
      if (animState.bar) drawBar();
      animState.tex.needsUpdate = true;
    };
    animRaf = requestAnimationFrame(loop);

    if (q.ask === 'pick') {
      /* 在動畫螢幕上疊可點區塊（座標為 0–1 的正規化畫面座標） */
      (q.regions || []).forEach(function (r) {
        var pw = SCRW * r.w, phh = SCRW * H / W * r.h;
        var m = new T.Mesh(new T.PlaneGeometry(pw, phh),
          new T.MeshBasicMaterial({ color: hex(CO.gold), transparent: true, opacity: 0.12,
                                    side: T.DoubleSide, depthWrite: false }));
        m.renderOrder = 15;
        m.position.set(scr.position.x + (r.x + r.w / 2 - 0.5) * SCRW,
                       scr.position.y - (r.y + r.h / 2 - 0.5) * SCRW * H / W,
                       scr.position.z + 0.012);
        G.add(m);
        var lab = STAGE.planeFrom(STAGE.drawChip(r.label, CO.gold), 0.20, { order: 17 });
        lab.position.set(m.position.x, m.position.y - phh / 2 - 0.05, m.position.z);
        G.add(lab);
        STAGE.registerHit(m, function () {
          if (animState) animState.playing = false;
          judge(!!r.correct, m, r.correct ? null : (r.tip || q.tip));
        });
      });
    } else {
      /* ask:'time'：懸浮時間軸，點下去的位置就是你的答案 */
      var bcv = document.createElement('canvas'); bcv.width = 512; bcv.height = 72;
      animState.bar = { cv: bcv, ctx: bcv.getContext('2d'), pick: null };
      var btex = STAGE.texFrom(bcv);
      var bar = new T.Mesh(new T.PlaneGeometry(SCRW, SCRW * 72 / 512),
        new T.MeshBasicMaterial({ map: btex, transparent: true, side: T.DoubleSide,
                                  depthWrite: false }));
      bar.renderOrder = 16;
      bar.position.set(0, Y0 - 0.52, -0.02);
      animState.bar.tex = btex;
      G.add(bar);
      STAGE.registerHit(bar, function (obj, hit) {
        if (!hit || !hit.uv || !animState || animState.answered) return;
        var p = Math.max(0, Math.min(1, hit.uv.x));
        animState.bar.pick = p;
        animState.playing = false;
        animState.p = p;
        var key = meta.key === undefined ? 0.5 : meta.key;
        var tol = meta.tol === undefined ? 0.1 : meta.tol;
        var ok = Math.abs(p - key) <= tol;
        animState.answered = true;
        animState.bar.key = key;
        judge(ok, bar, ok ? null : (q.tip || '再看一次動畫，注意畫面「開始改變」的那一瞬間。'));
      });
    }
    return true;
  }

  function drawBar() {
    var b = animState.bar, g2 = b.ctx, W = 512, H = 72;
    g2.clearRect(0, 0, W, H);
    g2.fillStyle = 'rgba(11,31,58,0.88)';
    g2.fillRect(0, 0, W, H);
    g2.fillStyle = '#1C7293';
    g2.fillRect(24, 30, W - 48, 12);
    g2.fillStyle = '#5FA98A';
    g2.fillRect(24, 30, (W - 48) * animState.p, 12);
    /* 目前播放頭 */
    g2.fillStyle = '#FFFFFF';
    g2.fillRect(24 + (W - 48) * animState.p - 3, 22, 6, 28);
    if (b.pick !== null && b.pick !== undefined) {
      g2.fillStyle = '#C99A3E';
      g2.fillRect(24 + (W - 48) * b.pick - 3, 16, 6, 40);
    }
    if (b.key !== undefined) {
      g2.strokeStyle = '#B03E34'; g2.lineWidth = 3;
      g2.beginPath();
      g2.moveTo(24 + (W - 48) * b.key, 12); g2.lineTo(24 + (W - 48) * b.key, 60);
      g2.stroke();
    }
    g2.font = 'bold 20px "Microsoft JhengHei",sans-serif';
    g2.fillStyle = '#DCE7EC'; g2.textAlign = 'left'; g2.textBaseline = 'middle';
    g2.fillText('點時間軸作答', 24, 12);
    b.tex.needsUpdate = true;
  }

  function stopAnim() {
    if (animRaf) { cancelAnimationFrame(animRaf); animRaf = 0; }
    animState = null;
  }
  function replay() {
    if (!animState) return false;
    animState.t0 = performance.now();
    animState.playing = true;
    return true;
  }

  return { ask: ask, close: close, replay: replay,
           state: function () { return animState; } };
})();
