/**
 * Tomanify by A.Z
 * Shared utility helpers (injected before content.js)
 *
 * Author: Mohammad Alizade (A.Z)
 * License: MIT
 */

const PD = '۰۱۲۳۴۵۶۷۸۹';

/** Convert number → Persian digits with thousand separators */
function toPersian(n) {
  return Math.round(n).toLocaleString('en-US').replace(/\d/g, d => PD[d]);
}

/** Rial → Toman (1 Toman = 10 Rial) */
function rialToToman(rial) {
  return Math.round(rial / 10);
}

/**
 * Smart Toman formatter
 * ≥ ۱ میلیارد → X.XXX میلیارد
 * ≥ ۱ میلیون  → X.XX میلیون
 * else        → X,XXX
 */
function formatToman(t, showUnit = true) {
  const MILLIARD = 1_000_000_000;
  const MILLION  = 1_000_000;

  if (t >= MILLIARD) {
    const v = (t / MILLIARD).toFixed(3).replace(/\.?0+$/, '');
    const pv = v.replace(/\d/g, d => PD[d]).replace('.', '٫');
    return showUnit ? `${pv} میلیارد تومان` : `${pv} میلیارد`;
  }
  if (t >= MILLION) {
    const v = (t / MILLION).toFixed(2).replace(/\.?0+$/, '');
    const pv = v.replace(/\d/g, d => PD[d]).replace('.', '٫');
    return showUnit ? `${pv} میلیون تومان` : `${pv} میلیون`;
  }
  return showUnit ? `${toPersian(t)} تومان` : toPersian(t);
}

/**
 * Parse a price string into a number.
 * Correctly handles:
 *   $70,000      → 70000   (US thousand sep, no decimal)
 *   $1,234.56    → 1234.56 (US)
 *   €1.234,56    → 1234.56 (European)
 *   1 234,56     → 1234.56
 *   1'234.56     → 1234.56
 */
function parseAmount(text) {
  if (!text) return null;

  const s = text.replace(/[^\d.,'\s]/g, ' ').trim();
  const tokens = s.match(/\d[\d,.''\s]*\d|\d+/g);
  if (!tokens) return null;

  let best = tokens.reduce((a, b) => (b.length > a.length ? b : a), '');

  const lastComma = best.lastIndexOf(',');
  const lastDot   = best.lastIndexOf('.');

  if (lastComma > lastDot) {
    // Possible European (1.234,56) or US-style thousand (70,000)
    const afterComma = best.slice(lastComma + 1).replace(/[^\d]/g, '');
    if (afterComma.length <= 2) {
      // Decimal part → European
      best = best.replace(/\./g, '').replace(',', '.');
    } else {
      // 3+ digits after comma → thousand separator
      best = best.replace(/[,'\s]/g, '');
    }
  } else {
    // US / common style
    best = best.replace(/[,'\s]/g, '');
  }

  const v = parseFloat(best);
  return isNaN(v) || v <= 0 ? null : v;
}
