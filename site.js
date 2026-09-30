const chapters = [
  { id: "rg-1", v: 0, a: 0, b: 0.36, kicker: "авторские футболки", title: "RUSSIAN\nGIRL", line: "Красный бисер по варёной ткани. Две строки, и футболка уже говорит сама.", face: "face-russo", bead: "#d23a48" },
  { id: "sea-1", v: 0, a: 0.36, b: 0.68, kicker: "вышивка", title: "МОРЕ", line: "Киты живут внутри букв. Снизу — «обнимет, закопает в песок».", face: "face-sea", bead: "#1aa7c7" },
  { id: "lama-1", v: 0, a: 0.68, b: 1, kicker: "чёрная нить", title: "NO\nPROBLAMA", line: "Лама в очках. Белая футболка, спокойная строчка, никакой спешки.", face: "face-hand", bead: "#1c1c1c" },
  { id: "lama-2", v: 1, a: 0, b: 0.28, kicker: "другой свет", title: "NO\nPROBLAMA", line: "Та же лама, другой поворот. Нить не повторяет принт — она его заменяет.", face: "face-hand", bead: "#222" },
  { id: "sea-2", v: 1, a: 0.28, b: 0.66, kicker: "четыре буквы", title: "МОРЕ", line: "Голубая нить на чёрном. Повернись — и кит в букве О меняет бок.", face: "face-sea", bead: "#1498b8" },
  { id: "rg-2", v: 1, a: 0.66, b: 1, kicker: "бисер ловит свет", title: "RUSSIAN\nGIRL", line: "Буквы не нарисованы. Каждая собрана стежком и блестит, когда она крутится.", face: "face-russo", bead: "#e23b4a" },
  { id: "gold", v: 2, a: 0, b: 0.3, kicker: "золотой бисер", title: "ВЕРХОВНАЯ", line: "Мечеть и слово набраны по бусине. Золото здесь не краска.", face: "face-gold", bead: "#c6a15a" },
  { id: "witch", v: 2, a: 0.3, b: 0.66, kicker: "бисер и цепи", title: "Верховная\nведьма", line: "Красный стежок, серебро, подвески. Надпись ходит по ткани вместе с телом.", face: "face-ink", bead: "#a61f32" },
  { id: "prosecco", v: 2, a: 0.66, b: 1, kicker: "короткая строчка", title: "Prosecco\nmood", line: "Красная футболка. Чёрная надпись короткая, как само настроение.", face: "face-prosecco", bead: "#111" },
];

const shirts = [
  ["lama", "film/hang/lama.jpg", "NO PROBLAMA", "face-hand", "Лама в очках. Чёрная нить, белая ткань.", true, "Белая футболка с вышитой ламой и надписью NO PROBLAMA"],
  ["more", "film/hang/more.jpg", "МОРЕ", "face-sea", "Киты в буквах. Подпись про песок.", true, "Чёрная футболка с голубой вышивкой МОРЕ"],
  ["russian", "film/hang/russian.jpg", "RUSSIAN GIRL", "face-russo", "Красный бисер на варёной серой.", true, "Серая варёная футболка с красной надписью RUSSIAN GIRL"],
  ["verhov", "film/hang/verhov.jpg", "ВЕРХОВНАЯ", "face-gold", "Золотая мечеть, золотое слово.", true, "Серая футболка с золотой вышивкой мечети и словом Верховная"],
  ["witchred", "film/hang/witchred.jpg", "Верховная ведьма", "face-ink", "Красный бисер и цепи по груди.", true, "Серая футболка с красной надписью Верховная ведьма"],
  ["prosecco", "film/hang/prosecco.jpg", "Prosecco mood", "face-prosecco", "Красная, короткая чёрная строчка.", true, "Красная футболка с чёрной надписью Prosecco mood"],
  ["vedma", "film/hang/vedma.jpg", "Ведьма", "face-ink", "Стеклянный бисер по рукописи.", true, "Чёрная футболка с бисерной надписью Ведьма"],
  ["beads", "film/hang/beads.jpg", "Ведьма шепчет", "face-cond", "Лес слушает. Красные и зелёные нити висят каплями.", false, "Чёрная футболка: Ведьма шепчет, лес слушает"],
  ["wind", "film/hang/wind.jpg", "Деньги на ветер", "face-cond", "Срочно нужны. Зелёная нить на белом.", false, "Белая футболка с зелёной вышивкой Срочно нужны деньги на ветер"],
  ["money", "film/hang/money.jpg", "Я здесь только ради денег", "face-ink", "Розовая рукопись и вспышка страз.", false, "Серая футболка с розовой вышивкой Я здесь только ради денег"],
  ["books", "film/hang/books.jpg", "Больше книг", "face-cond", "Серебряная строчка и красные стразы.", false, "Тёмная футболка со стразами и надписью Больше книг"],
  ["shine", "film/hang/shine.jpg", "Вокруг пи*дец, а я сияю", "face-hand", "Белая строчка по чёрной мятой ткани. Как на футболке.", false, "Чёрная мятая футболка с белой надписью Вокруг пи*дец, а я сияю"],
  ["tyson", "film/hang/tyson.jpg", "Everybody has a plan", "face-russo", "Красная нить. Цитата Тайсона, пока план не встретил лицо.", false, "Чёрная футболка с красной вышитой цитатой Майка Тайсона"],
];

const peg = `<svg class="peg" viewBox="0 0 80 36" aria-hidden="true"><path d="M40 2c0 6 0 8 0 8M28 10h24M14 10l-6 20h64l-6-20" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;

const row = document.getElementById("rack-row");
shirts.forEach((s, i) => {
  const worn = s[5];
  const fig = document.createElement("figure");
  fig.className = "shirt";
  fig.style.transitionDelay = `${i * 60}ms`;
  fig.innerHTML = `${peg}
    <div class="cloth ${worn ? "worn" : "flat"}" style="--focus:${worn ? "center 72%" : "center 50%"};--zoom:${worn ? "2.35" : "1.08"};--zoom-origin:${worn ? "50% 74%" : "50% 50%"}">
      <span class="fit"><img class="body" src="${s[1]}" alt="${s[6]}" draggable="false"></span>
      <span class="seam"></span>
      ${i === 0 ? '<span class="nudge">потяни рукав</span>' : ""}
    </div>
    <figcaption><strong class="${s[3]}">${s[2]}</strong><span>${s[4]}</span></figcaption>`;
  row.appendChild(fig);
});

function chapterAt(p) {
  const slot = Math.min(0.9999, Math.max(0, p)) * 3;
  const v = Math.min(2, Math.floor(slot));
  const local = slot - v;
  const list = chapters.filter((c) => c.v === v);
  return list.find((c) => local >= c.a && local < c.b) || list[list.length - 1];
}

const film = document.querySelector(".film");
const stage = document.querySelector(".film-sticky");
const vids = [...document.querySelectorAll(".turn")];
const copy = document.querySelector(".film-copy");
const h1 = copy.querySelector("h1");
const eyebrow = copy.querySelector(".eyebrow");
const deck = copy.querySelector(".deck");
const count = copy.querySelector(".count");
let current = chapters[0].id;
let raf = 0;

function paint() {
  const total = film.offsetHeight - window.innerHeight;
  const scrolled = Math.min(Math.max(-film.getBoundingClientRect().top, 0), Math.max(total, 1));
  const p = total > 0 ? scrolled / total : 0;
  const slot = Math.min(0.9999, p) * 3;
  const vi = Math.min(2, Math.floor(slot));
  const local = slot - vi;
  vids.forEach((el, i) => {
    el.classList.toggle("on", i === vi);
    if (i !== vi) return;
    const dur = el.duration;
    if (!Number.isFinite(dur) || dur <= 0) return;
    const target = Math.min(dur - 0.05, Math.max(0, local * dur));
    if (Math.abs(el.currentTime - target) > 0.045) el.currentTime = target;
  });
  const next = chapterAt(p);
  if (next.id !== current) {
    current = next.id;
    h1.className = next.face;
    h1.textContent = next.title;
    eyebrow.textContent = next.kicker;
    deck.textContent = next.line;
    const index = chapters.findIndex((c) => c.id === next.id) + 1;
    count.textContent = `${String(index).padStart(2, "0")} / 09`;
  }
  stage.style.setProperty("--bead", next.bead);
  copy.style.setProperty("--bead", next.bead);
}

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
if (reduce) {
  vids.forEach((el, i) => {
    el.classList.toggle("on", i === 0);
    if (i === 0) {
      el.loop = true;
      el.play().catch(() => {});
    }
  });
} else {
  const onScroll = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(paint);
  };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  paint();
}

addEventListener("pointerdown", () => {
  vids.forEach((el) => {
    const pending = el.play();
    if (pending) pending.then(() => { if (!reduce) el.pause(); }).catch(() => {});
  });
}, { once: true });

document.querySelectorAll(".vol").forEach((box) => {
  const v = box.querySelector("video");
  const io = new IntersectionObserver(([e]) => {
    if (!v) return;
    if (e && e.isIntersecting) v.play().catch(() => {});
    else v.pause();
  }, { threshold: 0.35 });
  io.observe(box);
  box.addEventListener("pointermove", (e) => {
    const r = box.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    box.style.transform = `perspective(1000px) rotateY(${x * 7}deg) rotateX(${-y * 5}deg)`;
  });
  box.addEventListener("pointerleave", () => { box.style.transform = ""; });
});

const rack = document.getElementById("rack");
const rackIo = new IntersectionObserver(([e]) => {
  if (e && e.isIntersecting) rack.classList.add("is-in");
}, { threshold: 0.18 });
rackIo.observe(rack);

document.querySelectorAll(".cloth").forEach((el) => {
  const pose = { body: 0, seam: 0, sk: 0, ox: 0 };
  const target = { body: 0, seam: 0, sk: 0, ox: 0 };
  let loop = 0;
  const step = () => {
    pose.body += (target.body - pose.body) * 0.16;
    pose.seam += (target.seam - pose.seam) * 0.16;
    pose.sk += (target.sk - pose.sk) * 0.16;
    pose.ox += (target.ox - pose.ox) * 0.16;
    el.style.setProperty("--body", `${pose.body.toFixed(2)}deg`);
    el.style.setProperty("--seam", `${pose.seam.toFixed(2)}px`);
    el.style.setProperty("--sk", `${pose.sk.toFixed(2)}deg`);
    el.style.setProperty("--ox", `${pose.ox.toFixed(2)}px`);
    const hot = Math.abs(target.body - pose.body) + Math.abs(target.seam - pose.seam) + Math.abs(target.sk - pose.sk) + Math.abs(target.ox - pose.ox) > 0.08;
    loop = hot ? requestAnimationFrame(step) : 0;
  };
  const kick = () => { if (!loop) loop = requestAnimationFrame(step); };
  const move = (e) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const dy = (y - 0.5) * 10;
    const dx = (x - 0.5) * 8;
    if (x < 0.34) {
      target.body = dy * 0.35; target.sk = -3.5; target.seam = -10; target.ox = -8;
      el.style.setProperty("--pull", "82% 20%");
    } else if (x > 0.66) {
      target.body = dy * 0.35; target.sk = 3.5; target.seam = 10; target.ox = 8;
      el.style.setProperty("--pull", "18% 20%");
    } else {
      target.body = dx * 0.4; target.sk = dy * 0.15; target.seam = (x - 0.5) * 22; target.ox = (x - 0.5) * 10;
      el.style.setProperty("--pull", "50% 42%");
    }
    kick();
  };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerdown", move);
  el.addEventListener("pointerleave", () => {
    target.body = target.seam = target.sk = target.ox = 0;
    el.style.setProperty("--pull", "50% 40%");
    kick();
  });
});

const themeBtn = document.getElementById("theme");
const order = ["light", "dark", "system"];
const labels = { light: "Светлая", dark: "Тёмная", system: "Система" };
function syncTheme() {
  const t = document.documentElement.getAttribute("data-theme") || "system";
  themeBtn.textContent = labels[t] || "Система";
}
syncTheme();
themeBtn.addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme") || "system";
  const next = order[(Math.max(0, order.indexOf(cur)) + 1) % order.length];
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("kiyaeva-theme", next); } catch (e) {}
  syncTheme();
});
