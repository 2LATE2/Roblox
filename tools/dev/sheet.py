# Compose rendered stills into a labelled contact sheet.
# usage: python3 -I dev/sheet.py <dir> <view> <out.png> [cols]
import sys, os, glob
from PIL import Image, ImageDraw

d, view, out = sys.argv[1], sys.argv[2], sys.argv[3]
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 5
files = sorted(glob.glob(os.path.join(d, f"{view}_*.png")), key=lambda p: float(os.path.basename(p)[len(view) + 1:-4]))
ims = [Image.open(f).convert("RGB") for f in files]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * w, rows * h), (20, 20, 20))
dr = ImageDraw.Draw(sheet)
for i, (f, im) in enumerate(zip(files, ims)):
    x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(im, (x, y))
    t = os.path.basename(f)[len(view) + 1:-4]
    dr.rectangle([x, y, x + 64, y + 18], fill=(0, 0, 0))
    dr.text((x + 4, y + 3), f"t={t}", fill=(255, 220, 120))
sheet.save(out)
print(out, sheet.size)
