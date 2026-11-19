from pathlib import Path
from PIL import Image, ImageDraw
out = Path(__file__).resolve().parent.parent / 'public'
out.mkdir(exist_ok=True)
for size in (192, 512):
    im = Image.new('RGB', (size, size), '#101b14')
    d = ImageDraw.Draw(im)
    s = size / 512
    # Original geometric H monogram, inside the maskable safe zone.
    d.rounded_rectangle(tuple(int(v*s) for v in (126,124,188,388)), radius=int(12*s), fill='#72edb0')
    d.rounded_rectangle(tuple(int(v*s) for v in (324,124,386,388)), radius=int(12*s), fill='#72edb0')
    d.polygon([(int(x*s),int(y*s)) for x,y in [(170,246),(215,246),(246,204),(276,281),(300,246),(342,246),(342,278),(316,278),(267,338),(238,261),(232,278),(170,278)]],fill='#72edb0')
    im.save(out / f'icon-{size}.png')
