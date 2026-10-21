/* Проверка на телефоне: откройте сайт с ?diag в адресе (…/avtorskie-futbolki/?diag) — через 3 с после загрузки
   появится табличка: что за браузер, включились ли анимации и почему нет. Скриншот таблички объясняет поломку.
   Обычным посетителям не загружается. */
(() => {
  "use strict";
  const doc = document.documentElement;
  const mm = (q) => { try { return matchMedia(q).matches ? "да" : "нет"; } catch (e) { return "?"; } };
  const c = navigator.connection || {};
  let webgl = "нет";
  try { const cv = document.createElement("canvas"); webgl = cv.getContext("webgl2") ? "webgl2" : cv.getContext("webgl") ? "webgl" : "нет"; } catch (e) { webgl = "ошибка"; }
  let ls = "да";
  try { localStorage.setItem("kiyaeva-diag", "1"); localStorage.removeItem("kiyaeva-diag"); } catch (e) { ls = "нет"; }
  const res = (performance.getEntriesByType ? performance.getEntriesByType("resource") : []).filter((r) => /site\.js|styles\.css/.test(r.name))
    .map((r) => `${r.name.split("/").pop().split("?")[0]} ${Math.round(r.responseEnd)} мс`).join(", ");
  const cls = doc.className;
  const has = (k) => doc.classList.contains(k);
  const verdict =
    !has("js") ? "АНИМАЦИИ ВЫКЛЮЧЕНЫ: скрипт сайта не сработал (см. строки ниже)" :
    has("rm") ? "АНИМАЦИИ ВЫКЛЮЧЕНЫ: в настройках телефона или браузера стоит «уменьшить движение» (часто включает режим энергосбережения)" :
    !has("film-on") ? "ФИЛЬМ НЕ ЗАПУСТИЛСЯ (см. строки ниже)" :
    has("novideo") ? "анимации работают, вместо роликов — кадры" : "анимации работают";
  const rows = [
    ["итог", verdict],
    ["браузер", navigator.userAgent],
    ["экран", `${innerWidth}×${innerHeight}, плотность ${Math.round(devicePixelRatio * 100) / 100}`],
    ["классы", cls],
    ["меньше движения", mm("(prefers-reduced-motion: reduce)")],
    ["сеть", `${c.effectiveType || "?"}, экономия трафика ${c.saveData ? "да" : "нет"}`],
    ["файлы", res || "нет данных"],
    ["WebGL / хранилище", `${webgl} / ${ls}`],
    ["шрифты", document.fonts ? document.fonts.status : "?"],
    ["скрипт дошёл до конца", window.kiyaevaReady ? "да" : "НЕТ"],
  ];
  const box = document.createElement("div");
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Диагностика сайта");
  box.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;max-height:72vh;overflow:auto;z-index:2147483647;" +
    "background:#fff;color:#111;border:2px solid #c8283c;border-radius:12px;padding:12px 12px 8px;" +
    "font:12px/1.35 ui-monospace,Menlo,Consolas,monospace;box-shadow:0 10px 40px rgba(0,0,0,.5);-webkit-text-size-adjust:100%";
  const h = document.createElement("div");
  h.textContent = "Диагностика — сделайте скриншот";
  h.style.cssText = "font-weight:700;margin-bottom:6px;color:#c8283c";
  box.appendChild(h);
  const add = (k, v, strong) => {
    const p = document.createElement("div");
    p.style.cssText = "margin:0 0 4px;word-break:break-word" + (strong ? ";font-weight:700" : "");
    p.textContent = `${k}: ${v}`;
    box.appendChild(p);
  };
  rows.forEach(([k, v], i) => add(k, v, i === 0));
  (window.kiyaevaLog || []).forEach((m) => add("•", m));
  const x = document.createElement("button");
  x.type = "button"; x.textContent = "закрыть";
  x.style.cssText = "margin-top:6px;min-height:44px;padding:0 16px;border:1px solid #c8283c;border-radius:999px;background:#fff;color:#c8283c;font:inherit";
  x.addEventListener("click", () => box.remove());
  box.appendChild(x);
  document.body.appendChild(box);
})();
