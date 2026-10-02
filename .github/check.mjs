// Проверка перед выкладкой: если что-то из этого не сходится, сайт не публикуется и на адресе остаётся прежняя версия.
// Запуск вручную: node .github/check.mjs
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const fail = [];
const html = readFileSync("index.html", "utf8");
const css = readFileSync("styles.css", "utf8");
const js = readFileSync("site.js", "utf8");

// 1. скрипт разбирается
try { execFileSync(process.execPath, ["--check", "site.js"], { stdio: "pipe" }); }
catch (e) { fail.push("site.js: синтаксическая ошибка\n" + String(e.stderr || e.message).slice(0, 400)); }

// 2. все файлы, на которые ссылается сайт, лежат в репозитории
const refs = new Set(["index.html", "404.html", "styles.css", "site.js", "manifest.webmanifest", ".nojekyll"]);
for (const text of [html, css, js]) {
  for (const m of text.matchAll(/(?:film|fonts)\/[\w.\/-]+\.(?:jpe?g|png|webp|mp4|woff2|svg)/g)) refs.add(m[0]);
}
// ролик главы задан без расширения: нужен и сам ролик, и его первый кадр
for (const m of html.matchAll(/"v":"(film\/[\w-]+)"/g)) { refs.add(m[1] + ".mp4"); refs.add(m[1] + ".jpg"); }
// листы кадров для браузеров без видео
const seqSrc = js.match(/const SEQ = (\{.*?\});/s);
if (!seqSrc) fail.push("site.js: не найдена таблица SEQ");
else {
  for (const [key, m] of Object.entries(JSON.parse(seqSrc[1]))) {
    for (let s = 0; s * 12 < m.n; s++) refs.add(`film/s/${key}-${s}.webp`);
  }
}
for (const r of refs) if (!existsSync(r)) fail.push("нет файла: " + r);

// 3. разделы и подключения на месте
for (const need of ['id="film"', 'id="close"', 'id="rack"', 'id="order"', 'class="colophon"', '<script src="site.js', 'href="styles.css', "Content-Security-Policy"]) {
  if (!html.includes(need)) fail.push("в index.html нет: " + need);
}

// 4. встроенный скрипт совпадает с хешем в политике безопасности (иначе браузер его не выполнит и пропадёт выбор темы)
for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
  const h = "sha256-" + createHash("sha256").update(m[1]).digest("base64");
  if (!html.includes(`'${h}'`)) fail.push(`встроенный скрипт изменён, а хеш в Content-Security-Policy прежний. Нужен '${h}'`);
}

// 5. никаких чужих скриптов и стилей
if (/<script[^>]+src=["'](?:https?:)?\/\//i.test(html)) fail.push("в index.html подключён скрипт с чужого адреса");
if (/<link[^>]+rel=["']stylesheet["'][^>]+href=["'](?:https?:)?\/\//i.test(html)) fail.push("в index.html подключён стиль с чужого адреса");
if (/@import\s+(?:url\()?["']?(?:https?:)?\/\//i.test(css)) fail.push("в styles.css есть @import с чужого адреса");
// project-сайт живёт в подпапке: пути от корня домена сломаются
if (/(?:src|href)=["']\/(?!\/)/.test(html)) fail.push("в index.html есть путь от корня домена (начинается с /): нужны относительные");

// 6. фигурные скобки в стилях сходятся
if ((css.match(/\{/g) || []).length !== (css.match(/\}/g) || []).length) fail.push("styles.css: не сходятся фигурные скобки");

if (fail.length) {
  console.error("Выкладка остановлена:\n- " + fail.join("\n- "));
  process.exit(1);
}
console.log(`Проверка пройдена: файлов ${refs.size}`);
