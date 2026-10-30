import test from 'node:test';
import assert from 'node:assert/strict';
import { csvField, exportCSV, exportJSON, importCSVText, importFile, parseCSV, parseDateLoose } from '../js/io.js';
import { buildDemoState, defaultState } from '../js/store.js';

const fileOf = (text, name) => Object.assign(new Blob([text]), { name });

function sample() {
  const s = defaultState();
  s.transactions = [
    { id: 'a', type: 'expense', amount: 4590, categoryId: 'coffee', date: '2026-10-02', note: 'ארומה, דיזנגוף', payment: 'card', createdAt: 2, updatedAt: 2 },
    { id: 'b', type: 'income', amount: 1450000, categoryId: 'salary', date: '2026-10-10', note: 'משכורת "אוקטובר"', payment: 'transfer', createdAt: 3, updatedAt: 3 },
    { id: 'c', type: 'expense', amount: 1000, categoryId: 'misc', date: '2026-09-30', note: '=HYPERLINK("x")', payment: 'cash', createdAt: 1, updatedAt: 1 },
    { id: 'd', type: 'expense', amount: 2000, categoryId: 'misc', date: '2026-10-03', note: 'שורה\nשנייה', payment: 'bit', createdAt: 4, updatedAt: 4 },
  ];
  return s;
}

test('csvField quoting and formula guard', () => {
  assert.equal(csvField('abc'), 'abc');
  assert.equal(csvField('a,b'), '"a,b"');
  assert.equal(csvField('say "hi"'), '"say ""hi"""');
  assert.equal(csvField('line\nbreak'), '"line\nbreak"');
  assert.equal(csvField(' pad'), '" pad"');
  assert.equal(csvField('=1+1', { text: true }), "'=1+1");
  assert.equal(csvField('-5', { text: true }), "'-5");
  assert.equal(csvField(null), '');
});

test('parseCSV handles quotes, CRLF, embedded newlines, BOM, ; and tabs', () => {
  assert.deepEqual(parseCSV('﻿a,b\r\n"x, y","say ""hi"""\r\n"multi\nline",2\n'), [
    ['a', 'b'],
    ['x, y', 'say "hi"'],
    ['multi\nline', '2'],
  ]);
  assert.deepEqual(parseCSV('a;b\n1,5;2'), [
    ['a', 'b'],
    ['1,5', '2'],
  ]);
  assert.deepEqual(parseCSV('a\tb\n1\t2'), [
    ['a', 'b'],
    ['1', '2'],
  ]);
  assert.deepEqual(parseCSV('a,b\n\n,\n1,2'), [
    ['a', 'b'],
    ['1', '2'],
  ]);
});

test('parseDateLoose', () => {
  assert.equal(parseDateLoose('2026-10-30'), '2026-10-30');
  assert.equal(parseDateLoose('30/10/2026'), '2026-10-30');
  assert.equal(parseDateLoose('5/3/2026'), '2026-03-05');
  assert.equal(parseDateLoose('05.03.26'), '2026-03-05');
  assert.equal(parseDateLoose('30-10-2026 14:22'), '2026-10-30');
  assert.equal(parseDateLoose('2026/10/30'), '2026-10-30');
  assert.equal(parseDateLoose('31/02/2026'), null);
  assert.equal(parseDateLoose('hello'), null);
  assert.equal(parseDateLoose(''), null);
});

test('exportCSV: BOM, headers, quoting, period filter, oldest first', async () => {
  const s = sample();
  const blob = exportCSV(s);
  assert.match(blob.type, /text\/csv/);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], 'UTF-8 BOM');
  const text = new TextDecoder().decode(bytes.slice(3));
  const lines = text.split('\r\n');
  assert.equal(lines[0], 'תאריך,סוג,קטגוריה,סכום,אמצעי תשלום,הערה');
  assert.equal(lines[1], `2026-09-30,הוצאה,שונות,10,מזומן,"'=HYPERLINK(""x"")"`);
  assert.equal(lines[2], '2026-10-02,הוצאה,קפה ומאפים,45.90,כרטיס אשראי,"ארומה, דיזנגוף"');
  assert.ok(text.includes('הכנסה,משכורת,14500,העברה בנקאית,"משכורת ""אוקטובר"""'));
  const oct = await exportCSV(s, { key: '2026-10' }).text();
  assert.ok(!oct.includes('2026-09-30'));
  assert.equal(parseCSV(oct).length, 4);
});

test('CSV round-trip of our own export (into an empty state) + dedupe on re-import', async () => {
  const s = sample();
  const csv = await exportCSV(s).text();
  const empty = defaultState();
  const r = await importFile(fileOf(csv, 'maazan.csv'), empty);
  assert.equal(r.kind, 'csv');
  assert.equal(r.added, 4);
  const key = (t) => [t.date, t.type, t.amount, t.categoryId, t.note, t.payment].join('|');
  assert.deepEqual(r.state.transactions.map(key).sort(), s.transactions.map(key).sort());

  // importing the same export into the original state adds nothing
  const again = await importFile(fileOf(csv, 'maazan.csv'), s);
  assert.equal(again.added, 0);
  assert.equal(again.skipped, 4);
  assert.equal(again.state.transactions.length, 4);
});

test('CSV import: Israeli bank statement (debit/credit columns, dd/mm/yyyy, ₪ & commas)', () => {
  const csv = ['עו"ש 12-345-678901', '', 'תאריך,תאריך ערך,תיאור,אסמכתא,חובה,זכות,יתרה', '01/10/2026,01/10/2026,העברה - שכר דירה,111,"₪4,800.00",,"10,200.00"', '10/10/2026,10/10/2026,משכורת,222,,"14,512.40","24,712.40"', 'סה"כ,,,,,,'].join('\n');
  const r = importCSVText(csv, defaultState());
  assert.equal(r.added, 2);
  assert.equal(r.skipped, 1);
  const [rent, salary] = r.state.transactions;
  assert.deepEqual([rent.date, rent.type, rent.amount, rent.note], ['2026-10-01', 'expense', 480000, 'העברה - שכר דירה']);
  assert.deepEqual([salary.date, salary.type, salary.amount], ['2026-10-10', 'income', 1451240]);
  assert.equal(rent.categoryId, 'misc');
  assert.equal(salary.categoryId, 'other-in');
});

test('CSV import: single signed amount column (negative = expense)', () => {
  const csv = 'Date,Description,Amount\n2026-10-05,Shufersal,-245.90\n2026-10-10,Salary,14500\n';
  const r = importCSVText(csv, defaultState());
  assert.equal(r.added, 2);
  const [a, b] = r.state.transactions;
  assert.equal(a.type, 'expense');
  assert.equal(a.amount, 24590);
  assert.equal(b.type, 'income');
  assert.equal(b.amount, 1450000);
});

test('CSV import: credit-card export (all positive = expenses), Hebrew headers, ; delimiter, categories created', () => {
  const csv = ['תאריך עסקה;שם בית העסק;סכום עסקה;סכום חיוב;ענף;תאריך חיוב', '02/10/26;וולט;89,90;89,90;מסעדות;10/11/26', '03/10/26;פז;250;250;דלק;10/11/26', '04/10/26;ארומה;18;18;קפה ומאפים;10/11/26'].join('\r\n');
  const r = importCSVText(csv, defaultState());
  assert.equal(r.added, 3);
  assert.ok(r.state.transactions.every((t) => t.type === 'expense'));
  assert.deepEqual(
    r.state.transactions.map((t) => t.amount),
    [8990, 25000, 1800],
  );
  assert.deepEqual(
    r.state.transactions.map((t) => t.date),
    ['2026-10-02', '2026-10-03', '2026-10-04'],
  );
  const catNames = r.state.transactions.map((t) => r.state.categories.find((c) => c.id === t.categoryId).name);
  assert.deepEqual(catNames, ['מסעדות', 'דלק', 'קפה ומאפים']);
  assert.equal(r.state.categories.filter((c) => c.name === 'קפה ומאפים').length, 1, 'existing category reused');
  assert.equal(r.state.categories.length, defaultState().categories.length + 2, 'two new categories');
});

test('CSV import: errors', () => {
  assert.throws(() => importCSVText('', defaultState()), /ריק/);
  assert.throws(() => importCSVText('foo,bar\n1,2', defaultState()), /עמודות/);
});

test('JSON backup round-trip', async () => {
  const s = buildDemoState('2026-10-30');
  const blob = exportJSON(s);
  assert.equal(blob.type, 'application/json');
  const r = await importFile(fileOf(await blob.text(), 'backup.json'), defaultState());
  assert.equal(r.kind, 'json');
  assert.equal(r.added, s.transactions.length);
  assert.deepEqual(r.state, s);
});

test('JSON import rejects junk', async () => {
  await assert.rejects(importFile(fileOf('{oops', 'x.json'), defaultState()), /פגום/);
  await assert.rejects(importFile(fileOf('{"a":1}', 'x.json'), defaultState()), /גיבוי/);
});
