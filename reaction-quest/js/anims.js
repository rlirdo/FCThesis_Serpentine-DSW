/* 蛇紋石改質反應探險 — 反應動畫庫 v1.1
   ── 為什麼是頁內動畫而不是影片檔 ──────────────────────────────
   本機沒有 ffmpeg（`where ffmpeg` 為空），無法離線輸出 WebM／MP4。
   因此十段反應動畫一律以 Canvas 逐幀自繪（6–10 秒、可重播、有進度條與時間軸），
   體積為零、可任意縮放、也不必處理 iOS 的自動播放限制。
   若日後裝了 ffmpeg，只要把 draw(ctx, p) 逐幀輸出即可轉成真影片，介面不必改。

   每一段動畫都是 draw(ctx, p, W, H)：p 為 0–1 的進度，純函式、無狀態，
   所以進度條可以任意拖曳、暫停、重播，畫面永遠一致（可重現＝可驗收）。 */
window.ANIMS = (function () {

  const C = { navy: '#0B1F3A', deep: '#065A82', teal: '#1C7293', green: '#2E7D5B',
              moss: '#5FA98A', gold: '#C99A3E', grey: '#64748B', ink: '#1E293B',
              red: '#B03E34', rust: '#8C4A2F', ice: '#78B2C8', white: '#FFFFFF',
              paper: '#F1F6F8' };
  const FF = '"Microsoft JhengHei","Noto Sans TC",sans-serif';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  /* seg(p, a, b)：把整段進度 p 映射到 [a,b] 這一小段的 0–1 */
  const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  function bg(ctx, W, H, col) {
    ctx.fillStyle = col || C.paper;
    ctx.fillRect(0, 0, W, H);
  }
  function txt(ctx, x, y, size, s, col, align, weight) {
    ctx.font = (weight || 'bold') + ' ' + size + 'px ' + FF;
    ctx.fillStyle = col;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  function dot(ctx, x, y, r, col, alpha) {
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832);
    ctx.fillStyle = col; ctx.fill();
    ctx.globalAlpha = 1;
  }
  function ring(ctx, x, y, r, col, w, alpha) {
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832);
    ctx.strokeStyle = col; ctx.lineWidth = w || 2; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function rrect(ctx, x, y, w, h, r, fill, stroke, lw) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  }
  function line(ctx, x1, y1, x2, y2, col, w, dash) {
    ctx.save();
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = col; ctx.lineWidth = w || 2; ctx.stroke();
    ctx.restore();
  }
  function flash(ctx, x, y, r, k, col) {
    if (k <= 0) return;
    ctx.globalAlpha = k;
    for (let i = 0; i < 10; i++) {
      const a = i * 0.6283;
      line(ctx, x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4,
           x + Math.cos(a) * r, y + Math.sin(a) * r, col || C.gold, 3);
    }
    ctx.globalAlpha = 1;
  }

  /* ═══════════ 十段反應動畫 ═══════════ */
  const A = {

    /* L1：TO 型層狀單元組裝，第二個單元靠氫鍵疊上來 */
    l1_stack(ctx, p, W, H) {
      bg(ctx, W, H, '#EDF4F7');
      txt(ctx, W / 2, 16, 12, '蛇紋石 1:1（TO）型單元的組裝', C.ink);
      const cx = W / 2, base = H - 44;
      const unit = (y, alpha) => {
        ctx.globalAlpha = alpha;
        rrect(ctx, cx - 118, y, 236, 17, 4, '#CEE4EC', C.deep, 2);          // T 層
        for (let i = 0; i < 9; i++) {
          const x = cx - 112 + i * 25;
          ctx.beginPath(); ctx.moveTo(x, y + 3); ctx.lineTo(x + 18, y + 3);
          ctx.lineTo(x + 9, y + 14); ctx.closePath();
          ctx.fillStyle = '#78B2C8'; ctx.fill();
        }
        rrect(ctx, cx - 118, y + 18, 236, 17, 4, '#D6EADE', C.green, 2);    // O 層
        for (let i = 0; i < 3; i++) dot(ctx, cx - 76 + i * 76, y + 42, 6, C.gold);
        ctx.globalAlpha = 1;
      };
      /* 0–0.25 T 層滑入、0.25–0.45 O 層滑入、0.45–0.58 鍵結、0.62–0.88 第二單元疊上 */
      const s1 = ease(seg(p, 0, 0.45));
      ctx.save();
      ctx.translate((1 - s1) * -160, 0);
      unit(base - 46, 0.35 + s1 * 0.65);
      ctx.restore();
      if (p > 0.45) {
        const b = seg(p, 0.45, 0.58);
        txt(ctx, cx, base + 22, 11, '① 一 T 一 O 疊成一個結構單元', C.green);
        flash(ctx, cx, base - 28, 22 * b, 1 - b, C.teal);
      }
      if (p > 0.60) {
        const s2 = ease(seg(p, 0.60, 0.80));
        ctx.save();
        ctx.translate(0, (1 - s2) * -74);
        unit(base - 108, 0.4 + s2 * 0.6);
        ctx.restore();
        /* 氫鍵：兩個單元之間的虛線（只有靠氫鍵，不是化學鍵） */
        if (s2 > 0.85) {
          const k = seg(p, 0.78, 0.90);
          for (let i = 0; i < 5; i++)
            line(ctx, cx - 90 + i * 45, base - 62, cx - 90 + i * 45, base - 48,
                 C.gold, 2.4, [3, 3]);
          ctx.globalAlpha = k;
          txt(ctx, cx, base - 55 + 30, 11, '② 層與層只靠氫鍵相黏（比化學鍵弱）', C.gold);
          ctx.globalAlpha = 1;
        }
      }
      if (p > 0.9) txt(ctx, cx, 32, 11, '所以蛇紋石容易一片一片剝開', C.grey, 'center', 'normal');
    },

    /* L2：溶解 CO₂ → 碳酸 → 碳酸根 → MgCO₃ 白色沉澱 */
    l2_mgco3(ctx, p, W, H) {
      bg(ctx, W, H, '#0C3550');
      rrect(ctx, 18, 26, W - 36, H - 52, 10, '#0F4A6B', C.teal, 2);
      txt(ctx, W / 2, 15, 12, '未脫氣的深層海水：碳酸鹽共沉的完整過程', '#CFE7F2');
      const bot = H - 34;
      for (let i = 0; i < 6; i++) {                                  // CO2 溶入
        const t = clamp((p - i * 0.02) / 0.26, 0, 1);
        if (t <= 0) continue;
        const x = 44 + i * 42, y = 46 + t * 60;
        dot(ctx, x, y, 7 - t * 3, '#9AA3AD', 1 - t * 0.55);
        if (t < 0.9) txt(ctx, x, y, 8, 'CO2', C.navy);
      }
      if (p > 0.24) {                                                // H2CO3
        const t = seg(p, 0.24, 0.44);
        ctx.globalAlpha = t;
        txt(ctx, W / 2, 92, 12, 'CO₂ + H₂O → H₂CO₃', '#FFE8B8');
        ctx.globalAlpha = 1;
      }
      if (p > 0.44) {                                                // CO3 2-
        const t = seg(p, 0.44, 0.60);
        ctx.globalAlpha = t;
        txt(ctx, W / 2, 112, 12, 'H₂CO₃ → HCO₃⁻ → CO₃²⁻', '#FFE8B8');
        ctx.globalAlpha = 1;
        for (let i = 0; i < 4; i++) dot(ctx, 70 + i * 60, 128, 6 * t, C.moss);
      }
      /* 0.62 起：Mg2+ 與 CO3 2- 結合，白色沉澱開始生成並落下 */
      if (p > 0.62) {
        const t = seg(p, 0.62, 1);
        for (let i = 0; i < 5; i++) {
          const x = 58 + i * 56;
          const y = 130 + t * (bot - 132) * (0.6 + i * 0.1);
          dot(ctx, x, Math.min(y, bot - 6), 5 + t * 3, '#F2F6F8', 0.95);
        }
        flash(ctx, W / 2, 132, 26, Math.max(0, 1 - seg(p, 0.62, 0.72)), '#FFFFFF');
        ctx.globalAlpha = Math.min(1, t * 2);
        txt(ctx, W / 2, bot + 12, 12, 'Mg²⁺ + CO₃²⁻ → MgCO₃↓（白色沉澱，把鎂搶走）', '#FFD9D4');
        ctx.globalAlpha = 1;
      } else {
        txt(ctx, W / 2, bot + 12, 11, '所以滴定前必須先超音波脫氣 15 分鐘', '#9FC4D8', 'center', 'normal');
      }
    },

    /* L4：兩格對照——左為 Lipshutz 的有機反應腔，右為本研究的分散／界面載體 */
    l4_use(ctx, p, W, H) {
      bg(ctx, W, H, '#F4F8FA');
      const hw = W / 2;
      rrect(ctx, 6, 24, hw - 12, H - 36, 10, '#FFFFFF', '#CBD9DF', 2);
      rrect(ctx, hw + 6, 24, hw - 12, H - 36, 10, '#FFFFFF', '#CBD9DF', 2);
      txt(ctx, hw / 2, 15, 11.5, 'A　把有機分子裝進核心', C.grey);
      txt(ctx, hw + hw / 2, 15, 11.5, 'B　撐開礦粉並在界面放離子', C.grey);
      /* A：疏水受質游進微胞核心 */
      const ax = hw / 2, ay = H / 2 + 6;
      ring(ctx, ax, ay, 40, C.teal, 3, 0.5);
      dot(ctx, ax, ay, 24, C.gold, 0.9);
      const t1 = ease(seg(p, 0.1, 0.55));
      dot(ctx, ax + (1 - t1) * 52, ay - (1 - t1) * 34, 9, C.rust);
      txt(ctx, ax, ay + 58, 10, '有機受質進核心反應', C.grey, 'center', 'normal');
      /* B：微胞把蛇紋石微粒撐開，Fe3+／Mg2+ 在界面釋放 */
      const bx = hw + hw / 2, by = H / 2 + 2;
      const spread = ease(seg(p, 0.1, 0.6)) * 16;
      for (let i = 0; i < 3; i++) {
        const a = i * 2.094 + 0.4;
        ctx.save();
        ctx.translate(bx + Math.cos(a) * spread, by + Math.sin(a) * spread);
        ctx.rotate(a);
        rrect(ctx, -17, -8, 34, 16, 3, '#B9CBBF', C.green, 2);
        ctx.restore();
      }
      const t2 = seg(p, 0.55, 1);
      for (let i = 0; i < 4; i++) {
        const a = i * 1.571 + 0.7;
        const r = 46 - t2 * 20;
        dot(ctx, bx + Math.cos(a) * r, by + Math.sin(a) * r, 6, i % 2 ? C.rust : C.moss);
      }
      ring(ctx, bx, by, 46 - t2 * 6, C.teal, 2.4, 0.55);
      txt(ctx, bx, by + 58, 10, '分散粉體＋界面受控釋放', C.green, 'center', 'normal');
    },

    /* L5：球磨時間 vs D50 下降曲線，批次 1 終點 1.8 μm */
    l5_d50(ctx, p, W, H) {
      bg(ctx, W, H, '#FFFFFF');
      txt(ctx, W / 2, 14, 12, '球磨時間對粒徑 D50 的影響', C.ink);
      const x0 = 44, x1 = W - 20, y0 = 34, y1 = H - 34;
      line(ctx, x0, y1, x1, y1, C.grey, 2);
      line(ctx, x0, y0, x0, y1, C.grey, 2);
      txt(ctx, 22, y0 + 6, 9, 'μm', C.grey, 'center', 'normal');
      txt(ctx, W / 2, H - 16, 10, '球磨時間 →', C.grey, 'center', 'normal');
      /* D50 由 12 μm 指數衰減到 1.5 μm；1.8 μm 出現在 p ≈ 0.70 */
      const dOf = u => 1.5 + 10.5 * Math.exp(-3.6 * u);
      const yOf = d => y1 - (d / 13) * (y1 - y0);
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const u = i / 120 * p;
        const x = x0 + u * (x1 - x0);
        if (i === 0) ctx.moveTo(x, yOf(dOf(u))); else ctx.lineTo(x, yOf(dOf(u)));
      }
      ctx.strokeStyle = C.teal; ctx.lineWidth = 3; ctx.stroke();
      line(ctx, x0, yOf(1.8), x1, yOf(1.8), C.gold, 2, [5, 4]);
      txt(ctx, x1 - 4, yOf(1.8) - 9, 10, 'D50 = 1.8 μm（批次 1）', C.gold, 'right');
      const cx = x0 + p * (x1 - x0), cy = yOf(dOf(p));
      dot(ctx, cx, cy, 6, C.green);
      txt(ctx, clamp(cx, x0 + 30, x1 - 30), Math.max(y0 + 10, cy - 14), 11,
          dOf(p).toFixed(1) + ' μm', C.green);
      if (Math.abs(dOf(p) - 1.8) < 0.25) flash(ctx, cx, cy, 18, 0.9, C.gold);
    },

    /* L6：濃度上升，表面張力下降到轉折（CMC）後打平，微胞開始出現 */
    l6_cmc(ctx, p, W, H) {
      bg(ctx, W, H, '#FFFFFF');
      txt(ctx, W / 2, 14, 12, '濃度上升時的表面張力：轉折點就是 CMC', C.ink);
      const x0 = 40, x1 = W - 18, y0 = 32, y1 = H - 36;
      line(ctx, x0, y1, x1, y1, C.grey, 2);
      line(ctx, x0, y0, x0, y1, C.grey, 2);
      txt(ctx, W / 2, H - 16, 10, '界面活性劑濃度 →', C.grey, 'center', 'normal');
      const K = 0.5;                                  // CMC 落在中點
      const gOf = u => u < K ? 1 - (u / K) * 0.72 : 0.28 - (u - K) * 0.06;
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const u = i / 120 * p;
        const x = x0 + u * (x1 - x0), y = y0 + (1 - gOf(u)) * (y1 - y0) * 0.86;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = C.deep; ctx.lineWidth = 3; ctx.stroke();
      const kx = x0 + K * (x1 - x0);
      if (p > K) {
        line(ctx, kx, y0, kx, y1, C.gold, 2, [5, 4]);
        txt(ctx, kx + 4, y0 + 8, 10, 'CMC', C.gold, 'left');
      }
      /* 超過 CMC 之後微胞才開始出現，且數量隨濃度增加 */
      const n = p > K ? Math.floor((p - K) / 0.1) + 1 : 0;
      for (let i = 0; i < n; i++) {
        const x = kx + 14 + i * 24;
        if (x > x1 - 8) break;
        dot(ctx, x, y1 - 20, 8, C.gold, 0.9);
        ring(ctx, x, y1 - 20, 12, C.moss, 2, 0.8);
      }
      const cx = x0 + p * (x1 - x0);
      dot(ctx, cx, y0 + (1 - gOf(p)) * (y1 - y0) * 0.86, 5.5, C.green);
      txt(ctx, W / 2, y0 + 2, 10, n ? '單體 ⇌ 微胞（動態平衡）' : '只有單體，還沒有微胞',
          n ? C.green : C.grey, 'center', 'normal');
    },

    /* L7：FeCl3 加入後 pH 曲線開始下降 */
    l7_ph(ctx, p, W, H) {
      bg(ctx, W, H, '#FFFFFF');
      txt(ctx, W / 2, 14, 12, '加入 FeCl₃·6H₂O 之後的 pH 變化', C.ink);
      const x0 = 40, x1 = W - 18, y0 = 32, y1 = H - 34;
      line(ctx, x0, y1, x1, y1, C.grey, 2);
      line(ctx, x0, y0, x0, y1, C.grey, 2);
      txt(ctx, 22, y0 + 6, 9, 'pH', C.grey, 'center', 'normal');
      txt(ctx, W / 2, H - 15, 10, '時間 →', C.grey, 'center', 'normal');
      const ADD = 0.30;
      const phOf = u => u < ADD ? 6.9 : 6.9 - 3.6 * (1 - Math.exp(-6 * (u - ADD)));
      const yOf = v => y1 - ((v - 2) / 6) * (y1 - y0);
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const u = i / 120 * p;
        const x = x0 + u * (x1 - x0);
        if (i === 0) ctx.moveTo(x, yOf(phOf(u))); else ctx.lineTo(x, yOf(phOf(u)));
      }
      ctx.strokeStyle = C.rust; ctx.lineWidth = 3; ctx.stroke();
      /* 加藥的那一刻：滴管落下 */
      const dy = clamp((p - (ADD - 0.14)) / 0.14, 0, 1);
      if (p < ADD + 0.14) {
        const dx = x0 + ADD * (x1 - x0);
        dot(ctx, dx, y0 - 6 + dy * 26, 5, C.rust, dy > 0 ? 1 : 0);
      }
      if (p > ADD) {
        line(ctx, x0 + ADD * (x1 - x0), y0, x0 + ADD * (x1 - x0), y1, C.gold, 2, [5, 4]);
        txt(ctx, x0 + ADD * (x1 - x0) + 4, y0 + 8, 10, '加入 FeCl₃', C.gold, 'left');
      }
      const cx = x0 + p * (x1 - x0);
      dot(ctx, cx, yOf(phOf(p)), 5.5, C.green);
      txt(ctx, W - 20, y1 - 10, 12, 'pH ' + phOf(p).toFixed(2), C.rust, 'right');
      if (p > ADD + 0.05)
        txt(ctx, W / 2, y0 + 2, 10, 'Fe³⁺ + H₂O ⇌ Fe(OH)²⁺ + H⁺（水解放出質子）',
            C.rust, 'center', 'normal');
    },

    /* L8：Fe3+ 靠近表面 –OH、形成內圈錯合物、把 H+ 擠出來【假說】 */
    l8_feoh(ctx, p, W, H) {
      bg(ctx, W, H, '#0E2338');
      txt(ctx, W / 2, 14, 12, '第四式：內圈表面錯合物的生成【研究假說】', '#FFE8B8');
      const base = H - 40, cx = W / 2;
      rrect(ctx, 30, base, W - 60, 20, 5, '#7B8C82', C.navy, 2);            // 礦物表面
      txt(ctx, W / 2, base + 10, 10, '蛇紋石表面', C.navy);
      line(ctx, cx, base, cx, base - 22, '#DDE6EA', 3);                     // –OH 立柱
      dot(ctx, cx, base - 30, 9, C.red);
      txt(ctx, cx, base - 30, 8, 'OH', '#fff');
      /* 0–0.45 Fe3+ 飛近；0.45–0.58 鍵結閃光；0.60 H+ 被擠出 */
      const t = ease(seg(p, 0, 0.45));
      const fx = cx + (1 - t) * 96, fy = base - 30 - (1 - t) * 68;
      dot(ctx, fx, fy, 11, C.rust);
      txt(ctx, fx, fy, 9, 'Fe', '#fff');
      if (p > 0.45) flash(ctx, cx, base - 34, 26, 1 - seg(p, 0.45, 0.62), C.gold);
      if (p > 0.60) {
        const u = seg(p, 0.60, 1);
        const hx = cx - 18 - u * 74, hy = base - 42 - u * 62;
        dot(ctx, hx, hy, 6, '#DDE6EA', 1 - u * 0.4);
        txt(ctx, hx, hy, 8, 'H⁺', C.navy);
        ctx.globalAlpha = Math.min(1, u * 2.4);
        txt(ctx, W / 2, 32, 11, '≡Si–OH + Fe³⁺ → ≡Si–O–Fe²⁺ + H⁺', '#FFE8B8');
        ctx.globalAlpha = 1;
      } else {
        txt(ctx, W / 2, 32, 10, '配位，不是取代——OH 沒有被拔掉', '#9FC4D8', 'center', 'normal');
      }
    },

    /* L9：DSW 緩慢滴入，Mg2+ 走到晶格缺陷位並嵌入【假說】 */
    l9_mgfill(ctx, p, W, H) {
      bg(ctx, W, H, '#0E2338');
      txt(ctx, W / 2, 14, 12, '第五式：Mg²⁺ 補進晶格缺陷【研究假說】', '#FFE8B8');
      const row = H / 2 + 14, cx = W / 2;
      for (let i = 0; i < 5; i++) {                                 // 晶格列，中間是缺陷
        const x = cx - 96 + i * 48;
        if (i === 2) { ring(ctx, x, row, 15, C.red, 3); continue; }
        dot(ctx, x, row, 14, C.moss);
        txt(ctx, x, row, 9, 'Mg', '#0B1F3A');
      }
      /* 0–0.32 滴管緩慢滴入；0.32–0.66 Mg2+ 移動；0.68 嵌入 */
      const d = seg(p, 0, 0.32);
      rrect(ctx, cx + 92, 30, 12, 30, 4, '#DDE6EA', C.navy, 2);
      dot(ctx, cx + 98, 62 + d * 34, 6, C.moss, d > 0.05 ? 1 : 0);
      if (p > 0.32) {
        const u = ease(seg(p, 0.32, 0.68));
        const mx = cx + 98 - u * 98, my = 96 + u * (row - 96);
        dot(ctx, mx, my, 13, C.teal);
        txt(ctx, mx, my, 9, 'Mg', '#fff');
      }
      if (p > 0.68) {
        const u = seg(p, 0.68, 0.82);
        flash(ctx, cx, row, 30, 1 - u, C.gold);
        dot(ctx, cx, row, 14, C.teal);
        txt(ctx, cx, row, 9, 'Mg', '#fff');
        ctx.globalAlpha = Math.min(1, seg(p, 0.70, 0.85));
        txt(ctx, W / 2, H - 22, 11, '≡Si–O⁻ + Mg²⁺ → ≡Si–O–Mg⁺（缺陷被補上）', '#FFE8B8');
        ctx.globalAlpha = 1;
      } else {
        txt(ctx, W / 2, H - 22, 10, '巴斯德滴管緩慢滴入，絕不可整瓶倒', '#9FC4D8', 'center', 'normal');
      }
    },

    /* L10：氣泡生長 → 失穩 → 崩陷（瞬態高溫高壓＋微射流） */
    l10_cav(ctx, p, W, H) {
      bg(ctx, W, H, '#08324B');
      txt(ctx, W / 2, 14, 12, '超音波空化：生長 → 失穩 → 崩陷', '#CFE7F2');
      const cx = W / 2, cy = H / 2 + 8;
      for (let i = 0; i < 26; i++) {                                 // 水分子背景
        const x = (i * 61) % W, y = 30 + ((i * 37) % (H - 60));
        dot(ctx, x, y, 2.4, '#2C6E93', 0.65);
      }
      let r, col = '#DDE6EA', alpha = 0.55;
      if (p < 0.60) { r = 8 + ease(p / 0.60) * 34; }                 // 生長
      else if (p < 0.80) {                                            // 失穩（抖動）
        const u = seg(p, 0.60, 0.80);
        r = 42 + Math.sin(u * 30) * 4 * (1 - u * 0.4);
        col = '#FFF2D0';
      } else {                                                        // 崩陷
        const u = seg(p, 0.80, 0.92);
        r = Math.max(2, 42 * (1 - u) * (1 - u));
        col = C.gold; alpha = 0.95;
      }
      dot(ctx, cx, cy, r, col, alpha);
      ring(ctx, cx, cy, r, '#FFFFFF', 2, 0.8);
      if (p >= 0.80) {
        const u = seg(p, 0.80, 1);
        flash(ctx, cx, cy, 20 + u * 46, Math.max(0, 1 - u * 1.4), '#FFE8B8');
        line(ctx, cx, cy, cx, cy + 46 * Math.min(1, u * 2.2), '#FFE8B8', 3);  // 微射流
        ctx.globalAlpha = Math.min(1, u * 2.4);
        txt(ctx, W / 2, H - 20, 11, '崩陷瞬間：局部瞬態高溫高壓＋微射流', '#FFE8B8');
        ctx.globalAlpha = 1;
      } else {
        txt(ctx, W / 2, H - 20, 10,
            p < 0.60 ? '氣泡在稀疏相生長…' : '氣泡失穩，即將崩陷…', '#9FC4D8', 'center', 'normal');
      }
    },

    /* L12：連續三次洗滌，每次滴 AgNO3 判斷是否還有 Cl- */
    l12_wash(ctx, p, W, H) {
      bg(ctx, W, H, '#FFFFFF');
      txt(ctx, W / 2, 14, 12, '洗滌三次，每次取上清液滴 AgNO₃', C.ink);
      const tubes = [
        { x: W * 0.22, n: '第 1 次', turb: 0.95, t0: 0.06 },
        { x: W * 0.50, n: '第 2 次', turb: 0.45, t0: 0.36 },
        { x: W * 0.78, n: '第 3 次', turb: 0.02, t0: 0.66 }
      ];
      tubes.forEach((t, i) => {
        const on = clamp((p - t.t0) / 0.26, 0, 1);
        rrect(ctx, t.x - 26, 38, 52, H - 92, 8, '#F2F7F9', '#B9CBD3', 2);
        const lv = H - 62;
        rrect(ctx, t.x - 22, lv - 44, 44, 44, 5, '#E8F1F5', null);
        if (on > 0) {                                                // 滴入 AgNO3
          dot(ctx, t.x, 30 + on * 26, 5, C.gold, on < 0.5 ? 1 : 0);
          const cloud = t.turb * clamp((on - 0.35) / 0.4, 0, 1);
          if (cloud > 0.01) {
            ctx.globalAlpha = cloud;
            rrect(ctx, t.x - 22, lv - 44, 44, 44, 5, '#FFFFFF', null);
            for (let k = 0; k < 14; k++)
              dot(ctx, t.x - 18 + ((k * 13) % 36), lv - 40 + ((k * 19) % 38), 2.6, '#D8E2E6');
            ctx.globalAlpha = 1;
          }
          if (on >= 1) {
            const clear = t.turb < 0.1;
            txt(ctx, t.x, H - 34, 10.5, clear ? '無白色沉澱' : '仍有白色混濁',
                clear ? C.green : C.red);
          }
        }
        txt(ctx, t.x, H - 18, 11, t.n, C.ink);
        txt(ctx, t.x, 30, 9, 'AgNO₃', C.gold, 'center', 'normal');
      });
    }
  };

  /* 每段動畫的長度與關鍵時刻（供題目判定；tol 為容許誤差） */
  const META = {
    l1_stack:  { dur: 8.0, key: 0.83, tol: 0.10 },
    l2_mgco3:  { dur: 9.0, key: 0.64, tol: 0.09 },
    l4_use:    { dur: 8.0 },
    l5_d50:    { dur: 8.0, key: 0.70, tol: 0.08 },
    l6_cmc:    { dur: 8.0, key: 0.50, tol: 0.08 },
    l7_ph:     { dur: 8.0, key: 0.30, tol: 0.07 },
    l8_feoh:   { dur: 8.0, key: 0.62, tol: 0.08 },
    l9_mgfill: { dur: 8.0, key: 0.69, tol: 0.08 },
    l10_cav:   { dur: 7.0, key: 0.81, tol: 0.07 },
    l12_wash:  { dur: 9.0 }
  };

  function draw(kind, ctx, p, W, H) {
    const f = A[kind];
    if (!f) { bg(ctx, W, H, C.paper); txt(ctx, W / 2, H / 2, 12, kind, C.grey); return; }
    f(ctx, clamp(p, 0, 1), W, H);
  }
  function meta(kind) { return META[kind] || { dur: 8 }; }

  return { draw: draw, meta: meta, list: Object.keys(A), META: META, C: C };
})();
