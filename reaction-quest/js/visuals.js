/* 蛇紋石改質反應探險 — 教學視覺 v1.0
   ① SVG.<kind>()：教學面板／免卡體驗用的 2D 示意圖（全部自繪，零版權）
   ② ar3d(kind)  ：掃到卡片後錨定在圖上的 A-Frame 3D 內容（含動畫）
   十二種 kind 對應十二關：
     serp_layer dsw_ions tpgs3 micelle mill cmc
     hydrolysis fe_oh mg_swap cavitation sidereact agcl */
window.VISUALS = (function () {

  const C = { navy:'#0B1F3A', deep:'#065A82', teal:'#1C7293', green:'#2E7D5B',
              moss:'#5FA98A', gold:'#C99A3E', grey:'#64748B', ink:'#1E293B',
              red:'#B03E34', rust:'#8C4A2F', white:'#FFFFFF' };

  const wrap = (inner, h) =>
    `<svg viewBox="0 0 340 ${h}" xmlns="http://www.w3.org/2000/svg" role="img">${inner}</svg>`;
  const t = (x, y, s, txt, fill, anchor = 'middle', weight = 'bold') =>
    `<text x="${x}" y="${y}" font-size="${s}" font-weight="${weight}" fill="${fill}" ` +
    `text-anchor="${anchor}" font-family="Microsoft JhengHei, Noto Sans TC, sans-serif">${txt}</text>`;
  const arrow = (x1, y, x2, col) =>
    `<line x1="${x1}" y1="${y}" x2="${x2 - 8}" y2="${y}" stroke="${col}" stroke-width="3"/>` +
    `<polygon points="${x2},${y} ${x2 - 10},${y - 5} ${x2 - 10},${y + 5}" fill="${col}"/>`;
  const eqArrow = (x1, y, x2, col) =>   // ⇌ 雙向
    `<line x1="${x1}" y1="${y - 4}" x2="${x2 - 8}" y2="${y - 4}" stroke="${col}" stroke-width="2.6"/>` +
    `<polygon points="${x2},${y - 4} ${x2 - 9},${y - 8} ${x2 - 9},${y}" fill="${col}"/>` +
    `<line x1="${x2}" y1="${y + 5}" x2="${x1 + 8}" y2="${y + 5}" stroke="${col}" stroke-width="2.6"/>` +
    `<polygon points="${x1},${y + 5} ${x1 + 9},${y + 1} ${x1 + 9},${y + 9}" fill="${col}"/>`;
  const ion = (cx, cy, r, col, label, txtCol) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}" stroke="${C.navy}" stroke-width="2"/>` +
    t(cx, cy + r * 0.32, r * 0.78, label, txtCol || '#fff');

  /* ═══════════ 2D 教學示意圖 ═══════════ */
  const SVG = {

    /* 1 蛇紋石 1:1（TO）層狀結構與表面 –OH */
    serp_layer() {
      let s = `<rect width="340" height="200" fill="#F1F6F8"/>`;
      s += t(170, 18, 12.5, 'Mg₃Si₂O₅(OH)₄　1:1（TO）型層狀矽酸鹽', C.ink);
      for (let L = 0; L < 2; L++) {
        const y = 30 + L * 76;
        // T 層：四面體
        s += `<rect x="26" y="${y}" width="288" height="24" rx="5" fill="#CEE4EC" stroke="${C.deep}" stroke-width="2"/>`;
        for (let i = 0; i < 10; i++) {
          const x = 32 + i * 28;
          s += `<polygon points="${x},${y + 3} ${x + 21},${y + 3} ${x + 10.5},${y + 21}" fill="#78B2C8" stroke="${C.navy}" stroke-width="1.1"/>`;
        }
        s += t(16, y + 17, 11, 'T', C.deep);
        // O 層：八面體
        const oy = y + 26;
        s += `<rect x="26" y="${oy}" width="288" height="24" rx="5" fill="#D6EADE" stroke="${C.green}" stroke-width="2"/>`;
        for (let i = 0; i < 10; i++) {
          const x = 32 + i * 28;
          s += `<polygon points="${x + 10.5},${oy + 3} ${x + 21},${oy + 12} ${x + 10.5},${oy + 21} ${x},${oy + 12}" fill="#92C4A8" stroke="#164C38" stroke-width="1.1"/>`;
        }
        s += t(16, oy + 17, 11, 'O', C.green);
        // 表面 –OH 門把（3 個露出）
        for (let i = 0; i < 3; i++) {
          const hx = 66 + i * 96;
          s += `<line x1="${hx}" y1="${oy + 24}" x2="${hx}" y2="${oy + 31}" stroke="${C.gold}" stroke-width="3"/>`;
          s += `<circle cx="${hx}" cy="${oy + 38}" r="9" fill="${C.gold}" stroke="${C.navy}" stroke-width="2"/>`;
          s += t(hx, oy + 41.5, 8, 'OH', C.navy);
        }
        // 層內 OH（碰不到）
        s += `<circle cx="${262}" cy="${y + 26}" r="7" fill="none" stroke="${C.grey}" stroke-width="2" stroke-dasharray="3 2"/>`;
        s += t(262, y + 29, 7, 'OH', C.grey);
      }
      s += t(170, 194, 11, '金色＝露在外表面的 3 個 –OH（可反應）　灰虛線＝層內 1 個（碰不到）', C.green);
      return wrap(s, 200);
    },

    /* 2 深層海水離子 */
    dsw_ions() {
      let s = `<defs><linearGradient id="dswg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#7FC9E6"/><stop offset="1" stop-color="#08304A"/></linearGradient></defs>`;
      s += `<rect width="340" height="190" fill="url(#dswg)"/>`;
      s += `<line x1="14" y1="56" x2="326" y2="56" stroke="${C.gold}" stroke-width="3" stroke-dasharray="9 5"/>`;
      s += t(324, 50, 11, '200 m 以深', C.gold, 'end');
      for (let i = 0; i < 6; i++) {
        s += `<line x1="14" y1="${24 + i * 28}" x2="30" y2="${24 + i * 28}" stroke="#fff" stroke-width="1.6"/>`;
        s += t(34, 28 + i * 28, 8.5, (i * 120) + ' m', '#fff', 'start', 'normal');
      }
      const ions = [['Mg²⁺', C.moss, 96, 86, 19], ['Ca²⁺', C.gold, 168, 112, 16],
                    ['Mg²⁺', C.moss, 240, 82, 19], ['K⁺', '#8FD0EA', 286, 128, 12],
                    ['Ca²⁺', C.gold, 118, 152, 15], ['Mg²⁺', C.moss, 214, 156, 18],
                    ['Na⁺', '#C6D8E2', 158, 44, 11]];
      ions.forEach(v => { s += ion(v[2], v[3], v[4], v[1], v[0], v[1] === '#C6D8E2' || v[1] === '#8FD0EA' ? C.navy : '#fff'); });
      s += t(170, 20, 12, '花蓮外海 600 m 以下・脫鹽濃縮鹽滷', '#fff');
      s += t(170, 184, 10.5, 'Mg²⁺ 35,000–42,000 mg/L　TDS ≧ 120,000 ppm', C.gold);
      return wrap(s, 190);
    },

    /* 3 TPGS-750-M 三段分子 */
    tpgs3() {
      let s = `<rect width="340" height="190" fill="#FAFBF8"/>`;
      s += t(170, 18, 12.5, 'TPGS-750-M：一個分子，三段個性', C.ink);
      // 段一 維生素 E（親油頭）
      s += `<rect x="14" y="34" width="98" height="54" rx="10" fill="#FCEFD3" stroke="${C.gold}" stroke-width="2.5"/>`;
      s += `<polygon points="34,52 44,46 54,52 54,64 44,70 34,64" fill="none" stroke="${C.gold}" stroke-width="2.4"/>`;
      s += `<polygon points="54,52 64,46 74,52 74,64 64,70 54,64" fill="none" stroke="${C.gold}" stroke-width="2.4"/>`;
      s += `<circle cx="64" cy="46" r="3" fill="${C.red}"/>`;
      s += `<path d="M74 58 l8 -6 l8 6 l8 -6 l8 6" stroke="${C.gold}" stroke-width="2.4" fill="none"/>`;
      s += t(63, 82, 10, '維生素 E（親油頭）', C.ink);
      // 段二 琥珀酸
      s += `<rect x="118" y="34" width="76" height="54" rx="10" fill="#DFF0E6" stroke="${C.green}" stroke-width="2.5"/>`;
      s += `<path d="M132 58 l10 -8 l10 8 l10 -8 l10 8" stroke="${C.green}" stroke-width="2.6" fill="none"/>`;
      s += `<circle cx="132" cy="58" r="4.5" fill="${C.red}"/><circle cx="172" cy="58" r="4.5" fill="${C.red}"/>`;
      s += t(156, 46, 9, 'HOOC–CH₂CH₂–COOH', C.green);
      s += t(156, 82, 10, '琥珀酸（兩個酯鍵）', C.ink);
      // 段三 PEG
      s += `<rect x="200" y="34" width="126" height="54" rx="10" fill="#DCEBF4" stroke="${C.deep}" stroke-width="2.5"/>`;
      for (let i = 0; i < 4; i++) {
        const x = 212 + i * 26;
        s += `<path d="M${x} 60 q6 -12 13 0 q6 12 13 0" stroke="${C.deep}" stroke-width="2.4" fill="none"/>`;
        s += `<circle cx="${x}" cy="60" r="3.6" fill="${C.red}"/>`;
      }
      s += t(263, 46, 9, '–O–CH₂CH₂– × n（n ≈ 16）', C.deep);
      s += t(263, 82, 10, 'PEG-750 甲醚（親水尾）', C.ink);
      // 連接線
      s += `<line x1="112" y1="61" x2="118" y2="61" stroke="${C.ink}" stroke-width="3"/>`;
      s += `<line x1="194" y1="61" x2="200" y2="61" stroke="${C.ink}" stroke-width="3"/>`;
      // 水／油分區
      s += `<rect x="14" y="98" width="150" height="34" rx="8" fill="#F4E7C8"/>`;
      s += t(89, 119, 11, '怕水（疏水核心）', '#8A6420');
      s += `<rect x="176" y="98" width="150" height="34" rx="8" fill="#D5E9F5"/>`;
      s += t(251, 119, 11, '愛水（親水外殼）', C.deep);
      s += t(170, 152, 11, 'CAS 1309573-60-1　Lipshutz et al., 2011', C.grey, 'middle', 'normal');
      s += t(170, 174, 11, '兩個酯鍵 → 可生物降解（綠色化學第 4、10 原則）', C.green);
      return wrap(s, 190);
    },

    /* 4 微胞剖面 */
    micelle() {
      let s = `<rect width="340" height="200" fill="#EAF4FA"/>`;
      for (let i = 0; i < 26; i++) {
        const x = 8 + (i * 53) % 330, y = 12 + ((i * 37) % 180);
        s += `<path d="M${x} ${y} q4 -5 8 0" stroke="#B9DDEE" stroke-width="2" fill="none"/>`;
      }
      const cx = 118, cy = 100;
      s += `<circle cx="${cx}" cy="${cy}" r="72" fill="#CFE6F2" opacity=".55"/>`;
      s += `<circle cx="${cx}" cy="${cy}" r="40" fill="#F4E4C4" stroke="${C.gold}" stroke-width="2.5"/>`;
      for (let i = 0; i < 20; i++) {
        const a = i * Math.PI / 10;
        const x1 = cx + Math.cos(a) * 40, y1 = cy + Math.sin(a) * 40;
        const x2 = cx + Math.cos(a) * 70, y2 = cy + Math.sin(a) * 70;
        s += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${C.deep}" stroke-width="2.6" stroke-linecap="round"/>`;
        s += `<circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="4.6" fill="${C.teal}"/>`;
        const xi = cx + Math.cos(a) * 26, yi = cy + Math.sin(a) * 26;
        s += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${xi.toFixed(1)} ${yi.toFixed(1)}" stroke="${C.gold}" stroke-width="2.2" stroke-linecap="round"/>`;
      }
      s += t(cx, cy + 4, 11, '疏水核心', '#8A6420');
      s += `<rect x="204" y="34" width="124" height="26" rx="8" fill="#fff" stroke="${C.teal}" stroke-width="2"/>`;
      s += t(266, 51, 10.5, '親水尾朝外・面向水', C.teal);
      s += `<rect x="204" y="68" width="124" height="26" rx="8" fill="#fff" stroke="${C.gold}" stroke-width="2"/>`;
      s += t(266, 85, 10.5, '親油頭朝內・躲開水', '#8A6420');
      s += `<rect x="204" y="102" width="124" height="26" rx="8" fill="#fff" stroke="${C.green}" stroke-width="2"/>`;
      s += t(266, 119, 10.5, '粒徑 50–100 nm', C.green);
      s += `<rect x="204" y="136" width="124" height="26" rx="8" fill="${C.navy}"/>`;
      s += t(266, 153, 10.5, '1.5 wt%（≫ CMC）', '#fff');
      s += t(170, 190, 11, '本研究把微胞當作分散與界面活化的載體', C.ink);
      return wrap(s, 200);
    },

    /* 5 第一式 球磨斷鍵 */
    mill() {
      let s = `<rect width="340" height="190" fill="#F4F5F2"/>`;
      s += t(170, 18, 12, '≡Si–O–Si≡ ＋ 機械能 → ≡Si–O• ＋ •Si≡', C.ink);
      // 左：完整矽氧橋
      s += `<rect x="10" y="30" width="120" height="92" rx="10" fill="#fff" stroke="${C.teal}" stroke-width="2"/>`;
      s += `<line x1="30" y1="76" x2="110" y2="76" stroke="${C.navy}" stroke-width="3"/>`;
      s += ion(34, 76, 15, '#78B2C8', 'Si');
      s += ion(70, 76, 12, C.red, 'O');
      s += ion(106, 76, 15, '#78B2C8', 'Si');
      s += t(70, 110, 10, '球磨前：橋連續完整', C.grey, 'middle', 'normal');
      // 中：機械能
      s += `<circle cx="170" cy="60" r="14" fill="${C.grey}" stroke="${C.navy}" stroke-width="2"/>`;
      s += `<circle cx="170" cy="92" r="11" fill="#9AA3AD" stroke="${C.navy}" stroke-width="2"/>`;
      s += arrow(148, 76, 196, C.red);
      s += t(170, 130, 10, '機械能（撞擊／剪切）', C.red);
      // 右：斷開
      s += `<rect x="206" y="30" width="124" height="92" rx="10" fill="#fff" stroke="${C.gold}" stroke-width="2"/>`;
      s += ion(232, 76, 15, '#78B2C8', 'Si');
      s += ion(258, 76, 11, C.red, 'O');
      s += `<line x1="232" y1="76" x2="258" y2="76" stroke="${C.navy}" stroke-width="3"/>`;
      s += `<circle cx="272" cy="66" r="4" fill="${C.gold}"/>`;
      s += ion(306, 76, 15, '#78B2C8', 'Si');
      s += `<circle cx="290" cy="66" r="4" fill="${C.gold}"/>`;
      s += `<path d="M266 88 l6 8 M280 88 l-6 8" stroke="${C.gold}" stroke-width="2.4"/>`;
      s += t(268, 110, 10, '斷口留下懸鍵 •', '#8A6420', 'middle', 'normal');
      s += `<rect x="10" y="134" width="320" height="44" rx="10" fill="${C.navy}"/>`;
      s += t(170, 152, 11, '「•」＝未配對的單一電子（自由基），由鍵均裂產生', '#fff');
      s += t(170, 170, 10.5, 'D50 約 1.8 μm・表面積暴增・缺陷是第五式 Mg²⁺ 的落腳處', C.moss);
      return wrap(s, 190);
    },

    /* 6 第二式 CMC */
    cmc() {
      let s = `<rect width="340" height="185" fill="#EAF4FA"/>`;
      s += t(170, 18, 12, 'n × TPGS-750-M ⇌ (TPGS-750-M)ₙ　【超過 CMC 時】', C.ink);
      // 左：低於 CMC
      s += `<rect x="10" y="30" width="132" height="104" rx="10" fill="#fff" stroke="${C.grey}" stroke-width="2"/>`;
      const pts = [[34,52],[72,44],[110,58],[46,84],[88,78],[120,96],[32,112],[76,110],[112,124]];
      pts.forEach((p, i) => {
        const a = (i * 37) % 360;
        s += `<g transform="translate(${p[0]},${p[1]}) rotate(${a})">` +
             `<circle cx="0" cy="0" r="4.6" fill="${C.teal}"/>` +
             `<path d="M4 0 l12 0" stroke="${C.gold}" stroke-width="2.4" stroke-linecap="round"/></g>`;
      });
      s += t(76, 148, 10.5, '低於 CMC：分散單分子', C.grey);
      // 中：⇌
      s += eqArrow(150, 82, 190, C.navy);
      s += t(170, 62, 10, 'CMC', C.gold);
      // 右：高於 CMC
      s += `<rect x="198" y="30" width="132" height="104" rx="10" fill="#fff" stroke="${C.teal}" stroke-width="2"/>`;
      const mc = [[248, 66, 22], [296, 96, 18], [238, 112, 15]];
      mc.forEach(m => {
        s += `<circle cx="${m[0]}" cy="${m[1]}" r="${m[2]}" fill="#F4E4C4" stroke="${C.gold}" stroke-width="2"/>`;
        for (let i = 0; i < 12; i++) {
          const a = i * Math.PI / 6;
          const x1 = m[0] + Math.cos(a) * m[2], y1 = m[1] + Math.sin(a) * m[2];
          const x2 = m[0] + Math.cos(a) * (m[2] + 8), y2 = m[1] + Math.sin(a) * (m[2] + 8);
          s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${C.deep}" stroke-width="2"/>`;
        }
      });
      s += t(264, 148, 10.5, '高於 CMC：自動聚成微胞', C.teal);
      s += t(170, 172, 11, '沒有鍵被打斷或形成 → 這是物理過程，不是化學反應', C.green);
      return wrap(s, 185);
    },

    /* 7 第三式 FeCl3 解離＋水解 */
    hydrolysis() {
      let s = `<rect width="340" height="200" fill="#FDF6F2"/>`;
      s += t(170, 18, 12, '①解離（不可逆）　②水解（可逆・pH 下降）', C.ink);
      // ① 解離
      s += `<rect x="10" y="28" width="320" height="62" rx="10" fill="#fff" stroke="${C.teal}" stroke-width="2"/>`;
      s += `<rect x="22" y="44" width="60" height="32" rx="6" fill="#C98A4E" stroke="${C.navy}" stroke-width="2"/>`;
      s += t(52, 64, 10, 'FeCl₃·6H₂O', '#fff');
      s += arrow(90, 60, 130, C.teal);
      s += t(110, 48, 8.5, '入水', C.teal);
      s += ion(152, 60, 16, C.rust, 'Fe³⁺');
      s += t(180, 64, 12, '＋', C.ink);
      s += ion(208, 60, 13, '#7FA65C', 'Cl⁻');
      s += ion(240, 60, 13, '#7FA65C', 'Cl⁻');
      s += ion(272, 60, 13, '#7FA65C', 'Cl⁻');
      s += t(306, 64, 9.5, '旁觀者', C.grey, 'middle', 'normal');
      // ② 水解
      s += `<rect x="10" y="98" width="320" height="66" rx="10" fill="#fff" stroke="${C.gold}" stroke-width="2"/>`;
      s += ion(38, 130, 16, C.rust, 'Fe³⁺');
      s += t(64, 134, 12, '＋', C.ink);
      s += `<circle cx="92" cy="130" r="13" fill="#6FB6DC" stroke="${C.navy}" stroke-width="2"/>`;
      s += t(92, 134, 9.5, 'H₂O', '#fff');
      s += eqArrow(116, 130, 158, C.gold);
      s += `<circle cx="188" cy="130" r="19" fill="${C.rust}" stroke="${C.navy}" stroke-width="2"/>`;
      s += t(188, 134, 8.5, 'Fe(OH)²⁺', '#fff');
      s += t(220, 134, 12, '＋', C.ink);
      s += `<circle cx="248" cy="130" r="13" fill="${C.red}" stroke="${C.navy}" stroke-width="2"/>`;
      s += t(248, 134, 10, 'H⁺', '#fff');
      s += `<path d="M274 120 l0 22" stroke="${C.red}" stroke-width="3"/>`;
      s += `<polygon points="274,148 269,138 279,138" fill="${C.red}"/>`;
      s += t(302, 128, 10, 'pH', C.red); s += t(302, 142, 10, '下降', C.red);
      s += `<rect x="10" y="172" width="320" height="22" rx="8" fill="${C.navy}"/>`;
      s += t(170, 187, 10.5, '0.242 g / 100 mL ≒ 8.95 mM ≒ 0.05 wt% Fe（M＝270.30）', '#fff');
      return wrap(s, 200);
    },

    /* 8 第四式 Fe3+ 抓表面羥基【假說】 */
    fe_oh() {
      let s = `<rect width="340" height="205" fill="#F6F3EA"/>`;
      s += `<rect x="200" y="6" width="134" height="20" rx="10" fill="${C.gold}"/>`;
      s += t(267, 21, 10.5, '研究假說（待驗證）', '#fff');
      s += t(90, 20, 12, '≡Si–OH ＋ Fe³⁺ → ≡Si–O–Fe²⁺ ＋ H⁺', C.ink);
      // 左：反應前
      s += `<rect x="10" y="34" width="140" height="106" rx="10" fill="#fff" stroke="${C.teal}" stroke-width="2"/>`;
      s += `<rect x="18" y="112" width="124" height="22" rx="4" fill="#93A79B"/>`;
      s += t(80, 127, 9, '蛇紋石表面', '#fff');
      s += `<line x1="60" y1="112" x2="60" y2="92" stroke="${C.navy}" stroke-width="3"/>`;
      s += ion(60, 82, 11, C.red, 'O');
      s += `<line x1="60" y1="71" x2="60" y2="62" stroke="${C.navy}" stroke-width="2.4"/>`;
      s += ion(60, 54, 8, '#DDE6EA', 'H', C.navy);
      s += ion(118, 60, 15, C.rust, 'Fe³⁺');
      s += t(80, 152, 10, '路易士鹼（孤對電子）＋ 路易士酸', C.grey, 'middle', 'normal');
      // 中：箭頭
      s += arrow(158, 84, 190, C.green);
      // 右：反應後
      s += `<rect x="196" y="34" width="134" height="106" rx="10" fill="#fff" stroke="${C.green}" stroke-width="2"/>`;
      s += `<rect x="204" y="112" width="118" height="22" rx="4" fill="#93A79B"/>`;
      s += t(263, 127, 9, '蛇紋石表面', '#fff');
      s += `<line x1="248" y1="112" x2="248" y2="92" stroke="${C.navy}" stroke-width="3"/>`;
      s += ion(248, 82, 11, C.red, 'O');
      s += `<line x1="259" y1="78" x2="272" y2="70" stroke="${C.green}" stroke-width="3"/>`;
      s += ion(288, 62, 16, C.rust, 'Fe');
      s += ion(214, 52, 8, C.red, 'H⁺');
      s += `<path d="M214 42 l0 -10" stroke="${C.red}" stroke-width="2.4"/>`;
      s += `<polygon points="214,28 210,38 218,38" fill="${C.red}"/>`;
      s += t(263, 152, 10, '內圈表面錯合物（inner-sphere）', C.green, 'middle', 'normal');
      // 電荷驗算
      s += `<rect x="10" y="164" width="320" height="34" rx="10" fill="${C.navy}"/>`;
      s += t(170, 179, 10.5, '電荷驗算：左 0 ＋ 3＋ ＝ 3＋　｜　右 2＋ ＋ 1＋ ＝ 3＋', '#fff');
      s += t(170, 193, 9.5, '2＋ 是「≡Si–O–Fe」整團的淨電荷，鐵仍是 Fe(III)，沒有被還原', C.gold);
      return wrap(s, 205);
    },

    /* 9 第五式 Mg2+ 補位【假說】 */
    mg_swap() {
      let s = `<rect width="340" height="200" fill="#EFF6F2"/>`;
      s += `<rect x="200" y="6" width="134" height="20" rx="10" fill="${C.gold}"/>`;
      s += t(267, 21, 10.5, '研究假說（待驗證）', '#fff');
      s += t(92, 20, 11, '≡Si–O⁻ ＋ Mg²⁺ → ≡Si–O–Mg⁺', C.ink);
      // 左：球磨後有空位
      s += `<rect x="10" y="34" width="140" height="104" rx="10" fill="#fff" stroke="${C.grey}" stroke-width="2"/>`;
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 2; j++) {
          const x = 34 + i * 28, y = 62 + j * 30;
          if (i === 2 && j === 0) {
            s += `<circle cx="${x}" cy="${y}" r="12" fill="none" stroke="${C.red}" stroke-width="2.6" stroke-dasharray="4 3"/>`;
            s += t(x, y + 4, 9, '空位', C.red);
          } else {
            s += ion(x, y, 12, C.moss, 'Mg');
          }
        }
      }
      s += t(80, 128, 10, '球磨後：晶格留下空位', C.grey, 'middle', 'normal');
      s += arrow(158, 84, 190, C.deep);
      s += t(174, 70, 9, 'DSW 滴入', C.deep);
      // 右：補位完成
      s += `<rect x="196" y="34" width="134" height="104" rx="10" fill="#fff" stroke="${C.green}" stroke-width="2"/>`;
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 2; j++) {
          const x = 220 + i * 28, y = 62 + j * 30;
          const isNew = (i === 2 && j === 0);
          s += ion(x, y, 12, isNew ? C.teal : C.moss, 'Mg');
          if (isNew) s += `<circle cx="${x}" cy="${y}" r="16" fill="none" stroke="${C.gold}" stroke-width="2.4"/>`;
        }
      }
      s += t(263, 128, 10, '缺陷補償：Si–O–Mg 更完整', C.green, 'middle', 'normal');
      s += `<rect x="10" y="148" width="320" height="44" rx="10" fill="${C.navy}"/>`;
      s += t(170, 165, 10.5, '電荷驗算：左 1− ＋ 2＋ ＝ 1＋　｜　右 0 ＋ 2＋ ＝ 1＋ ＋ 1＋', '#fff');
      s += t(170, 182, 9.5, '放射率 0.86（原礦基線・已量測）→ 0.93（目標・研究假說）', C.gold);
      return wrap(s, 200);
    },

    /* 10 第六式 超音波空化 */
    cavitation() {
      let s = `<defs><radialGradient id="hot"><stop offset="0" stop-color="#FFF0B0"/>
        <stop offset="1" stop-color="#E06A3A" stop-opacity="0"/></radialGradient></defs>`;
      s += `<rect width="340" height="190" fill="#E6F2F8"/>`;
      for (let i = 0; i < 5; i++) {
        s += `<path d="M0 ${24 + i * 34} q28 -12 56 0 q28 12 56 0 q28 -12 56 0 q28 12 56 0 q28 -12 56 0 q28 12 60 0"
               stroke="#BEDFEE" stroke-width="2" fill="none"/>`;
      }
      const stage = (cx, r, lab, col) => {
        let g = `<circle cx="${cx}" cy="86" r="${r}" fill="none" stroke="${col}" stroke-width="3"/>`;
        g += `<circle cx="${cx}" cy="86" r="${Math.max(2, r - 8)}" fill="#fff" opacity=".8"/>`;
        g += t(cx, 138, 10.5, lab, col);
        return g;
      };
      s += stage(56, 16, '① 氣泡生長', C.teal);
      s += arrow(84, 86, 108, C.grey);
      s += stage(140, 28, '② 氣泡失穩', C.deep);
      s += arrow(176, 86, 200, C.grey);
      // ③ 崩陷
      s += `<circle cx="248" cy="86" r="34" fill="url(#hot)"/>`;
      s += `<circle cx="248" cy="86" r="9" fill="#FFD98A" stroke="${C.red}" stroke-width="2.4"/>`;
      for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5;
        const x1 = 248 + Math.cos(a) * 32, y1 = 86 + Math.sin(a) * 32;
        const x2 = 248 + Math.cos(a) * 14, y2 = 86 + Math.sin(a) * 14;
        s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${C.red}" stroke-width="2.2"/>`;
      }
      s += t(248, 138, 10.5, '③ 氣泡崩陷（內爆）', C.red);
      // 微射流打向表面
      s += `<rect x="292" y="60" width="38" height="52" rx="4" fill="#93A79B"/>`;
      s += t(311, 90, 9, '礦物', '#fff');
      s += `<path d="M266 86 l22 0" stroke="${C.gold}" stroke-width="4"/>`;
      s += `<polygon points="292,86 282,80 282,92" fill="${C.gold}"/>`;
      s += t(170, 20, 12, '瞬態高溫高壓＋微射流（局部、微秒級）', C.ink);
      s += `<rect x="10" y="152" width="320" height="30" rx="9" fill="${C.navy}"/>`;
      s += t(170, 165, 10, '40 kHz・25°C・15 min・150 W（A4 組 300 W）', '#fff');
      s += t(170, 178, 9.5, 'H₂O ⇌ H• ＋ •OH（微量，伴隨現象非主反應）', C.moss);
      return wrap(s, 190);
    },

    /* 11 第七式 兩個副反應 */
    sidereact() {
      let s = `<rect width="340" height="200" fill="#FAF6EE"/>`;
      s += t(170, 18, 12, '兩個一定要防的副反應', C.ink);
      // A：MgCO3
      s += `<rect x="10" y="28" width="320" height="72" rx="10" fill="#fff" stroke="${C.grey}" stroke-width="2"/>`;
      s += `<rect x="10" y="28" width="42" height="72" rx="10" fill="${C.grey}"/>`;
      s += t(31, 68, 13, 'A', '#fff');
      s += `<circle cx="76" cy="56" r="13" fill="#9AA3AD" stroke="${C.navy}" stroke-width="2"/>`;
      s += t(76, 60, 9, 'CO₂', '#fff');
      s += arrow(92, 56, 118, C.grey);
      s += t(140, 60, 10, 'H₂CO₃', C.ink);
      s += arrow(160, 56, 184, C.grey);
      s += ion(202, 56, 14, C.grey, 'CO₃²⁻');
      s += t(226, 60, 12, '＋', C.ink);
      s += ion(250, 56, 14, C.moss, 'Mg²⁺');
      s += arrow(268, 56, 292, C.red);
      s += t(312, 60, 11, 'MgCO₃↓', C.red);
      s += t(170, 90, 10, '對策：25°C 超音波脫氣 15 min ＋ 完全零頂空充填 ＋ 4°C 避光', C.green, 'middle', 'normal');
      // B：Fe(OH)3
      s += `<rect x="10" y="108" width="320" height="72" rx="10" fill="#fff" stroke="${C.rust}" stroke-width="2"/>`;
      s += `<rect x="10" y="108" width="42" height="72" rx="10" fill="${C.rust}"/>`;
      s += t(31, 148, 13, 'B', '#fff');
      s += ion(80, 136, 15, C.rust, 'Fe³⁺');
      s += t(106, 140, 12, '＋', C.ink);
      s += ion(134, 136, 14, '#7FA6C8', '3OH⁻');
      s += arrow(154, 136, 182, C.red);
      s += `<circle cx="212" cy="136" r="17" fill="#A4552F" stroke="${C.navy}" stroke-width="2"/>`;
      s += t(212, 140, 9, 'Fe(OH)₃', '#fff');
      s += `<path d="M232 130 l0 14" stroke="${C.red}" stroke-width="3"/>`;
      s += `<polygon points="232,150 227,140 237,140" fill="${C.red}"/>`;
      s += t(288, 132, 10, '紅棕絮凝沉澱', C.rust);
      s += t(288, 148, 9.5, '整批樣品報銷', C.grey, 'middle', 'normal');
      s += t(170, 172, 10, '對策：緩慢滴定 ＋ 全程記錄 pH（綠色化學第 11 原則）', C.green, 'middle', 'normal');
      s += t(170, 194, 10.5, '「↓」＝沉澱，掉出水相就再也回不到反應裡', C.ink);
      return wrap(s, 200);
    },

    /* 12 第八式 AgCl 檢驗 */
    agcl() {
      let s = `<rect width="340" height="195" fill="#F3F7F9"/>`;
      s += t(170, 18, 12.5, 'Ag⁺ ＋ Cl⁻ → AgCl↓（白色沉澱）', C.ink);
      const tube = (cx, turbidity, lab) => {
        let g = `<rect x="${cx - 20}" y="34" width="40" height="96" rx="6" fill="#E8F2F6" stroke="${C.teal}" stroke-width="2.4"/>`;
        g += `<path d="M${cx - 20} 118 a20 20 0 0 0 40 0 z" fill="#E8F2F6"/>`;
        g += `<rect x="${cx - 18}" y="${130 - 68 * 0.9}" width="36" height="${68 * 0.9}" rx="4"
                fill="#fff" opacity="${0.15 + turbidity * 0.8}"/>`;
        if (turbidity > 0.05) {
          for (let i = 0; i < Math.round(turbidity * 26); i++) {
            const x = cx - 14 + ((i * 13) % 28), y = 76 + ((i * 19) % 48);
            g += `<circle cx="${x}" cy="${y}" r="${1.8 + (i % 3) * 0.7}" fill="#fff" opacity=".95"/>`;
          }
        }
        g += `<rect x="${cx - 22}" y="30" width="44" height="8" rx="3" fill="${C.teal}"/>`;
        g += t(cx, 148, 10.5, lab, C.ink);
        return g;
      };
      s += tube(66, 0.95, '第 1 次洗液');
      s += tube(170, 0.42, '第 2 次洗液');
      s += tube(274, 0.02, '第 3 次洗液');
      s += t(66, 164, 9.5, '白濁明顯：Cl⁻ 多', C.red, 'middle', 'normal');
      s += t(170, 164, 9.5, '白濁變淡', '#8A6420', 'middle', 'normal');
      s += t(274, 164, 9.5, '澄清：判定合格', C.green, 'middle', 'normal');
      s += arrow(96, 84, 138, C.grey);
      s += arrow(200, 84, 242, C.grey);
      s += t(170, 186, 10.5, '離心 → 超純水洗三次 → AgNO₃ 判終點 → 60°C 真空乾燥過夜', C.ink);
      return wrap(s, 195);
    }
  };

  function svg(kind) {
    const f = SVG[kind];
    return f ? f() : SVG.serp_layer();
  }

  /* ═══════════ 3D 錨定內容（A-Frame）═══════════
     所有元件都放在錨點原點附近（單位約等於卡片寬度），
     並加上動畫讓分子／反應式「動起來」：Fe³⁺ 飛向 –OH、Mg²⁺ 補進缺陷格等。 */
  const CC = { navy:'#0B1F3A', teal:'#1C7293', deep:'#065A82', green:'#2E7D5B',
               moss:'#5FA98A', gold:'#C99A3E', red:'#B03E34', rust:'#8C4A2F',
               white:'#F7FAFB', ice:'#78B2C8' };

  const label = (txt, x, y, z, col, w) =>
    `<a-entity text="value: ${txt}; align: center; color: ${col}; width: ${w || 1.6}; ` +
    `font: https://cdn.aframe.io/fonts/Roboto-msdf.json" position="${x} ${y} ${z}"></a-entity>`;
  const sphere = (x, y, z, r, col, extra) =>
    `<a-sphere position="${x} ${y} ${z}" radius="${r}" color="${col}" ${extra || ''}></a-sphere>`;
  const spin = (dur) => `animation="property: rotation; to: 0 360 0; loop: true; dur: ${dur || 9000}; easing: linear"`;
  const bob = (y0, y1) => `animation="property: position; dir: alternate; dur: 1600; loop: true; ` +
    `easing: easeInOutSine; from: 0 ${y0} 0; to: 0 ${y1} 0"`;
  const plate = (col, op) =>
    `<a-plane position="0 0 -0.02" width="1.05" height="0.72" color="${col}" opacity="${op || 0.82}"></a-plane>`;

  function ar3d(kind) {
    switch (kind) {

      case 'serp_layer':
        return plate(CC.navy) +
          `<a-entity ${spin(12000)}>` +
          `<a-box position="0 0.16 0" width="0.86" height="0.07" depth="0.42" color="${CC.ice}"></a-box>` +
          `<a-box position="0 0.06 0" width="0.86" height="0.07" depth="0.42" color="${CC.moss}"></a-box>` +
          `<a-box position="0 -0.08 0" width="0.86" height="0.07" depth="0.42" color="${CC.ice}"></a-box>` +
          `<a-box position="0 -0.18 0" width="0.86" height="0.07" depth="0.42" color="${CC.moss}"></a-box>` +
          sphere(-0.28, 0.28, 0.12, 0.045, CC.gold) + sphere(0, 0.28, 0.12, 0.045, CC.gold) +
          sphere(0.28, 0.28, 0.12, 0.045, CC.gold) +
          `</a-entity>` + label('Mg3Si2O5(OH)4  TO-type', 0, -0.3, 0.05, CC.gold);

      case 'dsw_ions':
        return plate(CC.deep) +
          `<a-entity ${bob(0.02, 0.08)}>` +
          sphere(-0.3, 0.1, 0, 0.075, CC.moss) + sphere(-0.05, 0.2, 0.05, 0.065, CC.gold) +
          sphere(0.22, 0.08, 0, 0.075, CC.moss) + sphere(0.36, -0.1, 0.04, 0.05, CC.white) +
          sphere(-0.2, -0.14, 0.03, 0.06, CC.gold) + `</a-entity>` +
          label('Mg2+ / Ca2+  from 200m deep', 0, -0.3, 0.05, CC.white);

      case 'tpgs3':
        return plate(CC.navy) +
          `<a-entity position="0 0.05 0">` +
          `<a-box position="-0.3 0 0" width="0.26" height="0.16" depth="0.1" color="${CC.gold}" ${spin(8000)}></a-box>` +
          `<a-box position="0 0 0" width="0.2" height="0.12" depth="0.09" color="${CC.green}"></a-box>` +
          `<a-box position="0.3 0 0" width="0.3" height="0.14" depth="0.09" color="${CC.deep}"></a-box>` +
          `<a-cylinder position="-0.16 0 0" radius="0.012" height="0.08" rotation="0 0 90" color="${CC.white}"></a-cylinder>` +
          `<a-cylinder position="0.15 0 0" radius="0.012" height="0.1" rotation="0 0 90" color="${CC.white}"></a-cylinder>` +
          `</a-entity>` + label('VitE - succinate - PEG750', 0, -0.26, 0.05, CC.moss);

      case 'micelle':
        return plate(CC.deep) +
          `<a-entity ${spin(14000)}>` +
          `<a-sphere position="0 0.03 0" radius="0.17" color="${CC.gold}" opacity="0.92"></a-sphere>` +
          `<a-sphere position="0 0.03 0" radius="0.29" color="${CC.teal}" opacity="0.3"></a-sphere>` +
          sphere(0.29, 0.03, 0, 0.035, CC.moss) + sphere(-0.29, 0.03, 0, 0.035, CC.moss) +
          sphere(0, 0.32, 0, 0.035, CC.moss) + sphere(0, -0.26, 0, 0.035, CC.moss) +
          sphere(0.2, 0.24, 0.1, 0.03, CC.moss) + sphere(-0.2, -0.18, -0.1, 0.03, CC.moss) +
          `</a-entity>` + label('micelle 50-100 nm', 0, -0.32, 0.05, CC.white);

      case 'mill':
        return plate(CC.navy) +
          `<a-sphere position="-0.28 0.06 0" radius="0.07" color="${CC.ice}"></a-sphere>` +
          `<a-sphere position="-0.12 0.06 0" radius="0.05" color="${CC.red}"></a-sphere>` +
          `<a-sphere position="0.24 0.06 0" radius="0.07" color="${CC.ice}"></a-sphere>` +
          `<a-sphere position="0 0.3 0" radius="0.06" color="#9AA3AD"
             animation="property: position; from: 0 0.34 0; to: 0 0.1 0; dir: alternate; loop: true; dur: 900; easing: easeInQuad"></a-sphere>` +
          `<a-sphere position="0.06 0.06 0" radius="0.02" color="${CC.gold}"
             animation="property: material.opacity; from: 1; to: 0.2; dir: alternate; loop: true; dur: 700"></a-sphere>` +
          label('Si-O-Si + mechanical -> radicals', 0, -0.28, 0.05, CC.gold, 1.4);

      case 'cmc':
        return plate(CC.deep) +
          `<a-entity animation="property: scale; from: 0.7 0.7 0.7; to: 1.05 1.05 1.05; dir: alternate; loop: true; dur: 2000; easing: easeInOutSine">` +
          `<a-sphere position="-0.24 0.06 0" radius="0.12" color="${CC.gold}" opacity="0.9"></a-sphere>` +
          `<a-sphere position="0.16 0.02 0" radius="0.09" color="${CC.gold}" opacity="0.9"></a-sphere>` +
          `<a-sphere position="0.3 0.22 0" radius="0.06" color="${CC.gold}" opacity="0.9"></a-sphere>` +
          `</a-entity>` + label('n x TPGS  <=>  micelle   (> CMC)', 0, -0.28, 0.05, CC.moss, 1.4);

      case 'hydrolysis':
        return plate(CC.navy) +
          `<a-sphere position="-0.26 0.1 0" radius="0.09" color="${CC.rust}" ${spin(7000)}></a-sphere>` +
          sphere(-0.04, 0.1, 0, 0.055, CC.ice) +
          `<a-sphere position="0.22 0.1 0" radius="0.075" color="${CC.rust}"></a-sphere>` +
          `<a-sphere position="0.34 -0.06 0" radius="0.04" color="${CC.red}"
             animation="property: position; from: 0.2 0.06 0; to: 0.4 -0.2 0; loop: true; dur: 1800; easing: easeInQuad"></a-sphere>` +
          label('Fe3+ + H2O <=> Fe(OH)2+ + H+  (pH down)', 0, -0.3, 0.05, CC.gold, 1.5);

      case 'fe_oh':
        /* Fe³⁺ 飛向表面 –OH，H⁺ 被擠出 */
        return plate(CC.navy) +
          `<a-box position="0 -0.2 0" width="0.9" height="0.08" depth="0.3" color="#7B8C82"></a-box>` +
          `<a-cylinder position="-0.1 -0.06 0" radius="0.012" height="0.18" color="${CC.white}"></a-cylinder>` +
          sphere(-0.1, 0.04, 0, 0.055, CC.red) +
          `<a-sphere radius="0.07" color="${CC.rust}"
             animation="property: position; from: 0.36 0.26 0.1; to: -0.02 0.1 0.02; loop: true; dur: 2400; easing: easeInOutCubic"></a-sphere>` +
          `<a-sphere radius="0.03" color="#DDE6EA"
             animation="property: position; from: -0.1 0.13 0; to: -0.34 0.32 0.05; loop: true; dur: 2400; easing: easeOutQuad"></a-sphere>` +
          label('=Si-OH + Fe3+ -> =Si-O-Fe2+ + H+', 0, -0.32, 0.05, CC.gold, 1.5) +
          label('HYPOTHESIS', 0.34, 0.3, 0.05, CC.gold, 0.7);

      case 'mg_swap':
        /* Mg²⁺ 補進缺陷格 */
        return plate(CC.navy) +
          `<a-entity position="0 0 0">` +
          sphere(-0.3, 0, 0, 0.06, CC.moss) + sphere(-0.15, 0, 0, 0.06, CC.moss) +
          `<a-torus position="0 0 0" radius="0.07" radius-tubular="0.008" color="${CC.red}" rotation="0 0 0"></a-torus>` +
          sphere(0.15, 0, 0, 0.06, CC.moss) + sphere(0.3, 0, 0, 0.06, CC.moss) +
          `<a-sphere radius="0.055" color="${CC.teal}"
             animation="property: position; from: 0.06 0.36 0.12; to: 0 0 0; loop: true; dur: 2600; easing: easeInOutCubic"></a-sphere>` +
          `</a-entity>` +
          label('=Si-O- + Mg2+ -> =Si-O-Mg+', 0, -0.3, 0.05, CC.gold, 1.4) +
          label('HYPOTHESIS', 0.34, 0.3, 0.05, CC.gold, 0.7);

      case 'cavitation':
        return plate(CC.deep) +
          `<a-sphere position="-0.28 0.06 0" radius="0.05" color="${CC.white}" opacity="0.6"
             animation="property: radius; from: 0.03; to: 0.07; dir: alternate; loop: true; dur: 1400"></a-sphere>` +
          `<a-sphere position="0 0.06 0" radius="0.1" color="${CC.white}" opacity="0.5"
             animation="property: radius; from: 0.06; to: 0.13; dir: alternate; loop: true; dur: 1400"></a-sphere>` +
          `<a-sphere position="0.26 0.06 0" radius="0.05" color="${CC.gold}"
             animation="property: radius; from: 0.14; to: 0.02; loop: true; dur: 1200; easing: easeInQuart"></a-sphere>` +
          label('grow -> collapse -> hot spot + microjet', 0, -0.3, 0.05, CC.moss, 1.5);

      case 'sidereact':
        return plate(CC.navy) +
          `<a-entity position="0 0.14 0">` +
          sphere(-0.24, 0, 0, 0.06, CC.moss) + sphere(-0.06, 0, 0, 0.055, '#9AA3AD') +
          `<a-sphere position="0.2 0 0" radius="0.07" color="#D8DEE3"
             animation="property: position; from: 0.2 0.06 0; to: 0.2 -0.1 0; dir: alternate; loop: true; dur: 1700"></a-sphere>` +
          `</a-entity>` +
          `<a-entity position="0 -0.1 0">` +
          sphere(-0.24, 0, 0, 0.065, CC.rust) + sphere(-0.06, 0, 0, 0.055, '#7FA6C8') +
          `<a-sphere position="0.2 0 0" radius="0.075" color="#A4552F"
             animation="property: position; from: 0.2 0.06 0; to: 0.2 -0.12 0; dir: alternate; loop: true; dur: 1700"></a-sphere>` +
          `</a-entity>` +
          label('MgCO3 down / Fe(OH)3 down', 0, -0.32, 0.05, CC.red, 1.4);

      case 'agcl':
        return plate(CC.navy) +
          `<a-box position="-0.26 0.02 0" width="0.16" height="0.34" depth="0.1" color="#DDE6EA" opacity="0.95"></a-box>` +
          `<a-box position="0 0.02 0" width="0.16" height="0.34" depth="0.1" color="#DDE6EA" opacity="0.55"></a-box>` +
          `<a-box position="0.26 0.02 0" width="0.16" height="0.34" depth="0.1" color="#DDE6EA" opacity="0.18"></a-box>` +
          `<a-sphere position="-0.26 0.28 0" radius="0.03" color="${CC.white}"
             animation="property: position; from: -0.26 0.3 0; to: -0.26 0.12 0; loop: true; dur: 1500; easing: easeInQuad"></a-sphere>` +
          label('Ag+ + Cl- -> AgCl (white)', 0, -0.3, 0.05, CC.gold, 1.4);

      default:
        return plate(CC.navy) + label('REACTION QUEST', 0, 0, 0.05, CC.gold);
    }
  }

  return { svg: svg, ar3d: ar3d, SVG: SVG, C: C };
})();
