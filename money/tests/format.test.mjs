import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  addMonths,
  diffDays,
  fmtDate,
  fmtDayHeader,
  fmtMoney,
  fmtMonth,
  fmtPct,
  fromISO,
  isISODate,
  normalizeText,
  parseMoney,
  PAYMENTS,
  todayISO,
  toISO,
  uid,
  weekdayOf,
} from '../js/format.js';

const NB = ' ';

test('fmtMoney: plain, agorot auto, grouping', () => {
  assert.equal(fmtMoney(123400), `1,234${NB}₪`);
  assert.equal(fmtMoney(123450), `1,234.50${NB}₪`);
  assert.equal(fmtMoney(5), `0.05${NB}₪`);
  assert.equal(fmtMoney(0), `0${NB}₪`);
  assert.equal(fmtMoney(123456789), `1,234,567.89${NB}₪`);
  assert.equal(fmtMoney(123450, { decimals: 0 }), `1,235${NB}₪`);
  assert.equal(fmtMoney(123400, { decimals: 2 }), `1,234.00${NB}₪`);
  assert.equal(fmtMoney(NaN), `0${NB}₪`);
  assert.equal(fmtMoney(undefined), `0${NB}₪`);
});

test('fmtMoney: no bidi control characters', () => {
  for (const v of [0, 1, -1, 123456, -98765432]) {
    assert.ok(!/[‎‏‪-‮⁦-⁩]/.test(fmtMoney(v, { sign: true })));
  }
});

test('fmtMoney: sign uses U+2212 for negatives, + only with sign', () => {
  assert.equal(fmtMoney(-5000), `−50${NB}₪`);
  assert.equal(fmtMoney(-5000, { sign: true }), `−50${NB}₪`);
  assert.equal(fmtMoney(5000, { sign: true }), `+50${NB}₪`);
  assert.equal(fmtMoney(0, { sign: true }), `0${NB}₪`);
  assert.equal(fmtMoney(-40, { compact: true }), `0${NB}₪`); // rounds to zero → unsigned
});

test('fmtMoney: compact', () => {
  assert.equal(fmtMoney(1240000, { compact: true }), `12.4K${NB}₪`);
  assert.equal(fmtMoney(1200000, { compact: true }), `12K${NB}₪`);
  assert.equal(fmtMoney(95000, { compact: true }), `950${NB}₪`);
  assert.equal(fmtMoney(99999, { compact: true }), `1,000${NB}₪`);
  assert.equal(fmtMoney(100000, { compact: true }), `1K${NB}₪`);
  assert.equal(fmtMoney(15500000, { compact: true }), `155K${NB}₪`);
  assert.equal(fmtMoney(99996000, { compact: true }), `1M${NB}₪`); // 999,960 ₪ → not "1000K"
  assert.equal(fmtMoney(250000000, { compact: true }), `2.5M${NB}₪`);
  assert.equal(fmtMoney(-1240000, { compact: true, sign: true }), `−12.4K${NB}₪`);
  assert.equal(fmtMoney(1240000, { compact: true, sign: true }), `+12.4K${NB}₪`);
});

test('parseMoney', () => {
  assert.equal(parseMoney('1,234.5'), 123450);
  assert.equal(parseMoney('1234,50'), 123450);
  assert.equal(parseMoney('₪ 12'), 1200);
  assert.equal(parseMoney('12 ₪'), 1200);
  assert.equal(parseMoney('12 ש"ח'), 1200);
  assert.equal(parseMoney('1,234'), 123400);
  assert.equal(parseMoney('1.234.567,89'), 123456789);
  assert.equal(parseMoney('1,234,567'), 123456700);
  assert.equal(parseMoney('0,50'), 50);
  assert.equal(parseMoney('0,500'), 50);
  assert.equal(parseMoney('.5'), 50);
  assert.equal(parseMoney('12.'), 1200);
  assert.equal(parseMoney('10.005'), 1001);
  assert.equal(parseMoney('1.005'), 101);
  assert.equal(parseMoney('-45.90'), -4590);
  assert.equal(parseMoney('−45.90'), -4590);
  assert.equal(parseMoney('(45.90)'), -4590);
  assert.equal(parseMoney('45.90-'), -4590);
  assert.equal(parseMoney('₪-45.90'), -4590);
  assert.equal(parseMoney(12.5), 1250);
  assert.ok(Number.isNaN(parseMoney('')));
  assert.ok(Number.isNaN(parseMoney('abc')));
  assert.ok(Number.isNaN(parseMoney(null)));
});

test('dates: ISO round-trip in local time, no TZ drift', () => {
  const d = new Date(2026, 9, 30, 23, 59);
  assert.equal(toISO(d), '2026-10-30');
  assert.equal(todayISO(d), '2026-10-30');
  const back = fromISO('2026-03-27'); // around DST change in Israel
  assert.equal(back.getFullYear(), 2026);
  assert.equal(back.getMonth(), 2);
  assert.equal(back.getDate(), 27);
  assert.equal(toISO(fromISO('2024-02-29')), '2024-02-29');
});

test('dates: arithmetic', () => {
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('2026-03-26', 7), '2026-04-02');
  assert.equal(diffDays('2026-03-01', '2026-02-01'), 28);
  assert.equal(diffDays('2026-10-25', '2026-10-26'), -1);
  assert.equal(addMonths('2026-10', 3), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(addMonths('2026-01', -13), '2024-12');
  assert.equal(addMonths('2026-05', 0), '2026-05');
  assert.equal(weekdayOf('2026-10-30'), 5); // Friday
  assert.equal(weekdayOf('2026-10-25'), 0); // Sunday
  assert.ok(isISODate('2028-02-29'));
  assert.ok(!isISODate('2026-02-29'));
  assert.ok(!isISODate('2026-13-01'));
  assert.ok(!isISODate('26-10-01'));
});

test('fmtDate / fmtDayHeader / fmtMonth', () => {
  const now = new Date(2026, 9, 30);
  assert.equal(fmtDate('2026-10-30', { now }), '30 באוק׳');
  assert.equal(fmtDate('2026-10-30', { weekday: true, now }), 'יום ו׳, 30 באוקטובר');
  assert.equal(fmtDate('2025-10-30', { now }), '30 באוק׳ 2025');
  assert.equal(fmtDate('2026-10-30', { year: true, now }), '30 באוק׳ 2026');
  assert.equal(fmtDate('2025-03-01', { year: false, now }), '1 במרץ');
  assert.equal(fmtDate('nope'), '');

  assert.equal(fmtDayHeader('2026-10-30', '2026-10-30'), 'היום');
  assert.equal(fmtDayHeader('2026-10-29', '2026-10-30'), 'אתמול');
  assert.equal(fmtDayHeader('2026-10-31', '2026-10-30'), 'מחר');
  assert.equal(fmtDayHeader('2026-10-25', '2026-10-30'), 'יום ראשון, 25 באוקטובר');
  assert.equal(fmtDayHeader('2026-10-24', '2026-10-30'), 'יום שבת, 24 באוקטובר');
  assert.equal(fmtDayHeader('2025-12-31', '2026-01-02'), 'יום רביעי, 31 בדצמבר 2025');

  assert.equal(fmtMonth('2026-10'), 'אוקטובר 2026');
  assert.equal(fmtMonth('2026-10', { short: true }), 'אוק׳');
  assert.equal(fmtMonth('2026-05', { short: true }), 'מאי');
});

test('fmtPct', () => {
  assert.equal(fmtPct(0.234), '23%');
  assert.equal(fmtPct(0.236), '24%');
  assert.equal(fmtPct(1.5), '150%');
  assert.equal(fmtPct(12.34), '1,234%');
  assert.equal(fmtPct(0.1, { sign: true }), '+10%');
  assert.equal(fmtPct(-0.1, { sign: true }), '−10%');
  assert.equal(fmtPct(-0.1), '−10%');
  assert.equal(fmtPct(0, { sign: true }), '0%');
  assert.equal(fmtPct(null), '—');
  assert.equal(fmtPct(NaN), '—');
});

test('PAYMENTS shape', () => {
  assert.deepEqual(
    PAYMENTS.map((p) => p.id),
    ['card', 'cash', 'transfer', 'bit', 'other'],
  );
  for (const p of PAYMENTS) assert.ok(p.label && p.icon);
});

test('uid is unique and short', () => {
  const ids = new Set(Array.from({ length: 5000 }, uid));
  assert.equal(ids.size, 5000);
  for (const id of [...ids].slice(0, 20)) assert.match(id, /^[a-z0-9]{10,20}$/);
});

test('normalizeText', () => {
  assert.equal(normalizeText('  שׁוּפֶרְסַל  דיל '), 'שופרסל דיל');
  assert.equal(normalizeText('Wolt'), 'wolt');
  assert.equal(normalizeText('רב-קו'), 'רב קו');
  assert.equal(normalizeText('ש"ח'), 'שח');
});
