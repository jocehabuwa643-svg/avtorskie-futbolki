# Плитки бисера для надписей: film/t/<цвет>.png. Стеклярус — стеклянные трубочки рядами со смещением,
# у каждой свой оттенок, блик вдоль оси и искра; бисер — круглые бусины сотами. Плитка бесшовная.
import os, math, random
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "film", "t")
S = 4          # рисуем в 4 раза крупнее и уменьшаем: мягкие края
T = 120        # сторона плитки в итоговых пикселях

def hexc(h): h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def mix(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

# цвет: (основа, блик, тень, шов)
COLORS = {
    "red":    ("#cf2741", "#ffc9d0", "#6a0b19", "#2a0309"),
    "black":  ("#26262d", "#f4f4fa", "#060608", "#000000"),
    "silver": ("#bfc5ce", "#ffffff", "#5f646e", "#2c2f35"),
    "teal":   ("#119a93", "#c9faf5", "#053d3b", "#021a19"),
    "pink":   ("#e5b2be", "#fff8fa", "#8c5a67", "#4a2c34"),
    "green":  ("#56c533", "#e6ffd6", "#1f5e0f", "#0b2a05"),
}

def bugle(img, cx, cy, w, l, ang, col, rnd):
    base, hi, lo, _ = col
    k = 0.85 + rnd.random() * 0.3                      # трубочки чуть разные
    base = tuple(min(255, int(c * k)) for c in base)
    # трубочка: вертикальная капсула, затенение поперёк оси как у цилиндра
    tw, tl = int(w * S), int(l * S)
    tube = Image.new("RGBA", (tw, tl), (0, 0, 0, 0))
    px = tube.load()
    for x in range(tw):
        u = (x + .5) / tw                               # 0..1 поперёк
        # цилиндр: края тёмные, блик смещён влево
        shade = math.cos((u - .5) * math.pi) ** .8
        c = mix(lo, base, shade)
        hl = math.exp(-((u - .34) / .09) ** 2)
        c = mix(c, hi, min(1, hl * .95))
        for y in range(tl):
            v = (y + .5) / tl
            # скруглённые торцы
            r = min(v, 1 - v) * tl / (tw / 2)
            if r < 1:
                dx = abs(u - .5) * 2
                if dx > math.sqrt(max(0, 1 - (1 - r) ** 2)): continue
            end = min(1, min(v, 1 - v) * 7)             # торцы темнее
            px[x, y] = mix(lo, c, .55 + .45 * end) + (255,)
    # искра у верхнего края блика
    d = ImageDraw.Draw(tube)
    if rnd.random() < .55:
        sx, sy = tw * .34, tl * (.18 + rnd.random() * .5)
        rr = tw * .16
        d.ellipse([sx - rr, sy - rr * 1.6, sx + rr, sy + rr * 1.6], fill=hi + (230,))
    tube = tube.rotate(ang, resample=Image.BICUBIC, expand=True)
    img.alpha_composite(tube, (int(cx * S - tube.width / 2), int(cy * S - tube.height / 2)))

def seed(img, cx, cy, r, col, rnd):
    base, hi, lo, _ = col
    k = 0.88 + rnd.random() * 0.24
    base = tuple(min(255, int(c * k)) for c in base)
    R = int(r * S)
    b = Image.new("RGBA", (2 * R, 2 * R), (0, 0, 0, 0)); px = b.load()
    for x in range(2 * R):
        for y in range(2 * R):
            dx, dy = (x - R + .5) / R, (y - R + .5) / R
            q = dx * dx + dy * dy
            if q > 1: continue
            z = math.sqrt(1 - q)
            light = max(0, (-dx * .45 - dy * .55 + z * .7))
            c = mix(lo, base, min(1, .25 + z))
            c = mix(c, hi, max(0, light - .55) * 2.2)
            px[x, y] = c + (255,)
    img.alpha_composite(b, (int(cx * S - R), int(cy * S - R)))

def tile(name, kind):
    col = tuple(hexc(c) for c in COLORS[name])
    rnd = random.Random(hash(name + kind) & 0xffff)
    img = Image.new("RGBA", (T * S, T * S), col[3] + (255,))
    beads = []
    if kind == "bugle":
        cw, rh = 12, 32                                 # шаг колонок и рядов: 10 колонок, 4 ряда (рядом — со сдвигом)
        for i in range(T // cw):
            for j in range(T // rh + 1):
                cy = j * rh + (rh / 2 if i % 2 else 0) + rh / 2
                beads.append((i * cw + cw / 2, cy, (rnd.random() - .5) * 16))
        for (cx, cy, a) in beads:
            for ox in (-T, 0, T):
                for oy in (-T, 0, T):
                    x, y = cx + ox, cy + oy
                    if -20 < x < T + 20 and -30 < y < T + 30:
                        bugle(img, x, y, 9.4, 28, a, col, random.Random(int(cx * 7 + cy * 13)))
    else:
        r, dx = 6.2, 12
        dy = dx * math.sqrt(3) / 2
        rows = int(round(T / dy)); dy = T / rows
        for j in range(rows):
            for i in range(T // dx):
                beads.append((i * dx + (dx / 2 if j % 2 else 0) + dx / 4, j * dy + dy / 2))
        for (cx, cy) in beads:
            for ox in (-T, 0, T):
                for oy in (-T, 0, T):
                    x, y = cx + ox, cy + oy
                    if -10 < x < T + 10 and -10 < y < T + 10:
                        seed(img, x, y, r, col, random.Random(int(cx * 7 + cy * 13)))
    img = img.resize((T, T), Image.LANCZOS).convert("RGB")
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, f"{name}{'' if kind == 'bugle' else '-seed'}.png")
    img.save(p, optimize=True)
    return p

if __name__ == "__main__":
    for n in COLORS: print(tile(n, "bugle"), os.path.getsize(os.path.join(OUT, f"{n}.png")) // 1024, "КБ")
    for n in ("pink", "black"): tile(n, "seed"); print(n, "seed")
