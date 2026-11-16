const PD = "۰۱۲۳۴۵۶۷۸۹";
const $ = (id) => document.getElementById(id);
const STALE_MS = 86_400_000;
const MILLION = 1_000_000;
const MILLIARD = 1_000_000_000;

const GROUPS = [
  { label: "پرکاربرد", items: [
    { code: "USD", name: "دلار آمریکا", flag: "🇺🇸", sym: "$" },
    { code: "EUR", name: "یورو", flag: "🇪🇺", sym: "€" },
    { code: "GBP", name: "پوند انگلیس", flag: "🇬🇧", sym: "£" },
    { code: "AED", name: "درهم امارات", flag: "🇦🇪", sym: "د.إ" },
    { code: "TRY", name: "لیر ترکیه", flag: "🇹🇷", sym: "₺" },
    { code: "CAD", name: "دلار کانادا", flag: "🇨🇦", sym: "C$" },
    { code: "AUD", name: "دلار استرالیا", flag: "🇦🇺", sym: "A$" },
  ]},
  { label: "اروپا", items: [
    { code: "CHF", name: "فرانک سوئیس", flag: "🇨🇭", sym: "Fr" },
    { code: "SEK", name: "کرون سوئد", flag: "🇸🇪", sym: "kr" },
    { code: "NOK", name: "کرون نروژ", flag: "🇳🇴", sym: "kr" },
    { code: "DKK", name: "کرون دانمارک", flag: "🇩🇰", sym: "kr" },
    { code: "RUB", name: "روبل روسیه", flag: "🇷🇺", sym: "₽" },
    { code: "GEL", name: "لاری گرجستان", flag: "🇬🇪", sym: "₾" },
    { code: "AZN", name: "منات آذربایجان", flag: "🇦🇿", sym: "₼" },
    { code: "AMD", name: "درام ارمنستان", flag: "🇦🇲", sym: "" },
  ]},
  { label: "آسیا و اقیانوسیه", items: [
    { code: "JPY", name: "ین ژاپن", flag: "🇯🇵", sym: "¥" },
    { code: "CNY", name: "یوان چین", flag: "🇨🇳", sym: "¥" },
    { code: "KRW", name: "وون کره جنوبی", flag: "🇰🇷", sym: "₩" },
    { code: "HKD", name: "دلار هنگ کنگ", flag: "🇭🇰", sym: "HK$" },
    { code: "SGD", name: "دلار سنگاپور", flag: "🇸🇬", sym: "S$" },
    { code: "NZD", name: "دلار نیوزیلند", flag: "🇳🇿", sym: "NZ$" },
    { code: "MYR", name: "رینگیت مالزی", flag: "🇲🇾", sym: "RM" },
    { code: "THB", name: "بات تایلند", flag: "🇹🇭", sym: "฿" },
    { code: "INR", name: "روپیه هند", flag: "🇮🇳", sym: "₹" },
    { code: "PKR", name: "روپیه پاکستان", flag: "🇵🇰", sym: "Rs" },
    { code: "AFN", name: "افغانی", flag: "🇦🇫", sym: "؋" },
  ]},
  { label: "خاورمیانه", items: [
    { code: "SAR", name: "ریال عربستان", flag: "🇸🇦", sym: "SR" },
    { code: "OMR", name: "ریال عمان", flag: "🇴🇲", sym: "ر.ع." },
    { code: "QAR", name: "ریال قطر", flag: "🇶🇦", sym: "QR" },
    { code: "KWD", name: "دینار کویت", flag: "🇰🇼", sym: "KD" },
    { code: "BHD", name: "دینار بحرین", flag: "🇧🇭", sym: "BD" },
    { code: "IQD", name: "دینار عراق", flag: "🇮🇶", sym: "ع.د" },
  ]},
  { label: "آمریکای لاتین", items: [
    { code: "BRL", name: "رئال برزیل", flag: "🇧🇷", sym: "R$" },
  ]},
];

const ALL = GROUPS.flatMap((g) => g.items);

const DEFAULTS = {
  badgeSize: 11,
  textColor: "#1b6b3a",
  bgColor: "#edf7f1",
  borderColor: "#b2dfc4",
  enabled: true,
  showToman: true,
  listUnit: "toman",
  pins: ["USD", "EUR", "GBP", "AED"],
  excludedHosts: [],
  overrides: {},
  alertPercent: 0,
  theme: "dark",
};

let rates = {};
let history = {};
let last = null;
let rateSource = '';
let selected = null;
let range = "max";
let cfg = { ...DEFAULTS };

const faDigits = (s) => String(s).replace(/\d/g, (d) => PD[d]);
const persian = (n) => Math.round(Number(n) || 0).toLocaleString("en-US").replace(/\d/g, (d) => PD[d]);

function effective(code) {
  const o = cfg.overrides && cfg.overrides[code];
  if (Number.isFinite(o) && o > 0) return o;
  return rates[code] || 0;
}

function fmtToman(t) {
  if (t >= MILLIARD) return faDigits((t / MILLIARD).toFixed(3).replace(/\.?0+$/, "")).replace(".", "٫") + " میلیارد تومان";
  if (t >= MILLION) return faDigits((t / MILLION).toFixed(2).replace(/\.?0+$/, "")).replace(".", "٫") + " میلیون تومان";
  return persian(t) + " تومان";
}

function displayAmount(toman) {
  if (cfg.listUnit === "rial") return persian(toman * 10) + " ریال";
  return fmtToman(toman);
}

function timeAgo(ts) {
  if (!ts) return "—";
  const m = Math.round((Date.now() - ts) / 60_000);
  if (m < 1) return "همین لحظه";
  if (m < 60) return faDigits(m) + " دقیقه پیش";
  const h = Math.round(m / 60);
  if (h < 24) return faDigits(h) + " ساعت پیش";
  return faDigits(Math.round(h / 24)) + " روز پیش";
}

function ask(type) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type }, (res) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(res);
    });
  });
}

const SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>';
const MOON = '<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>';
const STAR = '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>';

function applyTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  cfg.theme = next;
  const icon = $("themeIcon");
  if (icon) icon.innerHTML = next === "light" ? MOON : SUN;
  $("themeBtn").title = next === "light" ? "حالت تیره" : "حالت روشن";
}

function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 1200);
}

function setPill(kind, text) {
  const el = $("pill");
  el.className = "pill-state" + (kind ? " " + kind : "");
  el.textContent = text;
}

function findCurrency(code) {
  return ALL.find((c) => c.code === code) || null;
}

function parseAmount(raw) {
  let s = String(raw || "").trim().replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
  s = s.replace(/[,،\s]/g, "").replace("٫", ".");
  let mult = 1;
  if (/k$/i.test(s)) { mult = 1_000; s = s.slice(0, -1); }
  else if (/m$/i.test(s)) { mult = 1_000_000; s = s.slice(0, -1); }
  const n = Number(s);
  return Number.isFinite(n) ? n * mult : NaN;
}

function renderConvert() {
  const n = parseAmount($("convAmount").value);
  const code = $("convCode").value;
  const rate = effective(code);
  if (!n || !rate) {
    $("convOut").textContent = "معادل را همین‌جا ببینید";
    return;
  }
  $("convOut").textContent = displayAmount(n * rate);
}

function renderList() {
  const list = $("ratesList");
  const q = $("query").value.trim().toLowerCase();
  if (!rates || !Object.keys(rates).length) {
    list.innerHTML = '<p class="empty">نرخی دریافت نشد. به‌روزرسانی را بزنید.</p>';
    setPill("err", "خطا");
    return;
  }
  const match = (c) => !q || c.name.includes(q) || c.code.toLowerCase().includes(q) || (c.sym && c.sym.toLowerCase().includes(q));
  const pins = (cfg.pins || []).map(findCurrency).filter(Boolean).filter(match);
  const html = [];
  const row = (c) => {
    const toman = effective(c.code);
    if (!toman) return "";
    const pinned = (cfg.pins || []).includes(c.code);
    const manual = cfg.overrides && cfg.overrides[c.code];
    return `<div class="rate" data-code="${c.code}">
      <span class="rl"><button type="button" class="star ${pinned ? "on" : ""}" data-pin="${c.code}" title="سنجاق" aria-label="سنجاق"><svg viewBox="0 0 24 24" fill="${pinned ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${STAR}</svg></button>
      <span class="flag">${c.code.slice(0, 2)}</span><span><span class="cur-name">${c.name}</span>
      <div class="cur-code">${c.code}${c.sym ? " · " + c.sym : ""}${manual ? " · دستی" : ""}</div></span></span>
      <span class="rr" data-copy="${c.code}"><div class="r-toman">${displayAmount(toman)}</div>
      <div class="r-rial">${cfg.listUnit === "rial" ? fmtToman(toman) : persian(toman * 10) + " ریال"}</div></span>
    </div>`;
  };
  if (pins.length) {
    html.push('<div class="grp">سنجاق‌شده</div>');
    html.push(pins.map(row).join(""));
  }
  for (const group of GROUPS) {
    const rows = group.items.filter(match).filter((c) => !pins.some((p) => p.code === c.code));
    if (!rows.length) continue;
    html.push(`<div class="grp">${group.label}</div>`);
    html.push(rows.map(row).join(""));
  }
  list.innerHTML = html.join("") || '<p class="empty">ارزی با این نام نیست.</p>';
  list.querySelectorAll(".rate").forEach((el, i) => { el.style.animationDelay = Math.min(i * 18, 220) + "ms"; });
  const stale = !last || Date.now() - last >= STALE_MS;
  setPill(stale ? "stale" : "ok", stale ? "منقضی" : "به‌روز");
  const src = rateSource ? " · " + rateSource : "";
  $("tsLabel").textContent = "آخرین به‌روزرسانی: " + timeAgo(last) + src;
  $("unitBtn").textContent = cfg.listUnit === "rial" ? "ریال" : "تومان";
  $("unitBtn").classList.toggle("on", cfg.listUnit === "rial");
}

function sliceSeries(series) {
  const all = Array.isArray(series) ? series : [];
  if (range === "week") return all.slice(-7);
  if (range === "month") return all.slice(-30);
  return all;
}

function drawChart(points) {
  const host = $("chart");
  const w = Math.max(280, host.clientWidth || 320);
  const h = 150;
  if (points.length < 2) {
    host.innerHTML = '<p class="empty">تاریخچه از امروز شروع می‌شود.<br>هر روز یک نقطه ذخیره می‌شود.</p>';
    return;
  }
  const vals = points.map((p) => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const coords = vals.map((v, i) => {
    const x = 8 + (i / (vals.length - 1)) * (w - 20);
    const y = 14 + (1 - (v - min) / span) * (h - 32);
    return [x, y];
  });
  const line = coords.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const lastPt = coords[coords.length - 1];
  const first = coords[0];
  host.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5ef2a2" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="#5ef2a2" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${line} L${lastPt[0].toFixed(1)} ${h - 6} L${first[0].toFixed(1)} ${h - 6} Z" fill="url(#g)"></path>
    <path d="${line}" fill="none" stroke="#5ef2a2" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"></path>
    <circle cx="${lastPt[0].toFixed(1)}" cy="${lastPt[1].toFixed(1)}" r="4.5" fill="#151517" stroke="#5ef2a2" stroke-width="2"></circle>
  </svg>`;
}

function renderChart() {
  const item = findCurrency(selected);
  if (!item) return;
  const points = sliceSeries(history[item.code]);
  const now = effective(item.code);
  $("chartTitle").textContent = `${item.code}  ${item.name}`;
  drawChart(points);
  $("bigNum").textContent = now ? persian(cfg.listUnit === "rial" ? now * 10 : now) : "—";
  $("footLabel").textContent = cfg.listUnit === "rial" ? "هر واحد، ریال" : "هر واحد، تومان";
  $("pinBtn").textContent = (cfg.pins || []).includes(item.code) ? "برداشتن سنجاق" : "سنجاق";
  const ov = cfg.overrides && cfg.overrides[item.code];
  $("overrideInput").value = ov ? String(ov) : "";
  if (points.length > 1) {
    const diff = points[points.length - 1].v - points[0].v;
    const pct = (diff / points[0].v) * 100;
    const neg = diff < 0;
    $("bigDelta").textContent = (neg ? "−" : "+") + persian(Math.abs(diff));
    $("bigDelta").className = "delta" + (neg ? " neg" : "");
    $("bigPct").textContent = (neg ? "↓ " : "↑ ") + faDigits(Math.abs(pct).toFixed(1)) + "٪";
    $("bigPct").className = "pct" + (neg ? " neg" : "");
    $("chartNote").textContent = ov ? "عدد بزرگ نرخ دستی است. نمودار نرخ بازار را نشان می‌دهد." : "تغییر از ابتدای این بازه تا آخرین نرخ ذخیره‌شده.";
  } else {
    $("bigDelta").textContent = "";
    $("bigPct").textContent = "";
    $("chartNote").textContent = "نرخ بالا همین امروز است. نمودار با به‌روزرسانی روزانه پر می‌شود.";
  }
}

function show(view) {
  const views = { list: $("listView"), chart: $("chartView"), settings: $("settingsView") };
  Object.entries(views).forEach(([name, el]) => {
    const on = name === view;
    el.hidden = !on;
    if (on) { el.classList.remove("enter"); void el.offsetWidth; el.classList.add("enter"); }
  });
  $("toolbar").style.display = view === "list" ? "" : "none";
}

function applyPreview() {
  const p = $("badgePreview");
  p.style.fontSize = cfg.badgeSize + "px";
  p.style.color = cfg.textColor;
  p.style.background = cfg.bgColor;
  p.style.borderColor = cfg.borderColor;
  p.style.display = cfg.enabled ? "inline-block" : "none";
  p.textContent = cfg.showToman ? "≈ ۴۴۰٬۰۰۰ تومان" : "≈ ۴۴۰٬۰۰۰";
}

function renderExclude() {
  const hosts = cfg.excludedHosts || [];
  $("excludeList").innerHTML = hosts.length
    ? hosts.map((h) => `<button type="button" class="chip" data-host="${h}">${h} ×</button>`).join("")
    : '<span class="sub">هیچ سایتی مستثنی نیست.</span>';
}

function syncSettings() {
  $("sEnabled").checked = cfg.enabled;
  $("sToman").checked = cfg.showToman;
  $("sSize").value = String(cfg.badgeSize);
  $("sSizeVal").textContent = faDigits(cfg.badgeSize);
  $("sText").value = cfg.textColor;
  $("sBg").value = cfg.bgColor;
  $("sBorder").value = cfg.borderColor;
  $("alertPct").value = String(cfg.alertPercent || 0);
  applyPreview();
  renderExclude();
}

function saveSettings() {
  chrome.storage.local.set({ settings: cfg });
  applyPreview();
}

function fillConvSelect() {
  $("convCode").innerHTML = ALL.map((c) => `<option value="${c.code}">${c.code}</option>`).join("");
}

async function load(force) {
  $("refreshBtn").classList.add("spin");
  setPill("", "در حال بارگذاری");
  const res = await ask(force ? "FORCE_REFRESH" : "GET_RATES");
  $("refreshBtn").classList.remove("spin");
  if (!res) { setPill("err", "خطا"); return; }
  rates = res.rates || {};
  history = res.history || {};
  last = res.last || null;
  rateSource = res.source || '';
  if (selected) renderChart();
  renderList();
  renderConvert();
}

$("ratesList").addEventListener("click", async (e) => {
  const pin = e.target.closest("[data-pin]");
  if (pin) {
    e.stopPropagation();
    const code = pin.dataset.pin;
    const pins = new Set(cfg.pins || []);
    if (pins.has(code)) pins.delete(code); else pins.add(code);
    cfg.pins = [...pins];
    saveSettings();
    renderList();
    return;
  }
  const copy = e.target.closest("[data-copy]");
  if (copy && e.target.closest(".rr")) {
    const toman = effective(copy.dataset.copy);
    const text = cfg.listUnit === "rial" ? String(Math.round(toman * 10)) : String(Math.round(toman));
    try { await navigator.clipboard.writeText(text); toast("کپی شد"); } catch (_) { toast(text); }
    return;
  }
  const row = e.target.closest("[data-code]");
  if (!row) return;
  selected = row.dataset.code;
  range = "max";
  document.querySelectorAll(".range button").forEach((b) => b.setAttribute("aria-selected", b.dataset.range === "max" ? "true" : "false"));
  show("chart");
  renderChart();
});

$("backBtn").addEventListener("click", () => { selected = null; show("list"); renderList(); });
$("settingsBtn").addEventListener("click", () => { show("settings"); syncSettings(); });
$("themeBtn").addEventListener("click", () => {
  applyTheme(cfg.theme === "light" ? "dark" : "light");
  saveSettings();
});
$("settingsBack").addEventListener("click", () => show(selected ? "chart" : "list"));
$("refreshBtn").addEventListener("click", () => load(true));
$("query").addEventListener("input", renderList);
$("unitBtn").addEventListener("click", () => {
  cfg.listUnit = cfg.listUnit === "rial" ? "toman" : "rial";
  saveSettings();
  renderList();
  renderConvert();
});
$("convAmount").addEventListener("input", renderConvert);
$("convCode").addEventListener("change", renderConvert);

document.querySelectorAll(".range button").forEach((btn) => {
  btn.addEventListener("click", () => {
    range = btn.dataset.range;
    document.querySelectorAll(".range button").forEach((b) => b.setAttribute("aria-selected", b === btn ? "true" : "false"));
    renderChart();
  });
});

$("pinBtn").addEventListener("click", () => {
  if (!selected) return;
  const pins = new Set(cfg.pins || []);
  if (pins.has(selected)) pins.delete(selected); else pins.add(selected);
  cfg.pins = [...pins];
  saveSettings();
  renderChart();
});

$("overrideSave").addEventListener("click", () => {
  const n = parseAmount($("overrideInput").value);
  if (!selected || !n) return;
  cfg.overrides = { ...(cfg.overrides || {}), [selected]: Math.round(n) };
  saveSettings();
  renderChart();
  toast("نرخ دستی ذخیره شد");
});
$("overrideClear").addEventListener("click", () => {
  if (!selected || !cfg.overrides) return;
  delete cfg.overrides[selected];
  saveSettings();
  renderChart();
});

$("sEnabled").addEventListener("change", (e) => { cfg.enabled = e.target.checked; saveSettings(); });
$("sToman").addEventListener("change", (e) => { cfg.showToman = e.target.checked; saveSettings(); });
$("sSize").addEventListener("input", (e) => { cfg.badgeSize = Number(e.target.value); $("sSizeVal").textContent = faDigits(cfg.badgeSize); saveSettings(); });
$("sText").addEventListener("input", (e) => { cfg.textColor = e.target.value; saveSettings(); });
$("sBg").addEventListener("input", (e) => { cfg.bgColor = e.target.value; saveSettings(); });
$("sBorder").addEventListener("input", (e) => { cfg.borderColor = e.target.value; saveSettings(); });
$("alertPct").addEventListener("change", (e) => { cfg.alertPercent = Math.max(0, Number(e.target.value) || 0); saveSettings(); });
$("resetBtn").addEventListener("click", () => {
  cfg = { ...DEFAULTS, pins: cfg.pins, excludedHosts: cfg.excludedHosts, overrides: cfg.overrides, listUnit: cfg.listUnit, alertPercent: cfg.alertPercent };
  saveSettings();
  syncSettings();
});

function addHost(host) {
  host = String(host || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  if (!host || host.includes(" ")) return;
  const set = new Set(cfg.excludedHosts || []);
  set.add(host);
  cfg.excludedHosts = [...set];
  saveSettings();
  renderExclude();
}
$("excludeAdd").addEventListener("click", () => { addHost($("excludeInput").value); $("excludeInput").value = ""; });
$("excludeInput").addEventListener("keydown", (e) => { if (e.key === "Enter") { addHost($("excludeInput").value); $("excludeInput").value = ""; } });
$("excludeCurrent").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    try { addHost(new URL(tabs[0].url).hostname); } catch (_) {}
  });
});
$("excludeList").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-host]");
  if (!btn) return;
  cfg.excludedHosts = (cfg.excludedHosts || []).filter((h) => h !== btn.dataset.host);
  saveSettings();
  renderExclude();
});

fillConvSelect();
applyTheme(cfg.theme);
chrome.storage.local.get("settings", (stored) => {
  cfg = { ...DEFAULTS, ...(stored.settings || {}) };
  applyTheme(cfg.theme);
  syncSettings();
  load(false);
});
