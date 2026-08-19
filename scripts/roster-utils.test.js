const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeKey, makeRosterKey } = require('./roster-utils.js');

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
