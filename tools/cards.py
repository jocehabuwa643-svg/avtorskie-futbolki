# Ролики для карточек «Крупный план» и подвала: film/c-<ключ>.mp4 + постер .jpg + листы кадров film/s/c-<ключ>-<n>.webp.
# «туда-обратно» — короткий отрезок играет вперёд и назад (шов не виден);
# «наплыв» — длинный отрезок, последние 0,6 с плавно переходят в первые.
import subprocess, os, sys, glob, shutil, tempfile, json
import imageio_ffmpeg
from PIL import Image

SRC = r"C:\Users\Huawei\Desktop\KIAYEVA SAIT"
FILM = os.path.join(SRC, "repo", "film")
FF = imageio_ffmpeg.get_ffmpeg_exe()
# ключ: (исходник, начало, длительность, кадр crop=w:h:x:y, итоговая ширина, способ)
CLIPS = {
    "c-such":   ("ФУТБОЛКА 4.MOV", 2.42, 1.25, "720:576:0:190", 600, "pingpong"),
    "c-zdes":   ("для сайта 1.mp4", 2.05, 1.50, "560:560:0:0", 560, "pingpong"),
    "c-vokrug": ("для сайта 1.mp4", 3.70, 1.30, "560:560:0:0", 560, "pingpong"),
    "c-books":  ("для сайта 1.mp4", 14.05, 0.95, "560:464:0:47", 560, "pingpong"),
    "c-dengi":  ("деньги на ветер.mp4", 0.30, 8.00, "720:900:0:100", 576, "xfade"),
    "c-box":    ("отправка.mp4", 0.00, 12.35, "720:816:0:180", 540, "xfade"),
}
SHEET_FPS, PER, COLS = 8, 12, 4

# -r 24 и -level:v 4.0 у кодировщика: без них склейка «туда-обратно» объявляет уровень 6.2 (8K), и часть телефонов ролик не берёт
def run(*a): subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", *a], check=True)

def build(key):
    src, t0, dur, crop, w, mode = CLIPS[key]
    src = os.path.join(SRC, src)
    base = f"crop={crop},scale={w}:-2:flags=lanczos,fps=24,format=yuv420p"
    out = os.path.join(FILM, key + ".mp4")
    if mode == "pingpong":
        n = int(dur * 24)
        fc = (f"[0:v]trim=start={t0}:duration={dur},setpts=PTS-STARTPTS,{base},split[a][b];"
              f"[b]reverse,trim=start_frame=1,setpts=PTS-STARTPTS[r];[a][r]concat=n=2:v=1:a=0,trim=end_frame={2 * n - 2},setpts=PTS-STARTPTS[v]")
        run("-i", src, "-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264", "-profile:v", "high", "-preset", "slow",
            "-crf", "24", "-g", "48", "-r", "24", "-level:v", "4.0", "-movflags", "+faststart", out)
    else:
        # наплыв: сначала ровный отрезок 24 к/с во временный файл (xfade нужна постоянная частота кадров), потом склейка хвоста с головой
        x = 0.6
        mid = os.path.join(tempfile.gettempdir(), key + "_mid.mp4")
        run("-ss", str(t0), "-t", str(dur), "-i", src, "-vf", base, "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "16", "-r", "24", mid)
        fc = (f"[0:v]trim=start={x},setpts=PTS-STARTPTS,fps=24[body];[1:v]trim=duration={x},setpts=PTS-STARTPTS,fps=24[head];"
              f"[body][head]xfade=transition=fade:duration={x}:offset={dur - 2 * x:.3f},format=yuv420p[v]")
        run("-i", mid, "-i", mid, "-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264", "-profile:v", "high", "-preset", "slow",
            "-crf", "24", "-g", "48", "-r", "24", "-level:v", "4.0", "-movflags", "+faststart", out)
        os.remove(mid)
    run("-i", out, "-frames:v", "1", "-q:v", "3", os.path.join(FILM, key + ".jpg"))
    # листы для браузеров без видео: у «туда-обратно» только прямой ход (обратный строит скрипт), у «наплыва» — весь цикл
    tmp = tempfile.mkdtemp(prefix="cards_")
    try:
        if mode == "pingpong":
            run("-ss", str(t0), "-t", str(dur), "-i", src, "-vf", f"crop={crop},scale={min(w, 420)}:-2:flags=lanczos,fps={SHEET_FPS}", os.path.join(tmp, "%04d.png"))
        else:
            run("-i", out, "-vf", f"scale={min(w, 420)}:-2:flags=lanczos,fps={SHEET_FPS}", os.path.join(tmp, "%04d.png"))
        frames = [Image.open(f).convert("RGB") for f in sorted(glob.glob(os.path.join(tmp, "*.png")))]
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    for old in glob.glob(os.path.join(FILM, "s", key + "-*.webp")): os.remove(old)
    fw, fh = frames[0].size
    for si in range(0, len(frames), PER):
        chunk = frames[si:si + PER]; rows = (len(chunk) + COLS - 1) // COLS
        sheet = Image.new("RGB", (fw * COLS, fh * rows))
        for k, im in enumerate(chunk): sheet.paste(im, ((k % COLS) * fw, (k // COLS) * fh))
        sheet.save(os.path.join(FILM, "s", f"{key}-{si // PER}.webp"), "WEBP", quality=60, method=6)
    m = {"n": len(frames), "fps": SHEET_FPS, "w": fw, "h": fh}
    if mode == "pingpong": m["loop"] = 1
    return m, os.path.getsize(out)

if __name__ == "__main__":
    man = {}
    for key in (sys.argv[1:] or CLIPS):
        m, size = build(key); man[key] = m
        print(f"{key:9} {size // 1024} КБ, кадров в листах {m['n']} {m['w']}x{m['h']}")
    print(json.dumps(man, separators=(",", ":")))
