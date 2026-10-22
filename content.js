/**
 * Tomanify by A.Z
 * Content script — universal Toman price converter
 * Price reading is done by Price Mind (price-mind.js): the number touching
 * each currency symbol, with K/M/billion suffixes, instead of gluing every
 * digit in the element together.
 *
 * Author: Mohammad Alizade (A.Z)
 * License: MIT
 * Source: https://github.com/mohammad-alizade/tomanify
 */

(async function () {
  if (window !== window.top) return;
  if (location.protocol === 'chrome-extension:') return;
  if (typeof PriceMind === 'undefined' || typeof PriceMind.readPrices !== 'function') {
    console.warn('[Tomanify] Price Mind did not load');
    return;
  }

  // Skip sites that already show IRR/Toman
  const SKIP_HOSTS = /alanchand\.com|tgju\.org|bonbast\.com|irex\.ir|sanarate\.ir|navasan\.net|mazaneh\.net/i;
  if (SKIP_HOSTS.test(location.hostname)) return;

  console.log('[Tomanify] Active on:', location.hostname);

  // The font bytes come from the extension process. Fetching the
  // chrome-extension:// file from this page is what YouTube logs as
  // "Unsafe attempt to load URL", even when the font still applies.
  chrome.runtime.sendMessage({ type: 'GET_FONT' }, res => {
    if (chrome.runtime.lastError || !res?.font) return;
    try {
      const bin = Uint8Array.from(atob(res.font), c => c.charCodeAt(0));
      new FontFace('Vazirmatn', bin.buffer, { weight: '600', style: 'normal' })
        .load()
        .then(face => document.fonts.add(face))
        .catch(err => console.warn('[Tomanify] Vazirmatn', err));
    } catch (err) {
      console.warn('[Tomanify] Vazirmatn', err);
    }
  });

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

  // ── Badge styling & injection ─────────────────────────────────────────────
  function styleBadge(b) {
    b.style.fontSize     = cfg.badgeSize + 'px';
    b.style.color        = cfg.textColor;
    b.style.background   = cfg.bgColor;
    b.style.borderColor  = cfg.borderColor;
    b.style.display      = cfg.enabled ? 'inline-block' : 'none';
  }

  function sourceText(node) {
    const off = node.querySelector && node.querySelector('.a-offscreen');
    if (off && off.textContent && off.textContent.trim()) return off.textContent.trim();
    return (node.textContent || '').trim();
  }

  function labelFor(hits) {
    const parts = [];
    for (const hit of hits) {
      const rate = rates?.[hit.code];
      if (!rate || rate < 50 || rate > 10_000_000) continue;
      const toman = PriceMind.tomanValue(hit.amount, rate);
      if (!toman) continue;
      parts.push({ hit, toman });
    }
    if (!parts.length) return null;
    if (parts.length === 1) {
      const only = parts[0];
      return {
        text: `≈ ${PriceMind.formatToman(only.toman, cfg.showToman)}`,
        title: `${only.hit.raw} → ${only.toman.toLocaleString('en-US')} Toman`,
      };
    }
    const text =
      '≈ ' +
      parts.map(p => `${p.hit.symbol} ${PriceMind.formatToman(p.toman, false)}`).join(' · ') +
      (cfg.showToman ? ' تومان' : '');
    const title = parts.map(p => `${p.hit.raw} → ${p.toman.toLocaleString('en-US')} Toman`).join(' | ');
    return { text, title };
  }

  function inject(node) {
    if (node.dataset.tomanifyDone || !rates || !cfg.enabled) return;
    if (node.classList && node.classList.contains('tomanify-badge')) return;

    const text = sourceText(node);
    if (!text || text.length > 220) return;

    let hits;
    try {
      hits = PriceMind.readPrices(text).hits;
    } catch (err) {
      console.warn('[Tomanify] reader', err);
      return;
    }
    if (!hits.length) return;

    const built = labelFor(hits);
    if (!built) return;

    const badge = document.createElement('span');
    badge.className = 'tomanify-badge';
    badge.dataset.tomanifyDone = 'true';
    badge.textContent = built.text;
    badge.title = built.title;
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
    console.log(`[Tomanify] ${hits.map(h => h.code + ' ' + h.amount).join(', ')} → ${built.text}`);
  }

  // ── Scanning ──────────────────────────────────────────────────────────────
  const isAmazon = /amazon\./i.test(location.hostname);

  const CURRENCY_RE =
    /[$€£¥₹₺₽₩฿₾₼؋]|(?:^|\s|\()(?:USD|EUR|GBP|AED|CAD|AUD|CHF|NZD|HKD|SGD|MYR|BRL|TRY|RUB|GEL|AZN|CNY|JPY|KRW|INR|PKR|THB|SAR|OMR|QAR|KWD|BHD|IQD|AMD|AFN|NOK|SEK|DKK|NZ\$|HK\$|S\$|C\$|A\$|R\$|RM|SR|Fr)(?:\s|$|\))/;

  const AMAZON_SELS = [
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
    }

    // Universal TreeWalker – short text with a currency marker.
    // Price Mind decides which number belongs to that marker.
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(el) {
          if (el.dataset?.tomanifyDone) return NodeFilter.FILTER_REJECT;
          if (el.classList?.contains('tomanify-badge')) return NodeFilter.FILTER_REJECT;
          if (el.classList?.contains('a-offscreen')) return NodeFilter.FILTER_REJECT;
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

          if (direct.length > 0 && direct.length < 220 && CURRENCY_RE.test(direct)) {
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
