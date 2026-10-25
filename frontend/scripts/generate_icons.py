"""Draws the ClaimCheck ticket logo into the PWA and Apple touch icons in public/.

Same shapes as public/favicon.svg and Logo in src/App.jsx, on a 100x100 grid. Run: python scripts/generate_icons.py
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw

GREEN = '#1f3a2e'
CREAM = '#f2e8d6'
GOLD_TOP, GOLD_BOTTOM = (228, 199, 147), (176, 138, 82)
SUPERSAMPLE = 4  # draw big, then shrink, for smooth edges

# Each half: rotation (degrees, center), body outline, then holes and bars punched out in the tile color.
LEFT = (-6, (31, 52), [(13, 35), (46, 35), (50, 40), (45, 46), (50, 52), (45, 58), (49, 64), (47, 69), (13, 69)],
        [('circle', 13, 52, 5.5), ('rect', 22, 44, 15, 3.6), ('rect', 23, 53, 11, 3.6)])
RIGHT = (6, (70, 47), [(54, 30), (88, 30), (88, 64), (54, 64), (50, 58), (55, 52), (50, 46), (55, 40), (52, 34)],
         [('circle', 88, 47, 5.5), ('circle', 71, 46, 5)])


def rotate(points, angle, center):
    a, (cx, cy) = math.radians(angle), center
    return [(cx + (x - cx) * math.cos(a) - (y - cy) * math.sin(a), cy + (x - cx) * math.sin(a) + (y - cy) * math.cos(a))
            for x, y in points]


def shape_points(shape):
    if shape[0] == 'circle':
        _, cx, cy, r = shape
        return [(cx + r * math.cos(t / 48 * math.tau), cy + r * math.sin(t / 48 * math.tau)) for t in range(48)]
    _, x, y, w, h = shape
    return [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]


def gold_gradient(n, outline):
    """Top-left to bottom-right across the gold half only, like the SVG's objectBoundingBox gradient."""
    xs, ys = [x for x, _ in outline], [y for _, y in outline]
    box = tuple(round(v) for v in (min(xs), min(ys), max(xs), max(ys)))
    small = Image.new('RGB', (64, 64))
    small.putdata([tuple(round(a + (b - a) * (x + y) / 126) for a, b in zip(GOLD_TOP, GOLD_BOTTOM))
                   for y in range(64) for x in range(64)])
    canvas = Image.new('RGB', (n, n), GOLD_TOP)
    canvas.paste(small.resize((box[2] - box[0], box[3] - box[1]), Image.BICUBIC), box[:2])
    return canvas


def icon(size, rounded, scale):
    """rounded: transparent corners like the favicon. scale < 1 shrinks the ticket into a maskable safe zone."""
    n = size * SUPERSAMPLE
    image = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    if rounded:
        draw.rounded_rectangle((0, 0, n - 1, n - 1), radius=n * .24, fill=GREEN)
    else:
        draw.rectangle((0, 0, n, n), fill=GREEN)
    to_pixels = lambda points: [((50 + (x - 50) * scale) * n / 100, (50 + (y - 50) * scale) * n / 100) for x, y in points]
    for (angle, center, body, cutouts), fill in ((LEFT, CREAM), (RIGHT, None)):
        outline = to_pixels(rotate(body, angle, center))
        if fill:
            draw.polygon(outline, fill=fill)
        else:
            mask = Image.new('L', (n, n), 0)
            ImageDraw.Draw(mask).polygon(outline, fill=255)
            image.paste(gold_gradient(n, outline), mask=mask)
        for cutout in cutouts:
            draw.polygon(to_pixels(rotate(shape_points(cutout), angle, center)), fill=GREEN)
    return image.resize((size, size), Image.LANCZOS)


public = Path(__file__).resolve().parents[1] / 'public'
icon(192, True, 1).save(public / 'pwa-192x192.png')
icon(512, True, 1).save(public / 'pwa-512x512.png')
icon(512, False, .82).save(public / 'pwa-maskable-512x512.png')  # Android crops to a circle; keep the ticket inside
icon(180, False, 1).convert('RGB').save(public / 'apple-touch-icon.png')  # iOS rounds the corners itself
