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
    // при редких кадрах (слабое устройство) сцена всё равно догоняет скролл за то же реальное время
    const dt = Math.min(0.12, lastT ? (now - lastT) / 1000 : 1 / 60);
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
              c.style.setProperty("--rnd", ((((i * 53 + 7) % 19) / 9) - 1).toFixed(2));
              w.appendChild(c);
            }
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== "BR" && !child.classList.contains("sub")) {
          walk(child);
        }
      }
    };
    walk(h);
    const all = $$(".c", h);
    all.forEach((c, k) => c.style.setProperty("--ci", Math.abs(k - (all.length - 1) / 2).toFixed(1)));
  }

  function splitLines(h) {
    const parts = h.innerHTML.split(/<br\s*\/?>/i);
    h.innerHTML = parts.map((p, k) => `<span class="ln" style="--li:${k}">${p}</span>`).join("");
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

  /* спецэффекты вылета: осколки бисера, ударная волна, луч, след когтей. Всё на transform/opacity */
  const FX = {
    "t-rg":     { quake: [0.52, 0.42, 2], sha: 1.3, burst: [{ n: 12, at: 0.56, dir: "out", ox: 34, oy: 30, c: ["#e23a4c", "#ff9aa6", "#a81428"] }, { n: 9, at: 1.12, dir: "out", ox: 22, oy: 78, c: ["#e23a4c", "#ff9aa6", "#a81428"] }] },
    "t-more":   { sha: 1.4, burst: [{ n: 11, at: 0.62, dir: "up", ox: 45, oy: 62, c: ["#1f9fd0", "#8fdcf5", "#ffffff"] }] },
    "t-dome":   { sha: 1.3, beam: [1.0, 1.1, "rgba(255,242,198,.55)"], burst: [{ n: 10, at: 0.75, dir: "up", slow: 1, ox: 48, oy: 70, c: ["#fff2c6", "#e3c173", "#c9a24a"] }] },
    "t-verh":   { quake: [0.68, 0.36, 2], sha: 1.35, burst: [{ n: 12, at: 0.72, dir: "out", ox: 38, oy: 78, c: ["#c2202f", "#ff7b86", "#2a2020"] }] },
    "t-pros":   { quake: [0.5, 0.32, 1], sha: 1.0, burst: [{ n: 12, at: 0.36, dir: "up", hollow: 1, ox: 45, oy: 50, c: ["#ffffff", "#ffd9d2", "#150808"] }] },
    "t-vedma":  { sha: 1.1, beam: [0.14, 0.5, "rgba(255,255,255,.7)"] },
    "t-shep":   { quake: [0.55, 0.32, 1], sha: 1.1, burst: [{ n: 11, at: 0.62, dir: "down", ox: 46, oy: 55, c: ["#e02a4a", "#62d23c", "#ff8aa0"] }] },
    "t-money":  { quake: [0.42, 0.26, 3], sha: 1.3, beam: [1.35, 0.8, "rgba(255,255,255,.6)"], burst: [{ n: 12, at: 0.5, dir: "left", ox: 8, oy: 45, c: ["#ffffff", "#cfd2d8", "#9aa0aa"] }] },
    "t-ballet": { sha: 1.5, burst: [{ n: 10, at: 1.42, dir: "out", ox: 34, oy: 26, c: ["#e3c173", "#fff2c6", "#cf2536"] }] },
    "t-mama":   { sha: 1.3, claw: 0.8, burst: [{ n: 13, at: 0.25, dir: "up", slow: 1, ox: 40, oy: 68, c: ["#ff9a3c", "#ffd27a", "#e2541f"] }] },
    "t-lama":   { sha: 1.4, beam: [1.2, 0.8, "rgba(255,255,255,.75)"] },
    "t-tyson":  { quake: [0.5, 0.5, 1], sha: 1.0, ring: [0.48, 34, 44], burst: [{ n: 13, at: 0.5, dir: "out", ox: 34, oy: 44, c: ["#e0303a", "#ff8088", "#7d1218"] }] },
  };
  function addFx(h, tk) {
    const key = Object.keys(FX).find((k) => h.classList.contains(k));
    if (!key) return;
    const fx = FX[key];
    // генератор с зерном: рисунок осколков одинаковый при каждом заходе
    let seed = 0; for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const el = (cls) => { const e = document.createElement("i"); e.className = cls; e.setAttribute("aria-hidden", "true"); tk.appendChild(e); return e; };
    if (fx.sha) tk.style.setProperty("--sha", `${fx.sha}s`);
    if (fx.quake) { tk.classList.add("q"); tk.style.setProperty("--qa", `${fx.quake[0]}s`); tk.style.setProperty("--qd", `${fx.quake[1]}s`); tk.style.setProperty("--qn", fx.quake[2]); }
    (fx.burst || []).forEach((b) => {
      for (let k = 0; k < b.n; k++) {
        const e = el(b.hollow ? "pt hollow" : "pt");
        let ang;
        if (b.dir === "up") ang = -Math.PI / 2 + (rnd() - 0.5) * 1.5;
        else if (b.dir === "down") ang = Math.PI / 2 + (rnd() - 0.5) * 1.3;
        else if (b.dir === "left") ang = Math.PI + (rnd() - 0.5) * 1.2;
        else ang = rnd() * Math.PI * 2;
        const dist = (b.slow ? 0.7 : 1) * (0.55 + rnd() * 1.15);
        e.style.setProperty("--dx", (Math.cos(ang) * dist * 1.5).toFixed(2));
        e.style.setProperty("--dy", (Math.sin(ang) * dist).toFixed(2));
        e.style.setProperty("--ox", `${(b.ox + (rnd() - 0.5) * 44).toFixed(0)}%`);
        e.style.setProperty("--oy", `${(b.oy + (rnd() - 0.5) * 30).toFixed(0)}%`);
        e.style.setProperty("--sz", (0.05 + rnd() * 0.07).toFixed(3));
        e.style.setProperty("--s", (0.5 + rnd() * 0.9).toFixed(2));
        e.style.setProperty("--c", b.c[k % b.c.length]);
        e.style.setProperty("--d", `${(b.at + rnd() * 0.12).toFixed(2)}s`);
        e.style.setProperty("--t", `${((b.slow ? 1.7 : 0.8) + rnd() * 0.5).toFixed(2)}s`);
      }
    });
    if (fx.ring) { const e = el("rg-ring"); e.style.setProperty("--d", `${fx.ring[0]}s`); e.style.setProperty("--ox", `${fx.ring[1]}%`); e.style.setProperty("--oy", `${fx.ring[2]}%`); }
    if (fx.beam) { const w = el("bmw"); const b = document.createElement("i"); b.className = "bm"; b.style.setProperty("--d", `${fx.beam[0]}s`); b.style.setProperty("--t", `${fx.beam[1]}s`); b.style.setProperty("--bc", fx.beam[2]); w.appendChild(b); }
    if (fx.claw) { const e = el("claw"); e.style.setProperty("--d", `${fx.claw}s`); }
  }
  // тень: копия надписи одним цветом, лежит под ней со смещением
  function castShadow(h) {
    const tk = h.parentNode;
    const old = $(".t-sh", tk);
    if (old) old.remove();
    const d = document.createElement("div");
    d.className = `${h.className} t-sh`;
    d.setAttribute("aria-hidden", "true");
    d.innerHTML = h.innerHTML;
    $$(".sp, .bub", d).forEach((e) => e.remove());
    const src = $(".stitch-svg", h), dst = $(".stitch-svg", d);
    if (src && dst) dst.style.width = src.style.width;
    tk.insertBefore(d, h);
  }

  // текст надписи для экранного диктора: переносы строк читаются как пробелы
  const plain = (el) => el.innerHTML.replace(/<br\s*\/?>/gi, " ").replace(/<\/(span|small)>/gi, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const heads = $$(".t");
  heads.forEach((h) => {
    h.setAttribute("aria-label", h.dataset.label || plain(h));
    const kind = h.dataset.reveal;
    if (kind === "stitch") buildStitch(h);
    else if (kind === "write" || kind === "glass") splitLines(h);
    else splitLetters(h);
    // живые детали материала: блики на стеклярусе, пузырьки в просекко
    const deco = (n, cls) => { for (let k = 0; k < n; k++) { const el = document.createElement("i"); el.className = cls; el.style.setProperty("--k", k); el.setAttribute("aria-hidden", "true"); h.appendChild(el); } };
    deco(+h.dataset.sparks || 0, "sp");
    deco(+h.dataset.bubbles || 0, "bub");
    // .tw держит наклон, зеркальный рамке; .tk вздрагивает от удара; тень и осколки лежат рядом с надписью
    const tw = document.createElement("div"); tw.className = "tw";
    const tk = document.createElement("div"); tk.className = "tk";
    h.parentNode.insertBefore(tw, h); tw.appendChild(tk); tk.appendChild(h);
    addFx(h, tk);
  });
  // описание под надписью появляется по словам
  $$(".ch .deck").forEach((d) => {
    const words = d.textContent.trim().split(/\s+/);
    d.setAttribute("aria-label", words.join(" "));
    d.textContent = "";
    words.forEach((w, k) => { const sp = document.createElement("span"); sp.className = "dw"; sp.setAttribute("aria-hidden", "true"); sp.style.setProperty("--i", k); sp.textContent = w; d.appendChild(sp); d.appendChild(document.createTextNode(" ")); });
  });

  /* подгонка кегля: надпись влезает в колонку целиком, без переносов внутри слов */
  function fitHeads() {
    const film = doc.classList.contains("film-on");
    doc.classList.add("fitting"); // на время замера показываем все главы
    const vh = innerHeight, vw = innerWidth, small = narrow();
    heads.forEach((h) => {
      const art = h.closest(".ch");
      const tw = h.closest(".tw");
      // у скрытой главы ширина известна из раскладки: колонка абсолютная
      const colW = film ? art.offsetWidth || (small ? vw - 32 : vw * 0.46) : Math.min(art.clientWidth || vw - 32, 704);
      const maxH = film ? (small ? vh * 0.2 : vh * 0.42) : vh * 0.5;
      if (h._stitch) {
        layoutStitch(h);
        const r = h._stitch.ratio || 4;
        const w = Math.min(colW, maxH * r);
        h._stitch.svg.style.width = `${w}px`;
        h.style.removeProperty("--fs");
        tw.style.setProperty("--fs", `${Math.max(22, (w / r) / (h._stitch.lines.length * 1.04))}px`);
        castShadow(h);
        return;
      }
      h.style.setProperty("--fs", "100px");
      h.style.width = "max-content";
      const bw = h.offsetWidth, bh = h.offsetHeight;
      h.style.width = "";
      const tall = h.classList.contains("t-verh") ? 1.28 : h.classList.contains("t-money") ? 1.25 : 1;
      const s = Math.min(colW / Math.max(1, bw), maxH / Math.max(1, bh * tall));
      const cap = small ? 150 : 210;
      h.style.removeProperty("--fs");
      tw.style.setProperty("--fs", `${clamp(100 * s * 0.96, 26, cap).toFixed(1)}px`);
      castShadow(h);
    });
    doc.classList.remove("fitting");
  }

  /* ——— фильм ——— */
  const Film = (() => {
    const film = $("#film"), stage = $("#stage");
    if (!film || RM) return null;
    const framesEl = $("#frames");
    const beadEl = $("#spine-bead"), spine = $(".spine", stage), nav = $("#top"), cue = $("#cue");
    const FPS = 12; // клипы закодированы в 12 кадров/с: перематываем только при смене кадра

    doc.classList.add("film-on");
    const chapters = $$(".ch", stage).map((el) => {
      const tilt = (el.dataset.tilt || "0,0,0").split(",").map(Number);
      const fr = document.createElement("div");
      fr.className = "fr";
      framesEl.appendChild(fr);
      return {
        el, fr, tw: $(".tw", el),
        side: el.dataset.side === "l" ? -1 : 1,
        aspect: parseFloat(el.dataset.aspect) || 0.8,
        ry: tilt[0], rz: tilt[1], rx: tilt[2],
        len: parseFloat(el.dataset.len) || 1,
        bgL: hex(el.dataset.bg), bgD: hex(el.dataset.bgD || el.dataset.bg),
        inkL: hex(el.dataset.ink), inkD: hex(el.dataset.inkD || el.dataset.ink),
        acc: hex(el.dataset.acc),
        shots: JSON.parse(el.dataset.shots),
        on: false, o: -1, tr: "",
      };
    });

    let total = 0;
    const shots = [];
    chapters.forEach((c, ci) => {
      c.a = total; c.b = total + c.len; total = c.b;
      const wsum = c.shots.reduce((s, sh) => s + (sh.w || (sh.d ? sh.d : 1)), 0);
      let acc = c.a;
      c.list = [];
      c.shots.forEach((sh, k) => {
        const span = (c.len * (sh.w || (sh.d ? sh.d : 1))) / wsum;
        const el = sh.v ? document.createElement("video") : document.createElement("img");
        el.className = "shot-el";
        if (sh.v) {
          el.muted = true; el.playsInline = true; el.preload = "none";
          el.setAttribute("muted", ""); el.setAttribute("playsinline", ""); el.setAttribute("webkit-playsinline", "");
          el.setAttribute("disablepictureinpicture", ""); el.setAttribute("disableremoteplayback", "");
        } else {
          el.alt = ""; el.decoding = "async";
          if (ci === 0 && k === 0) el.src = sh.img; // первый экран нужен сразу
        }
        if (sh.o) el.style.transformOrigin = sh.o;
        if (sh.pos) el.style.objectPosition = sh.pos;
        c.fr.appendChild(el);
        const s = { ...sh, el, ci, a: acc, b: acc + span, firstInCh: k === 0, lastInCh: k === c.shots.length - 1, first: ci === 0 && k === 0, loaded: ci === 0 && k === 0, primed: false, o: -1, tr: "" };
        shots.push(s); c.list.push(s);
        acc += span;
      });
    });
    const X = 0.13; // полуширина перехода между главами в долях главы

    let unit = 0, filmTop = 0, filmH = 0, vh = innerHeight, vw = innerWidth, spineH = 0, small = false;
    let p = 0, pT = 0, active = false, fontsReady = false;
    let lastBg = "", lastCi = -1, lastDark = null, lastNav = -1, lastBead = -1;

    // цвет текста и акцента у главы свой и постоянный: меняется только фон сцены,
    // поэтому при смыве цвета браузер не пересчитывает стили у сотен букв
    function paintChapters() {
      const dark = isDark();
      chapters.forEach((c) => {
        c.el.style.setProperty("--sink", rgb(dark ? c.inkD : c.inkL));
        c.el.style.setProperty("--acc", rgb(c.acc));
        c.fr.style.backgroundColor = rgb(mix(dark ? c.bgD : c.bgL, dark ? c.inkD : c.inkL, 0.12));
        const bg = dark ? c.bgD : c.bgL;
        c.el.classList.toggle("dk", (bg[0] * 0.299 + bg[1] * 0.587 + bg[2] * 0.114) < 110);
      });
      lastCi = -1; lastBg = "";
    }

    // рамка стоит сбоку под углом, текст занимает оставшуюся колонку
    function measure() {
      vw = innerWidth; vh = innerHeight; small = narrow();
      unit = vh * (small ? 0.62 : 0.72);
      filmH = total * unit + vh;
      film.style.setProperty("--film-h", `${Math.round(filmH)}px`);
      filmTop = film.getBoundingClientRect().top + scrollY;
      spineH = spine ? spine.offsetHeight : 0;
      chapters.forEach((c) => {
        let fw, fh, left, top;
        if (small) {
          const availH = vh * 0.47;
          fh = Math.min(availH, (vw - 48) / c.aspect); fw = fh * c.aspect;
          left = (vw - fw) / 2 + c.side * 6; top = 74;
          c.el.style.left = ""; c.el.style.width = "";
        } else {
          fh = vh * (c.aspect >= 1 ? 0.68 : 0.76); fw = fh * c.aspect;
          const cap = vw * (c.aspect >= 1 ? 0.42 : 0.36);
          if (fw > cap) { fw = cap; fh = fw / c.aspect; }
          const edge = vw * 0.075;
          left = c.side > 0 ? vw - edge - fw : edge;
          top = (vh - fh) / 2 + vh * 0.01;
          const gap = vw * 0.055, colW = vw - fw - edge - vw * 0.06 - gap;
          c.el.style.width = `${Math.round(colW)}px`;
          c.el.style.left = `${Math.round(c.side > 0 ? vw * 0.06 : edge + fw + gap)}px`;
        }
        // надпись стоит под тем же углом, что рамка, но в другую сторону: вместе они как раскрытая книга
        if (c.tw) { c.tw.style.setProperty("--ty", `${(-c.ry * (small ? 0.7 : 1.3)).toFixed(1)}deg`); c.tw.style.setProperty("--tz", `${(-c.rz * 0.75).toFixed(1)}deg`); }
        c.fw = fw; c.fh = fh;
        c.fr.style.width = `${Math.round(fw)}px`; c.fr.style.height = `${Math.round(fh)}px`;
        c.fr.style.left = `${Math.round(left)}px`; c.fr.style.top = `${Math.round(top)}px`;
        c.tr = "";
      });
    }

    function loadShot(s) {
      if (s.loaded) return;
      s.loaded = true;
      if (!s.v) { s.el.src = s.img; return; }
      s.el.poster = `${s.v}.jpg`;
      s.el.preload = "auto";
      s.el.src = `${s.v}.mp4`;
      s.el.addEventListener("loadeddata", wake, { once: true });
      if (!s.bound) { s.bound = true; s.el.addEventListener("seeked", wake); }
      try { s.el.load(); } catch (e) { /* ничего */ }
    }
    function unloadShot(s) {
      // далеко ушедшие ролики освобождают декодер и память
      if (!s.loaded || !s.v || s.first) return;
      s.loaded = false; s.primed = false;
      s.el.removeAttribute("src");
      try { s.el.load(); } catch (e) { /* ничего */ }
    }
    function prime(s) {
      // iOS показывает кадры после первого play(); сразу ставим на паузу
      if (s.primed) return;
      s.primed = true;
      const pr = s.el.play();
      if (pr && pr.then) pr.then(() => s.el.pause()).catch(() => {});
    }

    function update(now, dt) {
      if (!active) return false;
      pT = clamp((scrollY - filmTop) / Math.max(1, filmH - vh), 0, 1) * total;
      p += (pT - p) * (1 - Math.exp(-dt * 9));
      if (Math.abs(pT - p) < 0.0005) p = pT;

      let ci = 0;
      for (let i = 0; i < chapters.length; i++) if (p >= chapters[i].a) ci = i;
      const c = chapters[ci];
      const dark = isDark();

      // цвет сцены: смыв в цвет материала на границе глав
      let bIdx = ci, bPos = c.b;
      if (ci > 0 && p - c.a < c.b - p) { bIdx = ci - 1; bPos = c.a; }
      const from = chapters[bIdx], to = chapters[Math.min(bIdx + 1, chapters.length - 1)];
      const t = from === to ? 0 : smooth(bPos - 0.15, bPos + 0.15, p);
      const sBg = rgb(mix(dark ? from.bgD : from.bgL, dark ? to.bgD : to.bgL, t));
      if (sBg !== lastBg) { stage.style.backgroundColor = sBg; lastBg = sBg; }
      // мелкие детали (нитка, подсказка, панель) перекрашиваются один раз на главу
      const near = t < 0.5 ? from : to;
      const ni = chapters.indexOf(near);
      if (ni !== lastCi || dark !== lastDark) {
        lastCi = ni; lastDark = dark;
        const sInk = rgb(dark ? near.inkD : near.inkL), sAcc = rgb(near.acc);
        for (const el of [spine, cue]) if (el) { el.style.setProperty("--sink", sInk); el.style.setProperty("--acc", sAcc); }
        lastNav = -1;
      }

      // рамки: видны одна-две, каждая влетает сбоку под углом и уходит вверх
      let lead = null, leadO = 0, pending = false;
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        const x = X * ch.len;
        const fin = i === 0 ? 1 : smooth(ch.a - x, ch.a + x, p);
        const fout = i === chapters.length - 1 ? 1 : 1 - smooth(ch.b - x, ch.b + x, p);
        const o = Math.round(fin * fout * 100) / 100;
        if (o !== ch.o) {
          ch.fr.style.opacity = o;
          if ((o > 0) !== (ch.o > 0)) ch.fr.style.visibility = o > 0 ? "visible" : "hidden";
          ch.o = o;
        }
        if (o <= 0) continue;
        const lt = clamp((p - ch.a) / ch.len, 0, 1);
        const e = easeOut(fin), ex = 1 - fout;
        const k = small ? 0.45 : 1;
        const ry = ch.ry * k * (1 + (1 - e) * 1.5 + ex * 0.8 - lt * 0.4);
        const rz = ch.rz * k * (1 + (1 - e) * 1.6 - lt * 0.5) + ex * ch.side * 3;
        const rx = ch.rx * k + (1 - e) * 7 - ex * 9;
        const tx = ch.side * (1 - e) * vw * (small ? 0.5 : 0.2);
        const ty = (1 - e) * vh * 0.1 - ex * vh * 0.2 + (0.5 - lt) * vh * (small ? 0.02 : 0.045);
        const sc = 0.9 + 0.1 * e - 0.07 * ex;
        const tr = `perspective(1500px) translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0) rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale(${sc.toFixed(3)})`;
        if (tr !== ch.tr) { ch.fr.style.transform = tr; ch.tr = tr; }
      }

      // кадры внутри рамки: перематываем только ведущий
      for (const s of shots) {
        if (p > s.a - 1.3 && p < s.b + 0.7) loadShot(s);
        else if (p < s.a - 3 || p > s.b + 2.4) unloadShot(s);
        // Safari начинает качать ролик только после play(): будим следующий кадр заранее, за полглавы
        if (s.v && s.loaded && !s.primed && p > s.a - 0.6 && p < s.b) prime(s);
        const ch = chapters[s.ci];
        if (ch.o <= 0) continue;
        const x = 0.1 * ch.len;
        const fin = s.firstInCh ? 1 : smooth(s.a - x, s.a + x, p);
        const fout = s.lastInCh ? 1 : 1 - smooth(s.b - x, s.b + x, p);
        const o = Math.round(fin * fout * 100) / 100;
        if (o !== s.o) { s.el.style.opacity = o; s.o = o; }
        if (o <= 0) continue;
        const w = o * ch.o;
        if (w > leadO) { leadO = w; lead = s; }
        const lt = clamp((p - (s.a - x)) / (s.b - s.a + 2 * x), 0, 1);
        s.lt = lt;
        const z = s.z ? lerp(s.z[0], s.z[1], easeOut(lt)) : 1;
        const tr = `scale(${z.toFixed(3)})`;
        if (tr !== s.tr) { s.el.style.transform = tr; s.tr = tr; }
      }
      if (lead && lead.v && lead.loaded) prime(lead); // на iPhone данные не идут, пока не вызван play()
      if (lead && lead.v && lead.el.readyState >= 1) {
        const d = lead.el.duration && isFinite(lead.el.duration) ? lead.el.duration : lead.d;
        const target = Math.min(d - 0.05, Math.round(lead.lt * (d - 0.05) * FPS) / FPS);
        if (Math.abs(lead.el.currentTime - target) > 0.03) {
          if (!lead.el.seeking) { try { lead.el.currentTime = target; } catch (e) { /* ещё не готово */ } }
          pending = true;
        }
      }

      // главы: класс on включает вылет надписи, дальше работает CSS
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        const u = (p - ch.a) / ch.len;
        const lastCh = i === chapters.length - 1;
        const on = fontsReady && (i === 0 ? u < 0.86 : u >= 0.1 && (lastCh || u < 0.88));
        const live = u > -0.6 && u < 1.6;
        if (live !== ch.live) { ch.el.classList.toggle("live", live); ch.live = live; }
        if (on !== ch.on) { ch.el.classList.toggle("on", on); ch.on = on; }
      }

      const by = Math.round((p / total) * spineH);
      if (by !== lastBead && beadEl) { beadEl.style.transform = `translate3d(0,${by}px,0)`; lastBead = by; }
      const inView = scrollY < filmTop + filmH - vh * 0.5 ? 1 : 0;
      const navKey = inView ? ni : -2;
      if (navKey !== lastNav) {
        nav.style.setProperty("--nav-ink", inView ? rgb(dark ? near.inkD : near.inkL) : "");
        nav.style.setProperty("--nav-bg", inView ? rgb(dark ? near.bgD : near.bgL) : "");
        nav.classList.toggle("over-film", !!inView);
        lastNav = navKey;
      }
      return p !== pT || pending;
    }

    measure();
    paintChapters();
    tasks.add(update);
    new IntersectionObserver(([e]) => {
      active = e.isIntersecting;
      if (active) wake(); else { nav.style.removeProperty("--nav-ink"); nav.style.removeProperty("--nav-bg"); nav.classList.remove("over-film"); lastNav = -1; }
    }, { rootMargin: "20% 0px" }).observe(film);
    addEventListener("scroll", wake, { passive: true });
    let lastW = innerWidth, lastH = innerHeight;
    addEventListener("resize", () => {
      // адресная строка на телефоне меняет высоту на пару десятков пикселей: фильм из-за этого не пересчитываем
      if (innerWidth !== lastW || Math.abs(innerHeight - lastH) > 120) { lastW = innerWidth; lastH = innerHeight; measure(); fitHeads(); }
      wake();
    });
    addEventListener("kiyaeva:theme", () => { paintChapters(); wake(); });
    return {
      fontsReady() { fontsReady = true; wake(); },
      measure,
    };
  })();

  // подсказка «листай» видна только в самом начале
  (() => {
    let was = null;
    const sync = () => { const s = scrollY > 24; if (s !== was) { doc.classList.toggle("scrolled", s); was = s; } };
    addEventListener("scroll", sync, { passive: true });
    sync();
  })();

  if (!Film) {
    // меньше движения или нет сцены: главы по очереди, каждая на своём цвете
    const tint = () => {
      const dark = isDark();
      $$(".ch").forEach((ch) => {
        ch.style.setProperty("--cbg", (dark && ch.dataset.bgD) || ch.dataset.bg);
        ch.style.setProperty("--sink", (dark && ch.dataset.inkD) || ch.dataset.ink);
        ch.style.setProperty("--acc", ch.dataset.acc);
        const bg = hex((dark && ch.dataset.bgD) || ch.dataset.bg);
        ch.classList.toggle("dk", (bg[0] * 0.299 + bg[1] * 0.587 + bg[2] * 0.114) < 110);
      });
    };
    doc.classList.add("tinted");
    tint();
    addEventListener("kiyaeva:theme", tint);
    // в каждой главе короткий фрагмент ролика по нажатию
    $$(".ch").forEach((ch) => {
      const shots = JSON.parse(ch.dataset.shots || "[]");
      const v = shots.find((s) => s.v);
      const fig = $(".ch-media", ch);
      // первая глава начинается с вышивки крупно, а не с лица: её кадр оставляем как есть
      if (!v || !fig || !shots[0].v) return;
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

  /* ——— Крупно: название крупно, вылет по теме вещи, рядом кружат её предметы ——— */
  const Cards = (() => {
    const cards = $$(".card");
    if (!cards.length) return null;

    // значки: то, из чего сделана шутка на футболке
    const ICON = {
      star: '<path fill="currentColor" d="M12 0C12.9 6.6 17.4 11.1 24 12 17.4 12.9 12.9 17.4 12 24 11.1 17.4 6.6 12.9 0 12 6.6 11.1 11.1 6.6 12 0Z"/>',
      crown: '<path fill="currentColor" d="M3.5 8 8.5 12.5 12 4l3.5 8.5L20.5 8 22 18H2zM2 20h20v2H2z"/>',
      halo: '<ellipse cx="12" cy="12" rx="10.5" ry="4.2" fill="none" stroke="currentColor" stroke-width="2.4"/>',
      bill: '<rect x="1" y="6" width="22" height="12" rx="2" fill="currentColor"/><circle cx="12" cy="12" r="3" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="1.4"/><path d="M4.500 9.500v5M19.500 9.500v5" stroke="#fff" stroke-opacity=".7" stroke-width="1.3" stroke-linecap="round"/>',
      coin: '<circle cx="12" cy="12" r="11" fill="currentColor"/><circle cx="12" cy="12" r="8.3" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.1"/><path d="M10 18V6.500h3.200a3 3 0 0 1 0 6H8.200M8.200 15.200h5.200" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
      book: '<path fill="currentColor" d="M12 6C10 4.400 7 4 3 4v14c4 0 7 .400 9 2 2-1.600 5-2 9-2V4c-4 0-7 .400-9 2z"/><path d="M12 6v14" stroke="#fff" stroke-opacity=".7" stroke-width="1.2"/>',
      note: '<path fill="currentColor" d="M9 18.500a3 3 0 1 1-2-2.830V4l13-2.500v13.500a3 3 0 1 1-2-2.830V6.040L9 8z"/>',
      snow: '<path d="M12 1.500v21M2.900 6.750l18.200 10.500M21.100 6.750 2.900 17.250M12 5.500 9.500 3M12 5.500 14.500 3M12 18.500 9.500 21M12 18.500l2.500 2.500" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
      moon: '<path fill="currentColor" d="M20 14.500A9 9 0 1 1 9.500 4a7 7 0 0 0 10.500 10.500z"/>',
      bolt: '<path fill="currentColor" d="M13 1 4 14h6l-1 9 9-13h-6z"/>',
    };
    // [вид движения, значок, цвет, параметры]
    const FX = {
      such:   { ob: [["orbit", "star", "#e0688a", { ph: 0 }], ["orbit", "star", "#f0a8b8", { ph: 0.36, sz: 0.3 }], ["orbit", "crown", "#c9973a", { ph: 0.68, sz: 0.5 }]], burst: { n: 10, at: 0.95, c: ["#e0688a", "#f4c2cc", "#c9973a"] }, quake: [0.9, 0.36, 2] },
      bogw:   { ob: [["float", "halo", "#c9973a", { x: 9, y: -6, sz: 0.9 }], ["orbit", "star", "#c9973a", { ph: 0.1, sz: 0.3 }], ["orbit", "star", "currentColor", { ph: 0.6, sz: 0.24 }]] },
      dengi:  { ob: [["fly", "bill", "#2f8f5f", { y: 12, ph: 0, sz: 0.5 }], ["fly", "bill", "#3fae78", { y: 48, ph: 0.3, sz: 0.38 }], ["fly", "bill", "#2f8f5f", { y: 82, ph: 0.55, sz: 0.46 }], ["fly", "bill", "#57c08b", { y: 30, ph: 0.8, sz: 0.32 }]] },
      zdes:   { ob: [["orbit", "coin", "#e0559a", { ph: 0, spin: 1, sz: 0.44 }], ["orbit", "coin", "#c9973a", { ph: 0.34, spin: 1, sz: 0.36 }], ["orbit", "coin", "#e0559a", { ph: 0.67, spin: 1, sz: 0.3 }]] },
      books:  { ob: [["float", "book", "#9aa0aa", { x: 94, y: -4, sz: 0.62 }], ["float", "book", "#e3203a", { x: -6, y: 92, sz: 0.46 }], ["twinkle", "star", "#e3203a", { x: 60, y: -6, sz: 0.26 }], ["twinkle", "star", "#e3203a", { x: 102, y: 62, sz: 0.2 }], ["twinkle", "star", "#9aa0aa", { x: 22, y: 100, sz: 0.22 }]] },
      vokrug: { glow: 1, ob: [["orbit", "bolt", "#e8a81a", { ph: 0, fast: 1, sz: 0.44 }], ["orbit", "bolt", "#ff6a3d", { ph: 0.33, fast: 1, sz: 0.36 }], ["orbit", "bolt", "#e8a81a", { ph: 0.66, fast: 1, sz: 0.3 }], ["twinkle", "star", "#e8a81a", { x: 86, y: 60, sz: 0.34 }], ["twinkle", "star", "#e8a81a", { x: 40, y: 104, sz: 0.24 }]], burst: { n: 12, at: 0.7, c: ["#e8a81a", "#ff6a3d", "#8b8680"] }, quake: [0.6, 0.4, 2] },
      song:   { ob: [["rise", "note", "currentColor", { x: 8, ph: 0, sz: 0.42 }], ["rise", "note", "currentColor", { x: 38, ph: 0.3, sz: 0.32 }], ["rise", "note", "currentColor", { x: 66, ph: 0.6, sz: 0.38 }], ["rise", "note", "currentColor", { x: 92, ph: 0.85, sz: 0.28 }]] },
      meteli: { ob: [["fly rev", "snow", "#7fb2dd", { y: 4, ph: 0, sz: 0.36 }], ["fly rev", "snow", "#a9cdea", { y: 30, ph: 0.2, sz: 0.24 }], ["fly rev", "snow", "#7fb2dd", { y: 56, ph: 0.42, sz: 0.3 }], ["fly rev", "snow", "#a9cdea", { y: 80, ph: 0.6, sz: 0.2 }], ["fly rev", "snow", "#7fb2dd", { y: 18, ph: 0.78, sz: 0.26 }], ["fly rev", "snow", "#a9cdea", { y: 94, ph: 0.9, sz: 0.32 }]] },
      gold:   { beam: 1, ob: [["orbit", "moon", "#c9973a", { ph: 0, sz: 0.5 }], ["orbit", "star", "#c9973a", { ph: 0.4, sz: 0.28 }], ["orbit", "star", "#e3c173", { ph: 0.74, sz: 0.22 }]] },
    };
    const mk = (tag, cls) => { const e = document.createElement(tag); e.className = cls; e.setAttribute("aria-hidden", "true"); return e; };

    cards.forEach((card, n) => {
      card.style.setProperty("--tilt", n % 2 ? "-1" : "1");
      const ct = $(".ct", card);
      if (!ct) return;
      ct.setAttribute("aria-label", plain(ct));
      // слова остаются целыми, внутри слова буквы вылетают по одной; строки помечаются для разных вылетов
      let i = 0, line = 0, j = 0;
      const letters = (text, into, extra) => {
        for (const ch of text) {
          const c = document.createElement("span");
          c.className = `c l${line}${extra || ""}`;
          c.textContent = ch;
          c.style.setProperty("--i", i); c.style.setProperty("--j", j);
          c.style.setProperty("--rnd", ((((i * 53 + 7) % 19) / 9) - 1).toFixed(2));
          i++; j++;
          into.appendChild(c);
        }
      };
      for (const child of Array.from(ct.childNodes)) {
        if (child.nodeType === 1 && child.tagName === "BR") { line++; j = 0; continue; }
        if (child.nodeType === 1 && child.tagName === "I") {
          // «БОЛЬШЕ» с красной Е: буква входит в предыдущее слово
          const prev = child.previousSibling;
          const w = prev && prev.classList && prev.classList.contains("w") ? prev : (() => { const s = document.createElement("span"); s.className = "w"; ct.insertBefore(s, child); return s; })();
          letters(child.textContent, w, " red");
          child.remove();
          continue;
        }
        if (child.nodeType !== 3) continue;
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
          const w = document.createElement("span");
          w.className = "w";
          letters(part, w);
          frag.appendChild(w);
        });
        child.replaceWith(frag);
      }
      const all = $$(".c", ct);
      all.forEach((c, k) => c.style.setProperty("--ci", Math.abs(k - (all.length - 1) / 2).toFixed(1)));

      // обёртка: держит наклон, размер и всё, что кружит вокруг названия
      const cw = mk("div", "cw"); cw.removeAttribute("aria-hidden");
      // название стоит отдельной строкой над карточкой, во всю её ширину
      card.insertBefore(cw, card.firstChild); cw.appendChild(ct);
      const fx = FX[card.dataset.fx];
      if (!fx || RM) return;
      let seed = 7 + n * 131;
      const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      if (fx.glow) cw.insertBefore(mk("i", "cg"), ct);
      if (fx.beam) { const w = mk("i", "bmw"); const b = mk("i", "bm"); b.style.setProperty("--d", "1.1s"); b.style.setProperty("--t", "1s"); b.style.setProperty("--bc", "rgba(255,242,198,.6)"); w.appendChild(b); cw.appendChild(w); }
      if (fx.quake) { ct.classList.add("q"); ct.style.setProperty("--qa", `${fx.quake[0]}s`); ct.style.setProperty("--qd", `${fx.quake[1]}s`); ct.style.setProperty("--qn", fx.quake[2]); }
      (fx.ob || []).forEach(([kind, icon, color, o], k) => {
        const ob = mk("span", `ob ${kind}`);
        const oy = mk("span", "oy");
        const oi = mk("span", o.spin ? "oi spin" : "oi");
        oi.innerHTML = `<svg viewBox="0 0 24 24">${ICON[icon]}</svg>`;
        oi.style.color = color;
        oi.style.setProperty("--sz", ((o.sz || 0.4) * (narrow() ? 1.25 : 1)).toFixed(2));
        const D = kind === "orbit" ? (o.fast ? 2.6 : 5.2) + k * 0.7 : kind.startsWith("fly") ? 3.4 + k * 0.5 : kind === "rise" ? 3.6 + k * 0.4 : 4 + k * 0.6;
        ob.style.setProperty("--D", `${D.toFixed(2)}s`);
        ob.style.setProperty("--ph", `${(-(o.ph || 0) * D * 2).toFixed(2)}s`);
        if (o.x !== undefined) ob.style.setProperty("--x", `${o.x}%`);
        if (o.y !== undefined) ob.style.setProperty("--y", `${o.y}%`);
        ob.style.setProperty("--dr", `${((rnd() - 0.5) * 0.9).toFixed(2)}em`);
        oy.appendChild(oi); ob.appendChild(oy); cw.appendChild(ob);
      });
      if (fx.burst) for (let k = 0; k < fx.burst.n; k++) {
        const e = mk("i", "pt");
        const ang = rnd() * Math.PI * 2, dist = 0.6 + rnd() * 1.2;
        e.style.setProperty("--dx", (Math.cos(ang) * dist * 1.5).toFixed(2));
        e.style.setProperty("--dy", (Math.sin(ang) * dist).toFixed(2));
        e.style.setProperty("--ox", `${(20 + rnd() * 60).toFixed(0)}%`);
        e.style.setProperty("--oy", `${(30 + rnd() * 45).toFixed(0)}%`);
        e.style.setProperty("--sz", (0.05 + rnd() * 0.07).toFixed(3));
        e.style.setProperty("--s", (0.5 + rnd() * 0.9).toFixed(2));
        e.style.setProperty("--c", fx.burst.c[k % fx.burst.c.length]);
        e.style.setProperty("--d", `${(fx.burst.at + rnd() * 0.14).toFixed(2)}s`);
        e.style.setProperty("--t", `${(0.8 + rnd() * 0.5).toFixed(2)}s`);
        cw.appendChild(e);
      }
    });

    // кегль: самая длинная строка названия занимает всю колонку
    function fit() {
      const small = narrow();
      cards.forEach((card) => {
        const cw = $(".cw", card), ct = $(".ct", card);
        if (!cw || !ct) return;
        cw.style.setProperty("--fs", "100px");
        const w100 = ct.offsetWidth || 1;
        const colW = card.clientWidth || innerWidth - 32;
        const fs = clamp((colW / w100) * 100 * 0.9, 30, small ? 96 : 176);
        cw.style.setProperty("--fs", `${fs.toFixed(1)}px`);
        cw.style.setProperty("--ow", `${Math.round(ct.offsetWidth)}px`);
        cw.style.setProperty("--oh", `${Math.round(ct.offsetHeight)}px`);
      });
    }
    fit();

    const show = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      show.unobserve(e.target);
    }), { threshold: 0.22, rootMargin: "0px 0px -8% 0px" });
    // всё, что кружит, работает только пока карточка на экране
    const live = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle("live", e.isIntersecting)), { rootMargin: "5% 0px" });
    const play = new IntersectionObserver((es) => es.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) { if (!v.src && v.dataset.src) v.src = v.dataset.src; if (!RM) { const pr = v.play(); pr && pr.catch && pr.catch(() => {}); } }
      else v.pause();
    }), { threshold: 0.25 });
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    cards.forEach((card) => {
      show.observe(card); live.observe(card);
      const v = $("video", card);
      if (v) {
        play.observe(v);
        if (RM) v.addEventListener("click", () => { if (!v.src) v.src = v.dataset.src; v.paused ? v.play().catch(() => {}) : v.pause(); });
      }
      // объём: карточка поворачивается к курсору, по ней идёт блик. Считается только у карточки под курсором
      const media = $(".card-media", card);
      if (!fine || RM || !media) return;
      let raf = 0, mx = 0, my = 0;
      const apply = () => { raf = 0; media.style.setProperty("--mx", mx.toFixed(3)); media.style.setProperty("--my", my.toFixed(3)); };
      media.addEventListener("pointermove", (e) => {
        const r = media.getBoundingClientRect();
        mx = (e.clientX - r.left) / r.width - 0.5; my = (e.clientY - r.top) / r.height - 0.5;
        if (!raf) raf = requestAnimationFrame(apply);
      });
      media.addEventListener("pointerenter", () => media.classList.add("hot"));
      media.addEventListener("pointerleave", () => { media.classList.remove("hot"); mx = my = 0; if (!raf) raf = requestAnimationFrame(apply); });
    });
    let lw = innerWidth;
    addEventListener("resize", () => { if (innerWidth !== lw) { lw = innerWidth; fit(); } });
    return { fit };
  })();

  /* ——— заголовки разделов и подвал: буквы поднимаются, когда блок входит в экран ——— */
  (() => {
    $$("h2.rv").forEach((h) => {
      h.setAttribute("aria-label", plain(h));
      let i = 0;
      const walk = (node) => {
        for (const child of Array.from(node.childNodes)) {
          if (child.nodeType === 3) {
            const frag = document.createDocumentFragment();
            child.textContent.split(/(\s+)/).forEach((part) => {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
              const w = document.createElement("span"); w.className = "w"; w.setAttribute("aria-hidden", "true");
              for (const ch of part) { const c = document.createElement("span"); c.className = "c"; c.textContent = ch; c.style.setProperty("--i", i++); w.appendChild(c); }
              frag.appendChild(w);
            });
            child.replaceWith(frag);
          } else if (child.nodeType === 1) walk(child);
        }
      };
      walk(h);
    });
    const blocks = $$(".close-head, .rack-head, .end-copy, .end-media");
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("seen"); io.unobserve(e.target); } }), { threshold: 0.2, rootMargin: "0px 0px -6% 0px" });
    blocks.forEach((b) => io.observe(b));
    // логотипы крутятся только пока видны
    const ctas = $("#ctas");
    if (ctas) new IntersectionObserver(([e]) => ctas.classList.toggle("live", e.isIntersecting), { rootMargin: "10% 0px" }).observe(ctas);
    // палец на подписи разработчика нажимает только пока подпись видна
    const colo = $(".colophon");
    if (colo) new IntersectionObserver(([e]) => colo.classList.toggle("idle", !e.isIntersecting), { rootMargin: "10% 0px" }).observe(colo);
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
    row.addEventListener("scroll", () => { syncTrack(); if (row.scrollLeft > 24) rack.classList.add("touched"); wake(); }, { passive: true });
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
    new IntersectionObserver(([e], o) => {
      if (!e.isIntersecting || rack.classList.contains("in")) return;
      rack.classList.add("in");
      o.disconnect();
      const t0 = performance.now();
      // вещи летят влево вместе с рейкой: подол отстаёт, потом догоняет и качается
      sims.forEach((s, k) => { s.theta = RM ? 0 : -0.3; s.thetaV = 0; s.arrive = t0 + 120 + k * 70 + 1100; });
      wake();
    }, { threshold: 0.3 }).observe(view);

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
      const arriving = s.arrive && t < s.arrive + 2600;
      const breeze = RM ? 0 : 0.0045 * Math.sin(t * 0.00055 + s.seed) + 0.0022 * Math.sin(t * 0.0013 + s.seed * 2.1);
      const lag = !RM && s.arrive && t < s.arrive - 420 ? -0.3 : 0; // пока рейка едет, подол отстаёт
      const target = breeze + lag + (s.grab ? clamp((s.grab.px - s.grab.rx) / s.w, -0.5, 0.5) * 0.06 : 0);
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
  const ready = () => { Film && Film.measure(); fitHeads(); Cards && Cards.fit(); Film && Film.fontsReady(); wake(); };
  fitHeads();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(ready);
    setTimeout(ready, 2500);
  } else {
    addEventListener("load", ready);
  }
  wake();
})();
