/* 過關「重玩本關」、全破「重玩本關／重新開始」、以及「結束遊戲」停音的驗證 */
(async function () {
  await new Promise(r => setTimeout(r, 1300));
  await fetch('/tools/rq4_verify.js').then(r => r.text()).then(t => eval(t));
  RQ.setChar('mimi'); RQ.S.route = 5;
  document.querySelector('#btn-start').click();
  await new Promise(r => setTimeout(r, 3200));
  var out = {};

  /* 走到過關 */
  RQ.grabAll();
  await new Promise(r => setTimeout(r, 2800));
  var g = 0;
  while (RQ.phase() !== 'clear' && g++ < 30) {
    if (RQ.phase() === 'quiz') RQ.answer(true); else RQ.next();
    await new Promise(r => setTimeout(r, 300));
  }
  out.clearPhase = RQ.phase();
  out.rescueAtClear = RQ.rescue();
  out.bgmAtClear = AUDIO.current();
  await new Promise(r => setTimeout(r, 4200));
  out.bgmAfterJingle = { bgm: AUDIO.current(), voices: AUDIO.liveVoices(), rms: +(AUDIO.rms() || 0).toFixed(6) };

  /* 過關頁按「重玩本關」 */
  var sfx0 = AUDIO.log.sfx.length;
  document.querySelector('#btn-again').click();
  await new Promise(r => setTimeout(r, 1600));
  out.afterAgain = { phase: RQ.phase(), level: RQ.level().n,
                     collected: STAGE.stats().collected, tokens: STAGE.stats().tokens,
                     rescue: RQ.rescue(), bgm: AUDIO.current(),
                     sfx: AUDIO.log.sfx.slice(sfx0).map(function (x) { return x.name; }) };

  /* 全破頁的兩顆按鈕 */
  RQ.finish();
  await new Promise(r => setTimeout(r, 1200));
  out.badgeVisible = !document.querySelector('#badge-layer').classList.contains('hidden');
  out.badgeButtons = ['#btn-badge-again', '#btn-restart'].map(function (id) {
    var e = document.querySelector(id), r = e.getBoundingClientRect();
    return { id: id, text: e.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height) };
  });
  document.querySelector('#btn-badge-again').click();
  await new Promise(r => setTimeout(r, 1600));
  out.afterBadgeAgain = { phase: RQ.phase(), level: RQ.level().n,
                          badgeHidden: document.querySelector('#badge-layer').classList.contains('hidden'),
                          collected: STAGE.stats().collected };

  /* 結束遊戲：這顆按鈕會 reload，先把結果寫進 sessionStorage 再按，
     重新載入後可用 sessionStorage.rq4_buttons 取回。 */
  AUDIO.bgm('explore');
  await new Promise(r => setTimeout(r, 800));
  out.beforeQuit = { bgm: AUDIO.current(), state: AUDIO.state(), voices: AUDIO.liveVoices() };
  out.errs = RQV4.errs.slice();
  try { sessionStorage.setItem('rq4_buttons', JSON.stringify(out)); } catch (e) {}
  document.querySelector('#btn-quit').click();
  await new Promise(r => setTimeout(r, 300));
  out.quit = { state: AUDIO.state(), bgm: AUDIO.current(),
               voices: AUDIO.liveVoices(), hasTimer: AUDIO.hasTimer(),
               life: AUDIO.log.life.slice(-1) };
  try { sessionStorage.setItem('rq4_buttons', JSON.stringify(out)); } catch (e) {}
  return out;
})()
