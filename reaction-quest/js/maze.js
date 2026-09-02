/* 蛇紋石改質反應探險 — 迷宮引擎 v1.0
   ── 為什麼要自己寫一個 ──────────────────────────────────────────
   第一款遊戲（花蓮綠色化學闖關）的探索模式是「自由走到光點」，對國小、國中
   很剛好，但大學生兩秒就走完、覺得無聊。本作改成格狀迷宮：
     ・DFS 隨機生成，每關固定 seed → 同一關永遠是同一張圖（可重現、可驗證）
     ・D-pad 一次走一格，牆壁不可穿越
     ・每關先蒐集 3 個「試劑／條件」代幣才會開啟終點
     ・部分關卡有陷阱格（違反綠色化學）＝退回起點並跳一句原則說明
   ── 可解性保證 ──────────────────────────────────────────────
   陷阱只會放在「起點→終點」與「起點→各代幣」最短路徑聯集之外的格子，
   因此一定存在一條完全不踩陷阱、可蒐齊三代幣並抵達終點的路線。
   verify() 會用 BFS（避開陷阱）實際確認這件事，供自動化驗收呼叫。 */
window.MAZE = (function () {

  /* mulberry32：32-bit 種子亂數，同一個 seed 永遠產生同一串數字 */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 牆壁以位元遮罩存在每一格：1=上 2=右 4=下 8=左（1 代表「有牆」） */
  const N = 1, E = 2, S = 4, W = 8;
  const DIRS = [
    { d: 'up',    dx: 0,  dy: -1, bit: N, opp: S },
    { d: 'right', dx: 1,  dy: 0,  bit: E, opp: W },
    { d: 'down',  dx: 0,  dy: 1,  bit: S, opp: N },
    { d: 'left',  dx: -1, dy: 0,  bit: W, opp: E }
  ];
  const idx = (m, x, y) => y * m.cols + x;
  const inside = (m, x, y) => x >= 0 && y >= 0 && x < m.cols && y < m.rows;

  /* 兩格之間是否連通（沒有牆） */
  function open(m, x, y, dir) {
    const d = DIRS.find(v => v.d === dir);
    if (!d) return false;
    const nx = x + d.dx, ny = y + d.dy;
    if (!inside(m, nx, ny)) return false;
    return (m.cells[idx(m, x, y)] & d.bit) === 0;
  }

  /* ── DFS（遞迴回溯）生成完美迷宮 ── */
  function carve(m, r) {
    const total = m.cols * m.rows;
    const seen = new Uint8Array(total);
    const stack = [{ x: 0, y: 0 }];
    seen[0] = 1;
    let visited = 1;
    while (stack.length) {
      const c = stack[stack.length - 1];
      const cand = [];
      for (const d of DIRS) {
        const nx = c.x + d.dx, ny = c.y + d.dy;
        if (inside(m, nx, ny) && !seen[idx(m, nx, ny)]) cand.push(d);
      }
      if (!cand.length) { stack.pop(); continue; }
      const d = cand[Math.floor(r() * cand.length)];
      const nx = c.x + d.dx, ny = c.y + d.dy;
      m.cells[idx(m, c.x, c.y)] &= ~d.bit;
      m.cells[idx(m, nx, ny)] &= ~d.opp;
      seen[idx(m, nx, ny)] = 1;
      visited++;
      stack.push({ x: nx, y: ny });
    }
    return visited === total;
  }

  /* 適度打通幾道牆做出迴路（braid）：完美迷宮只有唯一解，
     大一點的關卡加幾個環會比較耐走，也讓陷阱有繞路的餘地。 */
  function braid(m, r, n) {
    let done = 0, guard = 0;
    while (done < n && guard++ < n * 60) {
      const x = 1 + Math.floor(r() * (m.cols - 2));
      const y = 1 + Math.floor(r() * (m.rows - 2));
      const d = DIRS[Math.floor(r() * 4)];
      const nx = x + d.dx, ny = y + d.dy;
      if (!inside(m, nx, ny)) continue;
      if ((m.cells[idx(m, x, y)] & d.bit) === 0) continue;   // 本來就通
      m.cells[idx(m, x, y)] &= ~d.bit;
      m.cells[idx(m, nx, ny)] &= ~d.opp;
      done++;
    }
    return done;
  }

  /* BFS：回傳 prev 陣列與距離；blocked 為不可進入的格子索引集合 */
  function bfs(m, from, blocked) {
    const total = m.cols * m.rows;
    const dist = new Int32Array(total).fill(-1);
    const prev = new Int32Array(total).fill(-1);
    const start = idx(m, from.x, from.y);
    dist[start] = 0;
    const q = [start];
    for (let h = 0; h < q.length; h++) {
      const cur = q[h];
      const cx = cur % m.cols, cy = (cur / m.cols) | 0;
      for (const d of DIRS) {
        if ((m.cells[cur] & d.bit) !== 0) continue;
        const nx = cx + d.dx, ny = cy + d.dy;
        if (!inside(m, nx, ny)) continue;
        const ni = idx(m, nx, ny);
        if (dist[ni] !== -1) continue;
        if (blocked && blocked.has(ni)) continue;
        dist[ni] = dist[cur] + 1;
        prev[ni] = cur;
        q.push(ni);
      }
    }
    return { dist: dist, prev: prev };
  }

  function pathTo(prev, target) {
    const out = [];
    let c = target;
    while (c !== -1) { out.push(c); c = prev[c]; }
    return out;
  }

  /* 死路：只有一個開口的格子 */
  function deadEnds(m) {
    const out = [];
    for (let y = 0; y < m.rows; y++) {
      for (let x = 0; x < m.cols; x++) {
        const c = m.cells[idx(m, x, y)];
        let openN = 0;
        for (const d of DIRS) {
          const nx = x + d.dx, ny = y + d.dy;
          if (inside(m, nx, ny) && (c & d.bit) === 0) openN++;
        }
        if (openN === 1) out.push(idx(m, x, y));
      }
    }
    return out;
  }

  /* ═══════════ 產生一關 ═══════════
     spec: { cols, rows, seed, traps:[key,...] }
     回傳 { cols, rows, cells, start, goal, tokens:[i,i,i], traps:[{i,key}], solved } */
  function gen(spec) {
    const m = {
      cols: spec.cols, rows: spec.rows, seed: spec.seed,
      cells: new Uint8Array(spec.cols * spec.rows).fill(N | E | S | W)
    };
    const r = rng(spec.seed);
    carve(m, r);
    braid(m, r, Math.max(0, Math.floor((spec.cols * spec.rows) / 26)));

    /* 起點固定在左下角（玩家視線最自然的位置） */
    m.start = idx(m, 0, m.rows - 1);
    const b0 = bfs(m, { x: 0, y: m.rows - 1 }, null);

    /* 終點＝離起點最遠的格子 */
    let goal = m.start, best = -1;
    for (let i = 0; i < b0.dist.length; i++) if (b0.dist[i] > best) { best = b0.dist[i]; goal = i; }
    m.goal = goal;

    /* 三個代幣：優先取死路，且彼此與起點／終點保持距離，
       確保玩家必須真的把迷宮走過一遍，而不是順路撿到。 */
    const de = deadEnds(m).filter(i => i !== m.start && i !== m.goal);
    de.sort((a, b) => b0.dist[b] - b0.dist[a]);
    const tokens = [];
    const minGap = Math.max(2, Math.floor((m.cols + m.rows) / 5));
    const cellXY = i => ({ x: i % m.cols, y: (i / m.cols) | 0 });
    const far = (i, list, gap) => list.every(j => {
      const a = cellXY(i), b = cellXY(j);
      return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) >= gap;
    });
    /* 代幣不只要在死路，還要「夠遠」：以終點距離為尺，先要求至少 35%，
       湊不滿三個才逐步放寬。否則小迷宮會出現一個代幣就躺在起點旁邊的情況。 */
    const maxD = b0.dist[m.goal] || 1;
    [0.35, 0.2, 0].forEach(ratio => {
      for (const i of de) {
        if (tokens.length >= 3) break;
        if (tokens.indexOf(i) >= 0) continue;
        if (b0.dist[i] < maxD * ratio) continue;
        if (far(i, tokens.concat([m.goal, m.start]), minGap)) tokens.push(i);
      }
    });
    // 死路不夠（小迷宮可能發生）→ 放寬條件，改用「離起點最遠」的一般格子補齊
    if (tokens.length < 3) {
      const order = [];
      for (let i = 0; i < b0.dist.length; i++) if (b0.dist[i] >= 0) order.push(i);
      order.sort((a, b) => b0.dist[b] - b0.dist[a]);
      for (const i of order) {
        if (tokens.length >= 3) break;
        if (i === m.start || i === m.goal || tokens.indexOf(i) >= 0) continue;
        if (far(i, tokens.concat([m.goal, m.start]), 2)) tokens.push(i);
      }
    }
    m.tokens = tokens;

    /* 關鍵路徑聯集：起點→終點、起點→各代幣。陷阱一律不放在這上面，
       所以「一條不踩陷阱的完整路線」在設計上就存在。 */
    const critical = new Set();
    pathTo(b0.prev, m.goal).forEach(i => critical.add(i));
    m.tokens.forEach(t => pathTo(b0.prev, t).forEach(i => critical.add(i)));
    // 代幣之間互走的路徑也保留，玩家不必每次回起點
    m.tokens.forEach(t => {
      const bt = bfs(m, cellXY(t), null);
      m.tokens.concat([m.goal]).forEach(u => { if (u !== t) pathTo(bt.prev, u).forEach(i => critical.add(i)); });
    });
    critical.add(m.start);

    const keys = spec.traps || [];
    const traps = [];
    if (keys.length) {
      const pool = [];
      for (let i = 0; i < m.cols * m.rows; i++) {
        if (critical.has(i) || i === m.start || i === m.goal) continue;
        if (m.tokens.indexOf(i) >= 0) continue;
        if (b0.dist[i] < 2) continue;                    // 別緊貼起點
        pool.push(i);
      }
      // 以固定 seed 洗牌 → 陷阱位置也可重現
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      }
      const want = Math.min(pool.length, keys.length * 2);
      for (let i = 0; i < want; i++) traps.push({ i: pool[i], key: keys[i % keys.length] });
    }
    m.traps = traps;
    m.solved = verify(m).ok;
    return m;
  }

  /* ═══════════ 可解性驗證（避開陷阱） ═══════════ */
  function verify(m) {
    const blocked = new Set(m.traps.map(t => t.i));
    const sx = m.start % m.cols, sy = (m.start / m.cols) | 0;
    const b = bfs(m, { x: sx, y: sy }, blocked);
    const missing = [];
    m.tokens.forEach((t, k) => { if (b.dist[t] < 0) missing.push('token' + (k + 1)); });
    if (b.dist[m.goal] < 0) missing.push('goal');
    /* 更嚴格：蒐集完三個代幣後仍要走得到終點（避開陷阱），
       逐段檢查 起點→t1→t2→t3→終點 的任一排列是否全部可達。
       因為 BFS 圖是無向連通分量，只要四個目標都與起點同一分量即可。 */
    return {
      ok: missing.length === 0,
      missing: missing,
      distGoal: b.dist[m.goal],
      distTokens: m.tokens.map(t => b.dist[t]),
      cells: m.cols * m.rows,
      trapCount: m.traps.length
    };
  }

  return { gen: gen, verify: verify, open: open, bfs: bfs, idx: idx, inside: inside, DIRS: DIRS,
           deadEnds: deadEnds, rng: rng };
})();
