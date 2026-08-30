# -*- coding: utf-8 -*-
"""把 10 張關卡關鍵圖片排成 A4 列印稿（每頁 2 張，含關卡編號與掃描說明）。
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
    (1,  "花蓮的山與海",        "在地資源盤點"),
    (2,  "石材廠的邊角料",      "廢棄物現況"),
    (3,  "墨玉的秘密",          "蛇紋石層狀結構與 –OH 門把"),
    (4,  "深層海水的礦物",      "Mg²⁺ 與 Ca²⁺"),
    (5,  "水是最好的溶劑",      "綠色化學的無害介質"),
    (6,  "微胞奈米反應艙",      "TPGS-750-M"),
    (7,  "常溫改質不燒窯",      "節能原則"),
    (8,  "遠紅外線杯墊誕生",    "產品化與循環"),
    (9,  "災害土砂的第二種命運", "馬太鞍與 CO₂ 礦化"),
    (10, "綠色化學大考驗",      "十二原則總複習"),
]


def F(sz, bold=True):
    return ImageFont.truetype(FONTB if bold else FONT, sz)


def page_header(d, page, total):
    d.rectangle([0, 0, A4[0], 210], fill=NAVY)
    d.text((150, 68), "花蓮綠色化學闖關　AR 關鍵圖片列印稿",
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
    d.text((L + 120, top + 40), title, font=F(40), fill=WHITE, anchor="lm")
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
    d.text((L, cy + 42), "關卡 %d 專用　｜　請平放於光線充足處，避免反光與陰影" % n,
           font=F(24, False), fill=GREY, anchor="lt")
    return top + CARD_H


def build():
    pages = []
    total = (len(TITLES) + 1) // 2
    for p in range(total):
        img = Image.new("RGB", A4, WHITE)
        d = ImageDraw.Draw(img)
        page_header(d, p + 1, total)
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
