/* 教學視覺：AR 教學面板中的 2D 示意圖（全部自繪 SVG），
   以及 AR 場景中錨定在關鍵圖片上的 3D 內容（A-Frame 圖元）。 */
window.VISUALS = (function () {

  const C = { navy:'#0B1F3A', deep:'#065A82', teal:'#1C7293', green:'#2E7D5B',
              moss:'#5FA98A', gold:'#C99A3E', grey:'#64748B', ink:'#1E293B' };

  const wrap = (inner, h) =>
    `<svg viewBox="0 0 340 ${h}" xmlns="http://www.w3.org/2000/svg" role="img">${inner}</svg>`;
  const t = (x, y, s, txt, fill, anchor='middle', weight='bold') =>
    `<text x="${x}" y="${y}" font-size="${s}" font-weight="${weight}" fill="${fill}" ` +
    `text-anchor="${anchor}" font-family="Microsoft JhengHei, sans-serif">${txt}</text>`;

  /* ───────── 2D 教學示意圖 ───────── */
  const SVG = {
    resources(){
      let s = `<rect width="340" height="170" fill="#DCF1FA"/>`;
      s += `<circle cx="292" cy="30" r="16" fill="#FFE9A8"/>`;
      s += `<polygon points="0,96 40,58 84,86 128,50 176,88 220,60 268,92 340,64 340,110 0,110" fill="#4F7D69"/>`;
      s += `<rect x="0" y="108" width="340" height="62" fill="#2E86AB"/>`;
      for (let i=0;i<12;i++) s += `<path d="M${8+i*28} ${124+(i%3)*14} q10-5 20 0" stroke="#BFE6F2" stroke-width="2" fill="none"/>`;
      const items = [['蛇紋石',C.green],['大理石',C.gold],['深層海水',C.deep],['砂石',C.teal]];
      items.forEach((it,i)=>{ const x=12+i*82;
        s += `<rect x="${x}" y="128" width="72" height="30" rx="8" fill="#fff" stroke="${it[1]}" stroke-width="3"/>`;
        s += t(x+36,148,12,it[0],it[1]); });
      s += t(170,80,15,'一邊是山，一邊是海','#fff');
      return wrap(s,170);
    },
    waste(){
      let s = `<rect width="340" height="170" fill="#EEECE6"/>`;
      const seed=[[40,120,22],[92,108,26],[150,124,20],[204,110,24],[258,126,22],[300,112,18],
                  [66,140,18],[126,146,16],[186,142,20],[240,148,17],[292,144,19]];
      seed.forEach((r,i)=>{ const [x,y,rr]=r; let p='';
        for(let k=0;k<6;k++){const a=k*1.047+i;p+=`${(x+rr*Math.cos(a)*(0.7+((i+k)%3)*0.15)).toFixed(0)},${(y+rr*Math.sin(a)*0.75).toFixed(0)} `;}
        s += `<polygon points="${p}" fill="${['#8E8F86','#6E7269','#A6A79C'][i%3]}" stroke="#3F4C45" stroke-width="1.6"/>`; });
      s += t(170,26,15,'碎石工廠粉塵實測',C.ink);
      s += `<rect x="24" y="38" width="230" height="16" rx="6" fill="#B03E34"/>`;
      s += `<rect x="24" y="38" width="230" height="16" rx="6" fill="none" stroke="${C.grey}" stroke-width="2"/>`;
      s += t(262,51,11,'20.8 mg/m³',C.ink,'start');
      s += `<rect x="24" y="60" width="110" height="16" rx="6" fill="${C.grey}"/>`;
      s += `<rect x="24" y="60" width="230" height="16" rx="6" fill="none" stroke="${C.grey}" stroke-width="2"/>`;
      s += t(262,73,11,'法規 10 mg/m³',C.ink,'start');
      s += `<rect x="20" y="84" width="300" height="1.5" fill="#C6C2B6"/>`;
      return wrap(s,170);
    },
    layers(){
      let s = `<rect width="340" height="190" fill="#F1F6F8"/>`;
      for (let L=0;L<2;L++){
        const y = 30 + L*80;
        s += `<rect x="20" y="${y}" width="300" height="26" rx="5" fill="#CEE4EC" stroke="${C.deep}" stroke-width="2"/>`;
        for(let i=0;i<10;i++){const x=26+i*29;
          s += `<polygon points="${x},${y+4} ${x+22},${y+4} ${x+11},${y+22}" fill="#78B2C8" stroke="${C.navy}" stroke-width="1.2"/>`;}
        s += t(14,y+19,11,'T',C.navy,'middle');
        const oy = y+28;
        s += `<rect x="20" y="${oy}" width="300" height="26" rx="5" fill="#D6EADE" stroke="${C.green}" stroke-width="2"/>`;
        for(let i=0;i<10;i++){const x=26+i*29;
          s += `<polygon points="${x+11},${oy+4} ${x+22},${oy+13} ${x+11},${oy+22} ${x},${oy+13}" fill="#92C4A8" stroke="#164C38" stroke-width="1.2"/>`;}
        s += t(14,oy+19,11,'O',C.green,'middle');
        for(let i=0;i<5;i++){const hx=42+i*62;
          s += `<line x1="${hx}" y1="${oy+26}" x2="${hx}" y2="${oy+34}" stroke="${C.gold}" stroke-width="3"/>`;
          s += `<circle cx="${hx}" cy="${oy+41}" r="9" fill="${C.gold}" stroke="${C.navy}" stroke-width="2"/>`;
          s += t(hx,oy+45,8,'OH',C.navy);}
      }
      s += t(170,18,13,'Mg₃Si₂O₅(OH)₄　1:1（TO）型層狀',C.ink);
      s += t(170,184,12,'露在外面的 –OH ＝ 唯一能反應的門把',C.green);
      return wrap(s,190);
    },
    ions(){
      let s = `<defs><linearGradient id="dsw" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#78C4E4"/><stop offset="1" stop-color="#0A3550"/></linearGradient></defs>`;
      s += `<rect width="340" height="180" fill="url(#dsw)"/>`;
      s += `<line x1="16" y1="52" x2="324" y2="52" stroke="${C.gold}" stroke-width="3"/>`;
      s += t(320,46,11,'200 m 以深',C.gold,'end');
      for(let i=0;i<5;i++){
        s += `<line x1="16" y1="${22+i*32}" x2="34" y2="${22+i*32}" stroke="#fff" stroke-width="2"/>`;
        s += t(38, 26+i*32, 9, (i*100)+' m', '#fff', 'start', 'normal');
      }
      const ions=[['Mg²⁺',C.moss,70,86,17],['Ca²⁺',C.gold,140,110,15],['Mg²⁺',C.moss,214,80,17],
                  ['K⁺','#8FD0EA',272,120,12],['Ca²⁺',C.gold,104,146,14],['Mg²⁺',C.moss,250,152,16],
                  ['Na⁺','#C6D8E2',176,146,11]];
      ions.forEach(([lab,col,x,y,r])=>{ s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" stroke="${C.navy}" stroke-width="2"/>`;
        s += t(x,y+4,r>14?10:8,lab,C.navy); });
      s += t(170,18,13,'深層海水濃縮液（DSW）','#fff');
      return wrap(s,180);
    },
    water(){
      let s = `<rect width="340" height="180" fill="#ECF6FA"/>`;
      const P=[[68,58],[176,44],[276,66],[48,128],[152,120],[262,140]];
      for(let i=0;i<P.length;i++) for(let j=i+1;j<P.length;j++){
        const d=Math.hypot(P[i][0]-P[j][0],P[i][1]-P[j][1]);
        if(d<118) s += `<line x1="${P[i][0]}" y1="${P[i][1]}" x2="${P[j][0]}" y2="${P[j][1]}" stroke="#8CAFC4" stroke-width="2" stroke-dasharray="5 5"/>`;}
      P.forEach(([x,y],i)=>{ const a=i*1.1;
        [-1,1].forEach(sg=>{ const hx=x+22*Math.cos(a+sg*0.92), hy=y+22*Math.sin(a+sg*0.92);
          s += `<line x1="${x}" y1="${y}" x2="${hx}" y2="${hy}" stroke="#48607A" stroke-width="3"/>`;
          s += `<circle cx="${hx}" cy="${hy}" r="8" fill="#fff" stroke="${C.navy}" stroke-width="2"/>`;
          s += t(hx,hy+3,8,'H','#B03E34'); });
        s += `<circle cx="${x}" cy="${y}" r="14" fill="#C4E2EE" stroke="${C.deep}" stroke-width="2.5"/>`;
        s += t(x,y+5,12,'O',C.deep); });
      s += t(170,168,12,'極性 ＋ 氫鍵網路：水不只是背景，它會參與',C.deep);
      return wrap(s,180);
    },
    micelle(){
      let s = `<rect width="340" height="200" fill="#E8F3F7"/>`;
      const cx=170, cy=98;
      s += `<circle cx="${cx}" cy="${cy}" r="86" fill="#CEE4EE" stroke="${C.deep}" stroke-width="2.5"/>`;
      s += `<circle cx="${cx}" cy="${cy}" r="42" fill="#FCECCE" stroke="${C.gold}" stroke-width="2.5"/>`;
      for(let i=0;i<20;i++){ const a=i*Math.PI/10, ca=Math.cos(a), sa=Math.sin(a);
        s += `<circle cx="${(cx+34*ca).toFixed(1)}" cy="${(cy+34*sa).toFixed(1)}" r="8" fill="#E2B260" stroke="${C.navy}" stroke-width="1.4"/>`;
        s += `<line x1="${(cx+42*ca).toFixed(1)}" y1="${(cy+42*sa).toFixed(1)}" x2="${(cx+56*ca).toFixed(1)}" y2="${(cy+56*sa).toFixed(1)}" stroke="#7A5028" stroke-width="3"/>`;
        for(let k=0;k<3;k++){ const rr=62+k*10;
          s += `<circle cx="${(cx+rr*ca).toFixed(1)}" cy="${(cy+rr*sa).toFixed(1)}" r="4.5" fill="#78BAD6" stroke="${C.deep}" stroke-width="1.2"/>`;}}
      s += t(cx,cy-4,12,'疏水核心','#8A6222');
      s += t(cx,cy+13,10,'50–100 nm','#8A6222','middle','normal');
      s += t(170,16,13,'TPGS-750-M 微胞剖面',C.ink);
      const lg=[['維生素 E','#E2B260'],['琥珀酸','#7A5028'],['PEG-750','#78BAD6']];
      lg.forEach((l,i)=>{ const x=22+i*106;
        s += `<rect x="${x}" y="182" width="14" height="11" rx="3" fill="${l[1]}" stroke="${C.navy}"/>`;
        s += t(x+20,192,11,l[0],C.ink,'start','normal'); });
      return wrap(s,200);
    },
    energy(){
      let s = `<rect width="340" height="180" fill="#F1F6F8"/>`;
      const cols=[['傳統焙燒','800°C','#B03E34',0.95,44],['本研究 A 組','25°C',C.green,0.18,196]];
      cols.forEach(([lab,temp,col,v,x])=>{
        s += `<rect x="${x}" y="34" width="46" height="96" rx="23" fill="#fff" stroke="${C.navy}" stroke-width="3"/>`;
        s += `<circle cx="${x+23}" cy="${138}" r="24" fill="${col}" stroke="${C.navy}" stroke-width="3"/>`;
        s += `<rect x="${x+13}" y="${126-92*v}" width="20" height="${92*v+8}" rx="10" fill="${col}"/>`;
        s += t(x+23,143,12,temp,'#fff');
        s += t(x+23,26,13,lab,C.ink); });
      s += `<path d="M126 84 h44 M158 74 l14 10 l-14 10" stroke="${C.teal}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      s += t(170,172,12,'綠色化學第 6 原則：提高能源效率（部分符合）',C.green);
      return wrap(s,180);
    },
    product(){
      let s = `<rect width="340" height="190" fill="#F1F6F8"/>`;
      const steps=[['廢石粉',C.grey],['球磨',C.teal],['改質',C.deep],['壓片',C.green],['杯墊',C.gold]];
      steps.forEach(([lab,col],i)=>{ const x=36+i*68;
        s += `<circle cx="${x}" cy="34" r="19" fill="${col}"/>`;
        s += t(x,39,11,String(i+1),'#fff');
        s += t(x,66,10.5,lab,C.ink,'middle','normal');
        if(i<4) s += `<path d="M${x+21} 34 h20 M${x+35} 29 l7 5 l-7 5" stroke="${C.grey}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`; });
      s += `<ellipse cx="86" cy="132" rx="52" ry="30" fill="#3E5A4E" stroke="${C.navy}" stroke-width="2.5"/>`;
      s += `<ellipse cx="86" cy="126" rx="38" ry="20" fill="#5A7A6A"/>`;
      for(let k=0;k<3;k++) s += `<path d="M${146+k*13} ${108+k*3} q12 ${24-k*2} 0 ${48+k*4}" stroke="${C.gold}" stroke-width="3" fill="none"/>`;
      s += t(238,100,11.5,'4–14 μm 遠紅外線',C.deep);
      s += `<rect x="192" y="112" width="130" height="14" rx="5" fill="${C.grey}"/>`;
      s += t(192,140,11,'基線 0.86',C.ink,'start','normal');
      s += `<rect x="192" y="146" width="140" height="14" rx="5" fill="${C.gold}"/>`;
      s += t(192,174,11,'目標假說 0.93（尚待驗證）',C.gold,'start','normal');
      return wrap(s,190);
    },
    mineral(){
      let s = `<rect width="340" height="170" fill="#F3F0E8"/>`;
      s += `<polygon points="0,64 46,42 96,70 148,40 200,72 252,46 306,74 340,56 340,110 0,110" fill="#9E8E70" stroke="#7E7157" stroke-width="2"/>`;
      for(let i=0;i<24;i++) s += `<circle cx="${10+i*14}" cy="${88+(i%4)*7}" r="${3+(i%3)}" fill="${['#A8977A','#87795F','#C0B294'][i%3]}"/>`;
      const box=(x,lab,col)=>`<rect x="${x}" y="122" width="82" height="34" rx="9" fill="#fff" stroke="${col}" stroke-width="3"/>`+t(x+41,144,12,lab,col);
      s += box(10,'Mg²⁺',C.moss);
      s += t(102,145,17,'＋',C.navy);
      s += box(120,'CO₂',C.grey);
      s += t(214,145,17,'→',C.navy);
      s += box(232,'MgCO₃',C.green);
      s += t(170,26,13,'災害土砂 × CO₂ 礦化（研究構想）',C.ink);
      s += t(170,166,10.5,'延伸假說，尚未經本論文實驗驗證',C.grey,'middle','normal');
      return wrap(s,170);
    },
    twelve(){
      let s = `<rect width="340" height="200" fill="#F1F6F8"/>`;
      const names=['預防廢棄','原子經濟','低危害','安全產品','安全溶劑','能源效率',
                   '再生原料','少衍生化','用觸媒','可降解','即時分析','本質安全'];
      const st=['ok','part','ok','ok','full','part','full','ok','part','ok','ok','part'];
      const col={ok:C.green,part:C.gold,full:C.deep};
      names.forEach((n,i)=>{ const c=i%4, r=(i/4)|0, x=12+c*82, y=28+r*54;
        s += `<rect x="${x}" y="${y}" width="74" height="46" rx="10" fill="#fff" stroke="${col[st[i]]}" stroke-width="2.5"/>`;
        s += `<circle cx="${x+14}" cy="${y+14}" r="10" fill="${col[st[i]]}"/>`;
        s += t(x+14,y+18,10,String(i+1),'#fff');
        s += t(x+37,y+38,10.5,n,C.ink,'middle','normal'); });
      s += t(170,18,13,'8 條符合・4 條部分符合・0 條違背',C.navy);
      s += `<circle cx="96" cy="192" r="6" fill="${C.deep}"/>`+t(106,196,10,'完全符合',C.ink,'start','normal');
      s += `<circle cx="176" cy="192" r="6" fill="${C.green}"/>`+t(186,196,10,'符合',C.ink,'start','normal');
      s += `<circle cx="234" cy="192" r="6" fill="${C.gold}"/>`+t(244,196,10,'部分符合',C.ink,'start','normal');
      return wrap(s,200);
    }
  };

  /* ───────── AR 場景中錨定在圖片上的 3D 內容 ─────────
     只用 A-Frame 圖元；文字一律 ASCII（預設字型不含中文）。 */
  function ar3d(kind){
    const g = [];
    const push = (s)=>g.push(s);
    const spin = (dur=9000)=>`animation__spin="property: rotation; to: 0 360 0; loop: true; dur: ${dur}; easing: linear"`;
    const bob = (y=0.06,dur=2000)=>`animation__bob="property: position; dir: alternate; dur: ${dur}; loop: true; easing: easeInOutSine"`;

    switch(kind){
      case 'resources':
        ['#2E7D5B','#C99A3E','#065A82','#1C7293'].forEach((c,i)=>
          push(`<a-box position="${-0.33+i*0.22} ${0.08+i*0.03} 0" depth="0.12" height="${0.14+i*0.05}" width="0.16"
                 color="${c}" ${bob()} animation__bob2="property: position; to: ${-0.33+i*0.22} ${0.16+i*0.03} 0; dir: alternate; loop: true; dur: ${1400+i*220}"></a-box>`));
        push(`<a-plane position="0 -0.18 0" width="1.0" height="0.12" color="#0B1F3A" opacity="0.85"></a-plane>`);
        push(`<a-text value="MOUNTAIN + OCEAN" align="center" position="0 -0.18 0.01" width="1.5" color="#FFFFFF"></a-text>`);
        break;
      case 'waste':
        for(let i=0;i<9;i++){ const a=i*0.7;
          push(`<a-dodecahedron radius="${0.06+ (i%3)*0.02}" color="${['#8E8F86','#6E7269','#A6A79C'][i%3]}"
                position="${(Math.cos(a)*0.3).toFixed(2)} ${(0.06+(i%3)*0.05).toFixed(2)} ${(Math.sin(a)*0.2).toFixed(2)}"
                animation="property: rotation; to: 360 360 0; loop: true; dur: ${6000+i*500}; easing: linear"></a-dodecahedron>`);}
        break;
      case 'layers':
        for(let L=0;L<3;L++){
          push(`<a-box position="0 ${0.04+L*0.14} 0" width="0.8" height="0.05" depth="0.5" color="#78B2C8"></a-box>`);
          push(`<a-box position="0 ${0.09+L*0.14} 0" width="0.8" height="0.05" depth="0.5" color="#92C4A8"></a-box>`);
          for(let i=0;i<5;i++)
            push(`<a-sphere radius="0.026" color="#C99A3E" position="${-0.3+i*0.15} ${0.13+L*0.14} 0.16"></a-sphere>`);
        }
        push(`<a-text value="surface -OH" align="center" position="0 0.5 0" width="1.2" color="#C99A3E"></a-text>`);
        break;
      case 'ions':
        [['Mg2+','#5FA98A',-0.26,0.12],['Ca2+','#C99A3E',0.02,0.2],['Mg2+','#5FA98A',0.3,0.1]].forEach(([lab,c,x,y],i)=>{
          push(`<a-sphere radius="0.075" color="${c}" position="${x} ${y} 0"
                animation="property: position; to: ${x} ${y+0.09} 0; dir: alternate; loop: true; dur: ${1600+i*300}; easing: easeInOutSine"></a-sphere>`);
          push(`<a-text value="${lab}" align="center" position="${x} ${y-0.14} 0" width="0.9" color="#0B1F3A"></a-text>`);});
        break;
      case 'water':
        for(let i=0;i<3;i++){ const x=-0.26+i*0.26;
          push(`<a-entity position="${x} 0.14 0" ${spin(7000+i*900)}>
                  <a-sphere radius="0.06" color="#C4E2EE"></a-sphere>
                  <a-sphere radius="0.035" color="#FFFFFF" position="0.07 0.05 0"></a-sphere>
                  <a-sphere radius="0.035" color="#FFFFFF" position="-0.07 0.05 0"></a-sphere>
                </a-entity>`);}
        push(`<a-text value="H2O  polar + hydrogen bonds" align="center" position="0 -0.06 0" width="1.4" color="#065A82"></a-text>`);
        break;
      case 'micelle':
        push(`<a-entity ${spin(14000)}>
                <a-sphere radius="0.16" color="#C99A3E" opacity="0.9" position="0 0.2 0"></a-sphere>
                ${Array.from({length:16},(_,i)=>{const a=i*Math.PI/8;
                  return `<a-sphere radius="0.038" color="#78BAD6" position="${(Math.cos(a)*0.27).toFixed(2)} 0.2 ${(Math.sin(a)*0.27).toFixed(2)}"></a-sphere>`;}).join('')}
              </a-entity>`);
        push(`<a-text value="micelle 50-100 nm" align="center" position="0 -0.02 0" width="1.3" color="#0B1F3A"></a-text>`);
        break;
      case 'energy':
        push(`<a-cylinder radius="0.07" height="0.62" color="#B03E34" position="-0.2 0.31 0"></a-cylinder>`);
        push(`<a-text value="800C" align="center" position="-0.2 0.7 0" width="1.1" color="#B03E34"></a-text>`);
        push(`<a-cylinder radius="0.07" height="0.14" color="#2E7D5B" position="0.2 0.07 0"></a-cylinder>`);
        push(`<a-text value="25C" align="center" position="0.2 0.24 0" width="1.1" color="#2E7D5B"></a-text>`);
        break;
      case 'product':
        push(`<a-cylinder radius="0.24" height="0.05" color="#3E5A4E" position="0 0.03 0" ${spin(11000)}></a-cylinder>`);
        [0,1,2].forEach(k=>push(`<a-torus radius="${0.3+k*0.1}" radius-tubular="0.006" color="#C99A3E" rotation="-90 0 0" position="0 ${0.06+k*0.05} 0"
                 animation="property: scale; to: 1.25 1.25 1.25; dir: alternate; loop: true; dur: ${1800+k*400}; easing: easeInOutSine"
                 animation__o="property: material.opacity; to: 0.15; dir: alternate; loop: true; dur: ${1800+k*400}"></a-torus>`));
        push(`<a-text value="far infrared 4-14 um" align="center" position="0 -0.1 0" width="1.4" color="#065A82"></a-text>`);
        break;
      case 'mineral':
        push(`<a-entity position="-0.28 0.12 0" ${spin(8000)}>
                <a-sphere radius="0.05" color="#64748B"></a-sphere>
                <a-sphere radius="0.04" color="#B03E34" position="0.09 0 0"></a-sphere>
                <a-sphere radius="0.04" color="#B03E34" position="-0.09 0 0"></a-sphere>
              </a-entity>`);
        push(`<a-text value="CO2" align="center" position="-0.28 -0.02 0" width="0.9" color="#0B1F3A"></a-text>`);
        push(`<a-text value="-&gt;" align="center" position="0 0.12 0" width="1.2" color="#0B1F3A"></a-text>`);
        push(`<a-box position="0.28 0.12 0" width="0.18" height="0.18" depth="0.18" color="#2E7D5B" ${spin(9000)}></a-box>`);
        push(`<a-text value="MgCO3" align="center" position="0.28 -0.02 0" width="1.0" color="#2E7D5B"></a-text>`);
        break;
      case 'twelve':
        for(let i=0;i<12;i++){ const c=i%4, r=(i/4)|0;
          push(`<a-box position="${-0.3+c*0.2} ${0.32-r*0.14} 0" width="0.15" height="0.1" depth="0.05"
                color="${['#065A82','#C99A3E','#2E7D5B','#2E7D5B','#065A82','#C99A3E','#065A82','#2E7D5B','#C99A3E','#2E7D5B','#2E7D5B','#C99A3E'][i]}"
                animation="property: position; to: ${-0.3+c*0.2} ${0.36-r*0.14} 0.04; dir: alternate; loop: true; dur: ${1200+i*130}; easing: easeInOutSine"></a-box>`);}
        push(`<a-text value="12 principles" align="center" position="0 -0.02 0" width="1.3" color="#0B1F3A"></a-text>`);
        break;
      default:
        push(`<a-box color="#2E7D5B" width="0.3" height="0.3" depth="0.3" position="0 0.15 0" ${spin()}></a-box>`);
    }
    return g.join('\n');
  }

  return { svg: k => (SVG[k] ? SVG[k]() : ''), ar3d };
})();
