/* 卡片模式（錨定在萬用卡上）的防重疊掃描。
   本機沒有相機，MindAR 不會啟動，錨點不會被賦予姿態；
   這裡自建一個與 STAGE.simulate('found') 相同數學的假錨點
   （MindAR 世界單位＝目標圖片像素：scale 1200、距離 3800，約等於卡片填滿八成畫面），
   把 #rq-stage 與 #rq-ui 掛上去，量到的就是卡片模式的真實投影版式。 */
(async function () {
  await new Promise(r => setTimeout(r, 1400));
  await fetch('/tools/rq4_verify.js').then(r => r.text()).then(t => eval(t));
  var CH = window.__RQ4_CHAR || 'mimi';
  RQ.setChar(CH); RQ.S.route = 10;
  document.querySelector('#btn-start').click();
  await new Promise(r => setTimeout(r, 3200));

  var T = STAGE.THREE(), sc = STAGE.scene();
  var fake = new T.Group();
  fake.name = 'rq4-fake-card';
  sc.object3D.add(fake);
  fake.position.set(0, 0.10 * 1200, -3800);
  fake.rotation.set(-0.35, 0, 0);
  fake.scale.setScalar(1200);

  function toCard() {
    STAGE.setMode('card', false);
    fake.add(STAGE.stageEl().object3D);
    fake.add(STAGE.uiEl().object3D);
    sc.object3D.updateMatrixWorld(true);
  }
  var rows = [];
  for (var i = 0; i < RQ.S.list.length; i++) {
    RQ.goLevel(i);
    await new Promise(r => setTimeout(r, 800));
    toCard();
    STAGE.relayout(20); await new Promise(r => setTimeout(r, 150));
    toCard(); STAGE.relayout(20);
    var c = STAGE.rectReport();
    RQ.grabAll();
    await new Promise(r => setTimeout(r, 2600));
    toCard();
    STAGE.relayout(20); await new Promise(r => setTimeout(r, 150));
    toCard(); STAGE.relayout(20);
    var t = STAGE.rectReport();
    rows.push({ n: RQ.level().n,
                collectRatio: c.heroRatio, collectOv: c.overlaps.length, collectDetail: c.overlaps,
                teachRatio: t.heroRatio, teachOv: t.overlaps.length, teachDetail: t.overlaps });
  }
  STAGE.setMode('free', false);
  sc.object3D.remove(fake);
  return { mode: 'card', char: CH, w: innerWidth, h: innerHeight, rows: rows, errs: RQV4.errs.slice() };
})()
