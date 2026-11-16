/**
 * Tomanify by A.Z
 * Background service worker — live rate fetcher & cache
 *
 * Author: Mohammad Alizade (A.Z)
 * License: MIT
 * Source: https://github.com/mohammad-alizade/tomanify
 */

const ONE_DAY = 86_400_000;
const CACHE_VERSION = 6; // multi-source rates

/**
 * Currency table.
 * mult = 100 when AlanChand lists "صد X" (price per 100 units).
 * fa names must match the Persian text on alanchand.com exactly.
 */
const CURRENCY_TABLE = [
  { fa: 'دلار آمریکا',       code: 'USD', mult: 1 },
  { fa: 'یورو',               code: 'EUR', mult: 1 },
  { fa: 'پوند انگلیس',       code: 'GBP', mult: 1 },
  { fa: 'درهم',               code: 'AED', mult: 1 },
  { fa: 'لیر ترکیه',         code: 'TRY', mult: 1 },
  { fa: 'دلار کانادا',       code: 'CAD', mult: 1 },
  { fa: 'دلار استرالیا',     code: 'AUD', mult: 1 },
  { fa: 'یوان چین',          code: 'CNY', mult: 1 },
  { fa: 'روبل روسیه',        code: 'RUB', mult: 1 },
  { fa: 'رینگیت مالزی',      code: 'MYR', mult: 1 },
  { fa: 'لاری گرجستان',      code: 'GEL', mult: 1 },
  { fa: 'منات آذربایجان',    code: 'AZN', mult: 1 },
  { fa: 'بات تایلند',        code: 'THB', mult: 1 },
  { fa: 'ریال عمان',         code: 'OMR', mult: 1 },
  { fa: 'روپیه هند',         code: 'INR', mult: 1 },
  { fa: 'روپیه پاکستان',     code: 'PKR', mult: 1 },
  { fa: 'ریال عربستان',      code: 'SAR', mult: 1 },
  { fa: 'افغانی',             code: 'AFN', mult: 1 },
  { fa: 'کرون سوئد',         code: 'SEK', mult: 1 },
  { fa: 'فرانک سوئیس',       code: 'CHF', mult: 1 },
  { fa: 'ریال قطر',          code: 'QAR', mult: 1 },
  { fa: 'کرون نروژ',         code: 'NOK', mult: 1 },
  { fa: 'دلار نیوزلند',      code: 'NZD', mult: 1 },
  { fa: 'دلار سنگاپور',      code: 'SGD', mult: 1 },
  { fa: 'دلار هنگ کنگ',      code: 'HKD', mult: 1 },
  { fa: 'رئال برزیل',        code: 'BRL', mult: 1 },
  { fa: 'کرون دانمارک',      code: 'DKK', mult: 1 },
  { fa: 'دینار کویت',        code: 'KWD', mult: 1 },
  { fa: 'دینار بحرین',       code: 'BHD', mult: 1 },
  // "صد X" rows → divide by 100
  { fa: 'صد ین ژاپن',        code: 'JPY', mult: 100 },
  { fa: 'صد وون کره جنوبی',  code: 'KRW', mult: 100 },
  { fa: 'صد دینار عراق',     code: 'IQD', mult: 100 },
  { fa: 'صد درام ارمنستان',  code: 'AMD', mult: 100 },
];

/** Fallback rates in Toman (Nov 2026, used only if every source fails) */
const FALLBACK_TOMAN = {
  USD: 271800, EUR: 299950, GBP: 359170, AED: 74710,  TRY: 5400,
  CAD: 190700, AUD: 184250, CNY: 40750,  RUB: 3285,   MYR: 66520,
  GEL: 104960, AZN: 158620, THB: 8020,   OMR: 706880, INR: 2885,
  PKR: 985,    SAR: 72120,  AFN: 4245,   SEK: 26980,  CHF: 324100,
  QAR: 74540,  NOK: 28410,  NZD: 150270, SGD: 211000, HKD: 34640,
  BRL: 48170,  DKK: 40120,  KWD: 872580, BHD: 720300,
  JPY: 1700,   KRW: 203,    IQD: 179,    AMD: 755,
};

const WANTED = CURRENCY_TABLE.map(e => e.code);

const FETCH_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/json',
  'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

function norm(s) {
  return (s || '')
    .replace(/[\u200b\u200c\u200d\u200e\u200f\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normNum(s) {
  return parseInt(
    String(s)
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/[,\u066c]/g, '')
      .trim(),
    10
  );
}

function sane(code, value) {
  if (!Number.isFinite(value) || value <= 0) return false;
  if (code === 'USD') return value >= 50_000 && value <= 500_000;
  if (code === 'EUR' || code === 'GBP' || code === 'CHF') return value >= 40_000 && value <= 800_000;
  if (code === 'KRW' || code === 'IQD') return value >= 1 && value <= 5_000;
  return value >= 1 && value <= 5_000_000;
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

async function fetchText(url) {
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// 1. Navasan open JSON (toman, full set)
async function fromNavasan() {
  const text = await fetchText('https://raw.githubusercontent.com/HosseinOdd/Navasan-API/main/data/fiat.json');
  const data = JSON.parse(text);
  const rates = {};
  for (const code of WANTED) {
    const v = Number(data[code.toLowerCase()]?.value);
    if (sane(code, v)) rates[code] = Math.round(v);
  }
  return rates;
}

// 2. Arznab HTML (toman, data-s="USD" + data-f="p")
async function fromArznab() {
  const html = await fetchText('https://arznab.com/currency');
  const rates = {};
  const rx = /data-s="([A-Z]{3})"[\s\S]{0,600}?data-f="p">([^<]+)/g;
  let m;
  while ((m = rx.exec(html)) !== null) {
    const code = m[1];
    if (!WANTED.includes(code)) continue;
    const v = normNum(m[2]);
    if (sane(code, v)) rates[code] = v;
  }
  return rates;
}

// 3. Nerkhara HTML (toman, data-fiat="USD" data-v="269100")
async function fromNerkhara() {
  const html = await fetchText('https://nerkhara.com/');
  const rates = {};
  const rx = /data-fiat="([A-Z]{3})"[^>]*data-v="([0-9.]+)"/g;
  let m;
  while ((m = rx.exec(html)) !== null) {
    const code = m[1];
    if (!WANTED.includes(code)) continue;
    const v = Math.round(Number(m[2]));
    if (sane(code, v)) rates[code] = v;
  }
  return rates;
}

// 4. AlanChand HTML (toman, Persian table)
async function fromAlanChand() {
  const html = await fetchText('https://alanchand.com/currencies-price');
  const lookup = new Map(CURRENCY_TABLE.map(e => [norm(e.fa), e]));
  const stripTags = s => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
  const rates = {};
  const trRx = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr;
  while ((tr = trRx.exec(html)) !== null) {
    const cells = [];
    const tdRx = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let td;
    while ((td = tdRx.exec(tr[1])) !== null) cells.push(norm(stripTags(td[1])));
    if (cells.length < 2) continue;
    const entry = lookup.get(cells[0]);
    if (!entry) continue;
    const raw = normNum(cells[1]);
    if (!raw) continue;
    const v = Math.round(raw / entry.mult);
    if (sane(entry.code, v)) rates[entry.code] = v;
  }
  return rates;
}

// 5. TGJU ajax.json (rial → toman; JPY listed per 100)
const TGJU_MAP = {
  price_dollar_rl: ['USD', 10],
  price_eur: ['EUR', 10],
  price_gbp: ['GBP', 10],
  price_aed: ['AED', 10],
  price_try: ['TRY', 10],
  price_cny: ['CNY', 10],
  price_cad: ['CAD', 10],
  price_aud: ['AUD', 10],
  price_chf: ['CHF', 10],
  price_sar: ['SAR', 10],
  price_kwd: ['KWD', 10],
  price_jpy: ['JPY', 1000],
};

async function fromTgju() {
  const text = await fetchText('https://call.tgju.org/ajax.json');
  const data = JSON.parse(text).current || {};
  const rates = {};
  for (const [key, [code, div]] of Object.entries(TGJU_MAP)) {
    const raw = normNum(data[key]?.p);
    if (!raw) continue;
    const v = Math.round(raw / div);
    if (sane(code, v)) rates[code] = v;
  }
  return rates;
}

const SOURCES = [
  { name: 'Navasan', run: fromNavasan },
  { name: 'Arznab', run: fromArznab },
  { name: 'Nerkhara', run: fromNerkhara },
  { name: 'AlanChand', run: fromAlanChand },
  { name: 'TGJU', run: fromTgju },
];

let lastSource = '';

async function fetchRates() {
  const settled = await Promise.allSettled(SOURCES.map(s => s.run().then(rates => ({ name: s.name, rates }))));
  const ok = settled.filter(r => r.status === 'fulfilled' && r.value.rates && Object.keys(r.value.rates).length).map(r => r.value);
  console.log('[Tomanify] sources:', ok.map(s => `${s.name}:${Object.keys(s.rates).length}`).join(', ') || 'none');

  const rates = {};
  const votes = {};
  for (const src of ok) {
    for (const [code, value] of Object.entries(src.rates)) {
      if (!sane(code, value)) continue;
      (votes[code] ||= []).push({ value, name: src.name });
    }
  }

  for (const code of WANTED) {
    const list = votes[code] || [];
    if (!list.length) continue;
    rates[code] = median(list.map(x => x.value));
  }

  // Prefer a source whose USD is closest to the merged USD, for the label
  if (rates.USD) {
    let best = ok[0];
    let bestDiff = Infinity;
    for (const src of ok) {
      if (!src.rates.USD) continue;
      const d = Math.abs(src.rates.USD - rates.USD);
      if (d < bestDiff) { bestDiff = d; best = src; }
    }
    lastSource = best ? best.name : '';
  } else {
    lastSource = '';
  }

  let filled = 0;
  for (const [code, val] of Object.entries(FALLBACK_TOMAN)) {
    if (!rates[code]) { rates[code] = val; filled++; }
  }
  if (filled) console.warn(`[Tomanify] fallback for ${filled} currencies`);
  if (!ok.length) lastSource = 'پشتیبان';
  console.log(`[Tomanify] merged USD=${rates.USD} from ${lastSource || '—'}`);
  return rates;
}

async function getRates(force = false) {
  try {
    const stored = await chrome.storage.local.get(['rates', 'last', 'cacheVersion']);
    const versionOk = stored.cacheVersion === CACHE_VERSION;
    const age = Date.now() - (stored.last || 0);
    const hasRates = stored.rates && Object.keys(stored.rates).length > 0;

    if (!force && versionOk && hasRates && age < ONE_DAY) {
      const usd = stored.rates.USD;
      if (usd && usd > 50_000 && usd < 1_000_000) {
        console.log('[Tomanify] Cache hit, age:', Math.round(age / 3_600_000), 'h');
        return stored.rates;
      }
      console.warn('[Tomanify] USD sanity failed:', usd, '— refetching');
    }

    if (!versionOk) console.log('[Tomanify] Cache version mismatch — wiping');

    const fresh = await fetchRates();
    await chrome.storage.local.set({
      rates: fresh,
      last: Date.now(),
      cacheVersion: CACHE_VERSION,
      rateSource: lastSource,
    });
    await recordHistory(fresh);
    await checkBigMove(fresh);
    return fresh;
  } catch (err) {
    console.error('[Tomanify] getRates:', err);
    return { ...FALLBACK_TOMAN };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_RATES' || msg.type === 'FORCE_REFRESH') {
    getRates(msg.type === 'FORCE_REFRESH')
      .then(async (r) => {
        const extra = await chrome.storage.local.get(['history', 'last', 'rateSource']);
        sendResponse({
          rates: r,
          ok: true,
          history: extra.history || {},
          last: extra.last || null,
          source: extra.rateSource || lastSource || '',
        });
      })
      .catch(async () => {
        const extra = await chrome.storage.local.get(['history', 'last']);
        sendResponse({
          rates: FALLBACK_TOMAN,
          ok: false,
          history: extra.history || {},
          last: extra.last || null,
        });
      });
    return true;
  }
  if (msg.type === 'GET_FONT') {
    getFont()
      .then(font => sendResponse({ font }))
      .catch(() => sendResponse({ font: null }));
    return true;
  }
});

/** One point per currency per calendar day. The chart reads this. */
async function recordHistory(rates) {
  const day = new Date().toISOString().slice(0, 10);
  const stored = await chrome.storage.local.get('history');
  const history = stored.history && typeof stored.history === 'object' ? stored.history : {};
  for (const [code, value] of Object.entries(rates || {})) {
    if (!Number.isFinite(value) || value <= 0) continue;
    const series = Array.isArray(history[code]) ? history[code] : [];
    const last = series[series.length - 1];
    if (last && last.d === day) series[series.length - 1] = { d: day, v: value };
    else series.push({ d: day, v: value });
    history[code] = series.slice(-400);
  }
  await chrome.storage.local.set({ history });
}

async function checkBigMove(fresh) {
  try {
    const stored = await chrome.storage.local.get(['settings', 'history']);
    const pct = Number(stored.settings && stored.settings.alertPercent) || 0;
    if (pct <= 0) return;
    const series = (stored.history && stored.history.USD) || [];
    if (series.length < 2 || !fresh.USD) return;
    const prev = series[series.length - 2].v;
    if (!prev) return;
    const change = Math.abs((fresh.USD - prev) / prev) * 100;
    if (change < pct) return;
    const dir = fresh.USD >= prev ? 'بالا' : 'پایین';
    chrome.notifications.create('tomanify-move', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'تومانیفای',
      message: `دلار ${change.toFixed(1)}٪ ${dir} رفت. الان ${Math.round(fresh.USD).toLocaleString('en-US')} تومان.`,
    });
  } catch (_) {}
}

const MENU_ID = 'tomanify-convert';
function ensureMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'تبدیل به تومان',
      contexts: ['selection'],
    });
  });
}

const SYMBOLS = {
  '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR', '₺': 'TRY', '₽': 'RUB',
  USD: 'USD', EUR: 'EUR', GBP: 'GBP', AED: 'AED', CAD: 'CAD', AUD: 'AUD', CHF: 'CHF',
  TRY: 'TRY', CNY: 'CNY', JPY: 'JPY', SAR: 'SAR', KWD: 'KWD',
};

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID) return;
  const text = info.selectionText || '';
  const stored = await chrome.storage.local.get(['rates', 'settings']);
  const rates = stored.rates || FALLBACK_TOMAN;
  const overrides = (stored.settings && stored.settings.overrides) || {};
  const num = text.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[,،\s]/g, '').match(/[\d.]+/);
  if (!num) return;
  let code = 'USD';
  for (const [mark, c] of Object.entries(SYMBOLS)) {
    if (text.includes(mark)) { code = c; break; }
  }
  const rate = overrides[code] || rates[code];
  if (!rate) return;
  const toman = Math.round(Number(num[0]) * rate);
  chrome.notifications.create('tomanify-sel', {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'تومانیفای',
    message: `${num[0]} ${code} ≈ ${toman.toLocaleString('en-US')} تومان`,
  });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-badges') return;
  const stored = await chrome.storage.local.get('settings');
  const settings = { ...(stored.settings || {}) };
  settings.enabled = settings.enabled === false;
  await chrome.storage.local.set({ settings });
});

function ensureDailyAlarm() {
  chrome.alarms.get('tomanify-daily', (existing) => {
    if (chrome.runtime.lastError || existing) return;
    chrome.alarms.create('tomanify-daily', { periodInMinutes: 24 * 60 });
  });
}

ensureDailyAlarm();
ensureMenu();
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'tomanify-daily') getRates(true);
});

let fontB64 = null;
function getFont() {
  if (fontB64) return Promise.resolve(fontB64);
  return fetch(chrome.runtime.getURL('fonts/Vazirmatn-SemiBold.woff2'))
    .then(res => {
      if (!res.ok) throw new Error('font ' + res.status);
      return res.arrayBuffer();
    })
    .then(buf => {
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      fontB64 = btoa(binary);
      return fontB64;
    });
}

function track(event) {
  try {
    const url = 'https://tomanify.goatcounter.com/count?' +
      new URLSearchParams({
        p: event,
        t: 'Tomanify',
        r: '',
        s: [0, 0, 1].join(','),
      });
    fetch(url, { mode: 'no-cors', keepalive: true }).catch(() => {});
  } catch (_) {}
}

chrome.runtime.onInstalled.addListener((details) => {
  ensureDailyAlarm();
  ensureMenu();
  if (details.reason === 'install') {
    track('install');
  } else if (details.reason === 'update') {
    track('update');
  }
});

console.log('[Tomanify] Service worker started — cache version:', CACHE_VERSION);
