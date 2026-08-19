const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeKey, makeRosterKey, parseCSV, parseRosterRows, extractSheetId, buildSheetCsvUrl } = require('./roster-utils.js');

test('sanitizeKey trims whitespace and truncates to 40 chars', () => {
  assert.equal(sanitizeKey('  홍길동  '), '홍길동');
  assert.equal(sanitizeKey('a'.repeat(50)).length, 40);
});

test('sanitizeKey replaces firebase-illegal characters', () => {
  assert.equal(sanitizeKey('a.b#c$d[e]f/g'), 'a_b_c_d_e_f_g');
});

test('sanitizeKey returns empty string for empty/undefined input', () => {
  assert.equal(sanitizeKey(''), '');
  assert.equal(sanitizeKey(undefined), '');
});

test('makeRosterKey combines sanitized name and grade', () => {
  const existing = new Set();
  assert.equal(makeRosterKey('홍길동', 4, existing), '홍길동_4');
});

test('makeRosterKey appends a numeric suffix on collision', () => {
  const existing = new Set(['홍길동_4']);
  assert.equal(makeRosterKey('홍길동', 4, existing), '홍길동_4_2');
});

test('makeRosterKey keeps incrementing the suffix past _2', () => {
  const existing = new Set(['홍길동_4', '홍길동_4_2']);
  assert.equal(makeRosterKey('홍길동', 4, existing), '홍길동_4_3');
});

test('parseCSV splits rows and cells, trimming whitespace', () => {
  const rows = parseCSV('학년,이름\n4,홍길동\n5, 김민준 \n');
  assert.deepEqual(rows, [['학년','이름'],['4','홍길동'],['5','김민준']]);
});

test('parseCSV skips blank lines', () => {
  const rows = parseCSV('4,홍길동\n\n5,김민준');
  assert.deepEqual(rows, [['4','홍길동'],['5','김민준']]);
});

test('parseRosterRows skips a non-numeric header row', () => {
  const students = parseRosterRows([['학년','이름'],['4','홍길동'],['5','김민준']]);
  assert.deepEqual(students, [{grade:4,name:'홍길동'},{grade:5,name:'김민준'}]);
});

test('parseRosterRows works without a header row', () => {
  const students = parseRosterRows([['4','홍길동'],['5','김민준']]);
  assert.deepEqual(students, [{grade:4,name:'홍길동'},{grade:5,name:'김민준'}]);
});

test('parseRosterRows drops rows with an invalid grade or empty name', () => {
  const students = parseRosterRows([['학년','이름'],['4','홍길동'],['x','유령'],['3','']]);
  assert.deepEqual(students, [{grade:4,name:'홍길동'}]);
});

test('parseRosterRows drops grades outside 1-6', () => {
  const students = parseRosterRows([['0','아기'],['7','성인'],['3','정상']]);
  assert.deepEqual(students, [{grade:3,name:'정상'}]);
});

test('extractSheetId reads the id out of a typical edit URL', () => {
  assert.equal(
    extractSheetId('https://docs.google.com/spreadsheets/d/1AbC-XyZ_123/edit#gid=0'),
    '1AbC-XyZ_123'
  );
});

test('extractSheetId returns null for a non-matching URL', () => {
  assert.equal(extractSheetId('https://example.com/not-a-sheet'), null);
});

test('buildSheetCsvUrl builds the public gviz CSV export URL', () => {
  assert.equal(
    buildSheetCsvUrl('1AbC-XyZ_123'),
    'https://docs.google.com/spreadsheets/d/1AbC-XyZ_123/gviz/tq?tqx=out:csv'
  );
});
