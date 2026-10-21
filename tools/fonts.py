# Декоративные шрифты надписей: в каждом оставляем только буквы его надписей (и обе формы регистра).
# Исходники лежат в tools/fonts-src/ (на сайт не выкладываются), результат — fonts/<имя>-<хеш>.woff2,
# ссылки в styles.css переписываются сами. Поменялась надпись или имя вещи в листке «Узнать цену» —
# допишите буквы в TEXT и запустите заново:  python tools/fonts.py   (нужны: pip install fonttools brotli)
# Буквы собраны со страницы: текст, нарисованный каждым шрифтом, и имена вещей, которые листок цены показывает тем же шрифтом.
import hashlib, os, re
from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools", "fonts-src")
OUT = os.path.join(ROOT, "fonts")
CSS = os.path.join(ROOT, "styles.css")
# знаки, которые могут понадобиться любой надписи
COMMON = " ,.!?-–—…«»()*\"'“”0123456789"
# семейство: (исходник в tools/fonts-src, буквы)
TEXT = {
    "Bad Script": ("badscript.woff2", "ABDELMOabdelmoАБВЕЗИКЛМНОПСТабвезиклмнопст"),
    "Caveat": ("caveat.woff2", "АВДЕМЬавдемь"),
    "Comfortaa": ("comfortaa.woff2", "БГЕИКЛНОШЬбгеиклношь"),
    "Fira Sans Condensed": ("firasanscondensed.woff2", "АВГДЕЖИНОРСТУЧЫЬавгдежинорстучыь"),
    "Gochi Hand": ("gochihand.woff2", "ABCDEFGHIKLMNOPRSTUVYabcdefghiklmnoprstuvyАИЙНОСТЦаийностц"),
    "Great Vibes": ("greatvibes.woff2", "АБЕИЙЛМНОПРСУШЯабеийлмнопрсушя"),
    "Kurale": ("kurale.woff2", "АВГДЕЖЗИКЛМНОРСТУХЧЫЬЮЯавгдежзиклмнорстухчыьюя"),
    "Marck Script": ("marckscript.woff2", "АГДЕЗИКЛНОРСТЬЯагдезиклнорстья"),
    "Neucha": ("neucha.woff2", "АВЕЖЗИЙКНОПРСТУЧЫавежзийкнопрстучы"),
    "Pangolin": ("pangolin.woff2", "ABLMNOPRablmnopr"),
    "Philosopher": ("philosopher.woff2", "АВГДЕИКОПРСУЦЮЯавгдеикопрсуцюя"),
    "Playfair Display": ("playfairdisplay-i.woff2", "CDEMOPRScdemoprs"),
    "Unbounded": ("unbounded.woff2", "ЕМОРемор"),
    "Yeseva One": ("yesevaone.woff2", "БГИНОЯбгиноя"),
}

def build(family, src, letters):
    o = subset.Options()
    o.flavor = "woff2"; o.layout_features = ["*"]; o.hinting = False; o.name_IDs = ["*"]; o.notdef_outline = True
    font = subset.load_font(os.path.join(SRC, src), o)
    s = subset.Subsetter(o); s.populate(text=letters + COMMON); s.subset(font)
    tmp = os.path.join(OUT, "_tmp.woff2"); subset.save_font(font, tmp, o)
    data = open(tmp, "rb").read(); os.remove(tmp)
    name = f"{src[:-6]}-{hashlib.sha1(data).hexdigest()[:6]}.woff2"
    open(os.path.join(OUT, name), "wb").write(data)
    return name, len(data)

if __name__ == "__main__":
    css = open(CSS, encoding="utf-8").read()
    for family, (src, letters) in TEXT.items():
        name, size = build(family, src, letters)
        rule = re.compile(r'(@font-face \{ font-family: "' + re.escape(family) + r'";[^}]*?url\(")fonts/([\w.-]+)(")')
        old = rule.search(css)
        assert old, family
        if old.group(2) != name:
            if os.path.exists(os.path.join(OUT, old.group(2))) and old.group(2).startswith(src[:-6] + "-"): os.remove(os.path.join(OUT, old.group(2)))
            css = rule.sub(lambda m: m.group(1) + "fonts/" + name + m.group(3), css, count=1)
        print(f"{family:20} {os.path.getsize(os.path.join(SRC, src)) // 1024:4} КБ → {size // 1024:3} КБ  {name}")
    open(CSS, "w", encoding="utf-8", newline="\n").write(css)
