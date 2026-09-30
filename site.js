/* Авторские футболки: фильм по скроллу, крупные кадры, гардероб с живой тканью. */
(() => {
  "use strict";

  const doc = document.documentElement;
  const RM = doc.classList.contains("rm");
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const bell = (x, w) => Math.exp(-(x * x) / (2 * w * w));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const mqDark = matchMedia("(prefers-color-scheme: dark)");
  const isDark = () => { const t = doc.getAttribute("data-theme"); return t === "dark" || (t !== "light" && mqDark.matches); };
  const narrow = () => innerWidth < 900;

  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

  /* ——— единый цикл кадров: подписчики сами говорят, нужен ли им следующий кадр ——— */
  const tasks = new Set();
  let rafId = 0, lastT = 0;
  function tick(now) {
    rafId = 0;
    const dt = Math.min(0.05, lastT ? (now - lastT) / 1000 : 1 / 60);
    lastT = now;
    let again = false;
    for (const f of tasks) {
      try { if (f(now, dt)) again = true; } catch (err) { tasks.delete(f); console.warn(err); }
    }
    if (again) rafId = requestAnimationFrame(tick); else lastT = 0;
  }
  const wake = () => { if (!rafId) rafId = requestAnimationFrame(tick); };

  /* ——— тема ——— */
  const themeBtn = $("#theme");
  const themeNames = { system: "Система", light: "Светлая", dark: "Тёмная" };
  const themeOrder = ["system", "light", "dark"];
  function syncTheme() {
    const t = doc.getAttribute("data-theme") || "system";
    themeBtn.querySelector("span").textContent = themeNames[t];
    themeBtn.setAttribute("aria-label", `Тема оформления: ${themeNames[t].toLowerCase()}`);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", isDark() ? "#11100f" : "#ece7e2");
    window.dispatchEvent(new Event("kiyaeva:theme"));
  }
  themeBtn.addEventListener("click", () => {
    const cur = doc.getAttribute("data-theme") || "system";
    const next = themeOrder[(themeOrder.indexOf(cur) + 1) % themeOrder.length];
    doc.setAttribute("data-theme", next);
    try { localStorage.setItem("kiyaeva-theme", next); } catch (e) { /* приватный режим */ }
    syncTheme();
  });
  mqDark.addEventListener && mqDark.addEventListener("change", syncTheme);
  syncTheme();

  /* ——— заголовки-надписи: буквы, строки, строчка ——— */
  function splitLetters(h) {
    let i = 0;
    const walk = (node) => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span");
            w.className = "w";
            for (const ch of part) {
              const c = document.createElement("span");
              c.className = "c";
              c.textContent = ch;
              c.style.setProperty("--i", i++);
              c.style.setProperty("--len", (0.7 + ((i * 37) % 17) / 9).toFixed(2));
              w.appendChild(c);
            }
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== "BR") {
          walk(child);
        }
      }
    };
    walk(h);
    h.style.setProperty("--n", i);
  }

  function splitLines(h) {
    const parts = h.innerHTML.split(/<br\s*\/?>/i);
    h.innerHTML = parts.map((p, k) => `<span class="ln" style="--li:${k}">${p}</span>`).join("");
    h.style.setProperty("--L", parts.length);
  }

  const SVGNS = "http://www.w3.org/2000/svg";
  function buildStitch(h) {
    const sig = $(".sig", h);
    if (sig) sig.remove();
    const lines = h.innerHTML.split(/<br\s*\/?>/i).map((s) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim());
    h.textContent = "";
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("class", "stitch-svg");
    svg.setAttribute("aria-hidden", "true");
    const layers = ["body", "run", "trace"].map((cls) => {
      const g = document.createElementNS(SVGNS, "g");
      g.setAttribute("class", cls);
      lines.forEach((txt) => {
        const t = document.createElementNS(SVGNS, "text");
        t.textContent = txt;
        t.setAttribute("font-size", "100");
        g.appendChild(t);
      });
      svg.appendChild(g);
      return g;
    });
    h.appendChild(svg);
    if (sig) h.appendChild(sig);
    h._stitch = { svg, layers, lines };
  }

  function layoutStitch(h) {
    const st = h._stitch;
    if (!st) return;
    const lh = 104;
    let maxW = 10;
    const first = st.layers[0].children;
    for (let k = 0; k < first.length; k++) {
      let w = 0;
      try { w = first[k].getComputedTextLength(); } catch (e) { w = st.lines[k].length * 55; }
      maxW = Math.max(maxW, w);
    }
    st.layers.forEach((g) => Array.from(g.children).forEach((t, k) => { t.setAttribute("x", 6); t.setAttribute("y", 88 + k * lh); }));
    const H = 20 + st.lines.length * lh;
    st.svg.setAttribute("viewBox", `0 0 ${Math.ceil(maxW + 14)} ${H}`);
    st.ratio = (maxW + 14) / H;
  }

  const heads = $$(".t");
  heads.forEach((h) => {
    const plain = h.textContent.replace(/\s+/g, " ").trim();
    h.setAttribute("aria-label", plain);
    const kind = h.dataset.reveal;
    if (kind === "stitch") buildStitch(h);
    else if (kind === "write" || kind === "glass") splitLines(h);
    else splitLetters(h);
  });

  /* подгонка кегля: надпись должна влезть в колонку целиком, без переносов внутри слов */
  function fitHeads() {
    const stage = $("#stage");
    const film = doc.classList.contains("film-on");
    const vh = innerHeight, vw = innerWidth;
    heads.forEach((h) => {
      const art = h.closest(".ch");
      const colW = film ? art.getBoundingClientRect().width || (narrow() ? vw - 32 : vw * 0.47) : Math.min(art.clientWidth || vw - 32, 704);
      const maxH = film ? (narrow() ? vh * 0.27 : vh * 0.46) : vh * 0.5;
      if (h._stitch) {
        layoutStitch(h);
        const r = h._stitch.ratio || 4;
        const w = Math.min(colW, maxH * r);
        h._stitch.svg.style.width = `${w}px`;
        h.style.setProperty("--fs", `${Math.max(22, (w / r) / (h._stitch.lines.length * 1.04))}px`);
        return;
      }
      const prev = h.style.getPropertyValue("--r");
      h.style.setProperty("--r", "1");
      h.style.setProperty("--fs", "100px");
      h.style.width = "max-content";
      const box = h.getBoundingClientRect();
      h.style.width = "";
      if (prev) h.style.setProperty("--r", prev); else h.style.removeProperty("--r");
      const tall = h.classList.contains("t-verh") ? 1.28 : 1;
      const s = Math.min(colW / Math.max(1, box.width), maxH / Math.max(1, box.height * tall));
      const cap = narrow() ? 150 : 210;
      h.style.setProperty("--fs", `${clamp(100 * s * 0.98, 26, cap).toFixed(1)}px`);
    });
    if (stage) stage.style.setProperty("--fit", "1");
  }

  /* ——— фильм ——— */
  const Film = (() => {
    const film = $("#film"), stage = $("#stage"), cam = $("#cam"), frame = $("#frame");
    const spine = $("#spine");
    const threads = $$(".threads i", stage);
    const nav = $("#top");
    if (!film || RM) return null;

    doc.classList.add("film-on");
    const chapters = $$(".ch", stage).map((el) => ({
      el,
      h: $(".t", el),
      len: parseFloat(el.dataset.len) || 1,
      aspect: parseFloat(el.dataset.aspect) || 0.8,
      bgL: hex(el.dataset.bg), bgD: hex(el.dataset.bgD || el.dataset.bg),
      inkL: hex(el.dataset.ink), inkD: hex(el.dataset.inkD || el.dataset.ink),
      acc: hex(el.dataset.acc),
      shots: JSON.parse(el.dataset.shots),
    }));

    // раскладываем главы и кадры по одной оси
    let total = 0;
    const shots = [];
    chapters.forEach((c, ci) => {
      c.a = total; c.b = total + c.len; total = c.b;
      const wsum = c.shots.reduce((s, sh) => s + (sh.w || (sh.d ? sh.d : 1)), 0);
      let acc = c.a;
      c.shots.forEach((sh, k) => {
        const span = (c.len * (sh.w || (sh.d ? sh.d : 1))) / wsum;
        const el = sh.v ? document.createElement("video") : document.createElement("img");
        el.className = "shot-el";
        if (sh.v) {
          el.muted = true; el.playsInline = true; el.preload = "none";
          el.setAttribute("muted", ""); el.setAttribute("playsinline", ""); el.setAttribute("webkit-playsinline", "");
          el.setAttribute("disablepictureinpicture", ""); el.setAttribute("disableremoteplayback", "");
          el.poster = `${sh.v}.jpg`;
        } else {
          el.src = sh.img; el.alt = ""; el.decoding = "async";
        }
        if (sh.o) el.style.transformOrigin = sh.o;
        cam.appendChild(el);
        shots.push({ ...sh, el, ci, a: acc, b: acc + span, first: ci === 0 && k === 0, loaded: !sh.v, primed: false, want: 0 });
        acc += span;
      });
    });
    shots[shots.length - 1].last = true;
    const X = 0.13; // полуширина кроссфейда в долях главы

    let unit = 0, filmTop = 0, filmH = 0, vh = innerHeight, vw = innerWidth;
    let p = 0, pT = 0, introR = 0, introStart = 0, active = false, fontsReady = false;

    function measure() {
      vw = innerWidth; vh = innerHeight;
      unit = vh * (narrow() ? 0.68 : 0.78);
      filmH = total * unit + vh;
      film.style.setProperty("--film-h", `${Math.round(filmH)}px`);
      filmTop = film.getBoundingClientRect().top + scrollY;
      stage.style.setProperty("--colw", `${Math.max(280, vw * 0.87 - frameSize(1)[0] - vw * 0.045).toFixed(0)}px`);
      threads.forEach((t, i) => t.style.setProperty("--k", i));
    }

    function frameSize(aspect) {
      if (narrow()) {
        const top = 66;
        const availH = vh * 0.5;
        let fw = Math.min(vw - 32, availH * aspect);
        let fh = fw / aspect;
        if (top + fh > vh * 0.6) { fh = vh * 0.6 - top; fw = fh * aspect; }
        return [fw, fh];
      }
      let fh = vh * 0.8;
      let fw = fh * aspect;
      if (fw > vw * 0.42) { fw = vw * 0.42; fh = fw / aspect; }
      return [fw, fh];
    }

    function loadShot(s) {
      if (s.loaded || !s.v) return;
      s.loaded = true;
      s.el.src = `${s.v}.mp4`;
      s.el.addEventListener("loadeddata", wake, { once: true });
      s.el.addEventListener("seeked", wake);
      try { s.el.load(); } catch (e) { /* ничего */ }
    }
    function prime(s) {
      // iOS показывает кадры после первого play(); сразу ставим на паузу
      if (s.primed || !s.v) return;
      s.primed = true;
      const pr = s.el.play();
      if (pr && pr.then) pr.then(() => s.el.pause()).catch(() => {});
    }

    function update(now, dt) {
      if (!active) return false;
      const y = scrollY;
      pT = clamp((y - filmTop) / Math.max(1, filmH - vh), 0, 1) * total;
      const k = 1 - Math.exp(-dt * 7.5);
      p += (pT - p) * k;
      if (Math.abs(pT - p) < 0.0004) p = pT;

      // интро первой главы: надпись встаёт сама, потом ею управляет скролл
      if (fontsReady && introR < 1) {
        if (!introStart) introStart = now;
        introR = clamp((now - introStart) / 1900, 0, 1);
      }

      // текущая глава и ближайшая граница
      let ci = 0;
      for (let i = 0; i < chapters.length; i++) if (p >= chapters[i].a) ci = i;
      const c = chapters[ci];
      const dark = isDark();

      // цвет сцены: смыв в цвет материала на границе глав
      let bIdx = ci, bPos = c.b;
      if (ci > 0 && p - c.a < c.b - p) { bIdx = ci - 1; bPos = c.a; }
      const from = chapters[bIdx], to = chapters[Math.min(bIdx + 1, chapters.length - 1)];
      const t = from === to ? 0 : smooth(bPos - 0.16, bPos + 0.16, p);
      const bg = mix(dark ? from.bgD : from.bgL, dark ? to.bgD : to.bgL, t);
      const ink = mix(dark ? from.inkD : from.inkL, dark ? to.inkD : to.inkL, t);
      const accC = mix(from.acc, to.acc, t);
      const aspect = lerp(from.aspect, to.aspect, t);
      const b = from === to ? 0 : bell(p - bPos, 0.09);
      stage.style.setProperty("--sbg", rgb(bg));
      stage.style.setProperty("--sink", rgb(ink));
      stage.style.setProperty("--acc", rgb(accC));
      stage.style.setProperty("--wash", rgb(to.acc));
      stage.style.setProperty("--wo", (b * 0.7).toFixed(3));
      stage.style.setProperty("--ws", (0.7 + b * 0.55).toFixed(3));

      const [fw, fh] = frameSize(aspect);
      frame.style.setProperty("--fw", `${fw.toFixed(1)}px`);
      frame.style.setProperty("--fh", `${fh.toFixed(1)}px`);
      const sway = (p - bPos) * 60 * b;
      frame.style.setProperty("--fx", `${(narrow() ? sway * 0.3 : sway * 1.2).toFixed(1)}px`);
      frame.style.setProperty("--fy", `${(b * -6).toFixed(1)}px`);
      if (!narrow()) {
        stage.style.setProperty("--wx", `${(100 - (7 + (fw / vw) * 50)).toFixed(1)}%`);
        stage.style.setProperty("--wy", "50%");
      } else {
        stage.style.setProperty("--wx", "50%");
        stage.style.setProperty("--wy", `${((66 + fh / 2) / vh * 100).toFixed(1)}%`);
      }

      // нитки-линии сетки прошиваются на смене главы
      threads.forEach((th, i) => {
        const q0 = smooth(bPos - 0.22 + i * 0.025, bPos + 0.02 + i * 0.025, p);
        const q1 = smooth(bPos + 0.02 + i * 0.025, bPos + 0.26 + i * 0.025, p);
        th.style.setProperty("--t0", `${(q1 * 100).toFixed(1)}%`);
        th.style.setProperty("--t1", `${((1 - q0) * 100).toFixed(1)}%`);
      });

      // кадры
      let pending = false;
      for (const s of shots) {
        const span = s.b - s.a;
        const x = X * chapters[s.ci].len;
        const fin = s.first ? 1 : smooth(s.a - x, s.a + x, p);
        const fout = s.last ? 1 : 1 - smooth(s.b - x, s.b + x, p);
        const o = fin * fout;
        const near = p > s.a - 1.4 && p < s.b + 0.6;
        if (near) loadShot(s);
        if (o <= 0.002) {
          if (s.vis) { s.el.style.opacity = "0"; s.vis = false; }
          continue;
        }
        s.vis = true;
        const lt = clamp((p - (s.a - x)) / (span + 2 * x), 0, 1);
        const z = s.z ? lerp(s.z[0], s.z[1], easeOut(lt)) : 1;
        const shiftIn = (1 - fin) * 4, shiftOut = (1 - fout) * -4;
        s.el.style.opacity = o.toFixed(3);
        s.el.style.transform = `translate3d(${(shiftIn + shiftOut).toFixed(2)}%,0,0) scale(${(z * (1 + (1 - fout) * 0.03)).toFixed(4)})`;
        if (s.v && s.el.readyState >= 1) {
          prime(s);
          const d = s.el.duration && isFinite(s.el.duration) ? s.el.duration : s.d;
          const target = clamp(lt * (d - 0.06), 0, d - 0.04);
          if (!s.el.seeking && Math.abs(s.el.currentTime - target) > 0.018) {
            try { s.el.currentTime = target; } catch (e) { /* ещё не готово */ }
          }
          if (Math.abs(s.el.currentTime - target) > 0.03) pending = true;
        }
      }

      // главы: надпись встаёт, фраза проявляется, на выходе растворяется
      chapters.forEach((ch, i) => {
        const u = (p - ch.a) / ch.len;
        let r = smooth(-0.02, 0.34, u);
        if (i === 0) r = Math.min(1, Math.max(r, introR));
        const xo = i === chapters.length - 1 ? smooth(1.05, 1.3, u) : smooth(0.8, 1.0, u);
        const live = r > 0.001 && xo < 0.999 && u > -0.2 && u < 1.2;
        if (live !== ch.live) { ch.el.classList.toggle("live", live); ch.live = live; }
        if (!live) return;
        ch.el.style.setProperty("--r", r.toFixed(3));
        ch.h.style.setProperty("--r", r.toFixed(3));
        ch.h.style.setProperty("--r2", clamp((r - 0.45) / 0.55, 0, 1).toFixed(3));
        ch.el.style.opacity = (1 - xo).toFixed(3);
        ch.el.style.transform = xo > 0 ? `translate3d(0,${(-xo * 3).toFixed(2)}vh,0)` : "";
        ch.el.style.filter = xo > 0.01 && !narrow() ? `blur(${(xo * 6).toFixed(1)}px)` : "";
      });

      spine && spine.style.setProperty("--sp", (p / total).toFixed(4));
      // панель сверху подстраивается под цвет сцены
      const inView = y < filmTop + filmH - vh * 0.5;
      nav.style.setProperty("--nav-ink", inView ? rgb(ink) : "");
      nav.style.setProperty("--nav-bg", inView ? rgb(bg) : "");

      return p !== pT || pending || (fontsReady && introR < 1);
    }

    measure();
    tasks.add(update);
    const io = new IntersectionObserver(([e]) => { active = e.isIntersecting; if (active) wake(); else nav.style.removeProperty("--nav-ink"), nav.style.removeProperty("--nav-bg"); }, { rootMargin: "20% 0px" });
    io.observe(film);
    addEventListener("scroll", wake, { passive: true });
    let lastW = innerWidth, lastH = innerHeight;
    addEventListener("resize", () => {
      // адресная строка на телефоне меняет высоту на пару десятков пикселей — не пересчитываем фильм из-за этого
      if (innerWidth !== lastW || Math.abs(innerHeight - lastH) > 120) { lastW = innerWidth; lastH = innerHeight; measure(); fitHeads(); }
      wake();
    });
    addEventListener("kiyaeva:theme", wake);
    loadShot(shots[1]);
    return {
      fontsReady() { fontsReady = true; wake(); },
      measure,
    };
  })();

  if (!Film) {
    // меньше движения или нет сцены: главы по очереди, в каждой короткий фрагмент ролика по нажатию
    $$(".ch").forEach((ch) => {
      const shots = JSON.parse(ch.dataset.shots || "[]");
      const v = shots.find((s) => s.v);
      const fig = $(".ch-media", ch);
      // первая глава начинается с вышивки крупно, а не с лица: её кадр оставляем как есть
      if (!v || !fig || !shots[0].v) return;
      fig.style.position = "relative";
      const vid = document.createElement("video");
      vid.muted = true; vid.playsInline = true; vid.loop = true; vid.preload = "none";
      vid.setAttribute("muted", ""); vid.setAttribute("playsinline", "");
      vid.poster = `${v.v}.jpg`;
      vid.setAttribute("aria-label", "Короткий фрагмент, нажмите для просмотра");
      vid.style.cssText = "width:100%;height:auto;border-radius:28px;cursor:pointer";
      vid.addEventListener("click", () => { if (!vid.src) vid.src = `${v.v}.mp4`; vid.paused ? vid.play().catch(() => {}) : vid.pause(); });
      fig.replaceChildren(vid);
    });
  }

  /* ——— Примерка: скролл крутит дубли, сцена входит из темноты и растворяется в «Крупно» ——— */
  (() => {
    const sec = $("#try");
    if (!sec) return;
    const stage = $(".try-stage", sec), media = $(".try-media", sec), vid = $(".try-v", sec);
    const pick = () => (innerWidth / innerHeight < 0.8 ? "film/na-ney-v" : "film/na-ney");
    let file = "";
    vid.muted = true; vid.playsInline = true;
    vid.addEventListener("loadeddata", () => { vid.classList.add("ready"); wake(); });
    vid.addEventListener("seeked", wake);
    function load() {
      const f = pick();
      if (f === file) return;
      file = f;
      vid.classList.remove("ready");
      vid.poster = `${f}.jpg`;
      vid.preload = "auto";
      vid.src = `${f}.mp4`;
      try { vid.load(); } catch (e) { /* ничего */ }
    }
    // ролики не трогаем, пока секция далеко
    new IntersectionObserver(([e]) => { if (e.isIntersecting) load(); }, { rootMargin: "120% 0px" }).observe(sec);

    if (RM) {
      // меньше движения: без скраба, короткий показ один раз, по нажатию ещё раз
      new IntersectionObserver(([e]) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.5) {
          load();
          if (!vid.dataset.played) { vid.dataset.played = "1"; const pr = vid.play(); pr && pr.catch && pr.catch(() => {}); }
        } else vid.pause();
      }, { threshold: [0, 0.5] }).observe(sec);
      stage.addEventListener("click", () => { load(); vid.currentTime = 0; const pr = vid.play(); pr && pr.catch && pr.catch(() => {}); });
      return;
    }

    doc.classList.add("try-on");
    let vh = innerHeight, pS = 0, primed = false, active = false;
    function measure() {
      vh = innerHeight;
      sec.style.setProperty("--try-h", `${Math.round(vh * (narrow() ? 5.4 : 6.4) + vh)}px`);
    }
    function update(now, dt) {
      if (!active) return false;
      const r = sec.getBoundingClientRect();
      const pT = clamp(-r.top / Math.max(1, r.height - vh), 0, 1);
      pS += (pT - pS) * (1 - Math.exp(-dt * 8));
      if (Math.abs(pT - pS) < 0.0003) pS = pT;
      const p = pS;
      stage.style.setProperty("--tin", (1 - smooth(0, 0.08, p)).toFixed(3));
      stage.style.setProperty("--tout", smooth(0.87, 0.99, p).toFixed(3));
      stage.style.setProperty("--tk", (smooth(0.03, 0.1, p) * (1 - smooth(0.82, 0.9, p))).toFixed(3));
      stage.style.setProperty("--tl", smooth(0.12, 0.26, p).toFixed(3));
      stage.style.setProperty("--tlo", (1 - smooth(0.48, 0.56, p)).toFixed(3));
      media.style.setProperty("--tz", (1.07 - 0.07 * p).toFixed(4));
      media.style.setProperty("--tyy", `${(-1.2 * p).toFixed(2)}%`);
      let pending = false;
      if (vid.readyState >= 1) {
        if (!primed) { primed = true; const pr = vid.play(); if (pr && pr.then) pr.then(() => vid.pause()).catch(() => {}); }
        const d = isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 12.4;
        const target = clamp((p - 0.06) / 0.8, 0, 1) * (d - 0.06);
        if (!vid.seeking && Math.abs(vid.currentTime - target) > 0.02) { try { vid.currentTime = target; } catch (e) { /* ещё не готово */ } }
        if (Math.abs(vid.currentTime - target) > 0.03) pending = true;
      }
      return pS !== pT || pending;
    }
    measure();
    tasks.add(update);
    new IntersectionObserver(([e]) => { active = e.isIntersecting; if (active) wake(); }, { rootMargin: "10% 0px" }).observe(sec);
    addEventListener("scroll", wake, { passive: true });
    let lastW = innerWidth, lastH = innerHeight;
    addEventListener("resize", () => {
      if (innerWidth !== lastW || Math.abs(innerHeight - lastH) > 120) { lastW = innerWidth; lastH = innerHeight; measure(); if (file) load(); }
      wake();
    });
  })();

  /* ——— Крупно: кадры вылетают по скроллу, наклоняются от курсора ——— */
  (() => {
    const cards = $$(".shot");
    if (!cards.length) return;
    const state = cards.map((el) => ({ el, media: $(".media", el), v: $("video", el), from: el.dataset.from || "bottom", tx: 0, ty: 0, hx: 0, hy: 0, near: false }));
    const lazy = new IntersectionObserver((es) => es.forEach((e) => {
      const s = state.find((x) => x.el === e.target);
      if (!s) return;
      s.near = e.isIntersecting;
      if (e.isIntersecting && s.v && !s.v.src && s.v.dataset.src) { s.v.src = s.v.dataset.src; }
      if (e.isIntersecting) wake();
    }), { rootMargin: "60% 0px" });
    const play = new IntersectionObserver((es) => es.forEach((e) => {
      const v = $("video", e.target);
      if (!v || RM) return;
      if (e.isIntersecting && e.intersectionRatio > 0.3) { if (!v.src && v.dataset.src) v.src = v.dataset.src; const pr = v.play(); pr && pr.catch && pr.catch(() => {}); }
      else v.pause();
    }), { threshold: [0, 0.3, 0.6] });
    state.forEach((s) => { lazy.observe(s.el); play.observe(s.el); });

    if (RM) {
      state.forEach((s) => s.v && s.v.addEventListener("click", () => { if (!s.v.src) s.v.src = s.v.dataset.src; s.v.paused ? s.v.play().catch(() => {}) : s.v.pause(); }));
      return;
    }

    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (fine) state.forEach((s) => {
      s.media.addEventListener("pointermove", (e) => {
        const r = s.media.getBoundingClientRect();
        s.hx = (e.clientX - r.left) / r.width - 0.5;
        s.hy = (e.clientY - r.top) / r.height - 0.5;
        s.media.style.setProperty("--go", "1");
        s.media.style.setProperty("--gx", s.hx.toFixed(3));
        wake();
      });
      s.media.addEventListener("pointerleave", () => { s.hx = 0; s.hy = 0; s.media.style.setProperty("--go", "0"); wake(); });
    });

    let running = false;
    function update(now, dt) {
      const vh = innerHeight, vw = innerWidth;
      let again = false;
      const k = 1 - Math.exp(-dt * 8);
      for (const s of state) {
        if (!s.near) continue;
        const r = s.el.getBoundingClientRect();
        if (r.bottom < -vh * 0.3 || r.top > vh * 1.3) continue;
        const e = easeOut(clamp((vh - r.top) / (vh * 0.62), 0, 1));
        const c = (r.top + r.height / 2 - vh / 2) / vh;
        let x = 0, y = 0, rot = 0;
        const m = 1 - e;
        if (s.from === "left") { x = -m * vw * 0.36; rot = -m * 7; }
        else if (s.from === "right") { x = m * vw * 0.36; rot = m * 7; }
        else { y = m * vh * 0.32; rot = m * 3; }
        const big = s.el.classList.contains("sz-xl") || s.el.classList.contains("sz-l");
        y += c * (big ? -26 : -52);
        s.tx += (s.hx - s.tx) * k; s.ty += (s.hy - s.ty) * k;
        if (Math.abs(s.hx - s.tx) > 0.002 || Math.abs(s.hy - s.ty) > 0.002) again = true;
        const rx = -s.ty * 7 + c * 5, ry = s.tx * 9;
        const sc = 0.86 + 0.14 * e;
        s.el.style.opacity = clamp(e * 1.7, 0, 1).toFixed(3);
        s.el.style.transform = `perspective(1300px) translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${rot.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${sc.toFixed(4)})`;
      }
      return again;
    }
    tasks.add(update);
    addEventListener("scroll", wake, { passive: true });
    wake();
  })();

  /* ——— финал: ролик с лентой ——— */
  (() => {
    const v = $(".end video");
    if (!v) return;
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { if (!v.src) v.src = v.dataset.src; if (!RM) { const pr = v.play(); pr && pr.catch && pr.catch(() => {}); } }
      else v.pause();
    }, { threshold: 0.25, rootMargin: "20% 0px" }).observe(v);
    if (RM) v.addEventListener("click", () => { if (!v.src) v.src = v.dataset.src; v.paused ? v.play().catch(() => {}) : v.pause(); });
  })();

  /* ——— Гардероб ——— */
  (() => {
    const rack = $("#rack"), view = $("#rack-view"), row = $("#row"), canvas = $("#cloth");
    if (!rack || !row) return;
    const items = $$(".hang", row);
    const hookSVG = `<svg class="hanger" viewBox="0 0 80 84" aria-hidden="true"><defs><linearGradient id="hk" x1="0" x2="1"><stop offset="0" stop-color="#7c7b77"/><stop offset=".42" stop-color="#f6f5f1"/><stop offset=".62" stop-color="#c9c8c3"/><stop offset="1" stop-color="#5f5e5a"/></linearGradient></defs><path d="M40 82V63c0-8 7.5-13 7.5-32.5a7.5 7.5 0 1 0-15 0c0 3.2 1.4 5.2 3.2 6.2" fill="none" stroke="url(#hk)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="40" cy="80.5" r="3.2" fill="#5a4636"/></svg>`;
    items.forEach((li, k) => {
      li.style.setProperty("--k", k);
      const fig = $("figure", li);
      fig.insertAdjacentHTML("afterbegin", hookSVG);
      const shirt = $(".shirt", li);
      ["z-sl", "z-sr", "z-bl", "z-br", "z-hm"].forEach((z) => { const s = document.createElement("span"); s.className = `z ${z}`; s.setAttribute("aria-hidden", "true"); shirt.appendChild(s); });
    });

    // листание рейки
    const track = $("#track");
    function syncTrack() {
      const max = row.scrollWidth - row.clientWidth;
      const w = row.clientWidth / Math.max(row.scrollWidth, 1);
      track.style.setProperty("--tw", `${(w * 100).toFixed(2)}%`);
      track.style.setProperty("--tx", `${max > 0 ? ((row.scrollLeft / max) * (1 / w - 1) * 100).toFixed(2) : 0}%`);
    }
    row.addEventListener("scroll", () => { syncTrack(); wake(); }, { passive: true });
    addEventListener("resize", syncTrack);
    syncTrack();
    const step = () => (items[0].getBoundingClientRect().width + parseFloat(getComputedStyle(row).columnGap || 30)) * (narrow() ? 1 : 2);
    $("#prev").addEventListener("click", () => row.scrollBy({ left: -step(), behavior: RM ? "auto" : "smooth" }));
    $("#next").addEventListener("click", () => row.scrollBy({ left: step(), behavior: RM ? "auto" : "smooth" }));
    // мышью можно тянуть сам ряд, если схватить не за футболку
    let drag = null;
    row.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0 || e.target.closest(".shirt")) return;
      drag = { x: e.clientX, s: row.scrollLeft };
      row.setPointerCapture(e.pointerId);
    });
    row.addEventListener("pointermove", (e) => { if (drag) row.scrollLeft = drag.s - (e.clientX - drag.x); });
    const endDrag = () => { drag = null; };
    row.addEventListener("pointerup", endDrag); row.addEventListener("pointercancel", endDrag);

    // появление: вешалки выезжают по одной
    const sims = [];
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !rack.classList.contains("in")) {
        rack.classList.add("in");
        const t0 = performance.now();
        sims.forEach((s, k) => { s.theta = RM ? 0 : 0.085; s.thetaV = 0; s.arrive = t0 + k * 95; });
        wake();
      }
    }, { threshold: 0.12 }).observe(rack);

    // ——— ткань: сетка частиц, привязанная к плечикам ———
    const NX = 13, NY = 16;
    const gl = (() => {
      try {
        const o = { alpha: true, premultipliedAlpha: true, antialias: true };
        return canvas.getContext("webgl2", o) || canvas.getContext("webgl", o) || canvas.getContext("experimental-webgl", o);
      } catch (e) { return null; }
    })();
    const ctx2d = gl ? null : canvas.getContext("2d");
    if (!gl && !ctx2d) return;
    rack.classList.add("gl");

    function inside(u, v) {
      // грубый силуэт висящей футболки в долях текстуры (совпадает с генератором)
      if (v < 0.03 || v > 0.975) return false;
      const x = Math.abs(u - 0.5);
      if (v < 0.1) return x < 0.12 + (v - 0.03) * 3.8;
      if (v < 0.45) {
        const sleeveOut = 0.5 - lerp(0.15, 0.05, (v - 0.1) / 0.32);
        const body = 0.5 - 0.248;
        if (v < 0.32) return x < Math.max(sleeveOut, body);
        return x < body || (x < sleeveOut && x > body && v < 0.44 - (x - body) * 0.3);
      }
      return x < 0.5 - 0.24;
    }

    function makeSim(li, k) {
      const shirt = $(".shirt", li), img = $("img", shirt), hanger = $(".hanger", li);
      const n = NX * NY;
      const rest = new Float32Array(n * 2), pos = new Float32Array(n * 2), prev = new Float32Array(n * 2);
      const uv = new Float32Array(n * 2), pin = new Uint8Array(n), kr = new Float32Array(n), ins = new Uint8Array(n), shade = new Float32Array(n);
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const id = j * NX + i, u = i / (NX - 1), v = j / (NY - 1);
        uv[id * 2] = u; uv[id * 2 + 1] = v;
        ins[id] = inside(u, v) ? 1 : 0;
        pin[id] = v <= 0.075 && u > 0.2 && u < 0.8 ? 1 : 0;
        // полотно держит форму, рукава и подол свободнее; у плеч крепче всего
        const bodyZone = Math.abs(u - 0.5) < 0.24;
        const sleeveZone = !bodyZone && v < 0.47;
        kr[id] = pin[id] ? 1 : 0.01 + 0.18 * (1 - smooth(0.06, 0.4, v)) + (bodyZone ? 0.055 * (1 - smooth(0.55, 1, v)) + 0.02 : 0) + (sleeveZone ? 0.006 : 0);
      }
      const edges = [];
      const E = (a, b) => edges.push(a, b);
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const id = j * NX + i;
        if (i < NX - 1) E(id, id + 1);
        if (j < NY - 1) E(id, id + NX);
        if (i < NX - 1 && j < NY - 1) { E(id, id + NX + 1); E(id + 1, id + NX); }
      }
      const edgeArr = new Uint16Array(edges);
      const restLen = new Float32Array(edges.length / 2);
      return {
        li, shirt, img, hanger, k, rest, pos, prev, uv, pin, kr, ins, shade, edgeArr, restLen,
        w: 0, h: 0, x: 0, y: 0, ready: false, tex: null, image: null,
        theta: 0, thetaV: 0, thetaT: 0, arrive: 0, seed: k * 1.7 + 0.3,
        grab: null, vis: false, sleep: 0,
      };
    }
    items.forEach((li, k) => sims.push(makeSim(li, k)));

    function layoutSim(s, w, h) {
      if (Math.abs(s.w - w) < 0.5 && Math.abs(s.h - h) < 0.5) return;
      s.w = w; s.h = h;
      for (let id = 0; id < NX * NY; id++) {
        const x = s.uv[id * 2] * w, y = s.uv[id * 2 + 1] * h;
        s.rest[id * 2] = x; s.rest[id * 2 + 1] = y;
        s.pos[id * 2] = x; s.pos[id * 2 + 1] = y;
        s.prev[id * 2] = x; s.prev[id * 2 + 1] = y;
      }
      for (let e = 0; e < s.edgeArr.length; e += 2) {
        const a = s.edgeArr[e], b = s.edgeArr[e + 1];
        s.restLen[e / 2] = Math.hypot(s.rest[a * 2] - s.rest[b * 2], s.rest[a * 2 + 1] - s.rest[b * 2 + 1]);
      }
    }

    // хват: пальцем только за рукав/бок/подол, мышью — за любое место футболки
    sims.forEach((s) => {
      const down = (e) => {
        if (e.pointerType === "touch" && !(e.target.classList && e.target.classList.contains("z"))) return;
        if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
        if (!s.w) return;
        const r = s.shirt.getBoundingClientRect();
        const lx = e.clientX - r.left, ly = e.clientY - r.top;
        let best = -1, bd = 1e9;
        for (let id = 0; id < NX * NY; id++) {
          if (s.pin[id] || !s.ins[id]) continue;
          const d = (s.pos[id * 2] - lx) ** 2 + (s.pos[id * 2 + 1] - ly) ** 2;
          if (d < bd) { bd = d; best = id; }
        }
        if (best < 0) return;
        e.preventDefault();
        const sig = s.w * 0.095;
        const wts = new Float32Array(NX * NY);
        const gx = s.rest[best * 2], gy = s.rest[best * 2 + 1];
        for (let id = 0; id < NX * NY; id++) {
          if (s.pin[id]) continue;
          const d2 = (s.rest[id * 2] - gx) ** 2 + (s.rest[id * 2 + 1] - gy) ** 2;
          wts[id] = Math.exp(-d2 / (2 * sig * sig));
        }
        s.grab = { id: best, wts, ox: lx - s.pos[best * 2], oy: ly - s.pos[best * 2 + 1], px: lx, py: ly, rx: gx, ry: gy };
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* старые браузеры */ }
        rack.classList.add("touched");
        s.sleep = 0;
        wake();
      };
      const move = (e) => {
        if (!s.grab) return;
        const r = s.shirt.getBoundingClientRect();
        s.grab.px = e.clientX - r.left; s.grab.py = e.clientY - r.top;
        wake();
      };
      const up = () => { if (s.grab) { s.thetaV += clamp((s.grab.px - s.grab.rx) / s.w, -0.4, 0.4) * -0.35; } s.grab = null; wake(); };
      s.shirt.addEventListener("pointerdown", down);
      s.shirt.addEventListener("pointermove", move);
      s.shirt.addEventListener("pointerup", up);
      s.shirt.addEventListener("pointercancel", up);
      s.shirt.addEventListener("lostpointercapture", up);
    });

    function stepSim(s, t, dt) {
      const n = NX * NY;
      const { pos, prev, rest, kr, pin, edgeArr, restLen, shade } = s;
      // маятник плечиков
      const arriving = s.arrive && t < s.arrive + 1400;
      const breeze = RM ? 0 : 0.0045 * Math.sin(t * 0.00055 + s.seed) + 0.0022 * Math.sin(t * 0.0013 + s.seed * 2.1);
      const target = breeze + (s.grab ? clamp((s.grab.px - s.grab.rx) / s.w, -0.5, 0.5) * 0.06 : 0);
      const kS = RM ? 60 : 28, cS = RM ? 14 : 3.2;
      s.thetaV += ((target - s.theta) * kS - s.thetaV * cS) * dt;
      s.theta += s.thetaV * dt;
      const th = s.theta, cs = Math.cos(th), sn = Math.sin(th);
      const px = s.w * 0.5, py = -35;
      const damp = RM ? 0.78 : 0.94;
      const g = s.grab;
      let pull = 0, pullX = 0, pullY = 0;
      if (g) {
        pullX = g.px - g.ox - g.rx; pullY = g.py - g.oy - g.ry;
        const L = Math.hypot(pullX, pullY), max = s.w * 0.32;
        if (L > max) { const f = (max + (L - max) * 0.22) / L; pullX *= f; pullY *= f; }
        pull = 1;
      }
      const tt = t * 0.001;
      for (let id = 0; id < n; id++) {
        const i2 = id * 2;
        // точка покоя с учётом поворота плечиков
        const rx = rest[i2] - px, ry = rest[i2 + 1] - py;
        const wx = px + rx * cs - ry * sn, wy = py + rx * sn + ry * cs;
        if (pin[id]) { pos[i2] = prev[i2] = wx; pos[i2 + 1] = prev[i2 + 1] = wy; continue; }
        const vx = (pos[i2] - prev[i2]) * damp, vy = (pos[i2 + 1] - prev[i2 + 1]) * damp;
        prev[i2] = pos[i2]; prev[i2 + 1] = pos[i2 + 1];
        const v = s.uv[i2 + 1], u = s.uv[i2];
        const air = RM ? 0 : (Math.sin(tt * 0.9 + v * 3.1 + s.seed) * 0.6 + Math.sin(tt * 1.7 + u * 5 + s.seed * 1.3) * 0.4) * 0.028 * Math.pow(v, 1.5) * s.w * dt;
        pos[i2] += vx + air;
        pos[i2 + 1] += vy + 0.0009 * s.h * v * dt * 60 * 0.1;
        // возврат к форме
        const kk = kr[id];
        pos[i2] += (wx - pos[i2]) * kk;
        pos[i2 + 1] += (wy - pos[i2 + 1]) * kk;
        if (pull) {
          const w = g.wts[id];
          if (w > 0.002) {
            const tx = wx + pullX, ty = wy + pullY;
            pos[i2] += (tx - pos[i2]) * w * 0.6;
            pos[i2 + 1] += (ty - pos[i2 + 1]) * w * 0.6;
          }
        }
      }
      // ткань почти не тянется, но может собираться в складку
      for (let it = 0; it < 3; it++) {
        for (let e = 0; e < edgeArr.length; e += 2) {
          const a = edgeArr[e], b = edgeArr[e + 1];
          const ax = pos[a * 2], ay = pos[a * 2 + 1], bx = pos[b * 2], by = pos[b * 2 + 1];
          const dx = bx - ax, dy = by - ay;
          const d = Math.hypot(dx, dy) || 1e-4, L = restLen[e / 2];
          let diff = 0;
          if (d > L * 1.03) diff = (d - L * 1.03) / d;
          else if (d < L * 0.55) diff = (d - L * 0.55) / d;
          else continue;
          const pa = pin[a] ? 0 : 1, pb = pin[b] ? 0 : 1, sum = pa + pb;
          if (!sum) continue;
          const f = (diff * 0.9) / sum;
          pos[a * 2] += dx * f * pa; pos[a * 2 + 1] += dy * f * pa;
          pos[b * 2] -= dx * f * pb; pos[b * 2 + 1] -= dy * f * pb;
        }
      }
      // свет: где ткань сжалась — тень, где растянулась и повернулась к окну — светлее
      let motion = 0;
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const id = j * NX + i, i2 = id * 2;
        const L = i > 0 ? id - 1 : id, R = i < NX - 1 ? id + 1 : id, U = j > 0 ? id - NX : id;
        const rw = (s.rest[R * 2] - s.rest[L * 2]) || 1;
        const cw = pos[R * 2] - pos[L * 2];
        const comp = cw / rw - 1;
        const tilt = ((pos[i2] - rest[i2]) - (pos[U * 2] - rest[U * 2])) / (s.h / NY);
        const sh = 1 + clamp(comp, -0.6, 0.4) * 0.55 - clamp(tilt, -1, 1) * 0.16;
        shade[id] += (clamp(sh, 0.72, 1.16) - shade[id]) * 0.5;
        motion += Math.abs(pos[i2] - prev[i2]) + Math.abs(pos[i2 + 1] - prev[i2 + 1]);
      }
      if (s.hanger) s.hanger.style.transform = `rotate(${(th * 57.2958).toFixed(3)}deg)`;
      return motion > 0.02 || Math.abs(s.thetaV) > 0.001 || !!g || arriving;
    }

    // ——— отрисовка ———
    let prog = null, buf = null, ibuf = null, idxCount = 0, isGL2 = false;
    function initGL() {
      isGL2 = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
      const vs = `attribute vec2 p;attribute vec2 t;attribute float s;uniform vec2 V;uniform vec2 O;varying vec2 vt;varying float vs;
        void main(){vec2 q=(p+O)/V*2.0-1.0;gl_Position=vec4(q.x,-q.y,0.0,1.0);vt=t;vs=s;}`;
      const fs = `precision mediump float;varying vec2 vt;varying float vs;uniform sampler2D T;uniform float M;uniform float A;
        void main(){vec4 c=texture2D(T,vt);if(M>0.5){gl_FragColor=vec4(0.0,0.0,0.0,c.a*A);}else{gl_FragColor=vec4(c.rgb*vs,c.a);}}`;
      const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; };
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("cloth shader");
      gl.useProgram(prog);
      buf = gl.createBuffer(); ibuf = gl.createBuffer();
      const idx = [];
      for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
        const a = j * NX + i, b = a + 1, c = a + NX, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      idxCount = idx.length;
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      const stride = 20;
      const lp = gl.getAttribLocation(prog, "p"), lt = gl.getAttribLocation(prog, "t"), ls = gl.getAttribLocation(prog, "s");
      gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(lt); gl.vertexAttribPointer(lt, 2, gl.FLOAT, false, stride, 8);
      gl.enableVertexAttribArray(ls); gl.vertexAttribPointer(ls, 1, gl.FLOAT, false, stride, 16);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    }
    let glOK = !!gl;
    if (gl) { try { initGL(); } catch (e) { glOK = false; } }
    if (!glOK && !ctx2d) { rack.classList.remove("gl"); return; }

    function loadTex(s) {
      if (s.loading) return;
      s.loading = true;
      const im = new Image();
      im.decoding = "async";
      im.src = s.img.currentSrc || s.img.src;
      const done = () => {
        s.image = im;
        if (glOK) {
          let src = im;
          if (!isGL2) {
            const c = document.createElement("canvas"); c.width = 512; c.height = 512;
            c.getContext("2d").drawImage(im, 0, 0, 512, 512); src = c;
          }
          s.tex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, s.tex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.generateMipmap(gl.TEXTURE_2D);
        } else {
          // тень для 2D-режима рисуем один раз
          const c = document.createElement("canvas"); c.width = 150; c.height = 180;
          const cx = c.getContext("2d"); cx.filter = "blur(5px) brightness(0)"; cx.globalAlpha = 0.32; cx.drawImage(im, 8, 8, 134, 164);
          s.shadow = c;
        }
        s.ready = true;
        wake();
      };
      if (im.decode) im.decode().then(done, () => { im.onload = done; }); else im.onload = done;
    }

    const data = new Float32Array(NX * NY * 5);
    let dpr = 1, cw = 0, ch = 0;
    function sizeCanvas() {
      const r = view.getBoundingClientRect();
      dpr = Math.min(devicePixelRatio || 1, 2);
      cw = r.width; ch = r.height;
      canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
      canvas.style.width = `${cw}px`; canvas.style.height = `${ch}px`;
      if (glOK) gl.viewport(0, 0, canvas.width, canvas.height);
    }
    sizeCanvas();
    addEventListener("resize", () => { sizeCanvas(); wake(); });

    function fill(s, ox, oy, shadeOn) {
      for (let id = 0; id < NX * NY; id++) {
        const o = id * 5;
        data[o] = s.pos[id * 2] + ox; data[o + 1] = s.pos[id * 2 + 1] + oy;
        data[o + 2] = s.uv[id * 2]; data[o + 3] = s.uv[id * 2 + 1];
        data[o + 4] = shadeOn ? s.shade[id] : 1;
      }
    }

    function drawGL(list) {
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      const uV = gl.getUniformLocation(prog, "V"), uO = gl.getUniformLocation(prog, "O"), uM = gl.getUniformLocation(prog, "M"), uA = gl.getUniformLocation(prog, "A");
      gl.uniform2f(uV, cw, ch);
      for (const s of list) {
        gl.bindTexture(gl.TEXTURE_2D, s.tex);
        // тень на стене: сдвиг вправо-вниз, мягкий край из нескольких проходов
        gl.uniform1f(uM, 1);
        const sx = s.w * 0.035, sy = s.w * 0.06;
        const passes = [[0, 0, 0.1], [3, 3, 0.07], [-3, 4, 0.06], [4, -2, 0.05], [6, 7, 0.05]];
        for (const [dx, dy, a] of passes) {
          fill(s, s.x + sx + dx, s.y + sy + dy, false);
          gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
          gl.uniform1f(uA, a); gl.uniform2f(uO, 0, 0);
          gl.drawElements(gl.TRIANGLES, idxCount, gl.UNSIGNED_SHORT, 0);
        }
        gl.uniform1f(uM, 0);
        fill(s, s.x, s.y, true);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
        gl.drawElements(gl.TRIANGLES, idxCount, gl.UNSIGNED_SHORT, 0);
      }
    }

    function tri2d(c, im, x0, y0, x1, y1, x2, y2, u0, v0, u1, v1, u2, v2) {
      // аффинное отображение треугольника текстуры
      c.save();
      c.beginPath();
      const cx = (x0 + x1 + x2) / 3, cy = (y0 + y1 + y2) / 3, g = 1.02;
      c.moveTo(cx + (x0 - cx) * g, cy + (y0 - cy) * g); c.lineTo(cx + (x1 - cx) * g, cy + (y1 - cy) * g); c.lineTo(cx + (x2 - cx) * g, cy + (y2 - cy) * g);
      c.closePath(); c.clip();
      const d = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1);
      if (Math.abs(d) < 1e-6) { c.restore(); return; }
      const a = (x0 * (v1 - v2) + x1 * (v2 - v0) + x2 * (v0 - v1)) / d;
      const b = (y0 * (v1 - v2) + y1 * (v2 - v0) + y2 * (v0 - v1)) / d;
      const cc = (x0 * (u2 - u1) + x1 * (u0 - u2) + x2 * (u1 - u0)) / d;
      const dd = (y0 * (u2 - u1) + y1 * (u0 - u2) + y2 * (u1 - u0)) / d;
      const e = (x0 * (u1 * v2 - u2 * v1) + x1 * (u2 * v0 - u0 * v2) + x2 * (u0 * v1 - u1 * v0)) / d;
      const f = (y0 * (u1 * v2 - u2 * v1) + y1 * (u2 * v0 - u0 * v2) + y2 * (u0 * v1 - u1 * v0)) / d;
      c.transform(a, b, cc, dd, e, f);
      c.drawImage(im, 0, 0, 1, 1);
      c.restore();
    }
    function draw2d(list) {
      const c = ctx2d;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, cw, ch);
      for (const s of list) {
        if (s.shadow) c.drawImage(s.shadow, s.x + s.w * 0.035 - s.w * 0.05, s.y + s.w * 0.06 - s.h * 0.04, s.w * 1.1, s.h * 1.1);
        const im = s.unit || (s.unit = (() => { const k = document.createElement("canvas"); k.width = 300; k.height = 360; k.getContext("2d").drawImage(s.image, 0, 0, 300, 360); return k; })());
        const P = s.pos, U = s.uv;
        const T = (a, b, d) => tri2d(c, im, P[a * 2], P[a * 2 + 1], P[b * 2], P[b * 2 + 1], P[d * 2], P[d * 2 + 1], U[a * 2], U[a * 2 + 1], U[b * 2], U[b * 2 + 1], U[d * 2], U[d * 2 + 1]);
        c.save(); c.translate(s.x, s.y);
        for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
          const a = j * NX + i, b = a + 1, d = a + NX, e = d + 1;
          if (!s.ins[a] && !s.ins[b] && !s.ins[d] && !s.ins[e]) continue;
          T(a, d, b); T(b, d, e);
        }
        c.restore();
      }
    }

    let vis = false;
    new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis) { sizeCanvas(); wake(); } }, { rootMargin: "15% 0px" }).observe(view);

    let simT = 0;
    function update(now, dt) {
      if (!vis) return false;
      const vr = view.getBoundingClientRect();
      if (Math.abs(vr.width - cw) > 1 || Math.abs(vr.height - ch) > 1) sizeCanvas();
      const list = [];
      let again = false;
      const steps = Math.max(1, Math.min(3, Math.round(dt * 60)));
      for (const s of sims) {
        const r = s.shirt.getBoundingClientRect();
        s.x = r.left - vr.left; s.y = r.top - vr.top;
        const on = s.x + r.width > -40 && s.x < cw + 40;
        if (!on) continue;
        if (!s.ready) { loadTex(s); continue; }
        layoutSim(s, r.width, r.height);
        let live = false;
        for (let k = 0; k < steps; k++) live = stepSim(s, now + k * 16, 1 / 60) || live;
        if (live || !RM) again = true;
        list.push(s);
      }
      if (glOK) drawGL(list); else draw2d(list);
      simT = now;
      return again && vis;
    }
    tasks.add(update);
    // соседние текстуры подгружаем заранее
    sims.slice(0, 6).forEach((s) => new IntersectionObserver(([e], o) => { if (e.isIntersecting) { loadTex(s); o.disconnect(); } }, { rootMargin: "100% 100%" }).observe(s.shirt));
  })();

  /* ——— шрифты готовы: подгоняем кегли и запускаем интро ——— */
  const ready = () => { fitHeads(); Film && Film.measure(); Film && Film.fontsReady(); wake(); };
  fitHeads();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(ready);
    setTimeout(ready, 2500);
  } else {
    addEventListener("load", ready);
  }
  wake();
})();
