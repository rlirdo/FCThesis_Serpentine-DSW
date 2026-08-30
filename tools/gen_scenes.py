# -*- coding: utf-8 -*-
"""產生 10 張花蓮實景風插畫背景（SVG，全部自繪，零版權素材）。
陽光藍天大自然調性；輸出 assets/scenes/sceneNN.svg（viewBox 0 0 640 480）。
"""
import os, math, random

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "assets", "scenes")
os.makedirs(OUT, exist_ok=True)

W, H = 640, 480


def sky(sky_top="#8FD4F0", sky_bot="#DCF1FA", sun=(520, 78, 40), clouds=True):
    s = ['<defs>',
         '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">',
         '<stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/>' % (sky_top, sky_bot),
         '</linearGradient>',
         '<radialGradient id="glow"><stop offset="0" stop-color="#FFF3C4" stop-opacity=".95"/>'
         '<stop offset="1" stop-color="#FFF3C4" stop-opacity="0"/></radialGradient>',
         '</defs>',
         '<rect width="%d" height="%d" fill="url(#sky)"/>' % (W, H)]
    if sun:
        x, y, r = sun
        s.append('<circle cx="%d" cy="%d" r="%d" fill="url(#glow)"/>' % (x, y, r * 2.6))
        s.append('<circle cx="%d" cy="%d" r="%d" fill="#FFE9A8"/>' % (x, y, r))
    if clouds:
        rng = random.Random(7)
        for i in range(5):
            cx = 40 + i * 135 + rng.uniform(-20, 20)
            cy = 40 + (i % 3) * 34
            sc = rng.uniform(0.75, 1.3)
            s.append('<g opacity=".82" transform="translate(%.0f,%.0f) scale(%.2f)">' % (cx, cy, sc))
            s.append('<ellipse cx="0" cy="0" rx="34" ry="16" fill="#fff"/>'
                     '<ellipse cx="26" cy="4" rx="26" ry="13" fill="#fff"/>'
                     '<ellipse cx="-24" cy="5" rx="22" ry="11" fill="#fff"/>')
            s.append('</g>')
    return s


def mountains(y, h, fill, seed, peaks=9, stroke=None):
    rng = random.Random(seed)
    pts = ["0,%d" % (y + h)]
    for i in range(peaks * 2 + 1):
        x = i * W / float(peaks * 2)
        py = y + h - abs(math.sin(i * 1.1 + seed)) * h * rng.uniform(0.55, 1.0)
        pts.append("%.0f,%.0f" % (x, py))
    pts.append("%d,%d" % (W, y + h))
    p = '<polygon points="%s" fill="%s"' % (" ".join(pts), fill)
    p += ' stroke="%s" stroke-width="2"' % stroke if stroke else ""
    return [p + "/>"]


def sea(y, top="#2E86AB", bot="#0E4C6B", waves=True):
    s = ['<defs><linearGradient id="sea%d" x1="0" y1="0" x2="0" y2="1">'
         '<stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient></defs>' % (y, top, bot),
         '<rect x="0" y="%d" width="%d" height="%d" fill="url(#sea%d)"/>' % (y, W, H - y, y)]
    if waves:
        rng = random.Random(y)
        for i in range(18):
            wy = y + 12 + i * 15
            for k in range(7):
                wx = -30 + k * 100 + (i % 2) * 50 + rng.uniform(-12, 12)
                s.append('<path d="M%.0f %.0f q16-7 32 0" stroke="#BFE6F2" stroke-width="2.4" '
                         'fill="none" opacity="%.2f"/>' % (wx, wy, 0.28 + 0.03 * (i % 5)))
    return s


def ground(y, fill, top=None):
    s = ['<rect x="0" y="%d" width="%d" height="%d" fill="%s"/>' % (y, W, H - y, fill)]
    if top:
        s.append('<path d="M0 %d q160-14 320 0 t320 0 v10 h-640z" fill="%s"/>' % (y, top))
    return s


def path_road(y):
    return ['<path d="M-20 %d q320-30 680 0 v%d h-680z" fill="#D9CBA8" opacity=".85"/>' % (y, H - y),
            '<path d="M-20 %d q320-30 680 0" stroke="#B9A87E" stroke-width="3" fill="none"/>' % y]


def label(txt, sub):
    """場景名牌已停用：地點名稱改由遊戲 HUD 上方橫幅顯示，
    避免與畫面下方的虛擬方向鍵重疊。保留函式以維持呼叫端不變。"""
    return []


def tree(x, y, s=1.0, c="#2E7D5B", c2="#1F5240"):
    return ['<g transform="translate(%.0f,%.0f) scale(%.2f)">' % (x, y, s),
            '<rect x="-5" y="-24" width="10" height="26" rx="4" fill="#6B4A2E"/>',
            '<ellipse cx="0" cy="-38" rx="28" ry="24" fill="%s"/>' % c,
            '<ellipse cx="-12" cy="-30" rx="18" ry="15" fill="%s"/>' % c2,
            '<ellipse cx="13" cy="-32" rx="16" ry="14" fill="%s"/>' % c2,
            '</g>']


def rocks(seed, y0, y1, n=14, cols=("#7C8A80", "#5B6B60", "#96A398")):
    rng = random.Random(seed)
    s = []
    for i in range(n):
        cx = rng.uniform(20, W - 20)
        cy = rng.uniform(y0, y1)
        r = rng.uniform(9, 26)
        k = rng.randrange(5, 8)
        a0 = rng.uniform(0, 6.28)
        pts = []
        for j in range(k):
            a = a0 + j * 6.283 / k
            rr = r * rng.uniform(0.6, 1.0)
            pts.append("%.0f,%.0f" % (cx + rr * math.cos(a), cy + rr * math.sin(a) * 0.7))
        s.append('<polygon points="%s" fill="%s" stroke="#3F4C45" stroke-width="1.5"/>'
                 % (" ".join(pts), cols[i % len(cols)]))
    return s


def building(x, y, w, h, fill="#F2F5F4", roof="#1C7293", windows=True):
    s = ['<rect x="%d" y="%d" width="%d" height="%d" fill="%s" stroke="#8E9BA4" stroke-width="2"/>' % (x, y, w, h, fill),
         '<polygon points="%d,%d %d,%d %d,%d" fill="%s"/>' % (x - 8, y, x + w // 2, y - 26, x + w + 8, y, roof)]
    if windows:
        for r in range(max(1, h // 34)):
            for c in range(max(1, w // 34)):
                s.append('<rect x="%d" y="%d" width="18" height="16" rx="3" fill="#9FD4E8" stroke="#5E7A88"/>'
                         % (x + 10 + c * 34, y + 12 + r * 34))
    return s


# ----------------------------------------------------------------- 10 個場景
def s01():  # 七星潭
    # 註：直式手機的可行走區上限約在畫面 72%（下方虛擬方向鍵佔住底部），
    # 故礫石灘由 y=300（62%）就開始，讓主角有看得見的地方可走。
    s = sky()
    s += mountains(130, 100, "#5C8B78", 3)
    s += mountains(170, 70, "#3E6B59", 9)
    s += sea(230)
    s += ['<path d="M0 300 q180-34 340-8 t300 26 v190 h-640z" fill="#C9C3B2"/>']
    s += rocks(11, 316, 470, 30, ("#A9A79C", "#8B8A80", "#C0BEB2"))
    s += tree(70, 330, .8) + tree(600, 342, .9)
    s += label("七星潭・礫石海灣", "Qixingtan, Hualien")
    return s


def s02():  # 石材加工廠
    s = sky("#9AD6EE", "#E6F3FA")
    s += mountains(140, 120, "#57826F", 5)
    s += ground(300, "#CFC9B8", "#B9B3A0")
    s += building(60, 190, 170, 110, "#EDEFEC", "#64748B")
    s += building(250, 215, 130, 85, "#E4E8E6", "#1C7293")
    s += ['<rect x="60" y="176" width="34" height="16" fill="#8E9BA4"/>',
          '<rect x="72" y="120" width="14" height="60" fill="#9AA6AE"/>',
          '<ellipse cx="79" cy="112" rx="26" ry="12" fill="#E9EDEF" opacity=".8"/>',
          '<rect x="400" y="250" width="200" height="16" rx="8" fill="#7E8A92"/>',
          '<rect x="470" y="266" width="12" height="40" fill="#5E6A72"/>']
    s += rocks(22, 320, 450, 30, ("#8E8F86", "#6E7269", "#A6A79C"))
    s += ['<rect x="410" y="330" width="150" height="90" rx="8" fill="#B4B0A2" stroke="#6E6A5E" stroke-width="2"/>',
          '<text x="485" y="382" font-size="18" fill="#3F4438" text-anchor="middle" '
          'font-family="Microsoft JhengHei, sans-serif">邊角料堆置區</text>']
    s += label("石材加工廠", "Stone Processing Plant")
    return s


def s03():  # 蛇紋岩採石場
    s = sky("#86CDEA", "#DFF0F8")
    s += mountains(120, 130, "#4A7864", 4)
    # 階梯狀採石壁：收在 y=302（約 63%）以上，下方留給可行走的採石場地面
    for i in range(4):
        y = 150 + i * 38
        s.append('<rect x="%d" y="%d" width="%d" height="38" fill="%s" stroke="#2A4A3A" stroke-width="1.6"/>'
                 % (30 + i * 18, y, W - 60 - i * 36, ["#3E6B57", "#345C4A", "#4A7A64", "#2C5142"][i]))
        for k in range(9):
            s.append('<path d="M%d %d q14-8 28 0" stroke="#7CC0A2" stroke-width="2" fill="none" opacity=".55"/>'
                     % (46 + i * 18 + k * 62, y + 20))
    s += ground(302, "#6E7A6A", "#5A6A58")
    s += rocks(33, 318, 470, 30, ("#3E6B57", "#2A4A3A", "#5A8A72"))
    s += ['<rect x="430" y="322" width="86" height="34" rx="6" fill="#C99A3E" stroke="#7A5C1E" stroke-width="2"/>',
          '<circle cx="450" cy="358" r="12" fill="#333"/><circle cx="500" cy="358" r="12" fill="#333"/>']
    s += label("蛇紋岩採石場", "Serpentinite Quarry")
    return s


def s04():  # 深層海水園區
    s = sky("#7FC9EA", "#DAEFF9")
    s += mountains(130, 100, "#527F6C", 6)
    s += sea(200)
    s += ground(300, "#CBD5CE", "#B4C2BA")
    s += building(40, 198, 150, 102, "#F4F7F6", "#065A82")
    s += building(210, 226, 110, 74, "#EDF2F1", "#1C7293")
    # 取水管線（沿地面延伸，位置抬高到可行走區內）
    s += ['<path d="M120 320 q60 34 250 36 t250-10" stroke="#8E9BA4" stroke-width="14" fill="none" stroke-linecap="round"/>',
          '<path d="M120 320 q60 34 250 36 t250-10" stroke="#C6D0D6" stroke-width="5" fill="none" stroke-dasharray="14 14"/>']
    for i in range(6):
        s.append('<circle cx="%d" cy="%d" r="9" fill="#5FA98A" stroke="#0B1F3A" stroke-width="1.6"/>' % (150 + i * 78, 232))
        s.append('<text x="%d" y="%d" font-size="9" text-anchor="middle" fill="#0B1F3A" '
                 'font-family="sans-serif">Mg</text>' % (150 + i * 78, 235))
    s += label("深層海水園區", "Deep Sea Water Park")
    return s


def s05():  # 清水斷崖
    s = sky("#7BC6E8", "#D8EEF8")
    s += mountains(60, 150, "#3F6B58", 2, peaks=5)
    s += ['<polygon points="0,200 90,120 190,150 300,110 420,160 520,120 640,170 640,330 0,330" '
          'fill="#365E4D" stroke="#22402F" stroke-width="2"/>']
    for i in range(22):
        s.append('<path d="M%d 210 l%d 118" stroke="#2A4A3A" stroke-width="2" opacity=".55"/>' % (10 + i * 30, (i % 5) - 2))
    s += sea(330)
    s += ['<path d="M0 336 q160 22 320 0 t320 6 v14 h-640z" fill="#BFE6F2" opacity=".55"/>']
    s += ['<path d="M-20 300 q330-26 680 4 v22 q-350-30 -680-4z" fill="#6E6A5E" opacity=".9"/>',
          '<path d="M-20 300 q330-26 680 4" stroke="#4A473E" stroke-width="3" fill="none"/>']
    s += label("清水斷崖", "Qingshui Cliff")
    return s


def s06():  # 東華大學東湖畔
    s = sky("#8ED2EF", "#E3F3FA")
    s += mountains(120, 120, "#5A8874", 8)
    s += ground(250, "#7FB98F", "#67A87A")
    s += ['<ellipse cx="330" cy="360" rx="290" ry="96" fill="#3E9BC4"/>',
          '<ellipse cx="330" cy="360" rx="290" ry="96" fill="none" stroke="#2A7A9E" stroke-width="3"/>']
    for i in range(10):
        s.append('<path d="M%d %d q24-9 48 0" stroke="#BFE6F2" stroke-width="2.4" fill="none" opacity=".6"/>'
                 % (80 + (i % 5) * 100, 320 + i * 8))
    s += building(430, 168, 160, 84, "#F6F8F7", "#C99A3E")
    s += tree(70, 268, 1.1) + tree(150, 282, .85) + tree(600, 272, 1.0) + tree(250, 262, .7)
    s += ['<rect x="286" y="300" width="88" height="10" rx="5" fill="#8B6B43"/>',
          '<rect x="292" y="310" width="8" height="20" fill="#8B6B43"/>',
          '<rect x="360" y="310" width="8" height="20" fill="#8B6B43"/>']
    s += label("東華大學・東湖畔", "NDHU Lakeside")
    return s


def s07():  # 縱谷稻田
    s = sky("#8FD4F0", "#E8F5FB")
    s += mountains(110, 130, "#4F7D69", 7)
    s += mountains(170, 90, "#6A9A84", 12)
    s += ground(250, "#C8DE86")
    for i in range(11):
        y = 258 + i * 21
        c = ["#B7D46F", "#CBE288", "#A8C95E", "#D8EA9C"][i % 4]
        s.append('<path d="M-20 %d q330-14 680 0 v22 h-680z" fill="%s"/>' % (y, c))
        for k in range(16):
            s.append('<path d="M%d %d l3-11 M%d %d l-3-11" stroke="#7FA83C" stroke-width="1.6" opacity=".7"/>'
                     % (20 + k * 40, y + 18, 20 + k * 40, y + 18))
    s += path_road(300)
    s += tree(560, 262, .9, "#3E7F63") + tree(60, 258, .75, "#3E7F63")
    s += label("花東縱谷・稻田", "Huatung Valley Rice Fields")
    return s


def s08():  # 文創園區工坊
    s = sky("#93D6F0", "#E9F5FB")
    s += mountains(130, 100, "#57826F", 10)
    s += ground(290, "#D6CDB8", "#C2B99F")
    s += building(50, 178, 180, 112, "#F7EFE0", "#B4522F")
    s += building(250, 200, 150, 90, "#F2EADC", "#8E5A33")
    s += building(420, 214, 160, 76, "#F7EFE0", "#B4522F")
    # 展示台抬高至 y≈300（約 62%），落在可行走區內
    s += ['<rect x="70" y="300" width="500" height="12" rx="6" fill="#9C7B4E"/>']
    for i in range(5):
        cx = 120 + i * 100
        s.append('<rect x="%d" y="312" width="60" height="40" rx="6" fill="#EFE7D6" stroke="#9C7B4E" stroke-width="2"/>'
                 % (cx - 30))
        s.append('<ellipse cx="%d" cy="302" rx="30" ry="10" fill="#3E5A4E" stroke="#22402F" stroke-width="2"/>' % cx)
        s.append('<ellipse cx="%d" cy="299" rx="22" ry="7" fill="#5A7A6A"/>' % cx)
    s += label("花蓮文創工坊", "Craft & Product Studio")
    return s


def s09():  # 馬太鞍溪災後重建
    s = sky("#A8D8EC", "#EAF4F9")
    s += mountains(110, 130, "#5A7F6C", 13)
    # 崩塌裸露地
    s += ['<polygon points="180,150 260,120 340,168 420,140 470,200 380,230 250,222 170,206" '
          'fill="#B99C78" stroke="#8A7052" stroke-width="2"/>']
    s += ground(240, "#B8A98C", "#A2947A")
    # 溪流土砂（抬高，避免堆在畫面最底部被方向鍵蓋住）
    s += ['<path d="M-20 262 q180 30 320 6 t340 24 v56 q-180-24 -340-6 t-320-18z" fill="#9E8E70"/>',
          '<path d="M-20 282 q180 26 320 4 t340 22" stroke="#7E7157" stroke-width="3" fill="none"/>']
    s += rocks(99, 268, 344, 34, ("#A8977A", "#87795F", "#C0B294"))
    # 重建工程
    s += ['<rect x="440" y="300" width="130" height="52" rx="6" fill="#C99A3E" stroke="#7A5C1E" stroke-width="2"/>',
          '<rect x="470" y="270" width="46" height="32" rx="4" fill="#E0B65A" stroke="#7A5C1E" stroke-width="2"/>',
          '<circle cx="466" cy="354" r="14" fill="#333"/><circle cx="546" cy="354" r="14" fill="#333"/>',
          '<path d="M516 284 l70-30" stroke="#7A5C1E" stroke-width="6"/>']
    s += ['<rect x="60" y="296" width="150" height="60" rx="8" fill="#F2F5F4" stroke="#8E9BA4" stroke-width="2"/>',
          '<polygon points="52,296 135,270 218,296" fill="#2E7D5B"/>',
          '<text x="135" y="334" font-size="15" fill="#2E7D5B" text-anchor="middle" '
          'font-family="Microsoft JhengHei, sans-serif">重建工作站</text>']
    s += label("馬太鞍溪・災後重建區", "Post-Disaster Reconstruction")
    return s


def s10():  # 東華大學校園廣場
    s = sky("#8ED2EF", "#E6F4FA")
    s += mountains(110, 120, "#55836F", 15)
    s += ground(260, "#7FB98F", "#6BAA7E")
    s += ['<rect x="120" y="290" width="400" height="190" fill="#DCD6C6"/>',
          '<path d="M120 290 h400" stroke="#BCB6A4" stroke-width="3"/>']
    for i in range(7):
        s.append('<path d="M%d 290 v190" stroke="#C8C2B0" stroke-width="2"/>' % (140 + i * 58))
    s += building(190, 120, 260, 100, "#F7F9F8", "#0B1F3A")
    s += ['<rect x="300" y="160" width="40" height="60" fill="#9FD4E8" stroke="#5E7A88" stroke-width="2"/>',
          '<text x="320" y="110" font-size="16" fill="#0B1F3A" text-anchor="middle" font-weight="bold" '
          'font-family="Microsoft JhengHei, sans-serif">仿生與環境工作坊</text>']
    s += tree(70, 280, 1.2) + tree(575, 286, 1.1) + tree(150, 268, .8) + tree(500, 272, .85)
    # 十二原則旗幟（落在可行走區內）
    for i in range(6):
        x = 150 + i * 68
        s.append('<rect x="%d" y="248" width="6" height="46" fill="#8B6B43"/>' % x)
        s.append('<path d="M%d 248 h44 l-10 14 l10 14 h-44z" fill="%s"/>'
                 % (x + 6, ["#2E7D5B", "#C99A3E", "#1C7293", "#065A82", "#5FA98A", "#0B1F3A"][i]))
    s += label("東華大學・校園廣場", "NDHU Campus Plaza")
    return s


SCENES = [s01, s02, s03, s04, s05, s06, s07, s08, s09, s10]


def build():
    for i, fn in enumerate(SCENES, 1):
        body = "\n".join(fn())
        svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" '
               'preserveAspectRatio="xMidYMid slice">\n%s\n</svg>\n' % (W, H, body))
        p = os.path.join(OUT, "scene%02d.svg" % i)
        with open(p, "w", encoding="utf-8") as f:
            f.write(svg)
        print("saved", p, len(svg), "bytes")


if __name__ == "__main__":
    build()
