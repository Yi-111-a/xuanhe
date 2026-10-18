"""Video cover (1920x1080) for the 宣和 trailer: Codex key art + brush-type title laid out here (no text in the art).

    ../../.venv/Scripts/python cover/make_cover.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONTS = ROOT / "assets" / "fonts"
W, H = 1920, 1080
SNOW, GOLD, RED, INK = (239, 233, 220), (214, 180, 106), (205, 52, 34), (11, 9, 7)


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def cover_crop(path, focus_y=0.5, focus_x=0.5, zoom=1.0):
    im = Image.open(path).convert("RGB")
    s = max(W / im.width, H / im.height) * zoom
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x = round((im.width - W) * focus_x)
    y = round((im.height - H) * focus_y)
    return im.crop((x, y, x + W, y + H))


def shade(base, box, strength=0.75, side="left"):
    """Darken one side with a soft horizontal gradient so type reads."""
    grad = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(grad)
    x0, x1 = box
    for x in range(W):
        if side == "left":
            a = 1.0 if x < x0 else max(0.0, 1 - (x - x0) / max(1, x1 - x0))
        else:
            a = 1.0 if x > x1 else max(0.0, (x - x0) / max(1, x1 - x0))
        d.line([(x, 0), (x, H)], fill=int(255 * strength * a))
    dark = Image.new("RGB", (W, H), INK)
    return Image.composite(dark, base, grad)


def text_layer(draw_fn):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(layer))
    return layer


def glow_paste(base, layer, radius=18, glow=(0, 0, 0, 230), spread=2):
    alpha = layer.split()[3]
    halo = Image.new("RGBA", (W, H), glow)
    halo.putalpha(alpha.filter(ImageFilter.MaxFilter(spread * 2 + 1)).filter(ImageFilter.GaussianBlur(radius)))
    out = Image.alpha_composite(base.convert("RGBA"), halo)
    return Image.alpha_composite(out, layer)


def seal(base, xy, text, size=40):
    f = font("NotoSansSC-VF.ttf", size)
    try:
        f.set_variation_by_axes([800])
    except Exception:
        pass
    d0 = ImageDraw.Draw(base)
    l, t, r, b = d0.textbbox((0, 0), text, font=f)
    pad_x, pad_y = 22, 14
    x, y = xy
    box = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(box)
    d.rectangle([x, y, x + (r - l) + pad_x * 2, y + (b - t) + pad_y * 2], fill=RED + (240,))
    d.rectangle([x + 5, y + 5, x + (r - l) + pad_x * 2 - 5, y + (b - t) + pad_y * 2 - 5], outline=SNOW + (200,), width=2)
    d.text((x + pad_x - l, y + pad_y - t), text, font=f, fill=SNOW)
    return Image.alpha_composite(base.convert("RGBA"), box)


def make_a():
    base = cover_crop(ROOT / "art/out/cover_a.png", focus_y=0.18, focus_x=0.62, zoom=1.0)
    base = shade(base, (560, 1100), strength=0.62, side="left")
    big = font("MaShanZheng-Regular.ttf", 400)
    hook = font("MaShanZheng-Regular.ttf", 128)
    line = font("ZhiMangXing-Regular.ttf", 104)

    def title(d):
        d.text((70, 40), "宣和", font=big, fill=SNOW, stroke_width=6, stroke_fill=GOLD)
    img = glow_paste(base, text_layer(title), radius=26, spread=6)

    def hooks(d):
        d.text((92, 560), "繁华只剩六年", font=hook, fill=RED, stroke_width=4, stroke_fill=INK)
        d.text((98, 760), "这一次，你是宋徽宗", font=line, fill=SNOW)
    img = glow_paste(img, text_layer(hooks), radius=16, spread=4)
    img = seal(img, (1500, 62), "AI 演满朝文武")
    return img.convert("RGB")


def make_b():
    base = cover_crop(ROOT / "art/out/cover_b.png", focus_y=0.0, focus_x=0.5, zoom=1.0)
    # darken the sky band for the title
    grad = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(grad)
    for y in range(H):
        d.line([(0, y), (W, y)], fill=int(255 * 0.7 * max(0.0, 1 - y / 420)))
    base = Image.composite(Image.new("RGB", (W, H), INK), base, grad)
    big = font("MaShanZheng-Regular.ttf", 250)
    hook = font("MaShanZheng-Regular.ttf", 112)

    def title(d):
        l, t, r, b = d.textbbox((0, 0), "宣和", font=big)
        d.text(((W - (r - l)) / 2 - l, 18), "宣和", font=big, fill=SNOW, stroke_width=5, stroke_fill=GOLD)
    img = glow_paste(base, text_layer(title), radius=22, spread=5)

    def hooks(d):
        d.text((70, 300), "盛世", font=hook, fill=GOLD, stroke_width=4, stroke_fill=INK)
        l, t, r, b = d.textbbox((0, 0), "靖康", font=hook)
        d.text((W - 70 - (r - l) - l, 300), "靖康", font=hook, fill=RED, stroke_width=4, stroke_fill=INK)
    img = glow_paste(img, text_layer(hooks), radius=14, spread=4)
    img = seal(img, (70, 70), "AI 演满朝文武", size=34)
    return img.convert("RGB")


if __name__ == "__main__":
    out = ROOT / "cover"
    make_a().save(out / "cover-a.jpg", quality=92, optimize=True)
    make_b().save(out / "cover-b.jpg", quality=92, optimize=True)
    print("ok")
