/**
 * Tomanify by A.Z
 * Popup UI — live rates list & badge settings
 *
 * Author: Mohammad Alizade (A.Z)
 * License: MIT
 * Source: https://github.com/mohammad-alizade/tomanify
 */

// Count popup opens
try {
  fetch('https://tomanify.goatcounter.com/count?' + new URLSearchParams({
    p: 'popup-open',
    t: 'Tomanify Popup',
  }), { mode: 'no-cors', keepalive: true }).catch(() => {});
} catch (_) {}

const PD = '۰۱۲۳۴۵۶۷۸۹';
const persian = n => Math.round(n).toLocaleString('en-US').replace(/\d/g, d => PD[d]);

const MILLIARD = 1_000_000_000;
const MILLION  = 1_000_000;
const STALE_MS = 3_600_000; // 1 hour — match background cache TTL

function fmtToman(t) {
  if (t >= MILLIARD) {
    const v = (t / MILLIARD).toFixed(3).replace(/\.?0+$/, '');
    return v.replace(/\d/g, d => PD[d]).replace('.', '٫') + ' میلیارد تومان';
  }
  if (t >= MILLION) {
    const v = (t / MILLION).toFixed(2).replace(/\.?0+$/, '');
    return v.replace(/\d/g, d => PD[d]).replace('.', '٫') + ' میلیون تومان';
  }
  return persian(t) + ' تومان';
}

const timeAgo = ts => {
  if (!ts) return '—';
  const m = Math.round((Date.now() - ts) / 60_000);
  if (m < 1) return 'همین لحظه';
  if (m < 60) return `${persian(m)} دقیقه پیش`;
  const h = Math.round(m / 60);
  if (h < 24) return `${persian(h)} ساعت پیش`;
  const d = Math.round(h / 24);
  return `${persian(d)} روز پیش`;
};

const $  = id   => document.getElementById(id);
const gs = keys => new Promise(r => chrome.storage.local.get(keys, r));
const ss = obj  => new Promise(r => chrome.storage.local.set(obj, r));
const ds = keys => new Promise(r => chrome.storage.local.remove(keys, r));
const msg = m   => new Promise(r => chrome.runtime.sendMessage(m, res => {
  if (chrome.runtime.lastError) r(null); else r(res);
}));

// ── Currency groups ─────────────────────────────────────────────────────────
const GROUPS = [
  { label: 'پرکاربرد', items: [
    { code: 'USD', name: 'دلار آمریکا',   flag: '🇺🇸', sym: '$' },
    { code: 'EUR', name: 'یورو',           flag: '🇪🇺', sym: '€' },
    { code: 'GBP', name: 'پوند انگلیس',   flag: '🇬🇧', sym: '£' },
    { code: 'AED', name: 'درهم امارات',   flag: '🇦🇪', sym: 'AED' },
    { code: 'TRY', name: 'لیر ترکیه',     flag: '🇹🇷', sym: '₺' },
    { code: 'CAD', name: 'دلار کانادا',   flag: '🇨🇦', sym: 'C$' },
    { code: 'AUD', name: 'دلار استرالیا', flag: '🇦🇺', sym: 'A$' },
  ]},
  { label: 'اروپا', items: [
    { code: 'CHF', name: 'فرانک سوئیس',  flag: '🇨🇭', sym: 'Fr' },
    { code: 'SEK', name: 'کرون سوئد',    flag: '🇸🇪', sym: 'kr' },
    { code: 'NOK', name: 'کرون نروژ',    flag: '🇳🇴', sym: 'kr' },
    { code: 'DKK', name: 'کرون دانمارک', flag: '🇩🇰', sym: 'kr' },
    { code: 'RUB', name: 'روبل روسیه',   flag: '🇷🇺', sym: '₽' },
    { code: 'GEL', name: 'لاری گرجستان', flag: '🇬🇪', sym: '₾' },
    { code: 'AZN', name: 'منات آذربایجان', flag: '🇦🇿', sym: '₼' },
    { code: 'AMD', name: 'درام ارمنستان', flag: '🇦🇲', sym: '' },
  ]},
  { label: 'آسیا و اقیانوسیه', items: [
    { code: 'JPY', name: 'ین ژاپن',      flag: '🇯🇵', sym: '¥' },
    { code: 'CNY', name: 'یوان چین',     flag: '🇨🇳', sym: '¥' },
    { code: 'KRW', name: 'وون کره جنوبی', flag: '🇰🇷', sym: '₩' },
    { code: 'HKD', name: 'دلار هنگ کنگ', flag: '🇭🇰', sym: 'HK$' },
    { code: 'SGD', name: 'دلار سنگاپور', flag: '🇸🇬', sym: 'S$' },
    { code: 'NZD', name: 'دلار نیوزلند', flag: '🇳🇿', sym: 'NZ$' },
    { code: 'MYR', name: 'رینگیت مالزی', flag: '🇲🇾', sym: 'RM' },
    { code: 'THB', name: 'بات تایلند',   flag: '🇹🇭', sym: '฿' },
    { code: 'INR', name: 'روپیه هند',    flag: '🇮🇳', sym: '₹' },
    { code: 'PKR', name: 'روپیه پاکستان', flag: '🇵🇰', sym: 'Rs' },
    { code: 'AFN', name: 'افغانی',       flag: '🇦🇫', sym: '؋' },
  ]},
  { label: 'خاورمیانه', items: [
    { code: 'SAR', name: 'ریال عربستان', flag: '🇸🇦', sym: 'SR' },
    { code: 'OMR', name: 'ریال عمان',    flag: '🇴🇲', sym: 'OMR' },
    { code: 'QAR', name: 'ریال قطر',     flag: '🇶🇦', sym: 'QAR' },
    { code: 'KWD', name: 'دینار کویت',   flag: '🇰🇼', sym: 'KWD' },
    { code: 'BHD', name: 'دینار بحرین',  flag: '🇧🇭', sym: 'BHD' },
    { code: 'IQD', name: 'دینار عراق',   flag: '🇮🇶', sym: 'IQD' },
  ]},
  { label: 'آمریکای لاتین', items: [
    { code: 'BRL', name: 'رئال برزیل',   flag: '🇧🇷', sym: 'R$' },
  ]},
];

// ── Status ──────────────────────────────────────────────────────────────────
function setStatus(type, txt) {
  $('pill').className    = 'pill ' + type;
  $('pillDot').className = 'dot' + (type === 'ok' || type === 'load' ? ' pulse' : '');
  $('pillTxt').textContent = txt;
}

function isStale(ts) {
  if (!ts) return true;
  return (Date.now() - ts) >= STALE_MS;
}

// ── Render rates ────────────────────────────────────────────────────────────
function renderRates(rates, ts) {
  const list = $('ratesList');
  if (!rates || !Object.keys(rates).length) {
    list.innerHTML = `<div class="empty"><div class="ei">⚠️</div>نرخی دریافت نشد.<br>دکمه به‌روزرسانی را بزنید.</div>`;
    setStatus('err', 'خطا در دریافت');
    return;
  }

  list.innerHTML = '';
  let delay = 0;

  for (const { label, items } of GROUPS) {
    const grpEl = document.createElement('div');
    grpEl.className = 'grp-label';
    grpEl.textContent = label;
    list.appendChild(grpEl);

    for (const { code, name, flag, sym } of items) {
      const toman = rates[code];
      if (!toman) continue;

      const row = document.createElement('div');
      row.className = 'rate-row';
      row.style.animationDelay = (delay++ * 25) + 'ms';
      row.innerHTML =
        `<div class="rl">` +
          `<span class="flag">${flag}</span>` +
          `<div>` +
            `<div class="cur-name">${name}</div>` +
            `<div class="cur-code">${code}${sym ? ' · ' + sym : ''}</div>` +
          `</div>` +
        `</div>` +
        `<div class="rr">` +
          `<div class="r-toman">${fmtToman(toman)}</div>` +
          `<div class="r-rial">${persian(toman * 10)} ریال</div>` +
        `</div>`;
      list.appendChild(row);
    }
  }

  // Correct status based on freshness
  if (isStale(ts)) {
    setStatus('stale', 'منقضی');
  } else {
    setStatus('ok', 'به‌روز');
  }
  $('tsLabel').textContent = 'آخرین به‌روزرسانی: ' + timeAgo(ts);
}

function showSkeletons() {
  $('ratesList').innerHTML = Array(6)
    .fill(`<div class="skel"><div class="skel-bar" style="width:42%"></div><div class="skel-bar" style="width:28%"></div></div>`)
    .join('');
}

// ── Load rates ──────────────────────────────────────────────────────────────
async function loadRates(force = false) {
  setStatus('load', 'در حال بارگذاری');
  $('refreshBtn').classList.add('spin');
  showSkeletons();

  if (force) await ds(['rates', 'last']);

  // Fast path: show cached rates immediately (with correct stale status)
  let data = await gs(['rates', 'last']);
  if (!force && data.rates && Object.keys(data.rates).length > 0) {
    renderRates(data.rates, data.last);

    // If stale, kick off a quiet background refresh
    if (isStale(data.last)) {
      msg({ type: 'FORCE_REFRESH' }).then(async res => {
        if (res?.rates && Object.keys(res.rates).length) {
          const d = await gs(['last']);
          renderRates(res.rates, d.last || Date.now());
        }
        $('refreshBtn').classList.remove('spin');
      });
      // Keep spin a bit so user sees activity when rates were old
      return;
    }

    $('refreshBtn').classList.remove('spin');
    return;
  }

  // Slow path: no usable cache — wait for background
  let done = false;

  msg({ type: force ? 'FORCE_REFRESH' : 'GET_RATES' }).then(res => {
    if (done || !res?.rates || !Object.keys(res.rates).length) return;
    done = true;
    gs(['last']).then(d => renderRates(res.rates, d.last || Date.now()));
    $('refreshBtn').classList.remove('spin');
  });

  let tries = 0;
  const poll = setInterval(async () => {
    if (done) { clearInterval(poll); return; }
    data = await gs(['rates', 'last']);
    if ((data.rates && Object.keys(data.rates).length > 0) || ++tries >= 30) {
      clearInterval(poll);
      if (!done) {
        done = true;
        renderRates(data.rates || null, data.last || null);
        $('refreshBtn').classList.remove('spin');
      }
    }
  }, 500);
}

// ── Settings ────────────────────────────────────────────────────────────────
const DEFAULTS = {
  badgeSize: 11,
  textColor: '#1b6b3a',
  bgColor: '#edf7f1',
  borderColor: '#b2dfc4',
  enabled: true,
  showToman: true,
};
let cfg = { ...DEFAULTS };

function applyPreview() {
  const p = $('badgePreview');
  if (!p) return;
  p.style.fontSize    = cfg.badgeSize + 'px';
  p.style.color       = cfg.textColor;
  p.style.background  = cfg.bgColor;
  p.style.borderColor = cfg.borderColor;
  p.style.display     = cfg.enabled ? 'inline-block' : 'none';
}

function syncUI() {
  $('sBadgeEnabled').checked     = cfg.enabled;
  $('sShowToman').checked        = cfg.showToman;
  $('sBadgeSize').value          = cfg.badgeSize;
  $('sBadgeSizeVal').textContent = cfg.badgeSize;
  $('sTextColor').value          = cfg.textColor;
  $('sTextColorHex').textContent = cfg.textColor;
  $('sBgColor').value            = cfg.bgColor;
  $('sBgColorHex').textContent   = cfg.bgColor;
  $('sBorderColor').value        = cfg.borderColor;
  $('sBorderColorHex').textContent = cfg.borderColor;
  applyPreview();
}

function saveCfg() {
  ss({ settings: cfg });
  applyPreview();
}

// View switching with animation
$('settingsBtn').addEventListener('click', () => {
  $('mainView').classList.add('hidden');
  $('settingsPanel').classList.add('visible');
  $('settingsBtn').classList.add('active');
});

$('backBtn').addEventListener('click', () => {
  $('settingsPanel').classList.remove('visible');
  $('mainView').classList.remove('hidden');
  $('settingsBtn').classList.remove('active');
});

$('refreshBtn').addEventListener('click', () => loadRates(true));

$('sBadgeEnabled').addEventListener('change', e => { cfg.enabled   = e.target.checked; saveCfg(); });
$('sShowToman').addEventListener('change',    e => { cfg.showToman = e.target.checked; saveCfg(); });
$('sBadgeSize').addEventListener('input', e => {
  cfg.badgeSize = +e.target.value;
  $('sBadgeSizeVal').textContent = cfg.badgeSize;
  saveCfg();
});

[
  ['sTextColor', 'textColor', 'sTextColorHex'],
  ['sBgColor',   'bgColor',   'sBgColorHex'],
  ['sBorderColor','borderColor','sBorderColorHex'],
].forEach(([elId, key, hexId]) => {
  $(elId).addEventListener('input', e => {
    cfg[key] = e.target.value;
    $(hexId).textContent = e.target.value;
    saveCfg();
  });
});

$('resetBtn').addEventListener('click', () => {
  cfg = { ...DEFAULTS };
  saveCfg();
  syncUI();
});

// ── Support modal ───────────────────────────────────────────────────────────
const USDT_ADDR = '0x2Bf99Bf8EB11BEC0fC74A15CB2Ba8c6b9161EFF9';

$('supportBtn').addEventListener('click', () => {
  $('supportModal').classList.add('open');
});

$('modalClose').addEventListener('click', () => {
  $('supportModal').classList.remove('open');
});

$('supportModal').addEventListener('click', e => {
  if (e.target === $('supportModal')) {
    $('supportModal').classList.remove('open');
  }
});

$('addrBox').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(USDT_ADDR);
    $('addrBox').classList.add('copied');
    $('copyHint').textContent = 'کپی شد ✓';
    setTimeout(() => {
      $('addrBox').classList.remove('copied');
      $('copyHint').textContent = 'کلیک کنید تا کپی شود';
    }, 2000);
  } catch {
    // Fallback: select text
    const range = document.createRange();
    range.selectNodeContents($('usdtAddr'));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    $('copyHint').textContent = 'متن انتخاب شد — Ctrl+C';
  }
});

// Boot
gs(['settings']).then(d => {
  if (d.settings) cfg = { ...DEFAULTS, ...d.settings };
  syncUI();
});
loadRates(false);
