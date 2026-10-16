# -*- coding: utf-8 -*-
"""Contact sheet for reviewing generated images: python contact.py <glob> <out.png> [cols] [thumb_w]"""
import glob, sys
from PIL import Image, ImageDraw
files = sorted(glob.glob(sys.argv[1]))
out = sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 8
tw = int(sys.argv[4]) if len(sys.argv) > 4 else 240
ims = [Image.open(f).convert("RGB") for f in files]
th = max(round(im.height * tw / im.width) for im in ims)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * (th + 18)), "white")
d = ImageDraw.Draw(sheet)
for i, (f, im) in enumerate(zip(files, ims)):
    t = im.resize((tw, round(im.height * tw / im.width)))
    x, y = (i % cols) * tw, (i // cols) * (th + 18)
    sheet.paste(t, (x, y))
    d.text((x + 3, y + th + 2), f.replace("\\", "/").split("/")[-1].replace(".png", "").replace("portrait.", "")[:34], fill="black")
sheet.save(out)
print(len(ims), sheet.size)
