# -*- coding: utf-8 -*-
"""
產生 10 張「關卡關鍵圖片」（AR 掃描目標 ＋ 教學插圖）
＋ 第 0 張「遊戲萬用卡」（v1.3；每一關都可以掃它，一張卡玩到底）
- 1200x1200 px @ 300 dpi（約 10.2 cm 見方）
- 高特徵密度：不規則邊框刻度、非重複紋理斑塊、豐富角點
- 全部自繪，零版權素材
輸出：assets/targets/levelNN.png、assets/targets/universal.png（300dpi PNG）
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


def F(size, bold=True):
    return ImageFont.truetype(FONTB if bold else FONT, size)


def ctext(d, xy, txt, font, fill, anchor="mm"):
    d.text(xy, txt, font=font, fill=fill, anchor=anchor)


# ---------------------------------------------------------------- 邊框（特徵密集）
def frame(d, rng, n):
    """不規則刻度邊框 + 四角唯一識別碼：提供大量穩定角點"""
    m = 26
    d.rectangle([m, m, S - m, S - m], outline=NAVY, width=9)
    d.rectangle([m + 20, m + 20, S - m - 20, S - m - 20], outline=TEAL, width=3)
    # 邊框刻度：長度由關卡編號決定，四邊皆不同 → 非重複
    cols = [NAVY, DEEP, TEAL, GREEN, GOLD]
    for i in range(48):
        t = m + 30 + i * ((S - 2 * m - 60) / 47.0)
        h = 10 + ((i * (n + 2)) % 5) * 7
        c = cols[(i + n) % 5]
        d.line([t, m + 9, t, m + 9 + h], fill=c, width=5)
        h2 = 10 + ((i * (n + 3) + 1) % 5) * 7
        d.line([t, S - m - 9, t, S - m - 9 - h2], fill=cols[(i * 2 + n) % 5], width=5)
        h3 = 10 + ((i * (n + 5) + 2) % 5) * 7
        d.line([m + 9, t, m + 9 + h3, t], fill=cols[(i * 3 + n) % 5], width=5)
        h4 = 10 + ((i * (n + 7) + 3) % 5) * 7
        d.line([S - m - 9, t, S - m - 9 - h4, t], fill=cols[(i + n * 2) % 5], width=5)
    # 四角唯一識別方塊（n 的二進位 + 角落序號）→ 每張圖角落絕不相同
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
    """非重複紋理斑塊：小三角/短線/圓點混合，製造大量角點"""
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


def header(d, n, title, en):
    d.rounded_rectangle([70, 78, S - 70, 214], 22, fill=NAVY)
    d.ellipse([94, 100, 186, 192], fill=GOLD)
    ctext(d, (140, 146), "%02d" % n, F(52), NAVY)
    ctext(d, (210, 118), en, F(26, False), MOSS, "lm")
    ctext(d, (210, 168), title, F(44), WHITE, "lm")


def footer(d, n, note):
    d.rounded_rectangle([70, S - 196, S - 70, S - 78], 20, fill=(233, 241, 244), outline=TEAL, width=3)
    ctext(d, (96, S - 158), "掃描說明", F(24), TEAL, "lm")
    ctext(d, (96, S - 116), note, F(25, False), DARK, "lm")
    ctext(d, (S - 96, S - 137), "L%02d" % n, F(46), TEAL, "rm")


def card(d, box, r=18):
    d.rounded_rectangle(box, r, fill=WHITE, outline=GREY, width=3)


# ---------------------------------------------------------------- 各關插圖
def art01(d, rng):  # 花蓮的山與海
    x0, y0, x1, y1 = 100, 240, S - 100, 980
    card(d, (x0, y0, x1, y1))
    # 天空
    for i in range(120):
        t = i / 119.0
        c = (int(150 + 80 * t), int(200 + 45 * t), int(235 + 18 * t))
        d.line([x0 + 4, y0 + 4 + i * 1.6, x1 - 4, y0 + 4 + i * 1.6], fill=c)
    d.ellipse([x1 - 190, y0 + 30, x1 - 110, y0 + 110], fill=(255, 226, 140), outline=GOLD, width=4)
    # 中央山脈（多峰，鋸齒 → 高角點）
    pts = [(x0 + 4, y0 + 320)]
    rng2 = random.Random(101)
    for i in range(26):
        px = x0 + 4 + i * (x1 - x0 - 8) / 25.0
        py = y0 + 300 - abs(math.sin(i * 0.85)) * (90 + rng2.uniform(0, 70))
        pts.append((px, py))
    pts += [(x1 - 4, y0 + 320), (x1 - 4, y0 + 400), (x0 + 4, y0 + 400)]
    d.polygon(pts, fill=(62, 96, 82))
    # 稜線描邊
    d.line(pts[:28], fill=(34, 62, 52), width=4)
    # 海
    d.rectangle([x0 + 4, y0 + 400, x1 - 4, y1 - 4], fill=(38, 118, 156))
    for i in range(16):
        yy = y0 + 415 + i * 20
        for k in range(9):
            xx = x0 + 20 + k * 105 + (i % 2) * 48
            d.arc([xx, yy - 9, xx + 66, yy + 9], 200, 340, fill=(160, 210, 228), width=4)
    # 海岸線資源標籤
    labels = [("蛇紋石", GREEN), ("大理石", GOLD), ("深層海水", DEEP), ("砂石", TEAL)]
    for i, (t, c) in enumerate(labels):
        bx = x0 + 40 + i * 240
        by = y1 - 130
        d.rounded_rectangle([bx, by, bx + 200, by + 78], 14, fill=WHITE, outline=c, width=5)
        ctext(d, (bx + 100, by + 39), t, F(30), c)
    # 標語置於天空區（山峰在 y0+140 以下），加深色膠囊確保可讀
    cxm = (x0 + x1) / 2
    d.rounded_rectangle([cxm - 300, y0 + 40, cxm + 300, y0 + 116], 26, fill=NAVY)
    ctext(d, (cxm, y0 + 78), "花蓮：一邊是山，一邊是海", F(38), WHITE)
    speckle(d, rng, (x0 + 10, y0 + 410, x1 - 10, y1 - 150), 120)


def art02(d, rng):  # 石材廠邊角料
    x0, y0, x1, y1 = 100, 240, S - 100, 980
    card(d, (x0, y0, x1, y1))
    d.rectangle([x0 + 4, y0 + 4, x1 - 4, y1 - 4], fill=(238, 236, 230))
    # 石塊堆（不規則多邊形，大量角點）
    rng2 = random.Random(202)
    greys = [(120, 124, 118), (98, 108, 100), (142, 146, 138), (78, 92, 84), (160, 162, 154)]
    for i in range(26):
        cx = rng2.uniform(x0 + 60, x1 - 60)
        cy = rng2.uniform(y0 + 220, y1 - 170)
        r = rng2.uniform(28, 72)
        k = rng2.randrange(5, 8)
        pts = []
        a0 = rng2.uniform(0, 6.28)
        for j in range(k):
            a = a0 + j * 6.283 / k
            rr = r * rng2.uniform(0.62, 1.0)
            pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
        d.polygon(pts, fill=greys[i % 5], outline=(48, 58, 52))
        d.line(pts + [pts[0]], fill=(40, 50, 44), width=3)
    # 數據條
    ctext(d, ((x0 + x1) / 2, y0 + 60), "石材加工的邊角料與石粉", F(40), DARK)
    ctext(d, ((x0 + x1) / 2, y0 + 122), "堆置＝問題　｜　利用＝資源", F(30, False), TEAL)
    bars = [("粉塵均值", 0.82, RED, "20.8 mg/m³"), ("法規上限", 0.40, GREY, "10 mg/m³")]
    for i, (t, v, c, s) in enumerate(bars):
        by = y0 + 168 + i * 44
        d.rounded_rectangle([x0 + 60, by, x0 + 60 + 620 * v, by + 30], 10, fill=c)
        d.rounded_rectangle([x0 + 60, by, x0 + 680, by + 30], 10, outline=GREY, width=3)
        ctext(d, (x0 + 700, by + 15), "%s %s" % (t, s), F(22), DARK, "lm")
    d.rounded_rectangle([x0 + 50, y1 - 130, x1 - 50, y1 - 40], 16, fill=NAVY)
    ctext(d, ((x0 + x1) / 2, y1 - 85), "廢石粉 ≠ 垃圾，它是還沒被用對的原料", F(34), WHITE)
    speckle(d, rng, (x0 + 20, y0 + 210, x1 - 20, y1 - 150), 140)


def art03(d, rng):  # 蛇紋石層狀結構 + OH
    x0, y0, x1, y1 = 100, 240, S - 100, 980
    card(d, (x0, y0, x1, y1))
    ctext(d, ((x0 + x1) / 2, y0 + 52), "蛇紋石 Mg₃Si₂O₅(OH)₄", F(42), DARK)
    ctext(d, ((x0 + x1) / 2, y0 + 104), "1:1（TO）型層狀結構", F(28, False), TEAL)
    top = y0 + 150
    for layer in range(3):
        ly = top + layer * 190
        # 四面體層 T：倒三角序列
        d.rounded_rectangle([x0 + 50, ly, x1 - 50, ly + 76], 8, fill=(206, 228, 236), outline=DEEP, width=3)
        for i in range(14):
            px = x0 + 70 + i * 68
            d.polygon([(px, ly + 8), (px + 54, ly + 8), (px + 27, ly + 68)], fill=(120, 178, 200), outline=NAVY)
            d.line([(px, ly + 8), (px + 27, ly + 68), (px + 54, ly + 8)], fill=NAVY, width=3)
        ctext(d, (x0 + 62, ly + 38), "T", F(30), NAVY, "lm")
        # 八面體層 O：菱形序列
        oy = ly + 80
        d.rounded_rectangle([x0 + 50, oy, x1 - 50, oy + 76], 8, fill=(214, 234, 222), outline=GREEN, width=3)
        for i in range(14):
            px = x0 + 70 + i * 68
            d.polygon([(px + 27, oy + 8), (px + 54, oy + 42), (px + 27, oy + 68), (px, oy + 42)],
                      fill=(146, 196, 168), outline=(24, 76, 56))
            d.ellipse([px + 19, oy + 34, px + 35, oy + 50], fill=WHITE, outline=(24, 76, 56), width=2)
        ctext(d, (x0 + 62, oy + 38), "O", F(30), (24, 76, 56), "lm")
        # 表面 -OH 門把
        for i in range(7):
            hx = x0 + 92 + i * 136
            d.line([hx, oy + 76, hx, oy + 100], fill=GOLD, width=6)
            d.ellipse([hx - 15, oy + 96, hx + 15, oy + 126], fill=GOLD, outline=NAVY, width=3)
            ctext(d, (hx, oy + 111), "OH", F(17), NAVY)
        if layer < 2:
            for i in range(20):
                dx = x0 + 60 + i * 52
                d.line([dx, oy + 140, dx + 22, oy + 140], fill=GREY, width=3)
    ctext(d, ((x0 + x1) / 2, y1 - 44), "露在外面的 –OH＝唯一能反應的「門把」", F(32), GREEN)
    speckle(d, rng, (x0 + 20, y0 + 130, x1 - 20, y1 - 70), 90)


def art04(d, rng):  # 深層海水
    x0, y0, x1, y1 = 100, 240, S - 100, 980
    card(d, (x0, y0, x1, y1))
    for i in range(int(y1 - y0 - 8)):
        t = i / float(y1 - y0 - 8)
        c = (int(120 - 108 * t), int(196 - 150 * t), int(228 - 130 * t))
        d.line([x0 + 4, y0 + 4 + i, x1 - 4, y0 + 4 + i], fill=c)
    ctext(d, ((x0 + x1) / 2, y0 + 50), "深層海水濃縮液（DSW）", F(42), WHITE)
    # 深度刻度
    for i in range(11):
        yy = y0 + 100 + i * 58
        d.line([x0 + 40, yy, x0 + 96, yy], fill=WHITE, width=4)
        ctext(d, (x0 + 106, yy), "%d m" % (i * 100), F(22), WHITE, "lm")
    d.line([x0 + 40, y0 + 216, x1 - 40, y0 + 216], fill=GOLD, width=7)
    ctext(d, (x1 - 50, y0 + 190), "200 公尺以深", F(30), GOLD, "rm")
    # 離子泡泡
    rng2 = random.Random(404)
    ions = [("Mg²⁺", MOSS), ("Ca²⁺", GOLD), ("K⁺", (140, 200, 230)), ("Na⁺", (200, 216, 226))]
    for i in range(22):
        cx = rng2.uniform(x0 + 70, x1 - 70)
        cy = rng2.uniform(y0 + 250, y1 - 130)
        t, c = ions[i % 4]
        r = 34 if i % 4 < 2 else 25
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c, outline=NAVY, width=3)
        ctext(d, (cx, cy), t, F(20 if r > 30 else 16), NAVY)
    d.rounded_rectangle([x0 + 50, y1 - 116, x1 - 50, y1 - 34], 16, fill=WHITE, outline=DEEP, width=4)
    ctext(d, ((x0 + x1) / 2, y1 - 75), "低溫・潔淨・富含礦物質　→　安全的離子來源", F(30), DEEP)
    speckle(d, rng, (x0 + 20, y0 + 240, x1 - 20, y1 - 130), 110)


def art05(d, rng):  # 水
    x0, y0, x1, y1 = 100, 240, S - 100, 980
    card(d, (x0, y0, x1, y1))
    d.rectangle([x0 + 4, y0 + 4, x1 - 4, y1 - 4], fill=(236, 246, 250))
    ctext(d, ((x0 + x1) / 2, y0 + 52), "水：唯一的溶劑，也是參與者", F(40), DARK)
    # 水分子網路
    rng2 = random.Random(505)
    centers = []
    for r in range(4):
        for c in range(5):
            cx = x0 + 130 + c * 195 + (r % 2) * 60 + rng2.uniform(-14, 14)
            cy = y0 + 170 + r * 150 + rng2.uniform(-14, 14)
            centers.append((cx, cy))
    # 氫鍵虛線
    for i, (ax, ay) in enumerate(centers):
        for j, (bx, by) in enumerate(centers):
            if j <= i:
                continue
            dd = math.hypot(ax - bx, ay - by)
            if dd < 215:
                n = int(dd / 14)
                for k in range(n):
                    if k % 2:
                        continue
                    t0 = k / float(n)
                    t1 = (k + 1) / float(n)
                    d.line([ax + (bx - ax) * t0, ay + (by - ay) * t0,
                            ax + (bx - ax) * t1, ay + (by - ay) * t1], fill=(140, 170, 190), width=3)
    for i, (cx, cy) in enumerate(centers):
        a = rng2.uniform(0, 6.28)
        for s in (-1, 1):
            hx = cx + 44 * math.cos(a + s * 0.92)
            hy = cy + 44 * math.sin(a + s * 0.92)
            d.line([cx, cy, hx, hy], fill=(70, 90, 110), width=6)
            d.ellipse([hx - 17, hy - 17, hx + 17, hy + 17], fill=WHITE, outline=NAVY, width=3)
            ctext(d, (hx, hy), "H", F(19), (176, 62, 52))
        d.ellipse([cx - 29, cy - 29, cx + 29, cy + 29], fill=(196, 226, 238), outline=DEEP, width=4)
        ctext(d, (cx, cy), "O", F(26), DEEP)
        ctext(d, (cx - 34, cy - 30), "δ-", F(18), RED)
    d.rounded_rectangle([x0 + 50, y1 - 122, x1 - 50, y1 - 34], 16, fill=GREEN)
    ctext(d, ((x0 + x1) / 2, y1 - 78), "無毒・不可燃・零有機溶劑：綠色化學第 5 原則", F(30), WHITE)
    speckle(d, rng, (x0 + 20, y0 + 100, x1 - 20, y1 - 140), 90)


def art06(d, rng):  # 微胞
    x0, y0, x1, y1 = 100, 240, S - 100, 980
    card(d, (x0, y0, x1, y1))
    d.rectangle([x0 + 4, y0 + 4, x1 - 4, y1 - 4], fill=(232, 243, 247))
    ctext(d, ((x0 + x1) / 2, y0 + 50), "TPGS-750-M 微胞：奈米反應艙", F(40), DARK)
    cx, cy, R = (x0 + x1) / 2, y0 + 400, 205
    d.ellipse([cx - R - 8, cy - R - 8, cx + R + 8, cy + R + 8], fill=(206, 228, 238), outline=DEEP, width=4)
    d.ellipse([cx - 118, cy - 118, cx + 118, cy + 118], fill=(252, 236, 206), outline=GOLD, width=4)
    ctext(d, (cx, cy - 24), "疏水核心", F(30), (150, 106, 36))
    ctext(d, (cx, cy + 22), "50–100 nm", F(26, False), (150, 106, 36))
    # 48 條界面活性劑：頭(苯環)+扁擔+PEG 波浪尾
    N = 40
    for i in range(N):
        a = i * 6.2832 / N
        ca, sa = math.cos(a), math.sin(a)
        hx, hy = cx + 96 * ca, cy + 96 * sa
        d.regular_polygon((hx, hy, 20), 6, rotation=int(math.degrees(a)),
                          fill=(226, 178, 96), outline=NAVY)
        d.line([cx + 118 * ca, cy + 118 * sa, cx + 150 * ca, cy + 150 * sa], fill=(120, 80, 40), width=6)
        d.ellipse([cx + 150 * ca - 9, cy + 150 * sa - 9, cx + 150 * ca + 9, cy + 150 * sa + 9], fill=GREEN)
        for k in range(5):
            rr = 160 + k * 14
            ox = math.sin(k * 1.9) * 11
            d.ellipse([cx + rr * ca - 8 + ox * -sa, cy + rr * sa - 8 + ox * ca,
                       cx + rr * ca + 8 + ox * -sa, cy + rr * sa + 8 + ox * ca],
                      fill=(120, 186, 214), outline=DEEP, width=2)
    legend = [("維生素 E（親油頭）", (226, 178, 96)), ("琥珀酸（連接段）", (120, 80, 40)),
              ("PEG-750（親水尾）", (120, 186, 214))]
    for i, (t, c) in enumerate(legend):
        ly = y1 - 190 + i * 46
        d.rounded_rectangle([x0 + 60, ly, x0 + 100, ly + 32], 8, fill=c, outline=NAVY, width=2)
        ctext(d, (x0 + 116, ly + 16), t, F(26), DARK, "lm")
    d.rounded_rectangle([x0 + 640, y1 - 194, x1 - 50, y1 - 40], 16, fill=NAVY)
    ctext(d, ((x0 + 640 + x1 - 50) / 2, y1 - 145), "在水裡開一間", F(28), WHITE)
    ctext(d, ((x0 + 640 + x1 - 50) / 2, y1 - 100), "「不是水」的小房間", F(28), MOSS)
    speckle(d, rng, (x0 + 20, y0 + 90, x1 - 20, y1 - 210), 80)


def art07(d, rng):  # 常溫改質不燒窯
    x0, y0, x1, y1 = 100, 240, S - 100, 980
    card(d, (x0, y0, x1, y1))
    ctext(d, ((x0 + x1) / 2, y0 + 52), "常溫改質，不燒窯", F(42), DARK)
    ctext(d, ((x0 + x1) / 2, y0 + 106), "綠色化學第 6 原則：提高能源效率", F(28, False), TEAL)
    # 兩支溫度計
    for i, (t, temp, col, sub) in enumerate([("傳統高溫焙燒", 800, RED, "≧ 800°C 燒窯"),
                                             ("本研究常溫水相", 25, GREEN, "25°C 常溫常壓")]):
        bx = x0 + 110 + i * 480
        d.rounded_rectangle([bx, y0 + 160, bx + 96, y0 + 560], 48, fill=WHITE, outline=NAVY, width=6)
        d.ellipse([bx - 22, y0 + 520, bx + 118, y0 + 660], fill=col, outline=NAVY, width=6)
        h = int(380 * min(temp / 900.0, 1.0))
        d.rounded_rectangle([bx + 26, y0 + 540 - h, bx + 70, y0 + 560], 22, fill=col)
        for k in range(10):
            yy = y0 + 180 + k * 38
            d.line([bx + 96, yy, bx + 126, yy], fill=GREY, width=3)
        ctext(d, (bx + 48, y0 + 700), t, F(32), DARK)
        ctext(d, (bx + 48, y0 + 748), sub, F(26, False), col)
        ctext(d, (bx + 48, y0 + 590), "%d°C" % temp, F(34), NAVY)
    # 能耗對比條
    d.rounded_rectangle([x0 + 60, y1 - 190, x1 - 60, y1 - 34], 16, fill=(240, 246, 244), outline=GREEN, width=4)
    ctext(d, (x0 + 90, y1 - 152), "能耗對比（示意）", F(26), GREEN, "lm")
    for i, (t, v, c) in enumerate([("焙燒路線", 0.95, RED), ("本研究", 0.18, GREEN)]):
        by = y1 - 116 + i * 40
        d.rounded_rectangle([x0 + 250, by, x0 + 250 + 620 * v, by + 28], 9, fill=c)
        d.rounded_rectangle([x0 + 250, by, x0 + 870, by + 28], 9, outline=GREY, width=3)
        ctext(d, (x0 + 240, by + 14), t, F(24), DARK, "rm")
    speckle(d, rng, (x0 + 20, y0 + 150, x1 - 20, y1 - 210), 130)


def art08(d, rng):  # 遠紅外線杯墊
    x0, y0, x1, y1 = 100, 240, S - 100, 980
    card(d, (x0, y0, x1, y1))
    ctext(d, ((x0 + x1) / 2, y0 + 50), "遠紅外線杯墊誕生", F(42), DARK)
    # 杯墊
    ccx, ccy = x0 + 250, y0 + 330
    d.ellipse([ccx - 170, ccy - 170, ccx + 170, ccy + 170], fill=(66, 88, 78), outline=NAVY, width=6)
    d.ellipse([ccx - 138, ccy - 138, ccx + 138, ccy + 138], outline=MOSS, width=4)
    rng2 = random.Random(808)
    for _ in range(150):
        a = rng2.uniform(0, 6.28)
        r = rng2.uniform(0, 132)
        px, py = ccx + r * math.cos(a), ccy + r * math.sin(a)
        rr = rng2.uniform(3, 9)
        d.ellipse([px - rr, py - rr, px + rr, py + rr],
                  fill=[(96, 122, 106), (44, 66, 56), (120, 150, 128)][rng2.randrange(3)])
    for k in range(4):
        rr = 190 + k * 36
        d.arc([ccx - rr, ccy - rr, ccx + rr, ccy + rr], -55, 55, fill=GOLD, width=6)
    ctext(d, (ccx, ccy), "墨玉杯墊", F(32), WHITE)
    # 光譜帶 4-14 um
    sx, sy, sw = x0 + 520, y0 + 190, 520
    ctext(d, (sx, sy - 44), "遠紅外線量測帶 4–14 μm", F(28), DEEP, "lm")
    for i in range(sw):
        t = i / float(sw)
        c = (int(60 + 190 * t), int(30 + 60 * t), int(120 - 90 * t))
        d.line([sx + i, sy, sx + i, sy + 66], fill=c)
    d.rectangle([sx, sy, sx + sw, sy + 66], outline=NAVY, width=4)
    for k in range(6):
        px = sx + k * sw / 5.0
        d.line([px, sy + 66, px, sy + 92], fill=NAVY, width=4)
        ctext(d, (px, sy + 110), "%d" % (4 + k * 2), F(22), DARK)
    ctext(d, (sx + sw / 2, sy + 148), "μm（微米）", F(24, False), GREY)
    # 放射率提升
    d.rounded_rectangle([sx, sy + 190, sx + sw, sy + 380], 16, fill=(244, 249, 247), outline=GREEN, width=4)
    ctext(d, (sx + 24, sy + 228), "法向放射率", F(26), GREEN, "lm")
    for i, (t, v, c) in enumerate([("原礦基線 0.86", 0.86, GREY), ("目標假說 0.93", 0.93, GOLD)]):
        by = sy + 266 + i * 52
        d.rounded_rectangle([sx + 24, by, sx + 24 + 300 * v, by + 34], 10, fill=c)
        d.rounded_rectangle([sx + 24, by, sx + 324, by + 34], 10, outline=GREY, width=3)
        ctext(d, (sx + 336, by + 17), t, F(22), DARK, "lm")
    d.rounded_rectangle([x0 + 50, y1 - 130, x1 - 50, y1 - 34], 16, fill=NAVY)
    ctext(d, ((x0 + x1) / 2, y1 - 82), "廢石粉 → 微米化 → 改質 → 壓片 → 可用的產品", F(30), WHITE)
    speckle(d, rng, (x0 + 20, y0 + 500, x0 + 480, y1 - 150), 100)


def art09(d, rng):  # 災害土砂 CO2 礦化
    x0, y0, x1, y1 = 100, 240, S - 100, 980
    card(d, (x0, y0, x1, y1))
    ctext(d, ((x0 + x1) / 2, y0 + 50), "災害土砂的第二種命運", F(42), DARK)
    ctext(d, ((x0 + x1) / 2, y0 + 102), "馬太鞍溪土砂 × CO₂ 礦化", F(28, False), TEAL)
    # 溪谷剖面
    d.rectangle([x0 + 40, y0 + 150, x1 - 40, y0 + 330], fill=(206, 226, 236))
    pts = [(x0 + 40, y0 + 330)]
    rng2 = random.Random(909)
    for i in range(30):
        px = x0 + 40 + i * (x1 - x0 - 80) / 29.0
        py = y0 + 300 - abs(math.sin(i * 0.6)) * rng2.uniform(40, 110)
        pts.append((px, py))
    pts += [(x1 - 40, y0 + 330)]
    d.polygon(pts, fill=(120, 104, 82), outline=(70, 58, 44))
    d.line(pts, fill=(60, 50, 38), width=4)
    for _ in range(220):
        px = rng2.uniform(x0 + 46, x1 - 46)
        py = rng2.uniform(y0 + 250, y0 + 326)
        rr = rng2.uniform(3, 10)
        d.ellipse([px - rr, py - rr, px + rr, py + rr],
                  fill=[(148, 130, 104), (96, 82, 64), (170, 152, 124)][rng2.randrange(3)])
    ctext(d, ((x0 + x1) / 2, y0 + 190), "堰塞湖潰決後的大量土砂", F(30), NAVY)
    # 反應箭頭
    ay = y0 + 400
    items = [("土砂中的 Mg²⁺", MOSS), ("＋", None), ("CO₂", GREY), ("→", None), ("MgCO₃ 固碳", GREEN)]
    xx = x0 + 60
    for t, c in items:
        if c is None:
            ctext(d, (xx + 30, ay + 45), t, F(44), NAVY, "lm")
            xx += 86
        else:
            w = 230
            d.rounded_rectangle([xx, ay, xx + w, ay + 90], 16, fill=WHITE, outline=c, width=5)
            ctext(d, (xx + w / 2, ay + 45), t, F(30), c)
            xx += w + 20
    # CO2 分子群
    for i in range(12):
        px = x0 + 90 + (i % 6) * 165
        py = y0 + 540 + (i // 6) * 92
        d.ellipse([px - 22, py - 22, px + 22, py + 22], fill=(90, 100, 110), outline=NAVY, width=3)
        ctext(d, (px, py), "C", F(24), WHITE)
        for s in (-1, 1):
            d.ellipse([px + s * 52 - 20, py - 20, px + s * 52 + 20, py + 20], fill=(198, 88, 72), outline=NAVY, width=3)
            ctext(d, (px + s * 52, py), "O", F(22), WHITE)
            d.line([px + s * 22, py, px + s * 32, py], fill=NAVY, width=5)
    d.rounded_rectangle([x0 + 50, y1 - 150, x1 - 50, y1 - 34], 16, fill=GREEN)
    ctext(d, ((x0 + x1) / 2, y1 - 116), "災後土砂含鎂矽酸鹽，與蛇紋石同族", F(28), WHITE)
    ctext(d, ((x0 + x1) / 2, y1 - 68), "把碳固定成石頭，是研究假說也是希望", F(28), (222, 240, 232))
    speckle(d, rng, (x0 + 20, y0 + 340, x1 - 20, y1 - 170), 70)


def art10(d, rng):  # 綠色化學 12 原則
    x0, y0, x1, y1 = 100, 240, S - 100, 980
    card(d, (x0, y0, x1, y1))
    ctext(d, ((x0 + x1) / 2, y0 + 50), "綠色化學十二原則", F(42), DARK)
    ctext(d, ((x0 + x1) / 2, y0 + 100), "Anastas & Warner, 1998", F(26, False), GREY)
    names = ["預防廢棄", "原子經濟", "低危害", "安全產品", "安全溶劑", "能源效率",
             "再生原料", "少衍生化", "用觸媒", "可降解", "即時分析", "本質安全"]
    cols = [GREEN, GOLD, TEAL, DEEP, GREEN, GOLD, GREEN, TEAL, DEEP, GREEN, TEAL, GOLD]
    for i in range(12):
        r, c = divmod(i, 4)
        bx = x0 + 46 + c * 240
        by = y0 + 150 + r * 190
        d.rounded_rectangle([bx, by, bx + 218, by + 168], 18, fill=WHITE, outline=cols[i], width=5)
        d.ellipse([bx + 74, by + 18, bx + 144, by + 88], fill=cols[i])
        ctext(d, (bx + 109, by + 53), "%d" % (i + 1), F(40), WHITE)
        ctext(d, (bx + 109, by + 122), names[i], F(29), DARK)
        # 每格獨立小紋理 → 破壞重複性
        for k in range((i * 7) % 9 + 5):
            px = bx + 16 + (k * 37) % 190
            py = by + 148
            d.line([px, py, px + 12, py], fill=cols[i], width=4)
    d.rounded_rectangle([x0 + 46, y1 - 106, x1 - 46, y1 - 34], 16, fill=NAVY)
    ctext(d, ((x0 + x1) / 2, y1 - 70), "本研究：8 條符合、4 條部分符合、0 條違背", F(30), WHITE)
    speckle(d, rng, (x0 + 30, y0 + 140, x1 - 30, y1 - 120), 60)


# ================================================================ 萬用卡（v1.3）
# 設計原則：
#   1. 與十張關卡卡「明顯不同」——邊框改為波浪＋菱格鏈，主色改森綠／典雅金，
#      版心是三位主角剪影，不是圖表。玩家一眼分得出「這是萬用卡」。
#   2. 特徵密度更高——蛇紋石層理斜紋、海浪弧線、剪影輪廓、三層 speckle，
#      角點來源彼此不重複（避免自我相似造成誤配）。
#   3. 每一關的 .mind 都把它編成 target 1，所以一張卡可以玩完全程。

def uni_frame(d, rng):
    """萬用卡專屬邊框：外框波浪 ＋ 內框菱格鏈 ＋ 四角六邊形徽記"""
    m = 24
    d.rectangle([m, m, S - m, S - m], outline=GREEN, width=10)
    d.rectangle([m + 20, m + 20, S - m - 20, S - m - 20], outline=GOLD, width=4)

    # 上下：連續波浪（相位不同 → 上下不對稱）
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

    # 左右：蛇紋菱格鏈（每格大小依序變化 → 非重複）
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

    # 四角六邊形徽記（與關卡卡的方形二進位碼截然不同）
    for ci, (cx, cy) in enumerate([(m + 52, m + 52), (S - m - 52, m + 52),
                                   (m + 52, S - m - 52), (S - m - 52, S - m - 52)]):
        d.regular_polygon((cx, cy, 40), 6, rotation=ci * 15, fill=WHITE, outline=GREEN)
        d.regular_polygon((cx, cy, 40), 6, rotation=ci * 15, outline=GREEN)
        d.regular_polygon((cx, cy, 26), 6, rotation=ci * 15 + 30, fill=GOLD, outline=NAVY)
        for k in range(6):
            a = math.radians(ci * 15 + k * 60)
            d.line([cx + 28 * math.cos(a), cy + 28 * math.sin(a),
                    cx + 40 * math.cos(a), cy + 40 * math.sin(a)], fill=NAVY, width=4)
        ctext(d, (cx, cy), "OH", F(18), NAVY)


def uni_logo(d, cx, cy, r):
    """遊戲標誌：六邊形盾牌內含「山＋海＋–OH 核心」"""
    d.regular_polygon((cx, cy, r), 6, rotation=0, fill=NAVY)
    d.regular_polygon((cx, cy, r - 7), 6, rotation=0, outline=GOLD)
    for k in range(6):
        a = math.radians(k * 60)
        d.line([cx + (r - 7) * math.cos(a), cy + (r - 7) * math.sin(a),
                cx + (r - 7) * math.cos(a + 1.047), cy + (r - 7) * math.sin(a + 1.047)],
               fill=GOLD, width=4)
    # 山（森綠）
    d.polygon([(cx - r * 0.62, cy + r * 0.12), (cx - r * 0.22, cy - r * 0.48),
               (cx + r * 0.06, cy - r * 0.10), (cx + r * 0.34, cy - r * 0.55),
               (cx + r * 0.66, cy + r * 0.12)], fill=MOSS)
    # 海（三道弧）
    for k in range(3):
        yy = cy + r * (0.24 + k * 0.19)
        d.arc([cx - r * 0.66, yy - r * 0.13, cx + r * 0.66, yy + r * 0.13],
              200, 340, fill=(150, 205, 226), width=5)
    # –OH 核心
    d.ellipse([cx - r * 0.23, cy - r * 0.20, cx + r * 0.23, cy + r * 0.26], fill=GOLD, outline=WHITE, width=3)
    ctext(d, (cx, cy + r * 0.03), "OH", F(int(r * 0.30)), NAVY)


def sil_ahai(d, cx, base, h, col, rim):
    """阿海剪影：短刺髮少年，手拿量筒"""
    hw = h * 0.30
    # 腿
    d.polygon([(cx - hw * 0.42, base), (cx - hw * 0.10, base),
               (cx - hw * 0.06, base - h * 0.34), (cx - hw * 0.40, base - h * 0.34)], fill=col)
    d.polygon([(cx + hw * 0.10, base), (cx + hw * 0.42, base),
               (cx + hw * 0.40, base - h * 0.34), (cx + hw * 0.06, base - h * 0.34)], fill=col)
    # 身體
    d.polygon([(cx - hw * 0.62, base - h * 0.32), (cx + hw * 0.62, base - h * 0.32),
               (cx + hw * 0.52, base - h * 0.66), (cx - hw * 0.52, base - h * 0.66)], fill=col)
    # 手臂（右手舉量筒）
    d.line([cx - hw * 0.56, base - h * 0.62, cx - hw * 0.92, base - h * 0.38], fill=col, width=int(h * 0.055))
    d.line([cx + hw * 0.56, base - h * 0.62, cx + hw * 0.96, base - h * 0.70], fill=col, width=int(h * 0.055))
    d.rectangle([cx + hw * 0.84, base - h * 0.86, cx + hw * 1.12, base - h * 0.68], fill=rim, outline=NAVY, width=3)
    # 頭
    hy = base - h * 0.78
    d.ellipse([cx - h * 0.115, hy - h * 0.115, cx + h * 0.115, hy + h * 0.115], fill=col)
    # 刺髮（不規則，角點多）
    for k in range(9):
        a = math.radians(196 + k * 18)
        r1 = h * 0.113
        r2 = h * (0.150 + (k % 3) * 0.018)
        d.line([cx + r1 * math.cos(a), hy + r1 * math.sin(a),
                cx + r2 * math.cos(a - 0.10), hy + r2 * math.sin(a - 0.10)], fill=col, width=int(h * 0.030))
    d.arc([cx - h * 0.115, hy - h * 0.115, cx + h * 0.115, hy + h * 0.115], 0, 360, fill=rim, width=4)


def sil_xiaoyu(d, cx, base, h, col, rim):
    """小玉剪影：馬尾女孩，手拿葉片採樣袋"""
    hw = h * 0.30
    d.polygon([(cx - hw * 0.40, base), (cx - hw * 0.08, base),
               (cx - hw * 0.06, base - h * 0.30), (cx - hw * 0.36, base - h * 0.30)], fill=col)
    d.polygon([(cx + hw * 0.08, base), (cx + hw * 0.40, base),
               (cx + hw * 0.36, base - h * 0.30), (cx + hw * 0.06, base - h * 0.30)], fill=col)
    # 裙擺（梯形，下寬）
    d.polygon([(cx - hw * 0.80, base - h * 0.28), (cx + hw * 0.80, base - h * 0.28),
               (cx + hw * 0.50, base - h * 0.64), (cx - hw * 0.50, base - h * 0.64)], fill=col)
    d.line([cx - hw * 0.54, base - h * 0.60, cx - hw * 0.98, base - h * 0.44], fill=col, width=int(h * 0.052))
    d.line([cx + hw * 0.54, base - h * 0.60, cx + hw * 0.92, base - h * 0.34], fill=col, width=int(h * 0.052))
    # 採樣袋
    d.polygon([(cx + hw * 0.78, base - h * 0.34), (cx + hw * 1.14, base - h * 0.34),
               (cx + hw * 1.06, base - h * 0.10), (cx + hw * 0.86, base - h * 0.10)], fill=rim, outline=NAVY)
    hy = base - h * 0.76
    d.ellipse([cx - h * 0.112, hy - h * 0.112, cx + h * 0.112, hy + h * 0.112], fill=col)
    # 馬尾
    d.polygon([(cx + h * 0.09, hy - h * 0.06), (cx + h * 0.23, hy + h * 0.02),
               (cx + h * 0.20, hy + h * 0.20), (cx + h * 0.10, hy + h * 0.10)], fill=col)
    d.arc([cx - h * 0.112, hy - h * 0.112, cx + h * 0.112, hy + h * 0.112], 0, 360, fill=rim, width=4)
    # 髮箍
    d.arc([cx - h * 0.118, hy - h * 0.126, cx + h * 0.118, hy + h * 0.070], 195, 345, fill=rim, width=7)


def sil_shewen(d, cx, base, h, col, rim):
    """蛇紋獸剪影：仿生穿山甲（四足側身、尾在左、頭在右），鱗片＋胸口 –OH 核心"""
    # 尾（粗根細尖，帶節）
    tail = [(cx - h * 0.24, base - h * 0.36), (cx - h * 0.46, base - h * 0.30),
            (cx - h * 0.62, base - h * 0.12), (cx - h * 0.58, base - h * 0.04),
            (cx - h * 0.46, base - h * 0.16), (cx - h * 0.28, base - h * 0.18)]
    d.polygon(tail, fill=col)
    for k in range(4):
        t = 0.18 + k * 0.20
        px = cx - h * (0.28 + t * 0.30)
        py = base - h * (0.30 - t * 0.14)
        d.polygon([(px - h * 0.030, py + h * 0.024), (px, py - h * 0.026),
                   (px + h * 0.030, py + h * 0.024)], fill=rim, outline=NAVY)
    # 四足
    for sx, hgt in ((-0.20, 0.22), (-0.08, 0.20), (0.10, 0.20), (0.22, 0.22)):
        d.rounded_rectangle([cx + h * sx - h * 0.040, base - h * hgt,
                             cx + h * sx + h * 0.040, base], int(h * 0.03), fill=col)
    # 軀幹（拱背，橫長）
    d.ellipse([cx - h * 0.30, base - h * 0.60, cx + h * 0.30, base - h * 0.16], fill=col)
    d.polygon([(cx - h * 0.26, base - h * 0.20), (cx + h * 0.30, base - h * 0.20),
               (cx + h * 0.30, base - h * 0.42), (cx - h * 0.26, base - h * 0.42)], fill=col)
    # 背甲鱗片（沿拱背排列，每列數量與大小不同 → 非重複紋理）
    for k in range(4):
        rr = h * (0.20 + k * 0.052)
        n = 4 + k * 2
        for i in range(n):
            a = math.radians(188 + i * (152.0 / max(n - 1, 1)))
            px = cx + rr * math.cos(a) * 1.02
            py = base - h * 0.40 + rr * math.sin(a) * 0.86
            if py > base - h * 0.36:
                continue
            s = h * (0.026 + (i % 3) * 0.006)
            d.polygon([(px - s, py + s * 0.7), (px, py - s), (px + s, py + s * 0.7)],
                      fill=rim, outline=NAVY)
    # 頸與頭（頭略低於背，吻部短而尖）
    hy = base - h * 0.50
    d.polygon([(cx + h * 0.14, base - h * 0.56), (cx + h * 0.32, hy - h * 0.10),
               (cx + h * 0.32, hy + h * 0.06), (cx + h * 0.14, base - h * 0.30)], fill=col)
    d.ellipse([cx + h * 0.26, hy - h * 0.10, cx + h * 0.44, hy + h * 0.07], fill=col)
    d.polygon([(cx + h * 0.42, hy - h * 0.045), (cx + h * 0.53, hy + h * 0.005),
               (cx + h * 0.42, hy + h * 0.055)], fill=col)          # 吻
    d.polygon([(cx + h * 0.29, hy - h * 0.09), (cx + h * 0.34, hy - h * 0.17),
               (cx + h * 0.36, hy - h * 0.07)], fill=col)           # 耳
    d.ellipse([cx + h * 0.355, hy - h * 0.040, cx + h * 0.390, hy - h * 0.005],
              fill=GOLD, outline=NAVY, width=2)                     # 眼
    # 胸口 –OH 核心
    d.ellipse([cx - h * 0.02, base - h * 0.42, cx + h * 0.13, base - h * 0.27],
              fill=GOLD, outline=WHITE, width=3)
    ctext(d, (cx + h * 0.055, base - h * 0.345), "OH", F(int(h * 0.058)), NAVY)


def art_universal(d, rng):
    """萬用卡版心：蛇紋石層理 × 海浪 × 三位主角剪影"""
    x0, y0, x1, y1 = 96, 244, S - 96, 902
    d.rounded_rectangle([x0, y0, x1, y1], 22, fill=WHITE, outline=GREEN, width=5)

    # 上半：蛇紋石斜層理（傾斜條帶，寬度不等 → 特徵不重複）
    rng2 = random.Random(7001)
    band = y0 + 4
    tones = [(214, 232, 222), (188, 216, 200), (232, 240, 232), (170, 202, 184), (204, 224, 212)]
    i = 0
    while band < y0 + 330:
        hgt = rng2.uniform(22, 46)
        pts = [(x0 + 4, band), (x1 - 4, band - 26), (x1 - 4, band - 26 + hgt), (x0 + 4, band + hgt)]
        d.polygon(pts, fill=tones[i % 5])
        d.line([(x0 + 4, band), (x1 - 4, band - 26)], fill=(120, 158, 136), width=3)
        # 層間 –OH 門把：只放在部分層、間距不等（避免形成規則點陣造成自我相似）
        if i % 3 == 1:
            step = 208 + (i % 5) * 46
            px = x0 + 70 + (i * 53) % 150
            while px < x1 - 50:
                py = band + hgt * 0.62 - (px - x0) * 26.0 / (x1 - x0)
                d.line([px, py, px, py - 15], fill=GOLD, width=5)
                d.ellipse([px - 10, py - 33, px + 10, py - 13], fill=GOLD, outline=NAVY, width=3)
                px += step
        band += hgt
        i += 1

    # 下半：海浪（振幅／相位逐列不同）
    d.rectangle([x0 + 4, y0 + 330, x1 - 4, y1 - 4], fill=(42, 122, 158))
    for r in range(9):
        yy = y0 + 348 + r * 36
        amp = 8 + (r % 4) * 4
        pts = []
        for k in range(0, x1 - x0 - 8, 8):
            pts.append((x0 + 4 + k, yy + math.sin(k * 0.017 + r * 0.9) * amp))
        d.line(pts, fill=(150 + (r % 3) * 22, 208, 230), width=4)
        for k in range(2 + r % 3, len(pts), 9):
            px, py = pts[k]
            d.ellipse([px - 5, py - 5, px + 5, py + 5], fill=WHITE, outline=DEEP, width=2)

    # 分隔：金色斷層線
    d.line([x0 + 4, y0 + 330, x1 - 4, y0 + 330], fill=GOLD, width=7)

    # 紋理斑塊（先鋪底，之後剪影蓋在上面 → 主角輪廓乾淨、對比明確）
    speckle(d, rng, (x0 + 14, y0 + 14, x1 - 14, y0 + 320), 90)
    speckle(d, rng, (x0 + 14, y0 + 340, x1 - 14, y1 - 130), 70)

    # 三位主角剪影（跨層理與海浪，輪廓角點豐富）
    base = y1 - 118
    hh = 330
    sil_ahai(d, x0 + 200, base, hh, NAVY, (150, 205, 226))
    sil_xiaoyu(d, (x0 + x1) / 2, base, hh, (24, 76, 56), MOSS)
    sil_shewen(d, x1 - 226, base, hh, (46, 64, 58), MOSS)

    # 名牌
    for cx, nm, c in [(x0 + 200, "阿海", DEEP), ((x0 + x1) / 2, "小玉", GREEN), (x1 - 226, "蛇紋獸", GOLD)]:
        d.rounded_rectangle([cx - 92, y1 - 106, cx + 92, y1 - 34], 16, fill=WHITE, outline=c, width=5)
        ctext(d, (cx, y1 - 70), nm, F(36), c)


def build_universal():
    """第 0 張：遊戲萬用卡 assets/targets/universal.png"""
    img = Image.new("RGB", (S, S), (247, 251, 248))
    d = ImageDraw.Draw(img)
    rng = random.Random(70000)
    uni_frame(d, rng)

    # 標頭（森綠底，與關卡卡的 navy 標頭不同）
    d.rounded_rectangle([76, 84, S - 76, 226], 22, fill=GREEN)
    uni_logo(d, 152, 155, 56)
    ctext(d, (230, 126), "UNIVERSAL CARD · SCAN ME ANYTIME", F(24, False), (214, 238, 226), "lm")
    ctext(d, (230, 180), "遊戲萬用卡", F(48), WHITE, "lm")
    d.rounded_rectangle([S - 320, 116, S - 100, 196], 18, fill=GOLD)
    ctext(d, (S - 210, 142), "一張卡", F(28), NAVY)
    ctext(d, (S - 210, 176), "玩全程", F(28), NAVY)

    art_universal(d, rng)

    # 頁尾說明
    d.rounded_rectangle([76, 924, S - 76, S - 84], 20, fill=NAVY)
    ctext(d, (110, 962), "掃描說明", F(24), MOSS, "lm")
    ctext(d, (110, 1010), "任何一關按「開始掃描」，都可以掃這一張卡。", F(28), WHITE, "lm")
    ctext(d, (110, 1058), "不必每一關換一張圖，一張卡就能從第 1 關玩到第 10 關。", F(24, False), (198, 220, 232), "lm")
    ctext(d, (S - 110, 1010), "L00", F(52), GOLD, "rm")

    p = os.path.join(OUT, "universal.png")
    img.save(p, dpi=(DPI, DPI))
    print("saved", p)
    return p


LEVELS = [
    (1, "花蓮的山與海", "LOCAL RESOURCES", art01, "掃描這張圖，盤點花蓮的在地資源"),
    (2, "石材廠的邊角料", "STONE WASTE", art02, "掃描這張圖，看見廢石粉的現況"),
    (3, "墨玉的秘密", "SERPENTINE LAYERS", art03, "掃描這張圖，打開蛇紋石的層狀結構"),
    (4, "深層海水的礦物", "DEEP SEAWATER", art04, "掃描這張圖，取出 Mg²⁺ 與 Ca²⁺"),
    (5, "水是最好的溶劑", "WATER AS SOLVENT", art05, "掃描這張圖，認識水的極性與氫鍵"),
    (6, "微胞奈米反應艙", "MICELLE REACTOR", art06, "掃描這張圖，走進 TPGS-750-M 微胞"),
    (7, "常溫改質不燒窯", "ENERGY EFFICIENCY", art07, "掃描這張圖，比較燒窯與常溫路線"),
    (8, "遠紅外線杯墊誕生", "PRODUCT & CIRCLE", art08, "掃描這張圖，看見產品化與放射率"),
    (9, "災害土砂的第二種命運", "CO2 MINERALIZATION", art09, "掃描這張圖，把碳固定成石頭"),
    (10, "綠色化學大考驗", "GREEN CHEMISTRY 12", art10, "掃描這張圖，總複習十二原則"),
]


def build():
    build_universal()
    for n, title, en, fn, note in LEVELS:
        img = Image.new("RGB", (S, S), BG)
        d = ImageDraw.Draw(img)
        rng = random.Random(1000 + n)
        frame(d, rng, n)
        header(d, n, title, en)
        fn(d, rng)
        footer(d, n, note)
        p = os.path.join(OUT, "level%02d.png" % n)
        img.save(p, dpi=(DPI, DPI))
        print("saved", p)


if __name__ == "__main__":
    build()
