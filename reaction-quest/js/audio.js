/* 蛇紋石改質反應探險 — 原創合成音訊引擎 v2.0
   ── 為什麼是即時合成而不是音檔 ──────────────────────────────────
   1. 零版權：全部由 Web Audio API 的振盪器（OscillatorNode）即時合成，
      沒有任何取樣素材、沒有任何授權疑慮，也不必附上來源標註。
   2. 零位元組：五段背景音樂與七個音效加起來 0 KB，手機在行動網路下不必等下載。
   3. 真・無縫循環：以 AudioContext.currentTime 為時基做「前瞻排程」
      （lookahead scheduling），每 60 ms 排未來 200 ms 的音符，
      循環接點在取樣層級對齊，不會出現音檔循環常見的一聲「喀」。
   ── iOS 解鎖 ───────────────────────────────────────────────────
   iOS Safari 只允許在「使用者手勢的同步呼叫堆疊」內建立／resume AudioContext。
   因此 unlock() 必須在「開始冒險」的 click handler 內同步呼叫（不可 await 之後才呼叫），
   並播一段長度為 1 的無聲 buffer 把硬體音訊管線真正叫醒。 */
window.AUDIO = (function () {

  var KEY_MUTE = 'rq_muted_v2';
  var ctx = null, master = null, musicBus = null, sfxBus = null;
  var muted = false;
  var cur = null;            // 目前 BGM 名稱
  var curGain = null;        // 目前 BGM 的音量節點
  var timer = 0;             // 排程器 interval
  var nextTime = 0;          // 下一個 step 的絕對時間
  var step = 0;              // 目前在第幾個 step
  var LOOKAHEAD = 0.2, TICK = 60;
  var log = { bgm: [], sfx: [] };   // 驗證用：記錄所有切換與觸發

  try { muted = localStorage.getItem(KEY_MUTE) === '1'; } catch (e) {}

  /* 音名 → 頻率（A4 = 440 Hz，MIDI 69） */
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  /* 五段背景音樂：以 16 分音符為一 step，數字為 MIDI 音高，null 為休止 */
  var D = null;
  var TRACKS = {
    /* 探索：輕快。D 大調五聲音階、跳躍琶音 */
    explore: {
      bpm: 116, spb: 4,
      bass: [38,D,D,D, 45,D,D,D, 40,D,D,D, 45,D,D,D,
             43,D,D,D, 50,D,D,D, 38,D,D,D, 45,D,D,D],
      lead: [74,D,76,D, 78,D,81,D, 78,D,76,D, 74,D,D,D,
             76,D,78,D, 81,D,83,D, 81,D,78,D, 76,D,D,D],
      pad:  [62,D,D,D,D,D,D,D, 65,D,D,D,D,D,D,D,
             67,D,D,D,D,D,D,D, 62,D,D,D,D,D,D,D],
      hat:  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1,
             1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1],
      lw: 'triangle', bw: 'sine', pw: 'sine', gain: 0.20
    },
    /* 掃描：懸疑。小調半音下行、低頻脈動 */
    scan: {
      bpm: 84, spb: 4,
      bass: [33,D,D,D, D,D,D,D, 32,D,D,D, D,D,D,D,
             31,D,D,D, D,D,D,D, 30,D,D,D, D,D,D,D],
      lead: [D,D,D,D, 69,D,68,D, D,D,D,D, 67,D,66,D,
             D,D,D,D, 69,D,71,D, D,D,D,D, 68,D,D,D],
      pad:  [57,D,D,D,D,D,D,D, 56,D,D,D,D,D,D,D,
             55,D,D,D,D,D,D,D, 54,D,D,D,D,D,D,D],
      hat:  [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1,
             0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,1,1],
      lw: 'sine', bw: 'sine', pw: 'sine', gain: 0.17
    },
    /* 教學：沉靜。長音襯底、旋律稀疏，不搶注意力 */
    teach: {
      bpm: 72, spb: 4,
      bass: [41,D,D,D,D,D,D,D, D,D,D,D,D,D,D,D,
             43,D,D,D,D,D,D,D, D,D,D,D,D,D,D,D],
      lead: [D,D,D,D, 72,D,D,D, D,D,74,D, D,D,D,D,
             D,D,D,D, 76,D,D,D, D,D,72,D, D,D,D,D],
      pad:  [60,D,D,D,D,D,D,D, 64,D,D,D,D,D,D,D,
             65,D,D,D,D,D,D,D, 62,D,D,D,D,D,D,D],
      hat:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
             0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      lw: 'sine', bw: 'sine', pw: 'triangle', gain: 0.15
    },
    /* 問答：緊張。持續八分脈動、和聲不解決 */
    quiz: {
      bpm: 128, spb: 4,
      bass: [36,D,36,D, 36,D,36,D, 34,D,34,D, 34,D,34,D,
             38,D,38,D, 38,D,38,D, 36,D,36,D, 36,D,D,D],
      lead: [D,D,D,D, D,D,D,D, 72,D,D,D, 73,D,D,D,
             D,D,D,D, D,D,D,D, 75,D,D,D, 72,D,D,D],
      pad:  [55,D,D,D,D,D,D,D, 58,D,D,D,D,D,D,D,
             60,D,D,D,D,D,D,D, 55,D,D,D,D,D,D,D],
      hat:  [1,1,0,1, 1,0,1,1, 1,1,0,1, 1,0,1,1,
             1,1,0,1, 1,0,1,1, 1,1,0,1, 1,1,1,1],
      lw: 'square', bw: 'sawtooth', pw: 'sine', gain: 0.14
    },
    /* 過關：歡慶。大三和弦上行、明亮 */
    win: {
      bpm: 132, spb: 4,
      bass: [43,D,D,D, 50,D,D,D, 48,D,D,D, 43,D,D,D,
             45,D,D,D, 52,D,D,D, 50,D,D,D, 43,D,D,D],
      lead: [79,D,83,D, 86,D,D,D, 84,D,81,D, 79,D,D,D,
             81,D,84,D, 88,D,D,D, 86,D,83,D, 79,D,D,D],
      pad:  [67,D,D,D,D,D,D,D, 71,D,D,D,D,D,D,D,
             72,D,D,D,D,D,D,D, 67,D,D,D,D,D,D,D],
      hat:  [1,1,1,1, 1,0,1,0, 1,1,1,1, 1,0,1,1,
             1,1,1,1, 1,0,1,0, 1,1,1,1, 1,1,1,1],
      lw: 'triangle', bw: 'sine', pw: 'sine', gain: 0.22
    }
  };

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0.0001 : 1;
    master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 1; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    return ctx;
  }

  /* 必須在使用者手勢的同步堆疊內呼叫（iOS 硬規） */
  function unlock() {
    ensure();
    if (!ctx) return false;
    try { if (ctx.state !== 'running') ctx.resume(); } catch (e) {}
    try {
      var b = ctx.createBuffer(1, 1, 22050);
      var s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination); s.start(0);
    } catch (e) {}
    return true;
  }
  function state() { return ctx ? ctx.state : 'none'; }

  function note(bus, freq, t, dur, wave, vol, detune) {
    if (!ctx || !bus) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (detune) o.detune.setValueAtTime(detune, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(bus, t, dur, vol, hp) {
    if (!ctx || !bus) return;
    var n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = ctx.createBufferSource(); s.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 6000;
    var g = ctx.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t);
  }

  /* 前瞻排程器：無縫循環的關鍵 */
  function schedule() {
    if (!ctx || !cur) return;
    var T = TRACKS[cur];
    var stepDur = 60 / T.bpm / T.spb;
    var len = T.bass.length;
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      var i = step % len, t = nextTime;
      var b = T.bass[i], l = T.lead[i], p = T.pad[i];
      if (b !== null) note(curGain, hz(b), t, stepDur * 3.2, T.bw, 0.34);
      if (l !== null) {
        note(curGain, hz(l), t, stepDur * 2.4, T.lw, 0.16);
        note(curGain, hz(l), t, stepDur * 2.4, T.lw, 0.07, 8);
      }
      if (p !== null) {
        note(curGain, hz(p), t, stepDur * 7.0, T.pw, 0.10);
        note(curGain, hz(p + 7), t, stepDur * 7.0, T.pw, 0.06);
      }
      if (T.hat[i]) noise(curGain, t, 0.045, 0.05, 7200);
      nextTime += stepDur;
      step++;
    }
  }

  /* 切換 BGM：舊軌 400 ms 淡出、新軌 400 ms 淡入 —— 切換不斷音 */
  function bgm(name) {
    if (!TRACKS[name]) return false;
    ensure();
    if (!ctx) return false;
    if (cur === name) return true;
    log.bgm.push({ t: Date.now(), name: name });
    console.log('[AUDIO] BGM ->', name);
    if (curGain) {
      var old = curGain, now = ctx.currentTime;
      try {
        old.gain.cancelScheduledValues(now);
        old.gain.setValueAtTime(old.gain.value, now);
        old.gain.linearRampToValueAtTime(0.0001, now + 0.4);
      } catch (e) {}
      setTimeout((function (g) { return function () { try { g.disconnect(); } catch (e) {} }; })(old), 900);
    }
    cur = name;
    curGain = ctx.createGain();
    curGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    curGain.gain.linearRampToValueAtTime(TRACKS[name].gain, ctx.currentTime + 0.4);
    curGain.connect(musicBus);
    nextTime = ctx.currentTime + 0.06;
    step = 0;
    if (!timer) timer = setInterval(schedule, TICK);
    schedule();
    return true;
  }
  function stopBgm() {
    if (timer) { clearInterval(timer); timer = 0; }
    if (curGain) { try { curGain.disconnect(); } catch (e) {} }
    curGain = null; cur = null;
  }

  /* 七個音效 */
  var SFX = {
    /* 代幣收集：兩聲清脆上行小鈴 */
    coin: function (t) {
      note(sfxBus, hz(88), t, 0.10, 'triangle', 0.30);
      note(sfxBus, hz(95), t + 0.075, 0.16, 'triangle', 0.26);
      noise(sfxBus, t, 0.03, 0.05, 9000);
    },
    /* 三代幣集齊、關卡解鎖：上行四音琶音 */
    unlock: function (t) {
      [72, 76, 79, 84].forEach(function (m, i) {
        note(sfxBus, hz(m), t + i * 0.09, 0.35, 'triangle', 0.24);
      });
      note(sfxBus, hz(48), t, 0.5, 'sine', 0.22);
    },
    /* 掃描成功／舞台展開：掃頻上行＋亮擊 */
    scanok: function (t) {
      if (!ctx) return;
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(180, t);
      o.frequency.exponentialRampToValueAtTime(1400, t + 0.45);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600;
      o.connect(f); f.connect(g); g.connect(sfxBus);
      o.start(t); o.stop(t + 0.6);
      [76, 83, 88].forEach(function (m, i) {
        note(sfxBus, hz(m), t + 0.34 + i * 0.05, 0.4, 'triangle', 0.22);
      });
      noise(sfxBus, t + 0.33, 0.18, 0.07, 4000);
    },
    /* 答對：明亮大三和弦 */
    right: function (t) {
      [72, 76, 79].forEach(function (m) { note(sfxBus, hz(m), t, 0.42, 'triangle', 0.22); });
      note(sfxBus, hz(84), t + 0.13, 0.4, 'sine', 0.18);
    },
    /* 答錯：下行小二度（不刺耳、不責備） */
    wrong: function (t) {
      note(sfxBus, hz(58), t, 0.22, 'square', 0.12);
      note(sfxBus, hz(55), t + 0.14, 0.32, 'square', 0.11);
    },
    /* 過關：六音號角 */
    clear: function (t) {
      [72, 76, 79, 84, 79, 84].forEach(function (m, i) {
        note(sfxBus, hz(m), t + i * 0.11, 0.42, 'triangle', 0.24);
      });
      note(sfxBus, hz(36), t, 0.9, 'sine', 0.24);
      noise(sfxBus, t + 0.55, 0.3, 0.05, 3000);
    },
    /* 全破：長版凱旋，兩層和聲 */
    allclear: function (t) {
      [72, 74, 76, 79, 84, 88, 91].forEach(function (m, i) {
        note(sfxBus, hz(m), t + i * 0.14, 0.6, 'triangle', 0.24);
        note(sfxBus, hz(m - 12), t + i * 0.14, 0.6, 'sine', 0.15);
      });
      [36, 43, 48].forEach(function (m) { note(sfxBus, hz(m), t, 1.8, 'sine', 0.20); });
      noise(sfxBus, t + 0.9, 0.6, 0.06, 2500);
    }
  };

  function sfx(name) {
    ensure();
    if (!ctx || !SFX[name]) return false;
    if (ctx.state !== 'running') { try { ctx.resume(); } catch (e) {} }
    log.sfx.push({ t: Date.now(), name: name });
    console.log('[AUDIO] SFX ->', name);
    try { SFX[name](ctx.currentTime + 0.01); } catch (e) { console.warn('[AUDIO] sfx', e); }
    return true;
  }

  function setMuted(v) {
    muted = !!v;
    try { localStorage.setItem(KEY_MUTE, muted ? '1' : '0'); } catch (e) {}
    if (master && ctx) {
      var now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
      master.gain.linearRampToValueAtTime(muted ? 0.0001 : 1, now + 0.15);
    }
    console.log('[AUDIO] muted =', muted);
    return muted;
  }
  function toggle() { return setMuted(!muted); }
  function isMuted() { return muted; }

  return {
    unlock: unlock, state: state, bgm: bgm, stopBgm: stopBgm, sfx: sfx,
    setMuted: setMuted, toggle: toggle, isMuted: isMuted,
    TRACK_NAMES: Object.keys(TRACKS), SFX_NAMES: Object.keys(SFX),
    current: function () { return cur; },
    log: log,
    ctx: function () { return ctx; }
  };
})();
