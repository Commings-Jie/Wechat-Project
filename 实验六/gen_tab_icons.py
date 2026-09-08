# -*- coding: utf-8 -*-
"""生成 tabBar 图标：81x81 PNG，透明底，实心填充（辨识度最高、最不容易"看不见"）。
tabBar 图标必须是本地 png，不支持 svg / 网络路径 / base64。
用 4x 超采样再缩小做抗锯齿，避免边缘毛刺。
"""
import os
from PIL import Image, ImageDraw

OUT = r"C:\Users\21673\Desktop\移动软件开发\实验\实验六\miniprogram\images\tab"
os.makedirs(OUT, exist_ok=True)

SIZE = 81
SS = 4  # supersample
W = SIZE * SS

GREY = (153, 153, 153, 255)
BLUE = (74, 144, 217, 255)


def new_canvas():
    return Image.new("RGBA", (W, W), (0, 0, 0, 0))


def draw_home(color):
    """房子：实心屋顶三角 + 实心墙体 + 透明门洞"""
    img = new_canvas()
    d = ImageDraw.Draw(img)
    u = W / 81.0

    def U(x):
        return x * u

    # 屋顶（实心）
    roof = [
        (U(40.5), U(12)),
        (U(73), U(39)),
        (U(64), U(46)),
        (U(40.5), U(25)),
        (U(17), U(46)),
        (U(8), U(39)),
    ]
    d.polygon(roof, fill=color)

    # 墙体（实心）
    d.rectangle([U(18), U(40), U(63), U(69)], fill=color)

    # 门洞（透明挖空）
    d.rectangle([U(32), U(51), U(49), U(69)], fill=(0, 0, 0, 0))
    return img


def draw_mine(color):
    """人像：实心圆头 + 实心半圆肩"""
    img = new_canvas()
    d = ImageDraw.Draw(img)
    u = W / 81.0

    def U(x):
        return x * u

    # 头（实心圆）
    d.ellipse([U(26), U(12), U(55), U(41)], fill=color)
    # 肩（实心半圆）
    d.pieslice([U(12), U(46), U(69), U(116)], start=180, end=360, fill=color)
    # 底部封口
    d.rectangle([U(12), U(68), U(69), U(70)], fill=color)
    return img


def save(img, name):
    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    p = os.path.join(OUT, name)
    img.save(p, "PNG")
    print("saved", p, os.path.getsize(p), "bytes")


# 未选中 = 灰色实心，选中 = 蓝色实心
save(draw_home(GREY), "home.png")
save(draw_home(BLUE), "home_on.png")
save(draw_mine(GREY), "mine.png")
save(draw_mine(BLUE), "mine_on.png")
