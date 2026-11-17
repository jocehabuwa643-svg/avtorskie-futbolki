import { readFileSync, writeFileSync } from "node:fs";
const html = readFileSync("index.html", "utf8");
if (html.includes("data-gl-banner")) { console.log("Баннер уже есть"); process.exit(0); }
const banner = readFileSync(".github/green-banner.html", "utf8");
const i = html.lastIndexOf("</body>");
if (i < 0) { console.error("Нет </body> в index.html"); process.exit(1); }
writeFileSync("index.html", html.slice(0, i) + banner + html.slice(i));
console.log("Баннер Green Life вставлен перед </body>");
