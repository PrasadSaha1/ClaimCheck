from pathlib import Path
from PIL import Image, ImageDraw

public = Path(__file__).resolve().parents[1] / 'public'
for size, name in [(192, 'pwa-192x192.png'), (512, 'pwa-512x512.png'),
                   (512, 'pwa-maskable-512x512.png')]:
    image = Image.new('RGB', (size, size), '#f7faf9')
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((size * .16, size * .16, size * .84, size * .84),
                           radius=size * .16, fill='#0a455e')
    draw.rounded_rectangle((size * .33, size * .42, size * .67, size * .68),
                           radius=size * .035, outline='white', width=max(4, size // 35))
    draw.arc((size * .42, size * .28, size * .58, size * .52), 180, 360,
             fill='#ffbd59', width=max(4, size // 35))
    image.save(public / name)
