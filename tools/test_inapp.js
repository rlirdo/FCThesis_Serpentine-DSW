/* 內建瀏覽器偵測與 LINE 逃生網址的單元測試（node tools/test_inapp.js）
   navigator.userAgent 無法在瀏覽器內偽造，故把偵測邏輯抽成純函式直接測。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'ar.js'), 'utf8');
const sandbox = {
  window: {}, console,
  navigator: { userAgent: 'node-test', mediaDevices: null, permissions: null },
  document: { createElement: () => ({ getContext: () => null }),
              querySelectorAll: () => [], body: {}, addEventListener: () => {} },
  location: { href: 'https://rlirdo.github.io/FCThesis_Serpentine-DSW/',
              protocol: 'https:', hostname: 'rlirdo.github.io', search: '',
              replace(u) { this.__replaced = u; } },
  screen: { width: 390, height: 844 }, innerWidth: 390, innerHeight: 844, devicePixelRatio: 3,
  MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
  URL, setTimeout, clearTimeout, setInterval, clearInterval, fetch: () => Promise.reject(new Error('n/a'))
};
sandbox.window = sandbox;
sandbox.isSecureContext = true;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const AR = sandbox.window.AR;

let pass = 0, fail = 0;
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log('  ok   ' + label); }
  else { fail++; console.log('  FAIL ' + label + '\n       got  ' + JSON.stringify(got) +
                             '\n       want ' + JSON.stringify(want)); }
}

/* ── 1. detectInApp：多組真實 UA 字串 ── */
const UA = {
  lineIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1 Line/14.10.0',
  lineAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 Line/14.9.1/IAB',
  liff: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 LIFF/2.22.3',
  fbIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 [FBAN/FBIOS;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.4;FBSS/3;FBID/phone;FBLC/zh_TW;FBOP/5]',
  fbAndroid: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/125.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/465.0.0.35.109;]',
  ig: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 330.0.0.40.92 (iPhone15,2; iOS 17_4; zh_TW)',
  wechat: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.44(0x18002c2f) NetType/WIFI',
  safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36',
  chromeIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
  // 易誤判：字尾含 line 的字串不得判成 LINE
  skyline: 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Skyline/3.2 Chrome/120.0.0.0 Mobile Safari/537.36'
};
console.log('detectInApp');
eq('LINE iOS',        AR.detectInApp(UA.lineIOS).app, 'line');
eq('LINE Android',    AR.detectInApp(UA.lineAndroid).app, 'line');
eq('LIFF',            AR.detectInApp(UA.liff).app, 'line');
eq('Facebook iOS',    AR.detectInApp(UA.fbIOS).app, 'facebook');
eq('Facebook Android',AR.detectInApp(UA.fbAndroid).app, 'facebook');
eq('Instagram',       AR.detectInApp(UA.ig).app, 'instagram');
eq('WeChat',          AR.detectInApp(UA.wechat).app, 'wechat');
eq('Safari 非內建',    AR.detectInApp(UA.safari).inApp, false);
eq('Chrome Android',  AR.detectInApp(UA.chromeAndroid).inApp, false);
eq('Chrome iOS',      AR.detectInApp(UA.chromeIOS).inApp, false);
eq('桌機 Chrome',      AR.detectInApp(UA.desktop).inApp, false);
eq('Skyline 不誤判',   AR.detectInApp(UA.skyline).inApp, false);
eq('空字串',           AR.detectInApp('').inApp, false);
eq('undefined',       AR.detectInApp(undefined).inApp, false);
eq('LINE 有逃生方式',   AR.detectInApp(UA.lineIOS).escape, 'auto');
eq('FB 走選單',        AR.detectInApp(UA.fbIOS).escape, 'menu');

/* ── 2. externalBrowserUrl：LINE 自動重導網址 ── */
console.log('externalBrowserUrl');
const BASE = 'https://rlirdo.github.io/FCThesis_Serpentine-DSW/';
eq('LINE 乾淨網址 → 補參數',
   AR.externalBrowserUrl(BASE, UA.lineIOS), BASE + '?openExternalBrowser=1');
eq('LINE 已帶參數 → 不重導（防無限迴圈）',
   AR.externalBrowserUrl(BASE + '?openExternalBrowser=1', UA.lineIOS), null);
eq('LINE 已帶參數＋其他 query → 不重導',
   AR.externalBrowserUrl(BASE + '?utm=line&openExternalBrowser=1', UA.lineIOS), null);
eq('保留既有 query',
   AR.externalBrowserUrl(BASE + '?utm=poster', UA.lineIOS),
   BASE + '?utm=poster&openExternalBrowser=1');
eq('保留 hash',
   AR.externalBrowserUrl(BASE + '#level3', UA.lineIOS),
   BASE + '?openExternalBrowser=1#level3');
eq('同時保留 query 與 hash',
   AR.externalBrowserUrl(BASE + '?utm=poster#level3', UA.lineIOS),
   BASE + '?utm=poster&openExternalBrowser=1#level3');
eq('openExternalBrowser=0 → 視為未處理，補成 1',
   AR.externalBrowserUrl(BASE + '?openExternalBrowser=0', UA.lineIOS),
   BASE + '?openExternalBrowser=1');
eq('Safari 不重導',       AR.externalBrowserUrl(BASE, UA.safari), null);
eq('Facebook 不重導（走選單指引）', AR.externalBrowserUrl(BASE, UA.fbIOS), null);
eq('Instagram 不重導',    AR.externalBrowserUrl(BASE, UA.ig), null);
eq('壞網址不炸掉',         AR.externalBrowserUrl('not a url', UA.lineIOS), null);

/* ── 3. escapeInAppBrowser：確認只在該導向時導向，且不重複導向 ── */
console.log('escapeInAppBrowser（doRedirect=false，只計算）');
eq('LINE 回傳目標網址',
   AR.escapeInAppBrowser(BASE, UA.lineIOS, false), BASE + '?openExternalBrowser=1');
eq('LINE 第二次（已帶參數）回 null',
   AR.escapeInAppBrowser(BASE + '?openExternalBrowser=1', UA.lineIOS, false), null);
eq('Safari 回 null', AR.escapeInAppBrowser(BASE, UA.safari, false), null);

/* ── 4. 錯誤訊息對應 ── */
console.log('explain（getUserMedia 錯誤 → 中文訊息）');
['NotAllowedError', 'NotFoundError', 'NotReadableError', 'OverconstrainedError',
 'SecurityError', 'TypeError', 'WeirdError'].forEach(name => {
  const e = new Error('x'); e.name = name;
  const info = AR.explain(e);
  const ok = !!(info.reason && info.guide && info.reason.length > 4);
  if (ok) { pass++; console.log('  ok   ' + name + ' → ' + info.reason.slice(0, 24) + '…'); }
  else { fail++; console.log('  FAIL ' + name + ' 沒有中文訊息'); }
});

/* ── 5. preflight ── */
console.log('preflight');
eq('HTTPS 通過', AR.preflight().ok, false);   // 測試沙箱沒有 mediaDevices → 應擋下
eq('擋下原因是 NO_API', AR.preflight().code, 'NO_API');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
