/* v2.1.1 選角驗收：主會話指定的操作序列（點 card1 → card2 → card0），
   每一步用真的 pointerdown / pointerup / click，
   點完「立刻」讀 getComputedStyle —— 不做任何停用過渡的處理。
   選取態的四個身分屬性已從 transition 移除，所以同一幀就該是最終值。 */
(async function () {
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var cards = Array.prototype.slice.call(document.querySelectorAll('#char-row .pick-card.char'));
  var SEL = { mimi: 'rgb(6, 90, 130)', serpy: 'rgb(46, 125, 91)', aqua: 'rgb(28, 114, 147)' };
  var GOLD = 'rgb(201, 154, 62)', WHITE = 'rgb(245, 249, 250)';

  function realClick(el) {
    var r = el.getBoundingClientRect();
    var o = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    el.dispatchEvent(new PointerEvent('pointerdown', o));
    el.dispatchEvent(new PointerEvent('pointerup', o));
    el.dispatchEvent(new MouseEvent('click', o));
  }
  function snap(tag) {
    var rows = cards.map(function (x) {
      var cs = getComputedStyle(x);
      var badge = x.querySelector('.pick-ok');
      return {
        id: x.dataset.char,
        on: x.classList.contains('on'),
        aria: x.getAttribute('aria-pressed'),
        bg: cs.backgroundColor,
        borderW: cs.borderTopWidth,
        borderC: cs.borderTopColor,
        opacity: cs.opacity,
        transform: cs.transform,
        badge: badge ? getComputedStyle(badge).display : 'missing',
        inlineBg: x.style.background || '(none)',
        inlineBorder: x.style.borderColor || '(none)'
      };
    });
    /* 逐條驗收 */
    var bad = [];
    rows.forEach(function (r) {
      if (r.on) {
        if (r.bg !== SEL[r.id]) bad.push(r.id + ' 選取底色 ' + r.bg + ' ≠ ' + SEL[r.id]);
        if (r.borderW !== '3px') bad.push(r.id + ' 選取邊框寬 ' + r.borderW);
        if (r.borderC !== GOLD) bad.push(r.id + ' 選取邊框色 ' + r.borderC);
        if (r.opacity !== '1') bad.push(r.id + ' 選取 opacity ' + r.opacity);
        if (r.transform.indexOf('1.04') < 0) bad.push(r.id + ' 選取 transform ' + r.transform);
        if (r.badge !== 'block') bad.push(r.id + ' 標籤未顯示 (' + r.badge + ')');
        if (r.aria !== 'true') bad.push(r.id + ' aria-pressed ' + r.aria);
      } else {
        if (r.bg !== WHITE) bad.push(r.id + ' 未選取底色 ' + r.bg);
        if (r.borderW !== '2px') bad.push(r.id + ' 未選取邊框寬 ' + r.borderW);
        if (r.borderC === GOLD) bad.push(r.id + ' 未選取仍是金框');
        if (r.opacity !== '0.85') bad.push(r.id + ' 未選取 opacity ' + r.opacity);
        if (r.transform !== 'none') bad.push(r.id + ' 未選取 transform ' + r.transform);
        if (r.badge !== 'none') bad.push(r.id + ' 標籤未隱藏 (' + r.badge + ')');
        if (r.aria !== 'false') bad.push(r.id + ' aria-pressed ' + r.aria);
      }
      if (r.inlineBg !== '(none)') bad.push(r.id + ' 殘留 inline background ' + r.inlineBg);
      if (r.inlineBorder !== '(none)') bad.push(r.id + ' 殘留 inline borderColor ' + r.inlineBorder);
    });
    var onCount = rows.filter(function (r) { return r.on; }).length;
    if (onCount !== 1) bad.push('選取張數 = ' + onCount);
    return { tag: tag, rows: rows, fail: bad, pass: bad.length === 0 };
  }

  var out = { initial: snap('initial'), steps: [] };
  var order = [1, 2, 0];
  for (var i = 0; i < order.length; i++) {
    realClick(cards[order[i]]);
    out.steps.push(snap('after click card' + order[i] + ' (' + cards[order[i]].dataset.char + ')'));
    await sleep(350);
    out.steps[out.steps.length - 1].settled = snap('settled +350ms').pass;
  }
  out.allPass = out.initial.pass && out.steps.every(function (s) { return s.pass; });
  out.charId = window.RQ ? RQ.S.charId : null;
  return out;
})()
