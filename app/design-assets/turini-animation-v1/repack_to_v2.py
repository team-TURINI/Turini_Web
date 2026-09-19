import json
import numpy as np
from PIL import Image
from scipy import ndimage

import os
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'turini-animation-atlas-v1.png')
OUT_DIR = os.path.join(HERE, '..', '..', 'public', 'assets')
ROWS = ['idle', 'thinking', 'correct', 'wrong', 'celebrate', 'reading']
COL_CENTERS = [176.5, 400.5, 624.5, 848.5]
ROW_BANDS = [136.0, 380.0, 627.0, 880.0, 1140.0, 1389.0]

CELL = 288
COLS, NROWS = 4, 6
CENTER_X = CELL / 2          # 144
GROUND_Y = CELL - 22         # 266  (baseline the feet sit on)

src = np.array(Image.open(SRC).convert('RGBA'))
opaque = src[:, :, 3] > 8
lab, _ = ndimage.label(opaque)

owner = {}
for i, sl in enumerate(ndimage.find_objects(lab), start=1):
    ys, xs = sl
    cy, cx = (ys.start + ys.stop) / 2, (xs.start + xs.stop) / 2
    r = int(np.argmin([abs(cy - b) for b in ROW_BANDS]))
    c = int(np.argmin([abs(cx - b) for b in COL_CENTERS]))
    owner.setdefault((r, c), []).append(i)

masks, boxes = {}, {}
for r in range(NROWS):
    for c in range(COLS):
        m = np.isin(lab, owner[(r, c)])
        masks[(r, c)] = m
        ys, xs = np.nonzero(m)
        boxes[(r, c)] = (xs.min(), xs.max(), ys.min(), ys.max())

ground = {r: max(boxes[(r, c)][3] for c in range(COLS)) for r in range(NROWS)}

out = np.zeros((CELL * NROWS, CELL * COLS, 4), dtype=np.uint8)
report = []
for r in range(NROWS):
    for c in range(COLS):
        m = masks[(r, c)]
        others = opaque & ~m
        take = ndimage.binary_dilation(m, iterations=2) & ~others   # keep the soft antialiased fringe
        ys, xs = np.nonzero(take)
        dx = int(round(CENTER_X - COL_CENTERS[c]))
        dy = int(round(GROUND_Y - ground[r]))
        nx, ny = xs + dx + c * CELL, ys + dy + r * CELL
        assert nx.min() >= c * CELL and nx.max() < (c + 1) * CELL, (ROWS[r], c, 'x overflow')
        assert ny.min() >= r * CELL and ny.max() < (r + 1) * CELL, (ROWS[r], c, 'y overflow')
        out[ny, nx] = src[ys, xs]
        report.append((ROWS[r], c,
                       nx.min() - c * CELL, (c + 1) * CELL - 1 - nx.max(),
                       ny.min() - r * CELL, (r + 1) * CELL - 1 - ny.max()))

Image.fromarray(out).save(os.path.join(OUT_DIR, 'turini-atlas-v2.png'), optimize=True)

print(f'{"state":10s} f  marginL marginR marginT marginB   (px inside the {CELL}px cell)')
for name, c, l, rr, t, b in report:
    print(f'{name:10s} {c}  {l:7d} {rr:7d} {t:7d} {b:7d}')

meta = {
    "name": "Turini Animation Atlas V2 (repacked from V1)",
    "source": "turini-animation-atlas-v1.png",
    "image": "turini-atlas-v2.png",
    "canvas": {"width": CELL * COLS, "height": CELL * NROWS},
    "grid": {"columns": COLS, "rows": NROWS},
    "frame": {"width": CELL, "height": CELL},
    "groundLineY": GROUND_Y,
    "rows": {name: idx for idx, name in enumerate(ROWS)},
    "notes": [
        "Frames are re-centred on a 224px source pitch and bottom-aligned to a shared ground line.",
        "Artwork is untouched: pixels are copied, never redrawn, rescaled or warped.",
        "Every cell keeps a safety margin so ears, horns and placards never touch the cell edge.",
    ],
}
open(os.path.join(OUT_DIR, 'turini-atlas-v2.json'), 'w', encoding='utf-8').write(json.dumps(meta, ensure_ascii=False, indent=2) + '\n')
print('\nv1 png bytes:', os.path.getsize(SRC), ' v2 png bytes:', os.path.getsize(os.path.join(OUT_DIR, 'turini-atlas-v2.png')))
