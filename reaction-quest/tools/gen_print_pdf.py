# -*- coding: utf-8 -*-
"""把關鍵圖片排成 A4 列印稿。
第 1 頁 ＝ 遊戲萬用卡（放大版，一張卡玩全程），第 2 頁起才是十二張關卡卡（每頁 2 張）。
輸出：print/關鍵圖片列印稿.pdf
"""
import os
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "assets", "targets")
OUT = os.path.join(BASE, "print")
os.makedirs(OUT, exist_ok=True)

DPI = 300
A4 = (int(210 / 25.4 * DPI), int(297 / 25.4 * DPI))   # 2480 x 3508
FONT = "C:/Windows/Fonts/msjh.ttc"
FONTB = "C:/Windows/Fonts/msjhbd.ttc"

NAVY = (11, 31, 58); TEAL = (28, 114, 147); GREY = (100, 116, 139)
GOLD = (201, 154, 62); DARK = (30, 41, 59); WHITE = (255, 255, 255)

TITLES = [
    (1,  "墨玉的層狀結構與 –OH 門把", "蛇紋石 1:1（TO）型層狀矽酸鹽"),
    (2,  "深層海水的 Mg2+ 與 Ca2+",   "安全離子源與脫氣"),
    (3,  "TPGS-750-M 的三段分子",     "維生素 E／琥珀酸／PEG-750 甲醚"),
    (4,  "微胞：奈米反應艙",           "50–100 nm 的水相反應場地"),
    (5,  "第一式　球磨機械斷鍵",       "≡Si–O–Si≡ ＋ 機械能"),
    (6,  "第二式　微胞自組裝與 CMC",   "動態平衡與臨界微胞濃度"),
    (7,  "第三式　FeCl3 解離與水解",   "為什麼加鐵、為什麼會變酸"),
    (8,  "第四式　Fe3+ 抓住表面羥基",  "內圈表面錯合物【研究假說】"),
    (9,  "第五式　Mg2+ 補進晶格缺陷",  "晶格缺陷補償【研究假說】"),
    (10, "第六式　超音波空化",         "生長→失穩→崩陷"),
    (11, "第七式　兩個要防的副反應",   "MgCO3↓ 與 Fe(OH)3↓"),
    (12, "第八式　AgNO3 洗滌檢驗",     "把沉澱反過來當偵測器"),
]


def F(sz, bold=True):
    return ImageFont.truetype(FONTB if bold else FONT, sz)


def page_header(d, page, total):
    d.rectangle([0, 0, A4[0], 210], fill=NAVY)
    d.text((150, 68), "蛇紋石改質反應探險　AR 關鍵圖片列印稿",
           font=F(56), fill=WHITE, anchor="lm")
    d.text((150, 138), "國立東華大學自然資源與環境學系　仿生與環境工作坊",
           font=F(32, False), fill=(159, 211, 192), anchor="lm")
    d.text((A4[0] - 150, 104), "%d / %d" % (page, total), font=F(46), fill=GOLD, anchor="rm")


def page_footer(d):
    y = A4[1] - 130
    d.line([150, y, A4[0] - 150, y], fill=(200, 210, 216), width=3)
    d.text((150, y + 46),
           "列印建議：A4、實際大小（100%，勿縮放）、一般白紙即可；平放於光線充足處掃描。",
           font=F(30, False), fill=GREY, anchor="lm")
    d.text((A4[0] - 150, y + 46), "全部圖片皆為本專案自繪，零版權素材",
           font=F(28, False), fill=GREY, anchor="rm")


TITLE_H = 110       # 標題列高
IMG_SIDE = 1260     # 關鍵圖片邊長（≒ 107 mm，實測足夠手機辨識）
CARD_H = TITLE_H + 24 + IMG_SIDE + 86


def card(page_img, d, n, title, sub, top):
    """單張卡片：標題列 ＋ 關鍵圖片 ＋ 掃描說明（整張高度為 CARD_H）"""
    L = (A4[0] - IMG_SIDE) // 2
    R = L + IMG_SIDE
    # 標題列
    d.rounded_rectangle([L, top, R, top + TITLE_H], 16, fill=NAVY)
    d.ellipse([L + 18, top + 15, L + 98, top + 95], fill=GOLD)
    d.text((L + 58, top + 55), "%02d" % n, font=F(42), fill=NAVY, anchor="mm")
    d.text((L + 120, top + 40), title, font=F(34), fill=WHITE, anchor="lm")
    d.text((L + 120, top + 84), sub, font=F(26, False), fill=(159, 211, 192), anchor="lm")

    # 圖片（外框虛線提示可沿線裁下）
    iy = top + TITLE_H + 24
    src = Image.open(os.path.join(SRC, "level%02d.png" % n)).convert("RGB")
    src = src.resize((IMG_SIDE, IMG_SIDE), Image.LANCZOS)
    page_img.paste(src, (L, iy))
    d.rectangle([L - 3, iy - 3, R + 3, iy + IMG_SIDE + 3], outline=(150, 160, 168), width=3)

    # 說明
    cy = iy + IMG_SIDE + 26
    d.text((L, cy), "掃描方式：遊戲中走到目標點後按「開始掃描」，讓整張圖填滿手機畫面即可辨識。",
           font=F(26, False), fill=DARK, anchor="lt")
    d.text((L, cy + 42), "關卡 %d 專用　｜　不想換圖的話，掃第 1 頁的「遊戲萬用卡」也可以過關" % n,
           font=F(24, False), fill=GREY, anchor="lt")
    return top + CARD_H


GREEN = (46, 125, 91)
MOSS = (95, 169, 138)


def universal_page(page, total):
    """第 1 頁：遊戲萬用卡放大版 ＋「一張卡玩全程」說明。
    整場只印這一張、只帶這一張，就能從第 1 關掃到第 12 關。"""
    img = Image.new("RGB", A4, WHITE)
    d = ImageDraw.Draw(img)
    page_header(d, page, total)

    # 標題列（森綠，和關卡卡的 navy 標題列一眼分得出來）
    y = 268
    d.rounded_rectangle([150, y, A4[0] - 150, y + 190], 22, fill=GREEN)
    d.text((196, y + 62), "遊戲萬用卡", font=F(72), fill=WHITE, anchor="lm")
    d.text((196, y + 138), "UNIVERSAL CARD　一張卡玩全程", font=F(36, False), fill=(206, 236, 220), anchor="lm")
    d.rounded_rectangle([A4[0] - 700, y + 34, A4[0] - 176, y + 156], 18, fill=GOLD)
    d.text((A4[0] - 438, y + 95), "只要印這一張", font=F(44), fill=NAVY, anchor="mm")

    # 放大版萬用卡（≒ 160 mm 見方，比關卡卡大，好掃也好看）
    side = 1890
    L = (A4[0] - side) // 2
    iy = y + 190 + 44
    src = Image.open(os.path.join(SRC, "universal.png")).convert("RGB").resize((side, side), Image.LANCZOS)
    img.paste(src, (L, iy))
    d.rectangle([L - 4, iy - 4, L + side + 4, iy + side + 4], outline=(150, 160, 168), width=4)

    # 說明區
    ey = iy + side + 42
    d.rounded_rectangle([150, ey, A4[0] - 150, ey + 400], 20, fill=(240, 247, 244), outline=GREEN, width=4)
    d.text((196, ey + 56), "怎麼用這一張卡", font=F(42), fill=GREEN, anchor="lm")
    lines = [
        "1. 每一關按「開始掃描」後，選「掃描卡片」，把這一張卡填滿手機畫面即可。",
        "2. 第 1 關到第 12 關都掃同一張，不必每過一關回去換一張圖。",
        "3. 想要每關不同的圖也可以：後面十二張是各關專屬卡片，兩種掃法都會過關。",
        "4. 手邊完全沒有卡片時，遊戲裡還有「免卡體驗」可以直接開相機看內容。",
    ]
    for i, t in enumerate(lines):
        d.text((196, ey + 130 + i * 62), t, font=F(30, False), fill=DARK, anchor="lm")

    page_footer(d)
    return img


def build():
    pages = []
    total = 1 + (len(TITLES) + 1) // 2          # 第 1 頁是萬用卡
    pages.append(universal_page(1, total))
    for p in range(total - 1):
        img = Image.new("RGB", A4, WHITE)
        d = ImageDraw.Draw(img)
        page_header(d, p + 2, total)
        y = 270
        for k in range(2):
            i = p * 2 + k
            if i >= len(TITLES):
                break
            n, title, sub = TITLES[i]
            y = card(img, d, n, title, sub, y) + 56
        page_footer(d)
        pages.append(img)

    out = os.path.join(OUT, "關鍵圖片列印稿.pdf")
    pages[0].save(out, "PDF", resolution=DPI, save_all=True, append_images=pages[1:])
    print("saved", out, "%.1f MB" % (os.path.getsize(out) / 1048576.0))


if __name__ == "__main__":
    build()
