"""Draws the Rundown icons into ../icons. Run: python3 tools/make-icons.py (needs Pillow).
A checklist on the same off-white as the Apps icon: three rows, the first one ticked."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "icons"
BG = (251, 248, 244)       # the Apps screen's off-white
ACCENT = (226, 112, 57)    # logo orange, as on the Apps screen
INK = (43, 36, 32)
SOFT = (216, 207, 196)


def draw(size: int, pad: int = 0) -> Image.Image:
    s = 1024  # draw large, then shrink for smooth edges
    img = Image.new("RGB", (s, s), BG)
    d = ImageDraw.Draw(img)
    scale = (s - 2 * pad) / s
    def p(v):  # keep everything inside the safe zone (and smaller still for the maskable icon)
        return pad + v * scale
    for i, y in enumerate((330, 512, 694)):
        r = 62
        cx = 300
        if i == 0:
            d.ellipse([p(cx - r), p(y - r), p(cx + r), p(y + r)], fill=ACCENT)
            d.line([(p(cx - 30), p(y + 2)), (p(cx - 6), p(y + 28)), (p(cx + 34), p(y - 26))], fill=BG, width=int(24 * scale), joint="curve")
        else:
            d.ellipse([p(cx - r), p(y - r), p(cx + r), p(y + r)], outline=SOFT, width=int(20 * scale))
        x0, x1 = 420, 780 - i * 90
        d.rounded_rectangle([p(x0), p(y - 26), p(x1), p(y + 26)], radius=26 * scale, fill=INK if i == 0 else (120, 110, 102))
    return img.resize((size, size), Image.LANCZOS)


OUT.mkdir(exist_ok=True)
for name, size, pad in [("icon-192.png", 192, 0), ("icon-512.png", 512, 0), ("apple-touch-icon.png", 180, 0),
                        ("icon-maskable-512.png", 512, 110)]:
    draw(size, pad).save(OUT / name, optimize=True)
    print("wrote", OUT / name)
