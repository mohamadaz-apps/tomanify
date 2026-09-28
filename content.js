/**
 * Tomanify by A.Z
 * Content script — universal Toman price converter
 *
 * Author: Mohammad Alizade (A.Z)
 * License: MIT
 * Source: https://github.com/mohammad-alizade/tomanify
 */

(async function () {
  if (window !== window.top) return;
  if (location.protocol === 'chrome-extension:') return;

  // Skip sites that already show IRR/Toman
  const SKIP_HOSTS = /alanchand\.com|tgju\.org|bonbast\.com|irex\.ir|sanarate\.ir|navasan\.net|mazaneh\.net/i;
  if (SKIP_HOSTS.test(location.hostname)) return;

  console.log('[Tomanify] Active on:', location.hostname);

  // Load Vazirmatn font once
  if (!document.getElementById('vazirmatn-tomanify')) {
    const l = document.createElement('link');
    l.id = 'vazirmatn-tomanify';
    l.rel = 'stylesheet';
    l.href = 'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css';
    document.head.appendChild(l);
  }

  // ── Settings & rates ──────────────────────────────────────────────────────
  const DEFAULTS = {
    badgeSize: 11,
    textColor: '#1b6b3a',
    bgColor: '#edf7f1',
    borderColor: '#b2dfc4',
    enabled: true,
    showToman: true,
  };

  let stored = await new Promise(r => chrome.storage.local.get(['rates', 'settings'], r));
  let rates  = stored.rates || null;
  let cfg    = { ...DEFAULTS, ...(stored.settings || {}) };

  if (!rates) {
    chrome.runtime.sendMessage({ type: 'GET_RATES' }, res => {
      if (chrome.runtime.lastError || !res?.rates) return;
      rates = res.rates;
      scan();
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.settings) {
      cfg = { ...DEFAULTS, ...changes.settings.newValue };
      document.querySelectorAll('.tomanify-badge').forEach(styleBadge);
    }
    if (changes.rates) {
      rates = changes.rates.newValue;
      scan();
    }
  });

  // ── Currency detectors (longest symbols first) ────────────────────────────
  const DETECTORS = [
    { syms: ['KWD'], code: 'KWD' },
    { syms: ['BHD'], code: 'BHD' },
    { syms: ['OMR'], code: 'OMR' },
    { syms: ['QAR'], code: 'QAR' },
    { syms: ['SAR', 'SR'], code: 'SAR' },
    { syms: ['AED'], code: 'AED' },
    { syms: ['IQD'], code: 'IQD' },
    { syms: ['AMD'], code: 'AMD' },
    { syms: ['AFN', '؋'], code: 'AFN' },
    { syms: ['NZD', 'NZ$'], code: 'NZD' },
    { syms: ['HKD', 'HK$'], code: 'HKD' },
    { syms: ['SGD', 'S$'], code: 'SGD' },
    { syms: ['CAD', 'CA$', 'C$'], code: 'CAD' },
    { syms: ['AUD', 'AU$', 'A$'], code: 'AUD' },
    { syms: ['CHF', 'Fr.', 'SFr'], code: 'CHF' },
    { syms: ['MYR', 'RM'], code: 'MYR' },
    { syms: ['BRL', 'R$'], code: 'BRL' },
    { syms: ['SEK'], code: 'SEK' },
    { syms: ['NOK'], code: 'NOK' },
    { syms: ['DKK'], code: 'DKK' },
    { syms: ['TRY', '₺'], code: 'TRY' },
    { syms: ['RUB', '₽'], code: 'RUB' },
    { syms: ['GEL', '₾'], code: 'GEL' },
    { syms: ['AZN', '₼'], code: 'AZN' },
    { syms: ['CNY', 'RMB', 'CN¥'], code: 'CNY' },
    { syms: ['JPY', 'JP¥'], code: 'JPY' },
    { syms: ['KRW', '₩'], code: 'KRW' },
    { syms: ['INR', '₹'], code: 'INR' },
    { syms: ['PKR'], code: 'PKR' },
    { syms: ['THB', '฿'], code: 'THB' },
    { syms: ['GBP', '£'], code: 'GBP' },
    { syms: ['EUR', '€'], code: 'EUR' },
    { syms: ['USD', 'US$', '$'], code: 'USD' }, // $ last (most ambiguous)
  ];

  const SYM_LIST = [];
  for (const d of DETECTORS) {
    for (const s of d.syms) SYM_LIST.push({ sym: s, code: d.code });
  }
  SYM_LIST.sort((a, b) => b.sym.length - a.sym.length);

  function detectCurrency(text) {
    for (const { sym, code } of SYM_LIST) {
      if (text.includes(sym)) return code;
    }
    return null;
  }

  // ── Conversion ────────────────────────────────────────────────────────────
  // rates are already Toman per 1 foreign unit → just multiply
  function toToman(amount, code) {
    const rate = rates?.[code];
    if (!rate) return null;
    // Realistic range (KWD/BHD can be higher)
    if (rate < 50 || rate > 10_000_000) {
      console.warn('[Tomanify] Suspicious rate for', code, rate);
      return null;
    }
    const t = Math.round(amount * rate);
    return t > 0 ? t : null;
  }

  // ── Badge styling & injection ─────────────────────────────────────────────
  function styleBadge(b) {
    b.style.fontSize     = cfg.badgeSize + 'px';
    b.style.color        = cfg.textColor;
    b.style.background   = cfg.bgColor;
    b.style.borderColor  = cfg.borderColor;
    b.style.display      = cfg.enabled ? 'inline-block' : 'none';
  }

  function inject(node) {
    if (node.dataset.tomanifyDone || !rates || !cfg.enabled) return;

    const text = (node.textContent || '').trim();
    if (text.length > 80) return;

    const code = detectCurrency(text);
    if (!code) return;

    const amount = parseAmount(text); // from utils.js
    if (!amount || amount > 100_000_000) return;

    const toman = toToman(amount, code);
    if (!toman) return;

    const label = `≈ ${formatToman(toman, cfg.showToman)}`; // from utils.js
    const badge = document.createElement('span');
    badge.className = 'tomanify-badge';
    badge.textContent = label;
    Object.assign(badge.style, {
      fontWeight: '600',
      borderRadius: '4px',
      padding: '0 5px',
      marginLeft: '5px',
      verticalAlign: 'middle',
      whiteSpace: 'nowrap',
      fontFamily: "'Vazirmatn', Tahoma, sans-serif",
      direction: 'rtl',
      unicodeBidi: 'embed',
      lineHeight: '1.6',
      letterSpacing: '0',
      border: '1px solid',
    });
    styleBadge(badge);
    node.appendChild(badge);
    node.dataset.tomanifyDone = 'true';
    console.log(`[Tomanify] ${code} ${amount} → ${label}`);
  }

  // ── Scanning ──────────────────────────────────────────────────────────────
  const isAmazon = /amazon\./i.test(location.hostname);

  const CURRENCY_RE =
    /[$€£¥₹₺₽₩฿₾₼؋]|(?:^|\s|\()(?:USD|EUR|GBP|AED|CAD|AUD|CHF|NZD|HKD|SGD|MYR|BRL|TRY|RUB|GEL|AZN|CNY|JPY|KRW|INR|PKR|THB|SAR|OMR|QAR|KWD|BHD|IQD|AMD|AFN|NOK|SEK|DKK|NZ\$|HK\$|S\$|C\$|A\$|R\$|RM|SR|Fr)(?:\s|$|\))/;

  const AMAZON_SELS = [
    '.a-price .a-offscreen',
    '.a-price',
    '.priceToPay',
    '.apexPriceToPay',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    "[data-a-color='price']",
  ];

  function scan() {
    if (!rates) return;

    if (isAmazon) {
      AMAZON_SELS.forEach(sel =>
        document.querySelectorAll(`${sel}:not([data-tomanify-done])`).forEach(inject)
      );
      return;
    }

    // Universal TreeWalker – only short leaf text nodes with a currency marker
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(el) {
          if (el.dataset?.tomanifyDone) return NodeFilter.FILTER_REJECT;
          const tag = el.tagName;
          if (
            ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'HEAD', 'META', 'LINK', 'SVG', 'PATH'].includes(tag)
          )
            return NodeFilter.FILTER_REJECT;

          const direct = [...el.childNodes]
            .filter(n => n.nodeType === 3)
            .map(n => n.textContent)
            .join('')
            .trim();

          if (direct.length > 0 && direct.length < 80 && CURRENCY_RE.test(direct)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        },
      }
    );

    let node;
    while ((node = walker.nextNode())) inject(node);
  }

  // Initial scan
  scan();

  // Debounced MutationObserver for dynamic pages
  let timer;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(scan, 300);
  }).observe(document.body, { childList: true, subtree: true });

  console.log('[Tomanify] Ready (universal:', !isAmazon, ')');
})();
