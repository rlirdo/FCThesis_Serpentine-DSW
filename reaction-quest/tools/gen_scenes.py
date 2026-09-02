# -*- coding: utf-8 -*-
"""產生 12 張花蓮實景風插畫背景（SVG，全部自繪，零版權素材）。
陽光藍天大自然調性；輸出 assets/scenes/sceneNN.svg（viewBox 0 0 640 960，直式手機優先）。

迷宮會蓋在畫面中段，所以：
  ・畫面中央帶（y 約 180–780）刻意留白、低對比，讓迷宮牆與代幣看得清楚
  ・特徵集中在上緣（天空／山稜）與下緣（地面／海面）
用法： PYTHONUTF8=1 python tools/gen_scenes.py
"""
import os, math, random

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "assets", "scenes")
os.makedirs(OUT, exist_ok=True)

W, H = 640, 960


def head(sky_top, sky_bot, sun=(500, 120, 44)):
    s = ['<defs>',
         '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">',
         '<stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/>' % (sky_top, sky_bot),
         '</linearGradient>',
         '<radialGradient id="glow"><stop offset="0" stop-color="#FFF3C4" stop-opacity=".95"/>'
         '<stop offset="1" stop-color="#FFF3C4" stop-opacity="0"/></radialGradient>',
         '<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">'
         '<stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/>'
         '<stop offset="0.45" stop-color="#FFFFFF" stop-opacity="0.34"/>'
         '<stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>',
         '</defs>',
         '<rect width="%d" height="%d" fill="url(#sky)"/>' % (W, H)]
    if sun:
        x, y, r = sun
        s.append('<circle cx="%d" cy="%d" r="%d" fill="url(#glow)"/>' % (x, y, int(r * 2.6)))
        s.append('<circle cx="%d" cy="%d" r="%d" fill="#FFE9A8"/>' % (x, y, r))
    return s


def clouds(seed=7, n=6, y0=40):
    rng = random.Random(seed)
    s = []
    for i in range(n):
        cx = 40 + i * 112 + rng.uniform(-24, 24)
        cy = y0 + (i % 3) * 40
        sc = rng.uniform(0.8, 1.5)
        s.append('<g opacity=".8" transform="translate(%.0f,%.0f) scale(%.2f)">' % (cx, cy, sc))
        s.append('<ellipse cx="0" cy="0" rx="38" ry="17" fill="#fff"/>'
                 '<ellipse cx="30" cy="5" rx="28" ry="14" fill="#fff"/>'
                 '<ellipse cx="-28" cy="6" rx="24" ry="12" fill="#fff"/>')
        s.append('</g>')
    return s


def mountains(y, h, fill, seed, peaks=8, stroke=None, op=1.0):
    rng = random.Random(seed)
    pts = ["0,%d" % (y + h)]
    for i in range(peaks * 2 + 1):
        x = i * W / float(peaks * 2)
        py = y + h - abs(math.sin(i * 1.1 + seed)) * h * rng.uniform(0.5, 1.0)
        pts.append("%.0f,%.0f" % (x, py))
    pts.append("%d,%d" % (W, y + h))
    p = '<polygon points="%s" fill="%s" opacity="%.2f"' % (" ".join(pts), fill, op)
    if stroke:
        p += ' stroke="%s" stroke-width="2"' % stroke
    return [p + "/>"]


def sea(y, top="#2E86AB", bot="#0E4C6B", waves=True):
    s = ['<defs><linearGradient id="seag%d" x1="0" y1="0" x2="0" y2="1">'
         '<stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/>'
         '</linearGradient></defs>' % (y, top, bot),
         '<rect x="0" y="%d" width="%d" height="%d" fill="url(#seag%d)"/>' % (y, W, H - y, y)]
    if waves:
        rng = random.Random(y)
        for i in range(26):
            wx = rng.uniform(0, W - 40)
            wy = y + 18 + rng.uniform(0, H - y - 30)
            s.append('<path d="M%.0f %.0f q12 -6 24 0" stroke="#BFE6F2" stroke-width="2.4" '
                     'fill="none" opacity=".55"/>' % (wx, wy))
    return s


def ground(y, fill, top=None):
    s = ['<rect x="0" y="%d" width="%d" height="%d" fill="%s"/>' % (y, W, H - y, fill)]
    if top:
        s.append('<path d="M0 %d q80 -16 160 0 q80 16 160 0 q80 -16 160 0 q80 16 160 0 L640 %d L0 %d Z" '
                 'fill="%s"/>' % (y, y + 26, y + 26, top))
    return s


def rocks(seed, y0, y1, n=16, cols=("#7C8A80", "#5B6B60", "#96A398"), rmax=26):
    rng = random.Random(seed)
    s = []
    for i in range(n):
        cx = rng.uniform(20, W - 20)
        cy = rng.uniform(y0, y1)
        r = rng.uniform(rmax * 0.4, rmax)
        pts = []
        for k in range(7):
            a = k * math.pi * 2 / 7
            rr = r * rng.uniform(0.7, 1.15)
            pts.append("%.0f,%.0f" % (cx + rr * math.cos(a), cy + rr * math.sin(a) * 0.68))
        s.append('<polygon points="%s" fill="%s" stroke="#3F4C45" stroke-width="1.6" opacity=".9"/>'
                 % (" ".join(pts), cols[i % len(cols)]))
    return s


def tree(x, y, sc=1.0, c="#2E7D5B", c2="#1F5240"):
    return ['<g transform="translate(%.0f,%.0f) scale(%.2f)">' % (x, y, sc),
            '<rect x="-5" y="0" width="10" height="30" fill="#7A5230"/>',
            '<ellipse cx="0" cy="-14" rx="30" ry="26" fill="%s"/>' % c,
            '<ellipse cx="-13" cy="-4" rx="20" ry="16" fill="%s"/>' % c2,
            '<ellipse cx="14" cy="-6" rx="18" ry="15" fill="%s"/>' % c2,
            '</g>']


def palm(x, y, sc=1.0):
    s = ['<g transform="translate(%.0f,%.0f) scale(%.2f)">' % (x, y, sc),
         '<path d="M0 0 q6 -34 2 -60" stroke="#7A5230" stroke-width="8" fill="none"/>']
    for a in (-70, -35, 0, 35, 70):
        s.append('<path d="M2 -60 q%d -22 %d -6" stroke="#2E7D5B" stroke-width="7" fill="none" '
                 'stroke-linecap="round"/>' % (a // 2, a))
    s.append('</g>')
    return s


def building(x, y, w, h, fill="#F2F5F4", roof="#1C7293"):
    s = ['<rect x="%d" y="%d" width="%d" height="%d" fill="%s" stroke="#4A5B63" stroke-width="2"/>'
         % (x, y, w, h, fill),
         '<polygon points="%d,%d %d,%d %d,%d" fill="%s"/>' % (x - 8, y, x + w // 2, y - 26, x + w + 8, y, roof)]
    for i in range(max(1, w // 30)):
        for j in range(max(1, h // 34)):
            s.append('<rect x="%d" y="%d" width="14" height="16" fill="#BBD8E4"/>'
                     % (x + 12 + i * 30, y + 14 + j * 34))
    return s


def haze():
    """中央帶柔化：讓迷宮牆與代幣在任何場景上都讀得清楚。"""
    return ['<rect x="0" y="150" width="%d" height="660" fill="url(#haze)"/>' % W]


def label(txt, sub):
    """場景不畫地名標籤：HUD 已顯示關卡與地點，畫在圖上只會和方向鍵、迷宮打架。
    保留這個函式簽名，讓每個場景的定義仍看得出它對應哪一關。"""
    return ['<!-- %s | %s -->' % (txt, sub)]


# ─────────────────────────────────────────── 12 個場景
def s01():   # 七星潭礫石灘
    s = head("#8FD4F0", "#E4F4FB") + clouds(3)
    s += mountains(210, 150, "#7FA6B8", 3, op=.75)
    s += mountains(280, 130, "#4E7F86", 5)
    s += sea(410, "#2E86AB", "#0E4C6B")
    s += ground(700, "#C9C2B4", "#DCD6C8")
    s += rocks(11, 720, 930, 34, ("#9AA096", "#7C8A80", "#B4B7A8"), 22)
    s += haze() + label("七星潭礫石灘", "STAGE 01 · 蛇紋石的層狀結構與 –OH 門把")
    return s


def s02():   # 深層海水園區
    s = head("#7FCBEA", "#DFF2FA") + clouds(9)
    s += mountains(240, 140, "#5C93A3", 7, op=.8)
    s += sea(380, "#1F6E96", "#062F4A")
    for i in range(4):
        s += ['<rect x="%d" y="%d" width="26" height="300" rx="12" fill="#C6D5DC" '
              'stroke="#5A6E78" stroke-width="2" opacity=".85"/>' % (70 + i * 150, 420)]
    s += ground(720, "#D8E0E2", "#EDF2F3")
    s += building(60, 640, 130, 80, "#F4F8F9", "#065A82")
    s += building(430, 660, 150, 60, "#F4F8F9", "#1C7293")
    s += haze() + label("花蓮深層海水園區", "STAGE 02 · Mg²⁺ 與 Ca²⁺ 的來源")
    return s


def s03():   # 瑞穗牧場綠野
    s = head("#93D9F2", "#EAF7E4") + clouds(21, 7)
    s += mountains(230, 160, "#7CA98F", 6, op=.7)
    s += ground(420, "#8FC98F", "#A9DCA0")
    rng = random.Random(4)
    for i in range(9):
        s += tree(rng.uniform(30, 610), rng.uniform(440, 520), rng.uniform(.5, .9))
    for i in range(16):
        x, y = rng.uniform(30, 600), rng.uniform(760, 930)
        s += ['<ellipse cx="%.0f" cy="%.0f" rx="26" ry="16" fill="#FFFFFF" stroke="#3F4C45" '
              'stroke-width="2"/>' % (x, y),
              '<ellipse cx="%.0f" cy="%.0f" rx="9" ry="6" fill="#2E3B33"/>' % (x - 8, y - 3)]
    s += haze() + label("瑞穗牧場綠野", "STAGE 03 · TPGS-750-M 的三段分子")
    return s


def s04():   # 鯉魚潭綠地
    s = head("#8FD4F0", "#E8F6F0") + clouds(31)
    s += mountains(220, 180, "#5D8C6E", 5)
    s += sea(430, "#3E9BB5", "#125A72")
    s += ground(760, "#9ACB8E", "#B6DDA6")
    rng = random.Random(8)
    for i in range(8):
        s += tree(rng.uniform(20, 620), rng.uniform(780, 900), rng.uniform(.5, 1.0), "#2E7D5B")
    s += ['<ellipse cx="330" cy="600" rx="70" ry="14" fill="#FFFFFF" opacity=".28"/>']
    s += haze() + label("鯉魚潭綠地", "STAGE 04 · 微胞奈米反應艙")
    return s


def s05():   # 石梯坪海階
    s = head("#86CFEE", "#E2F3FB") + clouds(41)
    s += mountains(250, 130, "#6E97A6", 4, op=.75)
    s += sea(400, "#2A82A8", "#0B4661")
    # 海階地形：一階一階
    for i in range(5):
        y = 640 + i * 62
        s += ['<rect x="%d" y="%d" width="%d" height="70" fill="%s" stroke="#4A5B4E" '
              'stroke-width="2"/>' % (-20 + i * 10, y, W + 40, ["#B9B3A2", "#A69F8E", "#C7C1B0"][i % 3])]
    s += rocks(17, 660, 930, 22, ("#8E9186", "#6E7269", "#A6A79C"), 18)
    s += haze() + label("石梯坪海階", "STAGE 05 · 第一式　球磨機械斷鍵")
    return s


def s06():   # 東華校園草坪
    s = head("#9BDCF4", "#EFF8E9") + clouds(53, 7)
    s += mountains(210, 170, "#79A98D", 8, op=.65)
    s += ground(440, "#9ED18F", "#B8E3A6")
    s += building(70, 330, 180, 110, "#FBFDFD", "#1C7293")
    s += building(400, 350, 170, 90, "#FBFDFD", "#065A82")
    rng = random.Random(12)
    for i in range(10):
        s += tree(rng.uniform(20, 620), rng.uniform(760, 920), rng.uniform(.45, .85))
    s += haze() + label("東華大學校園草坪", "STAGE 06 · 第二式　微胞自組裝與 CMC")
    return s


def s07():   # 縱谷稻浪
    s = head("#8ED2F0", "#F3F6DC") + clouds(61)
    s += mountains(200, 190, "#7FA48D", 6, op=.7)
    s += mountains(320, 130, "#4F7A5C", 9)
    s += ground(450, "#D9C86A", "#E7DA84")
    rng = random.Random(15)
    for r in range(14):
        y = 470 + r * 34
        s += ['<path d="M0 %d q80 -10 160 0 q80 10 160 0 q80 -10 160 0 q80 10 160 0" '
              'stroke="#B9A94C" stroke-width="3" fill="none" opacity=".7"/>' % y]
    s += haze() + label("花東縱谷稻浪", "STAGE 07 · 第三式　FeCl₃ 入水")
    return s


def s08():   # 崇德海岸
    s = head("#7FC9EE", "#DDF0FA") + clouds(71)
    s += mountains(180, 230, "#5F7E88", 3)
    s += ['<polygon points="0,410 120,180 260,410" fill="#4A6771"/>',
          '<polygon points="380,410 500,200 640,410" fill="#4A6771"/>']
    s += sea(420, "#1F79A4", "#062F4A")
    s += rocks(23, 700, 940, 26, ("#6C7B74", "#54635C", "#87938B"), 26)
    s += haze() + label("崇德海岸", "STAGE 08 · 第四式　Fe³⁺ 抓住表面羥基【假說】")
    return s


def s09():   # 清水斷崖
    s = head("#7CC6EC", "#DFF2FB") + clouds(83, 5)
    s += ['<polygon points="0,120 200,60 400,180 640,90 640,560 0,560" fill="#5D7F72"/>',
          '<polygon points="0,220 160,170 340,300 640,210 640,560 0,560" fill="#42604F"/>']
    for i in range(18):
        x = 20 + i * 36
        s += ['<path d="M%d 240 L%d 555" stroke="#33503F" stroke-width="3" opacity=".55"/>' % (x, x + 12)]
    s += sea(560, "#1C7FA8", "#05304C")
    s += haze() + label("清水斷崖", "STAGE 09 · 第五式　DSW 滴定，Mg²⁺ 補位【假說】")
    return s


def s10():   # 太魯閣溪谷
    s = head("#8ED0EE", "#E9F4F6") + clouds(97, 5)
    s += ['<polygon points="0,60 180,120 280,600 0,600" fill="#8A8377"/>',
          '<polygon points="640,60 460,130 380,600 640,600" fill="#9A9285"/>',
          '<polygon points="0,60 180,120 280,600 0,600" fill="none" stroke="#6B6459" stroke-width="3"/>',
          '<polygon points="640,60 460,130 380,600 640,600" fill="none" stroke="#6B6459" stroke-width="3"/>']
    for i in range(12):
        y = 140 + i * 38
        s += ['<path d="M0 %d q140 18 280 6" stroke="#6B6459" stroke-width="2.4" fill="none" opacity=".6"/>' % y,
              '<path d="M640 %d q-140 18 -260 6" stroke="#6B6459" stroke-width="2.4" fill="none" opacity=".6"/>' % (y + 10)]
    s += ['<rect x="270" y="480" width="110" height="480" fill="#79C3DD"/>']
    rng = random.Random(19)
    for i in range(22):
        s += ['<path d="M%.0f %.0f q10 -6 20 0" stroke="#FFFFFF" stroke-width="2.6" fill="none" opacity=".6"/>'
              % (rng.uniform(275, 355), rng.uniform(500, 940))]
    s += rocks(29, 780, 940, 14, ("#A8A296", "#8A8377"), 20)
    s += haze() + label("太魯閣溪谷", "STAGE 10 · 第六式　超音波空化")
    return s


def s11():   # 光復田野
    s = head("#95D8F2", "#F0F7E4") + clouds(103, 7)
    s += mountains(200, 180, "#7BA48E", 7, op=.68)
    s += ground(440, "#A7D492", "#BFE4AA")
    # 水圳格網
    for i in range(5):
        x = 40 + i * 140
        s += ['<rect x="%d" y="470" width="16" height="470" fill="#6FBCD8" opacity=".8"/>' % x]
    for j in range(6):
        y = 500 + j * 78
        s += ['<rect x="0" y="%d" width="%d" height="14" fill="#6FBCD8" opacity=".8"/>' % (y, W)]
    rng = random.Random(23)
    for i in range(7):
        s += tree(rng.uniform(30, 610), rng.uniform(470, 520), rng.uniform(.45, .7))
    s += haze() + label("光復田野", "STAGE 11 · 第七式　兩個一定要防的副反應")
    return s


def s12():   # 花蓮港外海
    s = head("#79C6EC", "#DBEFFA") + clouds(113)
    s += mountains(240, 150, "#5E8C99", 5, op=.8)
    s += sea(390, "#1B72A0", "#04283F")
    # 浮標
    rng = random.Random(27)
    for i in range(7):
        x, y = rng.uniform(50, 590), rng.uniform(470, 900)
        s += ['<circle cx="%.0f" cy="%.0f" r="14" fill="#E4562F" stroke="#0B1F3A" stroke-width="2.4"/>' % (x, y),
              '<rect x="%.0f" y="%.0f" width="4" height="20" fill="#0B1F3A"/>' % (x - 2, y - 34),
              '<circle cx="%.0f" cy="%.0f" r="5" fill="#FFE9A8"/>' % (x, y - 36)]
    # 防波堤
    s += ['<rect x="0" y="700" width="%d" height="26" fill="#B9BFC2" stroke="#5A6E78" stroke-width="2"/>' % W]
    s += haze() + label("花蓮港外海", "STAGE 12 · 第八式　AgNO₃ 洗滌檢驗＋總複習")
    return s


SCENES = [s01, s02, s03, s04, s05, s06, s07, s08, s09, s10, s11, s12]


def build():
    for i, fn in enumerate(SCENES, 1):
        body = "".join(fn())
        svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" '
               'preserveAspectRatio="xMidYMid slice">%s</svg>' % (W, H, body))
        p = os.path.join(OUT, "scene%02d.svg" % i)
        with open(p, "w", encoding="utf-8") as f:
            f.write(svg)
        print("[scene] %s  %.1f KB" % (p, len(svg) / 1024.0))


if __name__ == "__main__":
    build()
