/* 在 rq4_test.html 上跑：一位主角 × 一種畫面尺寸 × 10 關的防重疊掃描 */
(async function () {
  await new Promise(r => setTimeout(r, 1400));
  await fetch('/tools/rq4_verify.js').then(r => r.text()).then(t => eval(t));
  var CH = window.__RQ4_CHAR || 'mimi';
  RQ.setChar(CH); RQ.S.route = 10;
  document.querySelector('#btn-start').click();
  await new Promise(r => setTimeout(r, 3200));
  var rows = [];
  for (var i = 0; i < RQ.S.list.length; i++) {
    RQ.goLevel(i);
    await new Promise(r => setTimeout(r, 800));
    STAGE.relayout(20); await new Promise(r => setTimeout(r, 150)); STAGE.relayout(20);
    var c = STAGE.rectReport();
    RQ.grabAll();
    await new Promise(r => setTimeout(r, 2600));
    STAGE.relayout(20); await new Promise(r => setTimeout(r, 150)); STAGE.relayout(20);
    var t = STAGE.rectReport();
    rows.push({ n: RQ.level().n,
                collectRatio: c.heroRatio, collectOv: c.overlaps.length, collectDetail: c.overlaps,
                teachRatio: t.heroRatio, teachOv: t.overlaps.length, teachDetail: t.overlaps,
                key: !!t.key, phase: RQ.phase() });
  }
  window.__RQ4_RESULT = { char: CH, w: innerWidth, h: innerHeight, rows: rows, errs: RQV4.errs.slice() };
  return window.__RQ4_RESULT;
})()
