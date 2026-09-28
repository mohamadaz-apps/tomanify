/**
 * Tomanify by A.Z
 * Background service worker — live rate fetcher & cache
 *
 * Author: Mohammad Alizade (A.Z)
 * License: MIT
 * Source: https://github.com/mohammad-alizade/tomanify
 */

const ONE_HOUR = 3_600_000;
const CACHE_VERSION = 5; // bump when rate unit/format changes

/**
 * Currency table.
 * mult = 100 when the site lists "صد X" (price per 100 units).
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

/** Fallback rates in Toman (updated Sep 2026) */
const FALLBACK_TOMAN = {
  USD: 229400, EUR: 261800, GBP: 300100, AED: 62460,  TRY: 4680,
  CAD: 161600, AUD: 161600, CNY: 34100,  RUB: 2695,   MYR: 55100,
  GEL: 86900,  AZN: 133600, THB: 6870,   OMR: 592200, INR: 2380,
  PKR: 822,    SAR: 60720,  AFN: 3590,   SEK: 23140,  CHF: 277600,
  QAR: 62620,  NOK: 23860,  NZD: 128780, SGD: 176900, HKD: 28780,
  BRL: 44260,  DKK: 34520,  KWD: 731400, BHD: 598820,
  JPY: 1446,   KRW: 168.7,  IQD: 145.1,  AMD: 627.2,
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
      .replace(/,/g, '')
      .trim(),
    10
  );
}

async function fetchRates() {
  console.log('[Tomanify] Fetching alanchand.com…');
  try {
    const res = await fetch('https://alanchand.com/currencies-price', {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const lookup = new Map(CURRENCY_TABLE.map(e => [norm(e.fa), e]));
    const stripTags = s => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
    const rates = {};

    const trRx = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let tr;
    while ((tr = trRx.exec(html)) !== null) {
      const cells = [];
      const tdRx = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let td;
      while ((td = tdRx.exec(tr[1])) !== null) {
        cells.push(norm(stripTags(td[1])));
      }
      if (cells.length < 2) continue;

      // cells[0] = currency name, cells[1] = buy price (Toman)
      const entry = lookup.get(cells[0]);
      if (!entry) continue;

      const raw = normNum(cells[1]);
      if (isNaN(raw) || raw < 1) continue;

      // Always store Toman per 1 foreign unit
      const tomanPerUnit = Math.round(raw / entry.mult);
      rates[entry.code] = tomanPerUnit;
      console.log(`[Tomanify] ${entry.code} = ${tomanPerUnit} T`);
    }

    const got = Object.keys(rates).length;
    console.log(`[Tomanify] Parsed ${got}/${CURRENCY_TABLE.length} currencies`);

    // Fill gaps with fallback
    let filled = 0;
    for (const [code, val] of Object.entries(FALLBACK_TOMAN)) {
      if (!rates[code]) {
        rates[code] = val;
        filled++;
      }
    }
    if (filled) console.warn(`[Tomanify] Used fallback for ${filled} currencies`);

    return rates;
  } catch (err) {
    console.error('[Tomanify] fetchRates failed:', err.message);
    return { ...FALLBACK_TOMAN };
  }
}

async function getRates(force = false) {
  try {
    const stored = await chrome.storage.local.get(['rates', 'last', 'cacheVersion']);
    const versionOk = stored.cacheVersion === CACHE_VERSION;
    const age = Date.now() - (stored.last || 0);
    const hasRates = stored.rates && Object.keys(stored.rates).length > 0;

    if (!force && versionOk && hasRates && age < ONE_HOUR) {
      const usd = stored.rates.USD;
      // Sanity: USD should be roughly 50k–500k Toman≈ ۱۲٫۰۸۵ میلیارد تومان≈ ۱۲٫۰۸۵ میلیارد تومان
      if (usd && usd > 50_000 && usd < 1_000_000) {
        console.log('[Tomanify] Cache hit, age:', Math.round(age / 60_000), 'min');
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
    });
    return fresh;
  } catch (err) {
    console.error('[Tomanify] getRates:', err);
    return { ...FALLBACK_TOMAN };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_RATES') {
    getRates(false)
      .then(r => sendResponse({ rates: r, ok: true }))
      .catch(() => sendResponse({ rates: FALLBACK_TOMAN, ok: false }));
    return true;
  }
  if (msg.type === 'FORCE_REFRESH') {
    getRates(true)
      .then(r => sendResponse({ rates: r, ok: true }))
      .catch(() => sendResponse({ rates: FALLBACK_TOMAN, ok: false }));
    return true;
  }
});

// Anonymous usage analytics (no personal data)
function track(event) {
  try {
    const url = 'https://tomanify.goatcounter.com/count?' +
      new URLSearchParams({
        p: event,                    // page / event name
        t: 'Tomanify',               // title
        r: '',                       // no referrer
        s: [0, 0, 1].join(','),      // screen dummy
      });
    fetch(url, { mode: 'no-cors', keepalive: true }).catch(() => {});
  } catch (_) {}
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    track('install');
  } else if (details.reason === 'update') {
    track('update');
  }
});

console.log('[Tomanify] Service worker started — cache version:', CACHE_VERSION);
