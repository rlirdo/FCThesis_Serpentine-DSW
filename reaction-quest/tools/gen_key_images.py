# -*- coding: utf-8 -*-
"""
產生 12 張「關卡關鍵圖片」（AR 掃描目標 ＋ 教學插圖）
＋ 第 0 張「遊戲萬用卡」（每一關都可以掃它，一張卡玩到底）
- 1200x1200 px @ 300 dpi（約 10.2 cm 見方）
- 高特徵密度：不規則邊框刻度、非重複紋理斑塊、豐富角點（MindAR 特徵點需 > 300）
- 全部自繪，零版權素材
輸出：assets/targets/levelNN.png、assets/targets/universal.png（300dpi PNG）
用法： PYTHONUTF8=1 python tools/gen_key_images.py
"""
import os, math, random
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "assets", "targets")
os.makedirs(OUT, exist_ok=True)

S = 1200
DPI = 300
FONT = "C:/Windows/Fonts/msjh.ttc"
FONTB = "C:/Windows/Fonts/msjhbd.ttc"

NAVY = (11, 31, 58)
DEEP = (6, 90, 130)
TEAL = (28, 114, 147)
GREEN = (46, 125, 91)
MOSS = (95, 169, 138)
GOLD = (201, 154, 62)
GREY = (100, 116, 139)
DARK = (30, 41, 59)
BG = (250, 251, 250)
WHITE = (255, 255, 255)
RED = (176, 62, 52)
RUST = (140, 74, 47)
ICE = (120, 178, 200)
SAND = (244, 228, 196)


def F(size, bold=True):
    return ImageFont.truetype(FONTB if bold else FONT, size)


# 微軟正黑體沒有下標（U+2080–208E）與上標加減號（U+207A/207B）的字符，
# 直接畫會變成豆腐方框。PNG 卡片一律先正規化：下標→一般數字、上標加減→ + / –。
# 上標 ² ³（Latin-1）本身有字，予以保留，電荷才不會與計量數混淆（如 CO3²–）。
_SUBSUP = {
    0x2080: "0", 0x2081: "1", 0x2082: "2", 0x2083: "3", 0x2084: "4",
    0x2085: "5", 0x2086: "6", 0x2087: "7", 0x2088: "8", 0x2089: "9",
    0x208A: "+", 0x208B: "-", 0x2099: "n",
    0x2070: "0", 0x2074: "4", 0x2075: "5", 0x2076: "6",
    0x2077: "7", 0x2078: "8", 0x2079: "9",
    0x207A: "+", 0x207B: "–",
    0x21CC: "↔",          # ⇌ → ↔（雙向平衡，字型有這一個）
}


def fix(txt):
    return str(txt).translate(_SUBSUP)


# ══════════════════════════════════════════════════════════════
# 文字量測與自動縮排（v1.1）
# ── 為什麼要有這一段 ──────────────────────────────────────────
# v1.0 的字級是寫死的，遇到「④Fe³⁺」這種上標多、字寬不可預測的字串，
# 就會撐出所屬的圓形／膠囊之外；右下角的 L00 徽章也會和左邊的說明文字重疊。
# v1.1 起所有文字一律：
#   ① 先用 PIL.ImageDraw.textbbox 量測，字級逐級縮小直到 bbox 完全落在
#      所屬形狀區域內（四邊各留 ≥6% 內距）
#   ② 把每一段文字的 bbox 與所屬區域登記起來
#   ③ 出圖前程式化斷言：任一文字不超出其區域、任兩個文字 bbox 不相交
#   ④ 另外輸出一張把 bbox 全部畫出來的檢查圖（tools/_bboxcheck/）
# ══════════════════════════════════════════════════════════════
TEXTS = []          # 目前這一張圖已經畫上去的文字紀錄


def reset_texts():
    del TEXTS[:]


def _register(name, bbox, region, size, overflow=False):
    TEXTS.append({"name": name, "bbox": bbox, "region": region,
                  "size": size, "overflow": overflow})


def _inner(region, pad=0.06):
    """區域內縮 pad（預設 6%），四邊各留白"""
    x0, y0, x1, y1 = region
    pw, ph = (x1 - x0) * pad, (y1 - y0) * pad
    return (x0 + pw, y0 + ph, x1 - pw, y1 - ph)


DEFAULT_REGION = (34, 34, S - 34, S - 34)


def anchor_point(reg, anchor):
    """由（已內縮的）區域與 anchor 推出文字的落點，
       這樣「左對齊的文字起點」一定就在內距之內，不會出現
       『再怎麼縮小字級也永遠不合格』的死循環。"""
    x0, y0, x1, y1 = reg
    ax = anchor[0] if anchor else "m"
    ay = anchor[1] if len(anchor) > 1 else "m"
    x = x0 if ax == "l" else (x1 if ax == "r" else (x0 + x1) / 2.0)
    y = y0 if ay in ("a", "t") else (y1 if ay in ("d", "s", "b") else (y0 + y1) / 2.0)
    return (x, y)


def fit_text(d, xy, txt, size, fill, region=None, anchor="mm", bold=True,
             min_size=8, pad=None, name=None):
    """畫文字，並保證 bbox 落在 region 的內縮框裡；放不下就逐級降字級。
       xy 傳 None 時，落點由 region＋anchor 自動推出（推薦用法）。
       沒有給 region 時代表「只登記、不設內距」，用整張卡當界線。
       回傳 (實際字級, bbox)。"""
    txt = fix(txt)
    if pad is None:
        pad = 0.06 if region is not None else 0.0
    reg = _inner(region or DEFAULT_REGION, pad)
    if xy is None:
        xy = anchor_point(reg, anchor)
    s = int(size)
    while s >= min_size:
        f = F(s, bold)
        b = d.textbbox(xy, txt, font=f, anchor=anchor)
        if b[0] >= reg[0] - 0.5 and b[1] >= reg[1] - 0.5 and            b[2] <= reg[2] + 0.5 and b[3] <= reg[3] + 0.5:
            d.text(xy, txt, font=f, fill=fill, anchor=anchor)
            _register(name or txt[:14], b, reg, s)
            return s, b
        s -= 1
    f = F(min_size, bold)
    b = d.textbbox(xy, txt, font=f, anchor=anchor)
    d.text(xy, txt, font=f, fill=fill, anchor=anchor)
    _register(name or txt[:14], b, reg, min_size, overflow=True)
    return min_size, b


def fit_circle(d, cx, cy, r, lines, size, fill, bold=True, pad=0.06, name=None):
    """圓形區域內的多行文字：以內接正方形為界，逐行分帶配置，
       所以同一顆圓裡的兩行永遠不會互相重疊，也不會超出圓周。"""
    half = r / 1.4142135
    n = max(1, len(lines))
    out = []
    for i, ln in enumerate(lines):
        y0 = cy - half + (2 * half) * i / n
        y1 = cy - half + (2 * half) * (i + 1) / n
        out.append(fit_text(d, (cx, (y0 + y1) / 2), ln, size, fill,
                            region=(cx - half, y0, cx + half, y1),
                            bold=bold, pad=pad,
                            name=(name or "circle") + "#%d" % i))
    return out


def check_texts(tag):
    """回傳所有違規：溢出所屬區域、或兩段文字 bbox 相交"""
    bad = []
    for t in TEXTS:
        b, r = t["bbox"], t["region"]
        if t.get("overflow") or b[0] < r[0] - 0.5 or b[1] < r[1] - 0.5 or            b[2] > r[2] + 0.5 or b[3] > r[3] + 0.5:
            bad.append(("OVERFLOW", tag, t["name"], tuple(int(v) for v in b),
                        tuple(int(v) for v in r)))
    for i in range(len(TEXTS)):
        for j in range(i + 1, len(TEXTS)):
            a, b = TEXTS[i]["bbox"], TEXTS[j]["bbox"]
            if a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]:
                bad.append(("OVERLAP", tag, TEXTS[i]["name"], TEXTS[j]["name"],
                            tuple(int(v) for v in a), tuple(int(v) for v in b)))
    return bad


def draw_bbox_check(img, tag):
    """輸出檢查圖：紅框＝文字 bbox、藍框＝所屬區域內縮框"""
    out = img.copy()
    dd = ImageDraw.Draw(out)
    for t in TEXTS:
        dd.rectangle(list(t["region"]), outline=(60, 120, 255), width=2)
        dd.rectangle(list(t["bbox"]), outline=(220, 40, 40), width=3)
    folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_bboxcheck")
    os.makedirs(folder, exist_ok=True)
    p = os.path.join(folder, tag + ".png")
    out.save(p)
    return p


def ctext(d, xy, txt, font, fill, anchor="mm", region=None, name=None):
    """相容 v1.0 的介面：仍然吃 font 物件，但改走 fit_text，
       所以每一段文字都會被量測與登記，超出範圍時自動縮小。"""
    try:
        size = font.size
    except AttributeError:
        size = 24
    bold = getattr(font, "path", "").lower().endswith("bd.ttc")
    return fit_text(d, xy, txt, size, fill, region=region, anchor=anchor,
                    bold=bold, name=name)


# ────────────────────────────────────────────── 邊框（特徵密集）
def frame(d, rng, n):
    """不規則刻度邊框 + 四角唯一識別碼：提供大量穩定角點"""
    m = 26
    d.rectangle([m, m, S - m, S - m], outline=NAVY, width=9)
    d.rectangle([m + 20, m + 20, S - m - 20, S - m - 20], outline=TEAL, width=3)
    cols = [NAVY, DEEP, TEAL, GREEN, GOLD]
    for i in range(48):
        t = m + 30 + i * ((S - 2 * m - 60) / 47.0)
        h = 10 + ((i * (n + 2)) % 5) * 7
        d.line([t, m + 9, t, m + 9 + h], fill=cols[(i + n) % 5], width=5)
        h2 = 10 + ((i * (n + 3) + 1) % 5) * 7
        d.line([t, S - m - 9, t, S - m - 9 - h2], fill=cols[(i * 2 + n) % 5], width=5)
        h3 = 10 + ((i * (n + 5) + 2) % 5) * 7
        d.line([m + 9, t, m + 9 + h3, t], fill=cols[(i * 3 + n) % 5], width=5)
        h4 = 10 + ((i * (n + 7) + 3) % 5) * 7
        d.line([S - m - 9, t, S - m - 9 - h4, t], fill=cols[(i + n * 2) % 5], width=5)
    # 四角唯一識別碼（n 的二進位 + 角落序號）→ 每張圖角落絕不相同
    for ci, (cx, cy) in enumerate([(m + 48, m + 48), (S - m - 48, m + 48),
                                   (m + 48, S - m - 48), (S - m - 48, S - m - 48)]):
        code = (n * 4 + ci) % 16
        d.rectangle([cx - 34, cy - 34, cx + 34, cy + 34], fill=WHITE, outline=NAVY, width=4)
        for b in range(4):
            bx = cx - 30 + (b % 2) * 32
            by = cy - 30 + (b // 2) * 32
            if code >> b & 1:
                d.rectangle([bx, by, bx + 26, by + 26], fill=NAVY)
            else:
                d.ellipse([bx + 4, by + 4, bx + 22, by + 22], outline=TEAL, width=4)


def speckle(d, rng, box, density=170):
    """非重複紋理斑塊：小三角／短線／圓點混合，製造大量角點"""
    x0, y0, x1, y1 = box
    cols = [DEEP, TEAL, GREEN, MOSS, GOLD, GREY]
    for _ in range(density):
        x = rng.uniform(x0, x1)
        y = rng.uniform(y0, y1)
        c = cols[rng.randrange(len(cols))]
        k = rng.randrange(3)
        if k == 0:
            r = rng.uniform(3, 8)
            d.ellipse([x - r, y - r, x + r, y + r], fill=c)
        elif k == 1:
            a = rng.uniform(0, 6.28)
            L = rng.uniform(9, 22)
            d.line([x, y, x + L * math.cos(a), y + L * math.sin(a)], fill=c, width=3)
        else:
            r = rng.uniform(6, 14)
            a = rng.uniform(0, 6.28)
            pts = [(x + r * math.cos(a + i * 2.094), y + r * math.sin(a + i * 2.094)) for i in range(3)]
            d.polygon(pts, outline=c, width=3)


def header(d, n, title, en, hypo=False):
    """標題列：假說徽章存在時，標題文字的區域右界自動退讓，兩者不可能重疊。"""
    d.rounded_rectangle([70, 78, S - 70, 214], 22, fill=NAVY)
    d.ellipse([94, 100, 186, 192], fill=GOLD)
    fit_text(d, None, "%02d" % n, 52, NAVY,
             region=(94, 100, 186, 192), name="lv-no")
    right = (S - 380) if hypo else (S - 100)
    fit_text(d, None, en, 24, MOSS, region=(204, 96, right, 142),
             anchor="lm", bold=False, name="lv-en")
    fit_text(d, None, title, 38, WHITE, region=(204, 146, S - 100, 206),
             anchor="lm", name="lv-title")
    if hypo:
        d.rounded_rectangle([S - 366, 96, S - 92, 148], 16, fill=GOLD)
        fit_text(d, None, "研究假說（待驗證）", 26, NAVY,
                 region=(S - 366, 96, S - 92, 148), name="lv-hypo")


def footer(d, n, note):
    """底部列：LNN 徽章獨立成區，說明文字的區域寬度扣掉徽章區。"""
    d.rounded_rectangle([70, S - 196, S - 70, S - 78], 20, fill=(233, 241, 244),
                        outline=TEAL, width=3)
    BADGE = (S - 240, S - 186, S - 88, S - 88)
    TXT_R = (88, S - 190, S - 256, S - 84)
    fit_text(d, None, "掃描說明", 24, TEAL,
             region=(TXT_R[0], S - 190, TXT_R[2], S - 138), anchor="lm", name="ft-label")
    fit_text(d, None, note, 25, DARK,
             region=(TXT_R[0], S - 136, TXT_R[2], S - 86), anchor="lm", bold=False,
             name="ft-note")
    fit_text(d, None, "L%02d" % n, 46, TEAL, region=BADGE, anchor="rm",
             name="ft-badge")


def card(d, box, r=18, fill=WHITE, outline=GREY):
    d.rounded_rectangle(box, r, fill=fill, outline=outline, width=3)


def atom(d, cx, cy, r, col, label, fsz=None, txt=WHITE):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col, outline=NAVY, width=4)
    if label:
        ctext(d, (cx, cy), label, F(fsz or int(r * 0.75)), txt)


def bond(d, x1, y1, x2, y2, col=NAVY, w=8):
    d.line([x1, y1, x2, y2], fill=col, width=w)


def arrow(d, x1, y, x2, col=NAVY, w=8, head=22):
    d.line([x1, y, x2 - head * 0.6, y], fill=col, width=w)
    d.polygon([(x2, y), (x2 - head, y - head * 0.55), (x2 - head, y + head * 0.55)], fill=col)


def eq_arrow(d, x1, y, x2, col=NAVY, w=6, head=18):
    """⇌ 雙向平衡箭頭"""
    d.line([x1, y - 12, x2 - head * 0.6, y - 12], fill=col, width=w)
    d.polygon([(x2, y - 12), (x2 - head, y - 12 - head * 0.5), (x2 - head, y - 12 + head * 0.2)], fill=col)
    d.line([x2, y + 12, x1 + head * 0.6, y + 12], fill=col, width=w)
    d.polygon([(x1, y + 12), (x1 + head, y + 12 - head * 0.2), (x1 + head, y + 12 + head * 0.5)], fill=col)


def eqline(d, y, txt, fsz=38, col=NAVY, bg=(240, 246, 249)):
    d.rounded_rectangle([100, y - 38, S - 100, y + 38], 14, fill=bg, outline=TEAL, width=3)
    ctext(d, (S // 2, y), txt, F(fsz), col)


def up_arrow(d, x, y0, y1, col=RED, w=8):
    """由 y0 往上畫到 y1（y1 < y0）"""
    d.line([x, y0, x, y1 + 14], fill=col, width=w)
    d.polygon([(x, y1), (x - 14, y1 + 20), (x + 14, y1 + 20)], fill=col)


def down_arrow(d, x, y0, y1, col=RED, w=8):
    d.line([x, y0, x, y1 - 14], fill=col, width=w)
    d.polygon([(x, y1), (x - 14, y1 - 20), (x + 14, y1 - 20)], fill=col)


# ────────────────────────────────────────────── 十二關插圖
def art01(d, rng):   # 蛇紋石層狀結構 + OH 門把
    card(d, [100, 240, S - 100, 700])
    speckle(d, rng, (120, 260, S - 120, 690), 120)
    card(d, [100, 240, S - 100, 700])
    for L in range(2):
        y = 300 + L * 190
        d.rounded_rectangle([150, y, S - 150, y + 74], 10, fill=(206, 228, 236), outline=DEEP, width=5)
        for i in range(12):
            x = 168 + i * 74
            d.polygon([(x, y + 10), (x + 56, y + 10), (x + 28, y + 64)], fill=(120, 178, 200),
                      outline=NAVY, width=3)
        ctext(d, (124, y + 37), "T", F(38), DEEP)
        oy = y + 78
        d.rounded_rectangle([150, oy, S - 150, oy + 74], 10, fill=(214, 234, 222), outline=GREEN, width=5)
        for i in range(12):
            x = 168 + i * 74
            d.polygon([(x + 28, oy + 10), (x + 56, oy + 37), (x + 28, oy + 64), (x, oy + 37)],
                      fill=(146, 196, 168), outline=(22, 76, 56), width=3)
        ctext(d, (124, oy + 37), "O", F(38), GREEN)
        for i in range(4):
            hx = 240 + i * 240
            d.line([hx, oy + 74, hx, oy + 100], fill=GOLD, width=8)
            atom(d, hx, oy + 122, 26, GOLD, "OH", 22, NAVY)
    eqline(d, 760, "Mg₃Si₂O₅(OH)₄　＝　3 Mg ＋ 2 Si ＋ 5 O ＋ 4 (OH)", 36)
    card(d, [100, 812, S - 100, 962])
    ctext(d, (130, 856), "4 個羥基：3 個露在外表面（可反應）、1 個藏在層內（碰不到）",
          F(30), DARK, "lm")
    ctext(d, (130, 912), "層與層之間靠氫鍵相黏，比化學鍵弱 → 容易一片一片剝開",
          F(28, False), GREY, "lm")


def art02(d, rng):   # 深層海水離子
    card(d, [100, 240, S - 100, 720], fill=(226, 240, 247))
    speckle(d, rng, (120, 260, S - 120, 700), 130)
    d.line([120, 380, S - 120, 380], fill=GOLD, width=8)
    ctext(d, (S - 140, 350), "200 m 以深", F(30), GOLD, "rm")
    for i in range(6):
        yy = 280 + i * 72
        d.line([130, yy, 190, yy], fill=DEEP, width=4)
        ctext(d, (200, yy), "%d m" % (i * 120), F(24, False), GREY, "lm")
    ions = [("Mg²⁺", MOSS, 420, 470, 62), ("Ca²⁺", GOLD, 640, 540, 52),
            ("Mg²⁺", MOSS, 860, 450, 62), ("K⁺", ICE, 990, 620, 40),
            ("Ca²⁺", GOLD, 480, 640, 48), ("Mg²⁺", MOSS, 760, 660, 58),
            ("Na⁺", (198, 216, 226), 320, 610, 36)]
    for lab, col, x, y, r in ions:
        atom(d, x, y, r, col, lab, int(r * 0.62), NAVY if col in (ICE, (198, 216, 226)) else WHITE)
    eqline(d, 786, "DSW（TDS ≧ 120,000 ppm）→ Mg²⁺ ＋ Ca²⁺ ＋ K⁺ ＋ Na⁺", 34)
    card(d, [100, 838, S - 100, 962])
    ctext(d, (130, 878), "Mg²⁺ 35,000–42,000 mg/L　花蓮外海 600 m 以下脫鹽濃縮鹽滷",
          F(30), DARK, "lm")
    ctext(d, (130, 928), "滴定前必須微濾 ＋ 25°C 超音波脫氣 15 分鐘（趕走 CO₂）",
          F(28, False), GREY, "lm")


def art03(d, rng):   # TPGS-750-M 三段
    card(d, [100, 240, S - 100, 660])
    speckle(d, rng, (120, 258, S - 120, 650), 110)
    card(d, [100, 240, S - 100, 660])
    # 段一
    d.rounded_rectangle([140, 300, 460, 560], 18, fill=(252, 239, 211), outline=GOLD, width=5)
    for k in range(2):
        cx = 240 + k * 74
        d.regular_polygon((cx, 410, 46), 6, rotation=0, outline=GOLD)
        for a in range(6):
            aa = math.radians(a * 60)
            ab = math.radians((a + 1) * 60)
            d.line([cx + 46 * math.cos(aa), 410 + 46 * math.sin(aa),
                    cx + 46 * math.cos(ab), 410 + 46 * math.sin(ab)], fill=GOLD, width=7)
    atom(d, 314, 364, 16, RED, "", 0)
    pts = [(360, 430)]
    for i in range(5):
        pts.append((385 + i * 25, 400 if i % 2 == 0 else 452))
    d.line(pts, fill=GOLD, width=8)
    fit_text(d, None, "維生素 E（親油頭）", 30, DARK,
             region=(140, 494, 460, 552), name="seg1")
    # 段二
    d.rounded_rectangle([490, 300, 720, 560], 18, fill=(223, 240, 230), outline=GREEN, width=5)
    d.line([(524, 430), (556, 396), (588, 430), (620, 396), (652, 430)], fill=GREEN, width=9)
    atom(d, 524, 430, 20, RED, "", 0)
    atom(d, 652, 430, 20, RED, "", 0)
    fit_text(d, None, "HOOC–CH₂CH₂–COOH", 26, GREEN,
             region=(490, 324, 720, 382), name="seg2-eq")
    fit_text(d, None, "琥珀酸（兩個酯鍵）", 30, DARK,
             region=(490, 494, 720, 552), name="seg2")
    # 段三
    d.rounded_rectangle([750, 300, S - 140, 560], 18, fill=(220, 235, 244), outline=DEEP, width=5)
    for i in range(4):
        x = 790 + i * 68
        d.arc([x - 24, 400, x + 24, 460], 180, 360, fill=DEEP, width=8)
        d.arc([x + 10, 400, x + 58, 460], 0, 180, fill=DEEP, width=8)
        atom(d, x, 430, 15, RED, "", 0)
    fit_text(d, None, "–O–CH₂CH₂– × n（n ≈ 16）", 26, DEEP,
             region=(750, 324, S - 140, 382), name="seg3-eq")
    fit_text(d, None, "PEG-750 甲醚（親水尾）", 30, DARK,
             region=(750, 494, S - 140, 552), name="seg3")
    bond(d, 460, 430, 490, 430, NAVY, 10)
    bond(d, 720, 430, 750, 430, NAVY, 10)
    eqline(d, 726, "α-生育酚 C₂₉H₅₀O₂ —〔琥珀酸 C₄H₆O₄〕— PEG-750 甲醚", 34)
    card(d, [100, 778, S - 100, 962])
    ctext(d, (130, 820), "750 ÷ 44 ≈ 17 → n 平均約 16–17 節", F(32), DARK, "lm")
    ctext(d, (130, 876), "兩個酯鍵會被水解斷開 → 可生物降解（綠色化學第 4、10 原則）",
          F(28, False), GREY, "lm")
    ctext(d, (130, 926), "CAS 1309573-60-1　Lipshutz et al., 2011", F(26, False), GREY, "lm")


def art04(d, rng):   # 微胞剖面
    card(d, [100, 240, S - 100, 760], fill=(234, 244, 250))
    speckle(d, rng, (120, 260, S - 120, 740), 120)
    cx, cy = 440, 500
    d.ellipse([cx - 230, cy - 230, cx + 230, cy + 230], fill=(207, 230, 242), outline=TEAL, width=4)
    d.ellipse([cx - 128, cy - 128, cx + 128, cy + 128], fill=SAND, outline=GOLD, width=6)
    for i in range(28):
        a = i * math.pi / 14
        x1, y1 = cx + math.cos(a) * 128, cy + math.sin(a) * 128
        x2, y2 = cx + math.cos(a) * 222, cy + math.sin(a) * 222
        d.line([x1, y1, x2, y2], fill=DEEP, width=8)
        d.ellipse([x2 - 14, y2 - 14, x2 + 14, y2 + 14], fill=TEAL, outline=NAVY, width=3)
        xi, yi = cx + math.cos(a) * 76, cy + math.sin(a) * 76
        d.line([x1, y1, xi, yi], fill=GOLD, width=7)
    ctext(d, (cx, cy), "疏水核心", F(34), (138, 100, 32))
    for i, (lab, col) in enumerate([("親水尾朝外・面向水", TEAL), ("親油頭朝內・躲開水", GOLD),
                                    ("粒徑 50–100 nm", GREEN), ("1.5 wt%（≫ CMC）", NAVY)]):
        y = 330 + i * 100
        d.rounded_rectangle([730, y, S - 130, y + 78], 14, fill=WHITE, outline=col, width=5)
        ctext(d, (905, y + 39), lab, F(30), col if col != NAVY else NAVY)
    eqline(d, 812, "n × TPGS-750-M ⇌ (TPGS-750-M)ₙ 微胞", 36)
    card(d, [100, 864, S - 100, 962])
    ctext(d, (130, 912), "本研究把微胞當作分散與界面活化的載體，不是有機反應容器",
          F(30), DARK, "lm")


def art05(d, rng):   # 第一式 球磨斷鍵
    card(d, [100, 240, S - 100, 700])
    speckle(d, rng, (120, 260, S - 120, 690), 130)
    card(d, [140, 300, 470, 620])
    bond(d, 200, 470, 410, 470, NAVY, 10)
    atom(d, 208, 470, 54, ICE, "Si", 40)
    atom(d, 305, 470, 40, RED, "O", 32)
    atom(d, 402, 470, 54, ICE, "Si", 40)
    ctext(d, (305, 578), "球磨前：矽氧橋連續完整", F(28, False), GREY)
    # 機械能：鋼球
    atom(d, 555, 380, 48, GREY, "", 0)
    atom(d, 560, 500, 36, (154, 163, 173), "", 0)
    arrow(d, 500, 470, 640, RED, 10, 28)
    ctext(d, (570, 600), "機械能", F(30), RED)
    # 右：斷開
    card(d, [680, 300, S - 140, 620])
    atom(d, 745, 470, 54, ICE, "Si", 40)
    atom(d, 838, 470, 38, RED, "O", 30)
    bond(d, 745, 470, 838, 470, NAVY, 10)
    atom(d, 890, 424, 14, GOLD, "", 0)
    atom(d, 1000, 470, 54, ICE, "Si", 40)
    atom(d, 944, 424, 14, GOLD, "", 0)
    ctext(d, (900, 578), "斷口留下懸鍵 •", F(28, False), (138, 100, 32))
    eqline(d, 760, "≡Si–O–Si≡ ＋ 機械能 → ≡Si–O• ＋ •Si≡", 38)
    card(d, [100, 812, S - 100, 962], fill=NAVY, outline=NAVY)
    ctext(d, (130, 856), "「•」＝未配對的單一電子（自由基），由鍵均裂產生", F(30), WHITE, "lm")
    ctext(d, (130, 912), "D50 約 1.8 μm・表面積暴增・缺陷是第五式 Mg²⁺ 的落腳處",
          F(28, False), MOSS, "lm")


def art06(d, rng):   # 第二式 CMC
    card(d, [100, 240, S - 100, 700], fill=(234, 244, 250))
    speckle(d, rng, (120, 260, S - 120, 690), 120)
    card(d, [140, 300, 500, 640])
    rng2 = random.Random(606)
    for i in range(12):
        x = rng2.uniform(190, 450)
        y = rng2.uniform(350, 590)
        a = rng2.uniform(0, 6.28)
        d.ellipse([x - 14, y - 14, x + 14, y + 14], fill=TEAL, outline=NAVY, width=3)
        d.line([x, y, x + 46 * math.cos(a), y + 46 * math.sin(a)], fill=GOLD, width=7)
    ctext(d, (320, 676), "低於 CMC：分散單分子", F(30), GREY)
    eq_arrow(d, 530, 470, 660, NAVY, 8, 24)
    ctext(d, (595, 400), "CMC", F(32), GOLD)
    card(d, [690, 300, S - 140, 640])
    for (mx, my, mr) in [(810, 400, 74), (990, 480, 60), (860, 560, 48)]:
        d.ellipse([mx - mr, my - mr, mx + mr, my + mr], fill=SAND, outline=GOLD, width=5)
        for k in range(14):
            a = k * math.pi / 7
            d.line([mx + mr * math.cos(a), my + mr * math.sin(a),
                    mx + (mr + 26) * math.cos(a), my + (mr + 26) * math.sin(a)], fill=DEEP, width=6)
    ctext(d, (900, 676), "高於 CMC：自動聚成微胞", F(30), TEAL)
    eqline(d, 760, "n × TPGS-750-M ⇌ (TPGS-750-M)ₙ　【超過 CMC 時】", 36)
    card(d, [100, 812, S - 100, 962])
    ctext(d, (130, 856), "沒有鍵被打斷或形成 → 這是物理過程，不是化學反應", F(30), GREEN, "lm")
    ctext(d, (130, 912), "超過 CMC 後，自由單體濃度大致維持定值，微胞「數目」增加",
          F(28, False), GREY, "lm")


def art07(d, rng):   # 第三式 FeCl3 解離＋水解
    card(d, [100, 240, S - 100, 470])
    speckle(d, rng, (120, 258, S - 120, 462), 70)
    card(d, [100, 240, S - 100, 470])
    ctext(d, (150, 282), "① 解離（不可逆）", F(28), TEAL, "lm")
    d.rounded_rectangle([150, 320, 330, 430], 12, fill=(201, 138, 78), outline=NAVY, width=4)
    ctext(d, (240, 375), "FeCl₃·6H₂O", F(28), WHITE)
    arrow(d, 350, 375, 440, TEAL, 8, 24)
    atom(d, 510, 375, 52, RUST, "Fe³⁺", 30)
    ctext(d, (582, 375), "＋", F(38), DARK)
    for i in range(3):
        atom(d, 660 + i * 106, 375, 44, (127, 166, 92), "Cl⁻", 26)
    ctext(d, (S - 150, 375), "旁觀者", F(26, False), GREY, "rm")

    card(d, [100, 500, S - 100, 736])
    speckle(d, rng, (120, 518, S - 120, 728), 70)
    card(d, [100, 500, S - 100, 736])
    ctext(d, (150, 542), "② 水解（可逆・pH 下降）", F(28), GOLD, "lm")
    atom(d, 210, 638, 52, RUST, "Fe³⁺", 30)
    ctext(d, (288, 638), "＋", F(38), DARK)
    atom(d, 366, 638, 44, ICE, "H₂O", 24)
    eq_arrow(d, 430, 638, 540, GOLD, 7, 22)
    atom(d, 640, 638, 62, RUST, "Fe(OH)²⁺", 24)
    ctext(d, (730, 638), "＋", F(38), DARK)
    atom(d, 812, 638, 40, RED, "H⁺", 26)
    down_arrow(d, 900, 596, 686, RED, 8)
    ctext(d, (990, 610), "pH", F(32), RED)
    ctext(d, (990, 664), "下降", F(32), RED)
    eqline(d, 800, "Fe³⁺ ＋ H₂O ⇌ Fe(OH)²⁺ ＋ H⁺", 38)
    card(d, [100, 852, S - 100, 962], fill=NAVY, outline=NAVY)
    ctext(d, (S // 2, 907), "0.242 g / 100 mL ≒ 8.95 mM ≒ 0.05 wt% Fe（M＝270.30）",
          F(30), WHITE)


def art08(d, rng):   # 第四式 Fe3+ 抓表面羥基【假說】
    card(d, [100, 250, S - 100, 716])
    speckle(d, rng, (120, 268, S - 120, 706), 120)
    card(d, [130, 296, 560, 656])
    d.rounded_rectangle([160, 560, 530, 620], 8, fill=(147, 167, 155))
    ctext(d, (345, 590), "蛇紋石表面", F(28), WHITE)
    bond(d, 300, 560, 300, 470, NAVY, 10)
    atom(d, 300, 440, 40, RED, "O", 32)
    bond(d, 300, 400, 300, 360, NAVY, 8)
    atom(d, 300, 336, 28, (221, 230, 234), "H", 22, NAVY)
    atom(d, 460, 372, 52, RUST, "Fe³⁺", 30)
    ctext(d, (345, 686), "路易士鹼（孤對電子）＋ 路易士酸", F(26, False), GREY)
    arrow(d, 590, 460, 660, GREEN, 10, 26)
    card(d, [690, 296, S - 130, 656])
    d.rounded_rectangle([720, 560, S - 160, 620], 8, fill=(147, 167, 155))
    ctext(d, (910, 590), "蛇紋石表面", F(28), WHITE)
    bond(d, 850, 560, 850, 470, NAVY, 10)
    atom(d, 850, 440, 40, RED, "O", 32)
    bond(d, 884, 420, 940, 386, GREEN, 10)
    atom(d, 985, 356, 54, RUST, "Fe", 34)
    atom(d, 745, 400, 30, RED, "H⁺", 22)
    up_arrow(d, 745, 366, 322, RED, 7)
    ctext(d, (910, 686), "內圈表面錯合物（inner-sphere）", F(26, False), GREEN)
    eqline(d, 762, "≡Si–OH ＋ Fe³⁺ → ≡Si–O–Fe²⁺ ＋ H⁺", 38, NAVY, (250, 243, 226))
    card(d, [100, 814, S - 100, 962], fill=NAVY, outline=GOLD)
    ctext(d, (130, 858), "電荷驗算：左 0 ＋ 3＋ ＝ 3＋　｜　右 2＋ ＋ 1＋ ＝ 3＋", F(30), WHITE, "lm")
    ctext(d, (130, 914), "2＋ 是「≡Si–O–Fe」整團的淨電荷，鐵仍是 Fe(III)，沒有被還原",
          F(28, False), GOLD, "lm")


def art09(d, rng):   # 第五式 Mg2+ 補位【假說】
    card(d, [100, 250, S - 100, 716])
    speckle(d, rng, (120, 268, S - 120, 706), 120)
    card(d, [130, 296, 560, 656])
    for i in range(4):
        for j in range(2):
            x, y = 210 + i * 92, 400 + j * 140
            if i == 2 and j == 0:
                d.ellipse([x - 44, y - 44, x + 44, y + 44], outline=RED, width=8)
                ctext(d, (x, y), "空位", F(26), RED)
            else:
                atom(d, x, y, 44, MOSS, "Mg", 28)
    ctext(d, (345, 686), "球磨後：晶格留下空位", F(26, False), GREY)
    arrow(d, 590, 460, 660, DEEP, 10, 26)
    ctext(d, (625, 410), "DSW 滴入", F(24), DEEP)
    card(d, [690, 296, S - 130, 656])
    for i in range(4):
        for j in range(2):
            x, y = 770 + i * 92, 400 + j * 140
            new = (i == 2 and j == 0)
            atom(d, x, y, 44, TEAL if new else MOSS, "Mg", 28)
            if new:
                d.ellipse([x - 60, y - 60, x + 60, y + 60], outline=GOLD, width=7)
    ctext(d, (910, 686), "缺陷補償：Si–O–Mg 更完整", F(26, False), GREEN)
    eqline(d, 762, "≡Si–O⁻ ＋ Mg²⁺ → ≡Si–O–Mg⁺", 38, NAVY, (250, 243, 226))
    card(d, [100, 814, S - 100, 962], fill=NAVY, outline=GOLD)
    ctext(d, (130, 858), "電荷驗算：左 1− ＋ 2＋ ＝ 1＋　｜　右 0 ＋ 2＋ ＝ 1＋ ＋ 1＋",
          F(30), WHITE, "lm")
    ctext(d, (130, 914), "放射率 0.86（原礦基線・已量測）→ 0.93（目標・研究假說）",
          F(28, False), GOLD, "lm")


def art10(d, rng):   # 第六式 超音波空化
    card(d, [100, 240, S - 100, 700], fill=(230, 242, 248))
    speckle(d, rng, (120, 258, S - 120, 690), 120)
    for i in range(6):
        y = 290 + i * 68
        pts = []
        for x in range(120, S - 120, 8):
            pts.append((x, y + math.sin(x * 0.03 + i) * 12))
        d.line(pts, fill=(190, 223, 238), width=5)
    # ① 生長 ② 失穩 ③ 崩陷
    for k, (cx, r, lab, col) in enumerate([(250, 46, "① 氣泡生長", TEAL),
                                           (500, 82, "② 氣泡失穩", DEEP)]):
        d.ellipse([cx - r, 470 - r, cx + r, 470 + r], outline=col, width=9)
        d.ellipse([cx - r + 24, 470 - r + 24, cx + r - 24, 470 + r - 24], fill=WHITE)
        ctext(d, (cx, 620), lab, F(30), col)
        arrow(d, cx + r + 20, 470, cx + r + 90, GREY, 7, 20)
    cx = 800
    for rr in (130, 106, 82):
        d.ellipse([cx - rr, 470 - rr, cx + rr, 470 + rr],
                  outline=(230, 150, 90), width=4)
    d.ellipse([cx - 30, 440, cx + 30, 500], fill=(255, 217, 138), outline=RED, width=6)
    for i in range(12):
        a = i * math.pi / 6
        d.line([cx + 122 * math.cos(a), 470 + 122 * math.sin(a),
                cx + 44 * math.cos(a), 470 + 44 * math.sin(a)], fill=RED, width=6)
    ctext(d, (cx, 640), "③ 氣泡崩陷（內爆）", F(30), RED)
    d.rounded_rectangle([980, 400, S - 130, 546], 10, fill=(147, 167, 155))
    ctext(d, (1030, 473), "礦物", F(28), WHITE)
    arrow(d, 900, 470, 975, GOLD, 10, 24)
    eqline(d, 760, "氣泡生長 → 崩陷 → 瞬態高溫高壓＋微射流", 36)
    card(d, [100, 812, S - 100, 962], fill=NAVY, outline=NAVY)
    ctext(d, (130, 856), "40 kHz・25°C・15 min・150 W（A4 組 300 W）", F(30), WHITE, "lm")
    ctext(d, (130, 912), "H₂O ⇌ H• ＋ •OH（微量，伴隨現象而非主反應）", F(28, False), MOSS, "lm")


def art11(d, rng):   # 第七式 兩個副反應
    card(d, [100, 240, S - 100, 550])
    speckle(d, rng, (120, 258, S - 120, 542), 80)
    card(d, [100, 240, S - 100, 550])
    d.rounded_rectangle([100, 240, 200, 550], 18, fill=GREY)
    ctext(d, (150, 395), "A", F(66), WHITE)
    atom(d, 280, 340, 44, GREY, "CO₂", 24)
    arrow(d, 330, 340, 400, GREY, 7, 20)
    ctext(d, (470, 340), "H₂CO₃", F(30), DARK)
    arrow(d, 540, 340, 610, GREY, 7, 20)
    atom(d, 680, 340, 48, GREY, "CO₃²⁻", 22)
    ctext(d, (752, 340), "＋", F(34), DARK)
    atom(d, 830, 340, 48, MOSS, "Mg²⁺", 24)
    arrow(d, 890, 340, 960, RED, 8, 22)
    ctext(d, (1060, 340), "MgCO₃↓", F(34), RED)
    ctext(d, (250, 480), "對策：25°C 超音波脫氣 15 min ＋ 完全零頂空充填 ＋ 4°C 避光",
          F(26, False), GREEN, "lm")

    card(d, [100, 580, S - 100, 830])
    speckle(d, rng, (120, 598, S - 120, 822), 80)
    card(d, [100, 580, S - 100, 830])
    d.rounded_rectangle([100, 580, 200, 830], 18, fill=RUST)
    ctext(d, (150, 705), "B", F(66), WHITE)
    atom(d, 290, 680, 52, RUST, "Fe³⁺", 28)
    ctext(d, (368, 680), "＋", F(34), DARK)
    atom(d, 452, 680, 50, (127, 166, 200), "3OH⁻", 22)
    arrow(d, 516, 680, 590, RED, 8, 22)
    atom(d, 680, 680, 60, (164, 85, 47), "Fe(OH)₃", 22)
    down_arrow(d, 760, 640, 726, RED, 8)
    ctext(d, (930, 660), "紅棕絮凝沉澱", F(30), RUST)
    ctext(d, (930, 712), "整批樣品報銷", F(26, False), GREY)
    ctext(d, (250, 790), "對策：緩慢滴定 ＋ 全程記錄 pH（綠色化學第 11 原則）",
          F(26, False), GREEN, "lm")
    card(d, [100, 862, S - 100, 962], fill=NAVY, outline=NAVY)
    ctext(d, (S // 2, 912), "「↓」＝沉澱：掉出水相就再也回不到反應裡", F(32), WHITE)


def art12(d, rng):   # 第八式 AgNO3 檢驗
    card(d, [100, 240, S - 100, 720])
    speckle(d, rng, (120, 258, S - 120, 710), 120)
    card(d, [100, 240, S - 100, 720])
    labs = [("第 1 次洗液", 0.95, "白濁明顯：Cl⁻ 多", RED),
            ("第 2 次洗液", 0.42, "白濁變淡", (138, 100, 32)),
            ("第 3 次洗液", 0.03, "澄清：判定合格", GREEN)]
    rng3 = random.Random(1212)
    for i, (lab, tb, note, col) in enumerate(labs):
        cx = 290 + i * 310
        d.rounded_rectangle([cx - 78, 320, cx + 78, 600], 16, fill=(232, 242, 246),
                            outline=TEAL, width=6)
        d.pieslice([cx - 78, 530, cx + 78, 640], 0, 180, fill=(232, 242, 246), outline=TEAL, width=6)
        # 濁度
        lvl = int(255 - tb * 90)
        d.rounded_rectangle([cx - 66, 360, cx + 66, 596], 10, fill=(lvl, lvl + 2, lvl + 4))
        for k in range(int(tb * 46)):
            x = cx - 58 + rng3.uniform(0, 116)
            y = 380 + rng3.uniform(0, 200)
            r = rng3.uniform(3, 9)
            d.ellipse([x - r, y - r, x + r, y + r], fill=WHITE, outline=(214, 222, 228))
        d.rounded_rectangle([cx - 88, 300, cx + 88, 336], 8, fill=TEAL)
        ctext(d, (cx, 672), lab, F(30), DARK)
        ctext(d, (cx, 712), note, F(24, False), col)
        if i < 2:
            arrow(d, cx + 100, 460, cx + 200, GREY, 7, 20)
    eqline(d, 780, "Ag⁺ ＋ Cl⁻ → AgCl ↓（白色沉澱）", 40)
    card(d, [100, 832, S - 100, 962], fill=NAVY, outline=NAVY)
    ctext(d, (130, 872), "離心 → 超純水洗三次 → 0.1 N AgNO₃ 判終點 → 60°C 真空乾燥過夜",
          F(28), WHITE, "lm")
    ctext(d, (130, 926), "整套流程唯一的檢驗步驟：不是要做出什麼，而是要確認什麼都沒剩下",
          F(26, False), MOSS, "lm")


# ══════════════════════════════════════════════ 萬用卡
def uni_frame(d, rng):
    """萬用卡專屬邊框：外框波浪 ＋ 內框菱格鏈 ＋ 四角六邊形徽記"""
    m = 24
    d.rectangle([m, m, S - m, S - m], outline=GREEN, width=10)
    d.rectangle([m + 20, m + 20, S - m - 20, S - m - 20], outline=GOLD, width=4)
    for k, (yy, ph, col) in enumerate([(m + 44, 0.0, DEEP), (S - m - 44, 1.7, TEAL)]):
        pts = []
        for i in range(0, S - 2 * m - 60, 6):
            x = m + 30 + i
            y = yy + math.sin(i * 0.021 + ph) * 13 + math.sin(i * 0.061 + ph * 2) * 5
            pts.append((x, y))
        d.line(pts, fill=col, width=6)
        for i in range(0, len(pts), 11):
            px, py = pts[i]
            d.ellipse([px - 6, py - 6, px + 6, py + 6], fill=MOSS, outline=NAVY, width=2)
    for side, xx in enumerate([m + 44, S - m - 44]):
        for i in range(26):
            cy = m + 60 + i * ((S - 2 * m - 120) / 25.0)
            r = 13 + ((i * (3 + side)) % 4) * 5
            c = [GREEN, GOLD, TEAL, MOSS][(i + side * 2) % 4]
            d.polygon([(xx, cy - r), (xx + r, cy), (xx, cy + r), (xx - r, cy)],
                      fill=WHITE, outline=c)
            d.line([(xx, cy - r), (xx + r, cy), (xx, cy + r), (xx - r, cy), (xx, cy - r)],
                   fill=c, width=4)
            if i % 3 == 0:
                d.ellipse([xx - 5, cy - 5, xx + 5, cy + 5], fill=NAVY)
    for ci, (cx, cy) in enumerate([(m + 52, m + 52), (S - m - 52, m + 52),
                                   (m + 52, S - m - 52), (S - m - 52, S - m - 52)]):
        d.regular_polygon((cx, cy, 40), 6, rotation=ci * 15, fill=WHITE, outline=GREEN)
        d.regular_polygon((cx, cy, 26), 6, rotation=ci * 15 + 30, fill=GOLD, outline=NAVY)
        for k in range(6):
            a = math.radians(ci * 15 + k * 60)
            d.line([cx + 28 * math.cos(a), cy + 28 * math.sin(a),
                    cx + 40 * math.cos(a), cy + 40 * math.sin(a)], fill=NAVY, width=4)
        fit_text(d, None, "OH", 18, NAVY,
                 region=(cx - 18, cy - 18, cx + 18, cy + 18), name="corner-OH%d" % ci)


def uni_logo(d, cx, cy, r):
    """遊戲標誌：六邊形盾牌內含「層狀礦物 ＋ 微胞 ＋ –OH 核心」"""
    d.regular_polygon((cx, cy, r), 6, rotation=0, fill=NAVY)
    d.regular_polygon((cx, cy, r - 7), 6, rotation=0, outline=GOLD)
    for k in range(6):
        a = math.radians(k * 60)
        d.line([cx + (r - 7) * math.cos(a), cy + (r - 7) * math.sin(a),
                cx + (r - 7) * math.cos(a + 1.047), cy + (r - 7) * math.sin(a + 1.047)],
               fill=GOLD, width=4)
    # 層狀（兩層）
    d.rounded_rectangle([cx - r * 0.62, cy - r * 0.30, cx + r * 0.62, cy - r * 0.06], 4,
                        fill=ICE, outline=WHITE)
    d.rounded_rectangle([cx - r * 0.62, cy - r * 0.02, cx + r * 0.62, cy + r * 0.22], 4,
                        fill=MOSS, outline=WHITE)
    # –OH 核心
    d.ellipse([cx - 16, cy + r * 0.28, cx + 16, cy + r * 0.28 + 32], fill=GOLD, outline=WHITE, width=3)


def sil_mimi(d, cx, base, h, col, rim):
    """泡泡 Mimi 剪影"""
    r = h * 0.34
    cy = base - h * 0.46
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col, outline=rim, width=6)
    d.ellipse([cx - r * 0.42, cy - r * 0.42, cx + r * 0.42, cy + r * 0.42], fill=GOLD, outline=rim, width=4)
    d.ellipse([cx - 30, cy - 12, cx - 8, cy + 16], fill=rim)
    d.ellipse([cx + 8, cy - 12, cx + 30, cy + 16], fill=rim)
    d.arc([cx - 22, cy + 22, cx + 22, cy + 52], 15, 165, fill=rim, width=6)
    for k in range(4):
        a = math.radians(215 + k * 37)
        d.line([cx + r * math.cos(a), cy + r * math.sin(a),
                cx + (r + 34) * math.cos(a), cy + (r + 34) * math.sin(a)], fill=rim, width=8)
        d.ellipse([cx + (r + 34) * math.cos(a) - 9, cy + (r + 34) * math.sin(a) - 9,
                   cx + (r + 34) * math.cos(a) + 9, cy + (r + 34) * math.sin(a) + 9], fill=MOSS)
    d.arc([cx - 30, base - h * 0.22, cx + 30, base - h * 0.02], 0, 180, fill=GOLD, width=9)


def sil_serpy(d, cx, base, h, col, rim):
    """蛇紋喵剪影"""
    bw, bh = h * 0.32, h * 0.26
    by = base - bh
    d.ellipse([cx - bw, by - bh, cx + bw, by + bh], fill=col, outline=rim, width=6)
    hy = by - bh * 1.55
    hr = h * 0.27
    d.polygon([(cx - hr * 0.75, hy - hr * 0.45), (cx - hr * 0.95, hy - hr * 1.5),
               (cx - hr * 0.15, hy - hr * 0.95)], fill=col, outline=rim)
    d.polygon([(cx + hr * 0.75, hy - hr * 0.45), (cx + hr * 0.95, hy - hr * 1.5),
               (cx + hr * 0.15, hy - hr * 0.95)], fill=col, outline=rim)
    d.ellipse([cx - hr, hy - hr * 0.9, cx + hr, hy + hr * 0.9], fill=col, outline=rim, width=6)
    d.ellipse([cx - 22, hy - 12, cx - 4, hy + 12], fill=rim)
    d.ellipse([cx + 4, hy - 12, cx + 22, hy + 12], fill=rim)
    d.ellipse([cx - 26, by - 26, cx + 26, by + 26], fill=GOLD, outline=rim, width=4)
    ctext(d, (cx, by), "OH", F(22), NAVY)
    d.arc([cx + bw - 10, by - bh, cx + bw + 70, by + bh * 0.4], 250, 60, fill=rim, width=10)


def sil_aqua(d, cx, base, h, col, rim):
    """水滴 Aqua 剪影"""
    r = h * 0.32
    cy = base - r
    # 水滴輪廓：上尖下圓（先畫圓身，再補一個窄尖端，避免看起來像圓錐帽）
    d.ellipse([cx - r, cy - r * 0.55, cx + r, cy + r * 1.15], fill=col, outline=rim, width=6)
    d.polygon([(cx, cy - h * 0.62), (cx + r * 0.62, cy + r * 0.20), (cx - r * 0.62, cy + r * 0.20)],
              fill=col)
    d.line([(cx, cy - h * 0.62), (cx + r * 0.62, cy + r * 0.20)], fill=rim, width=6)
    d.line([(cx, cy - h * 0.62), (cx - r * 0.62, cy + r * 0.20)], fill=rim, width=6)
    d.ellipse([cx - r, cy - r * 0.55, cx + r, cy + r * 1.15], outline=rim, width=6)
    d.ellipse([cx - 24, cy - 4, cx - 6, cy + 20], fill=rim)
    d.ellipse([cx + 6, cy - 4, cx + 24, cy + 20], fill=rim)
    for sgn in (-1, 1):
        d.line([cx + sgn * 26, cy - h * 0.5, cx + sgn * 62, cy - h * 0.74], fill=GOLD, width=7)
        d.ellipse([cx + sgn * 62 - 13, cy - h * 0.74 - 13, cx + sgn * 62 + 13, cy - h * 0.74 + 13],
                  fill=(221, 230, 234), outline=rim, width=3)


def art_universal(d, rng):
    """萬用卡版心：三位主角剪影 ＋ 八式反應鏈刻度 ＋ 蛇紋層理紋"""
    card(d, [96, 258, S - 96, 906], fill=(240, 248, 243), outline=GREEN)
    # 背景蛇紋層理斜紋（非重複）
    for i in range(34):
        y = 280 + i * 19
        pts = []
        for x in range(110, S - 110, 10):
            pts.append((x, y + math.sin(x * 0.014 + i * 0.5) * 9))
        d.line(pts, fill=(214, 234, 222) if i % 2 == 0 else (228, 240, 232), width=6)
    speckle(d, rng, (120, 280, S - 120, 640), 150)
    # 三位主角剪影
    sil_mimi(d, 300, 700, 300, TEAL, NAVY)
    sil_serpy(d, 600, 700, 300, GREEN, NAVY)
    sil_aqua(d, 900, 700, 300, DEEP, NAVY)
    for cx, name in ((300, "泡泡 Mimi"), (600, "蛇紋喵"), (900, "水滴 Aqua")):
        d.rounded_rectangle([cx - 108, 716, cx + 108, 768], 14, fill=WHITE, outline=GREEN, width=4)
        fit_text(d, None, name, 30, NAVY,
                 region=(cx - 108, 716, cx + 108, 768), name="hero-" + name)
    # 八式刻度鏈：圓徑由 44 加大到 52，文字改成「編號／名稱」兩行，
    # 並以 fit_circle 逐字級量測，保證「④Fe³⁺」「⑤Mg²⁺」這種寬字串不會撐出圓外。
    chain = [("①", "球磨"), ("②", "微胞"), ("③", "水解"), ("④", "Fe³⁺"),
             ("⑤", "Mg²⁺"), ("⑥", "空化"), ("⑦", "防治"), ("⑧", "檢驗")]
    R = 52
    CY = 840
    for i, (num, txt) in enumerate(chain):
        x = 155 + i * 127
        col = [TEAL, DEEP, GREEN, GOLD, GOLD, TEAL, DEEP, GREEN][i]
        d.ellipse([x - R, CY - R, x + R, CY + R], fill=col, outline=NAVY, width=4)
        fit_circle(d, x, CY, R - 6, [num, txt], 30, WHITE, name="chain%d" % (i + 1))
        if i < 7:
            d.line([x + R + 4, CY, x + 127 - R - 4, CY], fill=NAVY, width=6)


def build_universal():
    """萬用卡：所有文字都有明確的所屬區域，區域彼此不重疊，
       字級再由 fit_text 逐級量測縮到剛好放得下（含 6% 內距）。"""
    reset_texts()
    img = Image.new("RGB", (S, S), (247, 251, 248))
    d = ImageDraw.Draw(img)
    rng = random.Random(70012)
    uni_frame(d, rng)

    # ── 標題列 ──────────────────────────────────────────────
    d.rounded_rectangle([76, 84, S - 76, 240], 22, fill=GREEN)
    uni_logo(d, 152, 162, 60)
    TITLE_R = (232, 96, S - 336, 232)          # 標題文字區（右界扣掉金色徽章）
    fit_text(d, None, "UNIVERSAL CARD · SCAN ME ANYTIME", 24, (214, 238, 226),
             region=(TITLE_R[0], 104, TITLE_R[2], 158), anchor="lm", bold=False,
             name="eyebrow")
    fit_text(d, None, "反應探險　萬用卡", 44, WHITE,
             region=(TITLE_R[0], 162, TITLE_R[2], 226), anchor="lm", name="title")
    # 金色徽章：兩行各自一個子區域，不會互相碰到
    d.rounded_rectangle([S - 320, 122, S - 100, 206], 18, fill=GOLD)
    fit_text(d, None, "一張卡", 28, NAVY,
             region=(S - 320, 122, S - 100, 164), name="badge1")
    fit_text(d, None, "玩全程", 28, NAVY,
             region=(S - 320, 164, S - 100, 206), name="badge2")

    art_universal(d, rng)

    # ── 底部說明列 ──────────────────────────────────────────
    # L00 徽章往右獨立成一區，說明文字的區域寬度直接扣掉徽章區，
    # 兩者在版面上就不可能重疊（不是靠目測，是靠區域切分＋斷言）。
    d.rounded_rectangle([76, 930, S - 76, S - 84], 20, fill=NAVY)
    BADGE = (S - 268, 952, S - 100, 1094)
    TEXTB = (104, 944, S - 288, 1102)
    fit_text(d, None, "掃描說明", 24, MOSS,
             region=(TEXTB[0], 944, TEXTB[2], 992), anchor="lm", name="foot-label")
    fit_text(d, None, "任何一關按「開始掃描」，都可以掃這一張卡。", 28, WHITE,
             region=(TEXTB[0], 996, TEXTB[2], 1048), anchor="lm", name="foot-line1")
    fit_text(d, None, "一張卡就能從第 1 關玩到第 12 關，不必每關換圖。", 24,
             (198, 220, 232), region=(TEXTB[0], 1050, TEXTB[2], 1102), anchor="lm",
             bold=False, name="foot-line2")
    fit_text(d, None, "L00", 52, GOLD, region=BADGE, anchor="rm", name="foot-L00")

    bad = check_texts("universal")
    chk = draw_bbox_check(img, "universal")
    if bad:
        for b in bad:
            print("  [!]", b)
        raise SystemExit("universal.png 文字檢查未通過（見 %s）" % chk)
    print("  universal.png 文字檢查通過：%d 段文字，無溢出、無重疊；檢查圖 %s"
          % (len(TEXTS), chk))

    p = os.path.join(OUT, "universal.png")
    img.save(p, dpi=(DPI, DPI))
    print("saved", p)
    return p


LEVELS = [
    (1,  "墨玉的層狀結構與 –OH 門把", "SERPENTINE LAYERS",  art01, False, "掃描這張圖，打開蛇紋石的 1:1 層狀結構"),
    (2,  "深層海水的 Mg²⁺ 與 Ca²⁺",   "DEEP SEAWATER IONS", art02, False, "掃描這張圖，取出深層海水的鹼土金屬陽離子"),
    (3,  "TPGS-750-M 的三段分子",     "TPGS-750-M",         art03, False, "掃描這張圖，把界面活性劑剪成三段"),
    (4,  "微胞：奈米反應艙",           "MICELLE REACTOR",    art04, False, "掃描這張圖，走進 50–100 nm 的微胞"),
    (5,  "第一式　球磨機械斷鍵",       "REACTION 1",         art05, False, "掃描這張圖，看矽氧橋被機械力打斷"),
    (6,  "第二式　微胞自組裝與 CMC",   "REACTION 2",         art06, False, "掃描這張圖，理解 CMC 與動態平衡"),
    (7,  "第三式　FeCl₃ 解離與水解",   "REACTION 3",         art07, False, "掃描這張圖，看氯化鐵入水為何變酸"),
    (8,  "第四式　Fe³⁺ 抓住表面羥基",  "REACTION 4",         art08, True,  "掃描這張圖，看內圈表面錯合物的假說"),
    (9,  "第五式　Mg²⁺ 補進晶格缺陷",  "REACTION 5",         art09, True,  "掃描這張圖，看缺陷補償的假說"),
    (10, "第六式　超音波空化",         "REACTION 6",         art10, False, "掃描這張圖，看氣泡崩陷的三個階段"),
    (11, "第七式　兩個要防的副反應",   "REACTION 7",         art11, False, "掃描這張圖，記住兩個絕對不能發生的反應"),
    (12, "第八式　AgNO₃ 洗滌檢驗",     "REACTION 8",         art12, False, "掃描這張圖，完成八式並總複習"),
]


def build():
    build_universal()
    problems = []
    for n, title, en, fn, hypo, note in LEVELS:
        reset_texts()
        img = Image.new("RGB", (S, S), BG)
        d = ImageDraw.Draw(img)
        rng = random.Random(2000 + n * 7)
        frame(d, rng, n)
        header(d, n, title, en, hypo)
        fn(d, rng)
        footer(d, n, note)
        tag = "level%02d" % n
        bad = check_texts(tag)
        chk = draw_bbox_check(img, tag)
        if bad:
            problems.extend(bad)
            print("  [!] %s 文字檢查：%d 項違規（檢查圖 %s）" % (tag, len(bad), chk))
            for b in bad[:8]:
                print("      ", b)
        else:
            print("  %s 文字檢查通過：%d 段文字" % (tag, len(TEXTS)))
        p = os.path.join(OUT, "level%02d.png" % n)
        img.save(p, dpi=(DPI, DPI))
        print("saved", p)
    if problems:
        print("共 %d 項文字違規待修" % len(problems))
    else:
        print("12 張關卡卡 ＋ 萬用卡全部通過文字量測斷言")
    return problems


if __name__ == "__main__":
    build()
