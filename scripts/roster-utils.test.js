const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeKey, makeRosterKey, parseCSV, parseRosterRows, extractSheetId, buildSheetCsvUrl, autoAssignTeams, autoAssignTeamsByClass, computeEffectiveGrade } = require('./roster-utils.js');

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
  assert.deepEqual(students, [{grade:4,cls:'',name:'홍길동'},{grade:5,cls:'',name:'김민준'}]);
});

test('parseRosterRows works without a header row', () => {
  const students = parseRosterRows([['4','홍길동'],['5','김민준']]);
  assert.deepEqual(students, [{grade:4,cls:'',name:'홍길동'},{grade:5,cls:'',name:'김민준'}]);
});

test('parseRosterRows drops rows with an invalid grade or empty name', () => {
  const students = parseRosterRows([['학년','이름'],['4','홍길동'],['x','유령'],['3','']]);
  assert.deepEqual(students, [{grade:4,cls:'',name:'홍길동'}]);
});

test('parseRosterRows drops grades outside 1-6', () => {
  const students = parseRosterRows([['0','아기'],['7','성인'],['3','정상']]);
  assert.deepEqual(students, [{grade:3,cls:'',name:'정상'}]);
});

test('parseRosterRows parses a 3-column 학년,반,이름 sheet when any row has a class value', () => {
  const students = parseRosterRows([['4','1','홍길동'],['5','2','김민준']]);
  assert.deepEqual(students, [{grade:4,cls:'1',name:'홍길동'},{grade:5,cls:'2',name:'김민준'}]);
});

test('parseRosterRows treats a 3-column sheet with a header row the same way', () => {
  const students = parseRosterRows([['학년','반','이름'],['4','1','홍길동'],['5','2','김민준']]);
  assert.deepEqual(students, [{grade:4,cls:'1',name:'홍길동'},{grade:5,cls:'2',name:'김민준'}]);
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

test('autoAssignTeams assigns every student a teamId within range', () => {
  const students = [
    {name:'a',grade:6},{name:'b',grade:6},{name:'c',grade:5},{name:'d',grade:4},
    {name:'e',grade:3},{name:'f',grade:3},{name:'g',grade:1}
  ];
  const result = autoAssignTeams(students, 3, () => 0);
  assert.equal(result.length, 7);
  result.forEach(s => { assert.ok(s.teamId >= 1 && s.teamId <= 3); });
});

test('autoAssignTeams balances team sizes to within 1 of each other', () => {
  const students = [];
  for (let i = 0; i < 20; i++) students.push({ name: 'n' + i, grade: 1 + (i % 6) });
  const result = autoAssignTeams(students, 4, Math.random);
  const counts = [0, 0, 0, 0];
  result.forEach(s => counts[s.teamId - 1]++);
  const max = Math.max(...counts), min = Math.min(...counts);
  assert.ok(max - min <= 1, 'counts: ' + counts.join(','));
});

test('autoAssignTeams fills higher grades into teams before lower grades, round-robin', () => {
  const students = [
    {name:'g6a',grade:6},{name:'g6b',grade:6},{name:'g6c',grade:6},
    {name:'g4a',grade:4},{name:'g4b',grade:4},{name:'g4c',grade:4}
  ];
  const result = autoAssignTeams(students, 3, () => 0);
  const byName = Object.fromEntries(result.map(s => [s.name, s.teamId]));
  assert.deepEqual([byName.g6a, byName.g6b, byName.g6c].sort(), [1, 2, 3]);
  assert.deepEqual([byName.g4a, byName.g4b, byName.g4c].sort(), [1, 2, 3]);
});

test('autoAssignTeams keeps every present grade represented across teams when possible', () => {
  const students = [];
  [6,6,6,6,5,5,5,5,4,4,4,4].forEach((g, i) => students.push({ name: 'n' + i, grade: g }));
  const result = autoAssignTeams(students, 4, Math.random);
  for (let t = 1; t <= 4; t++) {
    const grades = new Set(result.filter(s => s.teamId === t).map(s => s.grade));
    assert.equal(grades.size, 3, 'team ' + t + ' grades: ' + [...grades]);
  }
});

test('autoAssignTeams handles teamCount of 1 by putting everyone on team 1', () => {
  const students = [{name:'a',grade:6},{name:'b',grade:3}];
  const result = autoAssignTeams(students, 1, Math.random);
  result.forEach(s => assert.equal(s.teamId, 1));
});

test('autoAssignTeams groups by grade before assigning, independent of input array order', () => {
  const studentsGradeFirst = [
    {name:'top',grade:6},
    {name:'lowA',grade:1},{name:'lowB',grade:1}
  ];
  const studentsGradeLast = [
    {name:'lowA',grade:1},{name:'lowB',grade:1},
    {name:'top',grade:6}
  ];
  const r1 = autoAssignTeams(studentsGradeFirst, 3, () => 0);
  const r2 = autoAssignTeams(studentsGradeLast, 3, () => 0);
  const teamOf = (result, name) => result.find(s => s.name === name).teamId;
  // Regardless of where the grade-6 student sits in the input array,
  // grade is processed highest-first, so it must always land on the
  // first (emptiest) team — team 1 under the tie-break-to-lowest-index rule.
  assert.equal(teamOf(r1, 'top'), 1);
  assert.equal(teamOf(r2, 'top'), 1);
});

test('computeEffectiveGrade returns the required grade when present', () => {
  assert.equal(computeEffectiveGrade(4, new Set([2, 4, 6])), 4);
});

test('computeEffectiveGrade escalates to the next higher present grade', () => {
  assert.equal(computeEffectiveGrade(4, new Set([2, 5, 6])), 5);
});

test('computeEffectiveGrade falls back to a lower grade when nothing higher is present', () => {
  assert.equal(computeEffectiveGrade(5, new Set([1, 2, 3])), 3);
});

test('computeEffectiveGrade returns the required grade unchanged when the team has no roster yet', () => {
  assert.equal(computeEffectiveGrade(4, new Set()), 4);
});

test('computeEffectiveGrade respects custom grade bounds', () => {
  assert.equal(computeEffectiveGrade(2, new Set([1]), 1, 3), 1);
  assert.equal(computeEffectiveGrade(2, new Set([]), 1, 3), 2);
});

test('autoAssignTeams passes the class(cls) field through to the result, defaulting to empty string', () => {
  const result = autoAssignTeams([{name:'a',grade:3,cls:'2'},{name:'b',grade:3}], 2, () => 0);
  const byName = Object.fromEntries(result.map(s => [s.name, s.cls]));
  assert.equal(byName.a, '2');
  assert.equal(byName.b, '');
});

test('autoAssignTeamsByClass never mixes two different classes into the same team', () => {
  const students = [];
  for (let i = 0; i < 12; i++) students.push({ name: 'a'+i, grade: 1+(i%6), cls: '1' });
  for (let i = 0; i < 12; i++) students.push({ name: 'b'+i, grade: 1+(i%6), cls: '2' });
  const result = autoAssignTeamsByClass(students, 4, Math.random);
  const clsOfTeam = {};
  result.forEach(s => {
    if (clsOfTeam[s.teamId] == null) clsOfTeam[s.teamId] = s.cls;
    assert.equal(s.cls, clsOfTeam[s.teamId], 'team ' + s.teamId + ' mixed classes');
  });
});

test('autoAssignTeamsByClass splits the requested team count across classes proportionally to headcount', () => {
  const students = [];
  for (let i = 0; i < 18; i++) students.push({ name: 'a'+i, grade: 1+(i%6), cls: '1' }); // 18명
  for (let i = 0; i < 6; i++) students.push({ name: 'b'+i, grade: 1+(i%6), cls: '2' });  // 6명
  const result = autoAssignTeamsByClass(students, 4, Math.random);
  const teamsOfCls = { '1': new Set(), '2': new Set() };
  result.forEach(s => teamsOfCls[s.cls].add(s.teamId));
  // 18:6 = 3:1 비율이므로 4개 조를 3개/1개로 나누는 것이 자연스럽다
  assert.equal(teamsOfCls['1'].size, 3);
  assert.equal(teamsOfCls['2'].size, 1);
});

test('autoAssignTeamsByClass guarantees every class at least one team, growing the total if there are more classes than requested teams', () => {
  const students = [
    {name:'a',grade:3,cls:'1'}, {name:'b',grade:3,cls:'2'}, {name:'c',grade:3,cls:'3'}
  ];
  const result = autoAssignTeamsByClass(students, 1, Math.random);
  const teamIds = new Set(result.map(s => s.teamId));
  assert.equal(teamIds.size, 3, 'expected one team per class even though 1 was requested');
});

test('autoAssignTeamsByClass balances grades within each class the same way autoAssignTeams does', () => {
  const students = [];
  for (let i = 0; i < 12; i++) students.push({ name: 'n'+i, grade: 1+(i%6), cls: '1' });
  const result = autoAssignTeamsByClass(students, 3, Math.random);
  const counts = {1:0,2:0,3:0};
  result.forEach(s => counts[s.teamId]++);
  const vals = Object.values(counts);
  assert.ok(Math.max(...vals) - Math.min(...vals) <= 1, 'counts: ' + JSON.stringify(counts));
});
