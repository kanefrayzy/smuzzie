"""Водяной знак для превью: диагональная сетка надписи, вшивается в preview.mp4 при загрузке шаблона.
python3 watermark.py <w> <h> <out.png> [text]"""
import sys
from PIL import Image, ImageDraw, ImageFont
w, h, out = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
text = sys.argv[4] if len(sys.argv) > 4 else "SMUZZIE  PREVIEW"
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", max(14, w // 26))
side = int((w * w + h * h) ** 0.5) + 200
tile = Image.new("RGBA", (side, side), (0, 0, 0, 0))
d = ImageDraw.Draw(tile)
tw = d.textbbox((0, 0), text, font=font)[2]
step_y = max(60, w // 6)
for row, y in enumerate(range(0, side, step_y)):
    off = (row % 2) * (tw // 2 + 40)
    for x in range(-tw + off, side, tw + 80):
        d.text((x, y), text, font=font, fill=(255, 255, 255, 46))
tile = tile.rotate(28, resample=Image.BICUBIC)
l, t = (side - w) // 2, (side - h) // 2
tile.crop((l, t, l + w, t + h)).save(out)
