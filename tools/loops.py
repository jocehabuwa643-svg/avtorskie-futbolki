# Петли для глав с моделью: тот же отрезок исходника, что был в фильме, но 24 к/с и «туда-обратно» —
# конец плавно переходит в начало. Пишет film/b-<ключ>.mp4 (вместо ролика для перемотки) и листы кадров film/s/b-<ключ>-<n>.webp.
import subprocess, os, sys, glob, shutil, tempfile, json
import imageio_ffmpeg
from PIL import Image

SRC = r"C:\Users\Huawei\Desktop\KIAYEVA SAIT"
FILM = os.path.join(SRC, "repo", "film")
FF = imageio_ffmpeg.get_ffmpeg_exe()
# ключ: (исходник, начало, длительность, сторона кадра или (ширина, высота)[, кадрирование crop=…]) — отрезки найдены сличением кадров с прежними роликами
CLIPS = {
    "b-lama":  ("Ира футболка 1.mp4", 0.25, 4.83, 720),
    "b-dome":  ("Ира футболка 3.mp4", 0.25, 5.58, 720),
    "b-vedma": ("ира футболка 8.mp4", 0.38, 5.67, 560),
    "b-shep":  ("ира футболка 4.mp4", 0.25, 5.42, 720),
    "b-mama":  ("ира футболка 6.mp4", 0.38, 5.67, 720),
    "b-tyson": ("ира футболка 5.mp4", 0.12, 2.58, 720),
    # худи целиком: воротник, плечи и вся надпись (раньше в главе был только крупный план букв)
    "b-verh":  ("ФУТБОЛКА 5.mp4", 10.55, 1.35, (464, 580), "crop=464:580:0:8"),
}
SHEET_FPS, SHEET_W, PER, COLS = 8, 480, 12, 4

def run(*a):
    subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", *a], check=True)

def build(key):
    src, t0, dur, side, *rest = CLIPS[key]
    src = os.path.join(SRC, src)
    w, h = side if isinstance(side, tuple) else (side, side)
    crop = rest[0] + "," if rest else ""
    scale = f"{crop}scale={w}:{h}:flags=lanczos"
    out = os.path.join(FILM, key + ".mp4")
    # туда и обратно; последний кадр обратного хода не повторяет первый — шов не виден
    fc = (f"[0:v]trim=start={t0}:duration={dur},setpts=PTS-STARTPTS,fps=24,{scale},format=yuv420p,split[a][b];"
          f"[b]reverse,trim=start_frame=1,setpts=PTS-STARTPTS[r];[a][r]concat=n=2:v=1:a=0,trim=end_frame={int(dur*24)*2-2},setpts=PTS-STARTPTS[v]")
    run("-i", src, "-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264", "-profile:v", "high", "-preset", "slow",
        "-crf", "25", "-g", "48", "-r", "24", "-level:v", "4.0", "-movflags", "+faststart", out)
    # кадры для браузеров без видео: только прямой ход, обратный строит скрипт
    tmp = tempfile.mkdtemp(prefix="loop_")
    try:
        run("-ss", str(t0), "-t", str(dur), "-i", src, "-vf", f"{crop}fps={SHEET_FPS},scale={min(SHEET_W, w)}:-2:flags=lanczos", os.path.join(tmp, "%04d.png"))
        frames = [Image.open(f).convert("RGB") for f in sorted(glob.glob(os.path.join(tmp, "*.png")))]
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    for old in glob.glob(os.path.join(FILM, "s", key + "-*.webp")): os.remove(old)
    fw, fh = frames[0].size; total = 0
    for si in range(0, len(frames), PER):
        chunk = frames[si:si + PER]; rows = (len(chunk) + COLS - 1) // COLS
        sheet = Image.new("RGB", (fw * COLS, fh * rows))
        for k, im in enumerate(chunk): sheet.paste(im, ((k % COLS) * fw, (k // COLS) * fh))
        p = os.path.join(FILM, "s", f"{key}-{si // PER}.webp"); sheet.save(p, "WEBP", quality=62, method=6); total += os.path.getsize(p)
    # первый кадр — постер
    run("-ss", str(t0 + 0.02), "-i", src, "-frames:v", "1", "-vf", scale, "-q:v", "3", os.path.join(FILM, key + ".jpg"))
    return {"n": len(frames), "fps": SHEET_FPS, "w": fw, "h": fh, "loop": 1}, os.path.getsize(out), total

if __name__ == "__main__":
    man = {}
    for key in (sys.argv[1:] or CLIPS):
        m, vsize, ssize = build(key); man[key] = m
        print(f"{key:8} ролик {vsize // 1024} КБ, листы {ssize // 1024} КБ, кадров {m['n']}")
    print(json.dumps(man, separators=(",", ":")))
