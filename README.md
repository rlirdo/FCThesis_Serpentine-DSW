# 花蓮綠色化學闖關（WebAR 教學遊戲）

一個**用手機瀏覽器就能玩**的 AR 闖關教學遊戲。開一個網址、選主角、走探索地圖、
用後鏡頭掃描列印出來的關鍵圖片，教學內容就會浮現在紙上，答對一題即可過關。

- 內容主軸：《從零基礎到論文實驗：化學整合教學簡報》（七階教學）
- 單位：國立東華大學自然資源與環境學系　仿生與環境工作坊
- 指導教授：楊悠娟 教授　｜　製作：游豐兆 博士生
- 五大概念：在地資源再利用・循環經濟・綠色化學・環境永續・環境教育

---

## 為什麼是 WebAR，不是 Unity

需求是「**一個網址，Android 與 iPhone 都能用相機掃描**」。

| 方案 | 能否只給一個網址 | iPhone 能否開相機 |
|---|---|---|
| Unity AR Foundation | ✗（產出 APK／IPA） | ✓ 但要安裝 App |
| Unity WebGL | ✓ | ✗ iOS Safari 不支援 WebXR，取不到 AR 相機 |
| **WebAR（本專案）** | **✓** | **✓** 用 `getUserMedia` ＋ JS/WASM 追蹤，不依賴 WebXR |

因此採 WebAR。

### AR 方案：MindAR（影像追蹤）＋ A-Frame

在 MindAR 與 AR.js 之間，**選用 MindAR**，理由：

1. **自然影像追蹤**：直接追蹤整張教學插圖，不需要 AR.js pattern marker 那種黑框方塊。
   關鍵圖片因此可以「同時是教材、同時是掃描標的」，符合教學現場的需求。
2. **離線編譯可行**：Windows 上 `npm install canvas` 需要原生編譯工具鏈，
   MindAR 的 Node 版 offline compiler 因此裝不起來（`node-gyp` 失敗）。
   但 MindAR 的 `Compiler` 在**瀏覽器端**一樣能跑，所以本專案改用
   `tools/compile-each.html` ＋ `tools/devserver.py` 在本機瀏覽器內完成編譯，
   再把 `.mind` 位元組 POST 回磁碟。**全程離線、不依賴任何線上編譯服務。**
3. **函式庫全部本地化**：`vendor/` 內為 A-Frame 1.5.0 與 mindar-image-aframe 1.2.5，
   不使用 CDN，避免日後 CDN 失效。

---

## 目錄結構

```
AR遊戲_花蓮綠色化學闖關/
├─ index.html                  單頁應用（所有畫面）
├─ css/style.css               自然科學雜誌風樣式（海洋科學色票）
├─ js/
│   ├─ data.js                 10 關內容、主角、題庫、總結（教學資料層）
│   ├─ visuals.js              教學用 2D SVG 示意圖 ＋ AR 場景 3D 內容
│   ├─ ar.js                   MindAR 封裝、iOS 相容處理、降級路徑
│   └─ game.js                 主流程狀態機、探索模式、方向鍵、問答
├─ assets/
│   ├─ chars/                  3 位主角（自繪 SVG）
│   ├─ scenes/                 10 張花蓮實景風背景（自繪 SVG）
│   └─ targets/                10 張關鍵圖片（300 dpi PNG，AR 掃描標的）
├─ targets/                    level01–10.mind（MindAR 追蹤資料，每關獨立）
├─ vendor/                     A-Frame ＋ MindAR（本地檔，非 CDN）
├─ print/關鍵圖片列印稿.pdf     A4、每頁 2 張、含關卡編號與掃描說明
├─ tools/                      素材產生器與離線編譯工具（不影響遊戲執行）
└─ 測試報告.md                  已驗證項目、未驗證項目、手機測試檢查表
```

**每關一個 `.mind` 檔**（各約 650–730 KB）而非單一 7.2 MB 的合併檔——
手機每關只下載當關需要的追蹤資料，教學現場的網路壓力小很多。

---

## 本機執行

```bash
python tools/devserver.py 8765
# 瀏覽器開 http://localhost:8765
```

`localhost` 是瀏覽器的安全來源例外，因此本機測試可以開相機。
任何其他主機都**必須是 HTTPS**，否則瀏覽器不會給相機權限。

## 重新產生素材

```bash
python tools/gen_key_images.py    # 10 張關鍵圖片（300 dpi PNG）
python tools/gen_scenes.py        # 10 張場景背景（SVG）
python tools/gen_print_pdf.py     # A4 列印稿 PDF
```

**改了關鍵圖片就必須重新編譯 `.mind`**（追蹤資料必須與實際列印的圖一致）：
開 `http://localhost:8765/tools/compile-each.html`，等它跑完並自動寫回 `targets/`。

---

## 遊戲設計

**流程**：主角三選一 → 關卡數（5 關精華版／10 關完整版）→ 每關「探索 → 掃描 → 答題 → 核心觀念」→ 全破總結與徽章。

**主角**（全部自繪，非既有動漫角色）
| 主角 | 設定 | 配色 |
|---|---|---|
| 阿海 | 七星潭長大的少年，觀察力強 | 海洋藍 |
| 小玉 | 縱谷長大的女孩，行動力強 | 森綠 |
| 蛇紋獸 | 鱗片帶蛇紋石紋理的仿生機器穿山甲，胸口 –OH 核心 | 森綠＋典雅金 |

**10 關**
| # | 關卡 | 場景 | 核心觀念 |
|---|---|---|---|
| 1 | 花蓮的山與海 | 七星潭 | 在地資源盤點 |
| 2 | 石材廠的邊角料 | 石材加工廠 | 廢棄物現況與職業安全 |
| 3 | 墨玉的秘密 | 蛇紋岩採石場 | 層狀結構與 –OH 門把 |
| 4 | 深層海水的礦物 | 深層海水園區 | Mg²⁺／Ca²⁺ 與脫氣 |
| 5 | 水是最好的溶劑 | 清水斷崖 | 綠色化學第 5 原則 |
| 6 | 微胞奈米反應艙 | 東華大學東湖畔 | TPGS-750-M 三段結構 |
| 7 | 常溫改質不燒窯 | 花東縱谷稻田 | 綠色化學第 6 原則 |
| 8 | 遠紅外線杯墊誕生 | 花蓮文創工坊 | 產品化與循環經濟 |
| 9 | 災害土砂的第二種命運 | 馬太鞍溪重建區 | CO₂ 礦化（延伸假說） |
| 10 | 綠色化學大考驗 | 東華大學校園廣場 | 十二原則總複習 |

5 關版取 ①③⑤⑥⑧。

### 學術誠實
教學內容沿用簡報的界定原則：**是假說就說是假說**。
放射率 0.93 標示為「目標假說，尚待驗證」（基線 0.86 才是實測值）；
第 9 關的 CO₂ 礦化標示為「延伸構想，未經本論文實驗驗證」；
綠色化學自評如實寫出「8 條符合、4 條部分符合、0 條違背」。

---

## ⚠️ 分享連結時請務必附上參數

**LINE 的內建瀏覽器會封鎖相機。** 從 LINE 直接點開網址，掃描框會全黑。
因此對外分享（LINE 群組、公告、QR Code）時，請一律使用下面這個網址：

```
https://rlirdo.github.io/FCThesis_Serpentine-DSW/?openExternalBrowser=1
```

帶了 `openExternalBrowser=1`，LINE 會自動改用手機的外部瀏覽器（Safari／Chrome）開啟，相機就能正常運作。
（即使不帶參數，v1.1 也會在偵測到 LINE 時自動補上參數並重新導向；帶參數只是更保險、少一次跳轉。）

Facebook／Instagram／微信的內建瀏覽器沒有等效參數，v1.1 會顯示置頂橫幅，
指引使用者從 App 選單選「以瀏覽器開啟」。

---

## 手機相容性處理（v1.1）

| 項目 | 做法 |
|---|---|
| **LINE 內建瀏覽器封鎖相機**（實測主因） | 偵測 UA 含 `Line/` 或 `LIFF/` → 自動導向同網址 ＋ `?openExternalBrowser=1`（保留原有 query 與 hash；已帶參數則不再導向，不會無限迴圈） |
| FB／IG／微信內建瀏覽器 | 顯示置頂紅色橫幅 ＋ 掃描面板常駐提示，指引改用外部瀏覽器 |
| iOS 需使用者手勢才能開相機 | **按鈕 click 內第一件事就是 `getUserMedia`**（不再先載 600–800 KB 的 `.mind`），取得串流後立刻接上自己的 `<video id="cam-preview">`，使用者馬上看到畫面 |
| `.mind` 載入 | 預覽播放的同時在背景 `fetch()` 並轉成 blob URL 交給 MindAR，載入不佔用手勢時間 |
| 相機串流交棒 | 覆寫 MindAR 的 `_startVideo`，**把預檢那條串流直接餵進去**，全程只呼叫一次 `getUserMedia`（避免 iOS 脫離手勢、避免 Android 鏡頭尚未釋放的 `NotReadableError`） |
| iOS 會全螢幕接管影片 | 所有 video 補 `playsinline` / `webkit-playsinline` / `muted` / `autoplay`，並主動呼叫 `play()`（攔截 rejection 記錄到診斷）；MutationObserver 補強 |
| 後鏡頭 | `facingMode: { ideal: 'environment' }`（用 ideal 不用 exact，單鏡頭 Android 才不會直接失敗）；`OverconstrainedError` 時降級為 `{ video: true }` 重試一次 |
| HTTPS | 非 `localhost` 一律需 HTTPS，程式會先 preflight 檢查並給明確訊息 |
| 相機靜默失敗 | 除了 `videoWidth > 0`，另外每秒把畫面畫到 4×4 canvas 取平均亮度；連續 3 秒 < 6 判定「黑畫面」並顯示鏡頭蓋提示 |
| 健康檢查 | 寬限 **12 秒**並顯示倒數與「繼續等待」按鈕；亮度 > 6 立即解除。逾時**不自動跳轉**，改為顯示原因 ＋ 三個選項（重試相機／圖片模式／直接答題） |
| 問題回報 | 「📋 複製診斷資訊」一鍵複製 UA、權限狀態、錯誤名稱、影像尺寸、亮度值等（剪貼簿不可用時退回文字方塊供手動複製） |
| 無相機／不授權 | 提供「圖片模式」與「直接答題」，**沒有相機也能完整玩完**（教學場域的無障礙需求） |
| 觸控 | 所有按鈕 ≥ 44 px；方向鍵 64 px |
| 瀏海／安全區 | `viewport-fit=cover` ＋ `env(safe-area-inset-*)` |
| 版本可視化 | 開場頁右下角顯示 `v1.1`；`index.html` 對 js/css 加 `?v=1.1` 破快取 |

內建瀏覽器偵測與 LINE 逃生網址已抽成純函式（`AR.detectInApp(ua)` / `AR.externalBrowserUrl(href, ua)`），
可離線單元測試：

```bash
node tools/test_inapp.js      # 39 項，全數通過
```

---

## 版權

所有插畫、角色、場景、關鍵圖片、圖表**皆為本專案以 Python（PIL）與手寫 SVG 自繪**，
不使用任何有版權的圖片、字型或音效；字型使用系統字型。
第三方函式庫僅 A-Frame（MIT）與 MindAR（MIT），已置於 `vendor/`。
