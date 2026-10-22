(function () {
// @ts-nocheck
/**
 * Price Mind — a tiny local ranker for Tomanify.
 *
 * Currency symbols often sit in the same sentence as counts, years, and other
 * amounts. The old reader glued every digit in the element into one number.
 * This one only looks at the number touching each symbol (or one gap of
 * spaces away), then a linear score picks the left side or the right side.
 * Nothing is sent to a server.
 */

const MODEL = {
  weights: {
    bias: 0.2,
    touching: 1.4,
    gap: -0.25,
    cents: 0.45,
    suffix: 0.9,
    grouped: 0.35,
    yearLike: -0.8,
    countLike: -0.15,
    right: 0.2,
  },
};

/** Screenshot rates (toman per 1 unit) from the popup at the time of the bugs. */
const SNAPSHOT_RATES = {
  USD: 262850,
  EUR: 295300,
  GBP: 346400,
  AED: 71560,
  TRY: 5270,
  CAD: 186000,
};

/** Last-resort rates baked into Tomanify 2.2, used when a live rate is missing. */
const FALLBACK_TOMAN = {
  USD: 229400, EUR: 261800, GBP: 300100, AED: 62460, TRY: 4680,
  CAD: 161600, AUD: 161600, CNY: 34100, RUB: 2695, MYR: 55100,
  GEL: 86900, AZN: 133600, THB: 6870, OMR: 592200, INR: 2380,
  PKR: 822, SAR: 60720, AFN: 3590, SEK: 23140, CHF: 277600,
  QAR: 62620, NOK: 23860, NZD: 128780, SGD: 176900, HKD: 28780,
  BRL: 44260, DKK: 34520, KWD: 731400, BHD: 598820,
  JPY: 1446, KRW: 168.7, IQD: 145.1, AMD: 627.2,
};

const EU_DOT_THOUSANDS = new Set(["EUR", "CHF", "SEK", "NOK", "DKK", "TRY", "BRL", "RUB"]);

const ANCHORS = [
  ["US$", "USD"], ["CA$", "CAD"], ["AU$", "AUD"], ["NZ$", "NZD"], ["HK$", "HKD"],
  ["JP¥", "JPY"], ["CN¥", "CNY"], ["SFr", "CHF"], ["Fr.", "CHF"],
  ["NZD", "NZD"], ["HKD", "HKD"], ["SGD", "SGD"], ["CAD", "CAD"], ["AUD", "AUD"],
  ["USD", "USD"], ["EUR", "EUR"], ["GBP", "GBP"], ["AED", "AED"], ["CHF", "CHF"],
  ["MYR", "MYR"], ["BRL", "BRL"], ["TRY", "TRY"], ["RUB", "RUB"], ["GEL", "GEL"],
  ["AZN", "AZN"], ["CNY", "CNY"], ["RMB", "CNY"], ["JPY", "JPY"], ["KRW", "KRW"],
  ["INR", "INR"], ["PKR", "PKR"], ["THB", "THB"], ["SAR", "SAR"], ["OMR", "OMR"],
  ["QAR", "QAR"], ["KWD", "KWD"], ["BHD", "BHD"], ["IQD", "IQD"], ["AMD", "AMD"],
  ["AFN", "AFN"], ["NOK", "NOK"], ["SEK", "SEK"], ["DKK", "DKK"],
  ["S$", "SGD"], ["A$", "AUD"], ["C$", "CAD"], ["R$", "BRL"],
  ["RM", "MYR"], ["SR", "SAR"],
  ["$", "USD"], ["€", "EUR"], ["£", "GBP"],
  ["₺", "TRY"], ["₽", "RUB"], ["₩", "KRW"], ["₹", "INR"], ["฿", "THB"],
  ["₾", "GEL"], ["₼", "AZN"], ["؋", "AFN"],
]
  .map(([symbol, code]) => ({ symbol, code }))
  .sort((a, b) => b.symbol.length - a.symbol.length);

const SUFFIXES = [
  { name: "billion", mul: 1e9, re: /billion|milliard|میلیارد|bn/i },
  { name: "million", mul: 1e6, re: /million|میلیون|mn/i },
  { name: "thousand", mul: 1e3, re: /thousand|هزار/i },
  { name: "b", mul: 1e9, re: /b/i },
  { name: "m", mul: 1e6, re: /m/i },
  { name: "k", mul: 1e3, re: /k/i },
];

const PD = "۰۱۲۳۴۵۶۷۸۹";

function fold(text) {
  return String(text)
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/٫/g, ".")
    .replace(/[٬،]/g, ",");
}

function isSpace(ch) {
  return ch === " " || ch === "\t" || ch === "\u00a0" || ch === "\u202f";
}

function bounded(text, index, symbol) {
  const prev = text[index - 1];
  const next = text[index + symbol.length];
  if (/[A-Za-z]/.test(symbol[0]) && prev && /[A-Za-z]/.test(prev)) return false;
  if (/[A-Za-z]/.test(symbol[symbol.length - 1]) && next && /[A-Za-z]/.test(next)) return false;
  return true;
}

function groupOk(intPart, sep) {
  if (!intPart.includes(sep)) return /^\d+$/.test(intPart);
  const segs = intPart.split(sep);
  if (segs.some((s) => !/^\d+$/.test(s))) return false;
  if (segs[0].length < 1 || segs[0].length > 3) return false;
  return segs.slice(1).every((s) => s.length === 3);
}

function parseToken(raw, code) {
  let token = String(raw).replace(/[.,']+$/, "");
  if (!token) return null;
  if (token.includes("'")) {
    if (!/^\d{1,3}(?:'\d{3})+(?:[.,]\d{1,4})?$/.test(token)) return null;
    token = token.replace(/'/g, "");
  }
  if (!/^\d[\d.,]*$/.test(token)) return null;

  const hasDot = token.includes(".");
  const hasComma = token.includes(",");

  if (hasDot && hasComma) {
    const lastDot = token.lastIndexOf(".");
    const lastComma = token.lastIndexOf(",");
    const dec = lastDot > lastComma ? "." : ",";
    const thou = dec === "." ? "," : ".";
    const idx = token.lastIndexOf(dec);
    const intPart = token.slice(0, idx);
    const frac = token.slice(idx + 1);
    if (!/^\d{1,4}$/.test(frac) || !groupOk(intPart, thou)) return null;
    const value = Number(intPart.split(thou).join("") + "." + frac);
    if (!(value > 0)) return null;
    return { value, grouped: intPart.includes(thou), cents: frac.length === 2 };
  }

  if (hasComma) {
    const segs = token.split(",");
    const thousands =
      segs.every((s) => /^\d+$/.test(s)) &&
      segs[0].length >= 1 &&
      segs[0].length <= 3 &&
      segs.slice(1).every((s) => s.length === 3);
    if (thousands) {
      return { value: Number(segs.join("")), grouped: true, cents: false };
    }
    if (segs.length === 2 && /^\d+$/.test(segs[0]) && /^\d{1,2}$/.test(segs[1])) {
      return { value: Number(`${segs[0]}.${segs[1]}`), grouped: false, cents: segs[1].length === 2 };
    }
    return null;
  }

  if (hasDot) {
    const segs = token.split(".");
    const allGroups =
      segs.every((s) => /^\d+$/.test(s)) &&
      segs[0].length >= 1 &&
      segs[0].length <= 3 &&
      segs.slice(1).every((s) => s.length === 3);
    if (allGroups && (segs.length > 2 || EU_DOT_THOUSANDS.has(code))) {
      return { value: Number(segs.join("")), grouped: true, cents: false };
    }
    if (segs.length === 2 && /^\d+$/.test(segs[0]) && /^\d{1,4}$/.test(segs[1])) {
      return {
        value: Number(`${segs[0]}.${segs[1]}`),
        grouped: false,
        cents: segs[1].length === 2,
      };
    }
    return null;
  }

  if (!/^\d+$/.test(token)) return null;
  const value = Number(token);
  if (!(value > 0)) return null;
  return { value, grouped: false, cents: false };
}

function nextIsWordChar(ch) {
  return !!ch && /[A-Za-z0-9\u0600-\u06FF]/.test(ch);
}

function suffixAt(text, index) {
  let i = index;
  let space = 0;
  if (isSpace(text[i])) {
    space = 1;
    i += 1;
  }
  const slice = text.slice(i);
  for (const s of SUFFIXES) {
    const m = slice.match(s.re);
    if (!m || m.index !== 0) continue;
    const word = m[0];
    if (nextIsWordChar(text[i + word.length])) continue;
    return { mul: s.mul, label: word.toLowerCase(), length: space + word.length };
  }
  return null;
}

function suffixEndingAt(left) {
  for (const s of SUFFIXES) {
    const m = left.match(new RegExp(`(?:${s.re.source})$`, "i"));
    if (!m) continue;
    const word = m[0];
    let rest = left.slice(0, left.length - word.length);
    if (isSpace(rest[rest.length - 1])) rest = rest.slice(0, -1);
    if (!/\d$/.test(rest)) continue;
    return { mul: s.mul, label: word.toLowerCase(), rest };
  }
  return null;
}

function scoreOf(c) {
  const w = MODEL.weights;
  return (
    w.bias +
    (c.touching ? w.touching : 0) +
    w.gap * c.gap +
    (c.cents ? w.cents : 0) +
    (c.mul > 1 ? w.suffix : 0) +
    (c.grouped ? w.grouped : 0) +
    (c.yearLike ? w.yearLike : 0) +
    (c.countLike ? w.countLike : 0) +
    (c.side === "right" ? w.right : 0)
  );
}

function reasonsFor(c) {
  const reasons = [];
  reasons.push(c.touching ? "touches the symbol" : `${c.gap} space from the symbol`);
  reasons.push(c.side === "right" ? "after the symbol" : "before the symbol");
  if (c.cents) reasons.push("has cents");
  if (c.grouped) reasons.push("thousand separators");
  if (c.mul > 1) reasons.push(`${c.label} ×${c.mul.toLocaleString("en-US")}`);
  if (c.yearLike) reasons.push("looks like a year");
  if (c.countLike) reasons.push("small count");
  return reasons;
}

function buildCandidate(partial) {
  const amount = partial.base * partial.mul;
  if (!(amount > 0) || amount > 1e12) return null;
  const yearLike =
    partial.mul === 1 &&
    !partial.cents &&
    !partial.grouped &&
    Number.isInteger(partial.base) &&
    partial.base >= 1900 &&
    partial.base <= 2099;
  const countLike =
    partial.mul === 1 &&
    !partial.cents &&
    !partial.grouped &&
    Number.isInteger(partial.base) &&
    partial.base <= 30;
  const candidate = {
    ...partial,
    amount,
    yearLike,
    countLike,
    touching: partial.gap === 0,
  };
  candidate.score = scoreOf(candidate);
  candidate.reasons = reasonsFor(candidate);
  return candidate;
}

function readRight(text, anchorEnd, anchor) {
  let i = anchorEnd;
  let gap = 0;
  while (i < text.length && isSpace(text[i]) && gap < 3) {
    i += 1;
    gap += 1;
  }
  const m = text.slice(i).match(/^\d[\d.,']*/);
  if (!m) return null;
  let token = m[0].replace(/[.,']+$/, "");
  if (!token) return null;
  const parsed = parseToken(token, anchor.code);
  if (!parsed) return null;
  let end = i + token.length;
  // The regex may have swallowed a trailing separator that parseToken stripped.
  // Keep `end` on the last digit, then look for a suffix after any leftover seps.
  let look = i + m[0].length;
  while (look > end && /[.,']/.test(text[look - 1])) look -= 1;
  end = look;
  const suf = suffixAt(text, end);
  const mul = suf ? suf.mul : 1;
  const label = suf ? suf.label : "";
  if (suf) end += suf.length;
  return buildCandidate({
    code: anchor.code,
    symbol: anchor.symbol,
    side: "right",
    gap,
    base: parsed.value,
    cents: parsed.cents,
    grouped: parsed.grouped,
    mul,
    label,
    start: i,
    end,
    raw: text.slice(anchor.start, end),
  });
}

function readLeft(text, anchorStart, anchor) {
  let i = anchorStart;
  let gap = 0;
  while (i > 0 && isSpace(text[i - 1]) && gap < 3) {
    i -= 1;
    gap += 1;
  }
  const left = text.slice(0, i);
  const suf = suffixEndingAt(left);
  const mul = suf ? suf.mul : 1;
  const label = suf ? suf.label : "";
  const body = suf ? suf.rest : left;
  const num = body.match(/(\d[\d.,']*)$/);
  if (!num) return null;
  const token = num[1].replace(/^[.,']+/, "");
  const parsed = parseToken(token, anchor.code);
  if (!parsed) return null;
  const tokenStart = body.length - num[1].length + (num[1].length - token.length);
  return buildCandidate({
    code: anchor.code,
    symbol: anchor.symbol,
    side: "left",
    gap,
    base: parsed.value,
    cents: parsed.cents,
    grouped: parsed.grouped,
    mul,
    label,
    start: tokenStart,
    end: i,
    raw: text.slice(tokenStart, anchorStart + anchor.symbol.length),
  });
}

function better(a, b) {
  if (Math.abs(a.score - b.score) > 1e-9) return a.score > b.score ? a : b;
  if (a.gap !== b.gap) return a.gap < b.gap ? a : b;
  return a.side === "right" ? a : b;
}

function readPrices(input) {
  const text = fold(input ?? "");
  const considered = [];
  const hits = [];
  let i = 0;
  while (i < text.length) {
    let anchor = null;
    for (const candidate of ANCHORS) {
      if (!text.startsWith(candidate.symbol, i)) continue;
      if (!bounded(text, i, candidate.symbol)) continue;
      anchor = { ...candidate, start: i };
      break;
    }
    if (!anchor) {
      i += 1;
      continue;
    }
    const end = i + anchor.symbol.length;
    const sides = [readLeft(text, i, anchor), readRight(text, end, anchor)].filter(Boolean);
    for (const side of sides) considered.push({ ...side, chosen: false });
    if (sides.length) {
      const winner = sides.reduce((best, side) => better(side, best));
      hits.push(winner);
      const row = considered.find((c) => c.start === winner.start && c.end === winner.end && c.side === winner.side && c.code === winner.code && !c.chosen);
      if (row) row.chosen = true;
    }
    i = end;
  }

  const unique = [];
  for (const hit of hits) {
    const dup = unique.find((k) => k.code === hit.code && Math.abs(k.amount - hit.amount) <= 0.001);
    if (!dup) unique.push(hit);
  }
  unique.sort((a, b) => a.start - b.start);
  return { hits: unique, considered };
}

function tomanValue(amount, rate) {
  if (!rate || !Number.isFinite(rate) || rate <= 0) return null;
  const t = Math.round(amount * rate);
  return t > 0 ? t : null;
}

function formatToman(t, showUnit = true) {
  const milliard = 1_000_000_000;
  const million = 1_000_000;
  const persian = (v) => v.replace(/\d/g, (d) => PD[d]).replace(".", "٫");
  if (t >= milliard) {
    const v = (t / milliard).toFixed(3).replace(/\.?0+$/, "");
    const pv = persian(v);
    return showUnit ? `${pv} میلیارد تومان` : `${pv} میلیارد`;
  }
  if (t >= million) {
    const v = (t / million).toFixed(2).replace(/\.?0+$/, "");
    const pv = persian(v);
    return showUnit ? `${pv} میلیون تومان` : `${pv} میلیون`;
  }
  const small = Math.round(t).toLocaleString("en-US").replace(/\d/g, (d) => PD[d]);
  return showUnit ? `${small} تومان` : small;
}

const LEGACY_DETECTORS = [
  { syms: ["KWD"], code: "KWD" },
  { syms: ["BHD"], code: "BHD" },
  { syms: ["OMR"], code: "OMR" },
  { syms: ["QAR"], code: "QAR" },
  { syms: ["SAR", "SR"], code: "SAR" },
  { syms: ["AED"], code: "AED" },
  { syms: ["IQD"], code: "IQD" },
  { syms: ["AMD"], code: "AMD" },
  { syms: ["AFN", "؋"], code: "AFN" },
  { syms: ["NZD", "NZ$"], code: "NZD" },
  { syms: ["HKD", "HK$"], code: "HKD" },
  { syms: ["SGD", "S$"], code: "SGD" },
  { syms: ["CAD", "CA$", "C$"], code: "CAD" },
  { syms: ["AUD", "AU$", "A$"], code: "AUD" },
  { syms: ["CHF", "Fr.", "SFr"], code: "CHF" },
  { syms: ["MYR", "RM"], code: "MYR" },
  { syms: ["BRL", "R$"], code: "BRL" },
  { syms: ["SEK"], code: "SEK" },
  { syms: ["NOK"], code: "NOK" },
  { syms: ["DKK"], code: "DKK" },
  { syms: ["TRY", "₺"], code: "TRY" },
  { syms: ["RUB", "₽"], code: "RUB" },
  { syms: ["GEL", "₾"], code: "GEL" },
  { syms: ["AZN", "₼"], code: "AZN" },
  { syms: ["CNY", "RMB", "CN¥"], code: "CNY" },
  { syms: ["JPY", "JP¥"], code: "JPY" },
  { syms: ["KRW", "₩"], code: "KRW" },
  { syms: ["INR", "₹"], code: "INR" },
  { syms: ["PKR"], code: "PKR" },
  { syms: ["THB", "฿"], code: "THB" },
  { syms: ["GBP", "£"], code: "GBP" },
  { syms: ["EUR", "€"], code: "EUR" },
  { syms: ["USD", "US$", "$"], code: "USD" },
];

const LEGACY_SYMBOLS = [];
for (const d of LEGACY_DETECTORS) {
  for (const sym of d.syms) LEGACY_SYMBOLS.push({ sym, code: d.code });
}
LEGACY_SYMBOLS.sort((a, b) => b.sym.length - a.sym.length);

function legacyAmount(text) {
  const s = String(text).replace(/[^\d.,'\s]/g, " ").trim();
  const tokens = s.match(/\d[\d,.''\s]*\d|\d+/g);
  if (!tokens) return null;
  let best = tokens.reduce((a, b) => (b.length > a.length ? b : a), "");
  const lastComma = best.lastIndexOf(",");
  const lastDot = best.lastIndexOf(".");
  if (lastComma > lastDot) {
    const afterComma = best.slice(lastComma + 1).replace(/[^\d]/g, "");
    if (afterComma.length <= 2) best = best.replace(/\./g, "").replace(",", ".");
    else best = best.replace(/[,'\s]/g, "");
  } else {
    best = best.replace(/[,'\s]/g, "");
  }
  const v = parseFloat(best);
  return Number.isNaN(v) || v <= 0 ? null : v;
}

/** Tomanify 2.2 reader: one currency, every digit in the string glued together. */
function legacyRead(text) {
  const source = String(text ?? "");
  let code = null;
  for (const { sym, code: c } of LEGACY_SYMBOLS) {
    if (source.includes(sym)) {
      code = c;
      break;
    }
  }
  if (!code) return null;
  const amount = legacyAmount(source);
  if (amount == null) return null;
  return { code, amount };
}

globalThis.PriceMind = { readPrices, formatToman, legacyRead, tomanValue, MODEL, FALLBACK_TOMAN, SNAPSHOT_RATES };

})();
