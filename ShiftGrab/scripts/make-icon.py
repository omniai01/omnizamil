from PIL import Image
from pathlib import Path

src = Path(r"C:\Users\musta\.cursor\projects\d-faizan-tools-ShiftGrab\assets\shiftgrab-cute-icon.png")
root = Path(r"d:\faizan tools\ShiftGrab")
out_png = root / "resources" / "icon.png"
out_grabber = root / "resources" / "icon-grabber.png"
out_ico = root / "resources" / "icon.ico"
assets = root / "src" / "assets" / "icon.png"
assets.parent.mkdir(parents=True, exist_ok=True)

im = Image.open(src).convert("RGBA")
px = im.load()
w, h = im.size

# Only punch out the black / near-black corners outside the squircle.
# Never touch white claw pixels or teal fill.
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if a == 0:
            continue
        if r < 28 and g < 28 and b < 28:
            px[x, y] = (0, 0, 0, 0)

master = im.resize((1024, 1024), Image.Resampling.LANCZOS)
master.save(out_png, "PNG")
master.save(out_grabber, "PNG")
master.save(assets, "PNG")

# Solid teal plate behind for crisp Windows ICO at tiny sizes
sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
ico_base = Image.new("RGBA", (256, 256), (21, 123, 134, 255))
layer = master.resize((256, 256), Image.Resampling.LANCZOS)
ico_base.paste(layer, (0, 0), layer)
ico_base.save(out_ico, format="ICO", sizes=sizes)

print("png", out_png.stat().st_size, "ico", out_ico.stat().st_size)
print("mid", master.getpixel((512, 512)))
print("tl", master.getpixel((8, 8)))
print("teal", master.getpixel((512, 120)))
