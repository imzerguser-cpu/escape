# 조 자동 편성 + 단일 페이지 통합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `escape.html`(학생) + `escapeAdmin.html`(관리자)을 `index.html` 하나로 합치고, 학생 개인 로그인을 없애는 대신 관리자가 구글시트/엑셀 명단을 업로드하면 학년이 고르게 섞이도록(상급학년 우선) 조를 자동 편성하게 만든다.

**Architecture:** 조 편성 알고리즘·명단 파싱·학년 대체 규칙처럼 입출력이 분명한 순수 로직은 `scripts/roster-utils.js`에 분리해 Node 테스트로 검증한다. 화면(DOM)을 다루는 나머지는 기존 코드 스타일 그대로 `index.html` 안에 인라인 `<script>`로 작성하고, 학생/관리자 두 화면을 `#studentRoot`/`#adminRoot` 두 컨테이너로 나눠 `appMode` 상태로 토글한다(페이지 이동 없음).

**Tech Stack:** 순수 HTML/CSS/바닐라 JS(빌드 도구 없음), Firebase Realtime Database(`jump-rope-43833` 프로젝트, 기존과 동일), SheetJS(xlsx, CDN)로 엑셀 파싱, 구글시트는 `gviz/tq` CSV 공개 엔드포인트로 fetch, 테스트는 Node 내장 `node:test`.

## Global Constraints

- 스펙 문서: `docs/superpowers/specs/2026-08-19-team-assignment-design.md` (모든 작업의 근거)
- Firebase 프로젝트/설정은 기존 값을 그대로 재사용한다: `apiKey:"AIzaSyAKbtiQ1UutXkGI2ozyTNDO3N20NQ9vjDE",authDomain:"jump-rope-43833.firebaseapp.com",databaseURL:"https://jump-rope-43833-default-rtdb.asia-southeast1.firebasedatabase.app",projectId:"jump-rope-43833",storageBucket:"jump-rope-43833.firebasestorage.app",messagingSenderId:"870652268913",appId:"1:870652268913:web:6b45cabb7e317827b1a6d0"`
- 관리자 비밀번호는 기존과 동일하게 하드코딩 문자열 `"escape2026"`을 그대로 쓴다 (바꾸지 않는다).
- 새 Firebase 경로: `escape_data/meta/teamCount` (숫자). 조 편성 결과는 `escape_data/roster/{key}`에 `{name, grade, teamId, ts}`로 저장 (기존 스키마 그대로).
- 조 진행상황 경로는 `escape_data/team{N}` 그대로 두되, N의 상한을 하드코딩 5 대신 전역 변수 `teamCount`로 바꾼다.
- 이 저장소에는 지금 빌드 도구/패키지 매니저가 없다. `scripts/roster-utils.js`는 브라우저 `<script src>`와 Node `require()` 양쪽에서 그대로 동작해야 하므로 `import`/`export` 문법을 쓰지 않고, 함수 정의 후 `module.exports`(Node)와 `window.RosterUtils`(브라우저)에 동시에 노출하는 방식을 쓴다.
- 테스트는 `node --test scripts/`로 실행한다 (Node 24 확인됨, `node:test`/`node:assert/strict` 내장 모듈만 사용, 외부 패키지 설치 불필요).
- DOM을 다루는 화면 작업(Task 5 이후)은 자동 테스트 프레임워크가 없으므로, 각 작업 끝에 있는 "수동 확인" 단계를 브라우저에서 실제로 수행하고 관찰 결과를 확인하는 것으로 검증을 대신한다 — 이 단계를 생략하면 안 된다.
- 원본 파일 `escape.html`(975줄), `escapeAdmin.html`(527줄)은 Task 9까지 저장소에 그대로 남겨두고 참고용(코드 이식 원본)으로 쓴다. 삭제는 Task 9의 마지막 단계에서만 한다.
- 대상 저장소: `C:\Users\박정민\escape` (GitHub `imzerguser-cpu/escape`, GitHub Pages로 `main` 브랜치 루트가 배포됨).

---

## Task 1: roster-utils — sanitizeKey / makeRosterKey

**Files:**
- Create: `scripts/roster-utils.js`
- Test: `scripts/roster-utils.test.js`

**Interfaces:**
- Produces: `sanitizeKey(name: string): string`, `makeRosterKey(name: string, grade: number, existingKeys: Set<string>): string`
- 이 두 함수는 Task 2~4에서 같은 `scripts/roster-utils.js` 파일에 함수를 추가하고 같은 export 객체에 이어붙이는 방식으로 계속 확장된다.

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/roster-utils.test.js` 파일을 만들고 다음을 작성한다:

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `node --test scripts/roster-utils.test.js`
Expected: FAIL — `Cannot find module './roster-utils.js'`

- [ ] **Step 3: 최소 구현 작성**

`scripts/roster-utils.js`를 새로 만든다:

```js
function sanitizeKey(name) {
  return (name || "").toString().trim().replace(/[.#$\[\]\/]/g, "_").slice(0, 40);
}

function makeRosterKey(name, grade, existingKeys) {
  const base = sanitizeKey(name) + "_" + grade;
  if (!existingKeys.has(base)) return base;
  let i = 2;
  while (existingKeys.has(base + "_" + i)) i++;
  return base + "_" + i;
}

const RosterUtils = { sanitizeKey, makeRosterKey };

if (typeof module !== "undefined" && module.exports) {
  module.exports = RosterUtils;
}
if (typeof window !== "undefined") {
  window.RosterUtils = RosterUtils;
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test scripts/roster-utils.test.js`
Expected: PASS — 6 tests, 0 failures

- [ ] **Step 5: 커밋**

```bash
git add scripts/roster-utils.js scripts/roster-utils.test.js
git commit -m "feat: add sanitizeKey/makeRosterKey roster utilities"
```

---

## Task 2: roster-utils — 명단 파싱 (CSV / 구글시트 URL)

**Files:**
- Modify: `scripts/roster-utils.js` (Task 1에서 만든 `RosterUtils` export 객체에 함수 추가)
- Test: `scripts/roster-utils.test.js` (Task 1 테스트 뒤에 이어서 추가)

**Interfaces:**
- Consumes: 없음 (독립 순수 함수)
- Produces: `parseCSV(text: string): string[][]`, `parseRosterRows(rows: string[][]): {name: string, grade: number}[]`, `extractSheetId(url: string): string|null`, `buildSheetCsvUrl(id: string): string`

- [ ] **Step 1: 실패하는 테스트 추가**

`scripts/roster-utils.test.js` 맨 아래에 이어서 추가한다 (import 줄을 아래처럼 확장):

```js
```

먼저 파일 맨 위 import 줄을 다음으로 교체한다:

```js
const { sanitizeKey, makeRosterKey, parseCSV, parseRosterRows, extractSheetId, buildSheetCsvUrl } = require('./roster-utils.js');
```

그 다음 파일 끝에 추가한다:

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `node --test scripts/roster-utils.test.js`
Expected: FAIL — `parseCSV is not a function` 등

- [ ] **Step 3: 구현 추가**

`scripts/roster-utils.js`에서 `const RosterUtils = { sanitizeKey, makeRosterKey };` 줄 **위**에 다음 함수들을 추가하고, `RosterUtils` 객체에도 추가한다:

```js
function parseCSV(text) {
  return text
    .split(/\r\n|\r|\n/)
    .filter(line => line.trim() !== "")
    .map(line => line.split(",").map(cell => cell.trim().replace(/^"|"$/g, "")));
}

function parseRosterRows(rows) {
  const students = [];
  rows.forEach((row, i) => {
    const gradeRaw = (row[0] || "").toString().trim();
    const nameRaw = (row[1] || "").toString().trim();
    if (i === 0 && !/^\d+$/.test(gradeRaw)) return; // 헤더 행으로 간주하고 건너뜀
    const grade = parseInt(gradeRaw, 10);
    if (!Number.isInteger(grade) || grade < 1 || grade > 6) return;
    if (!nameRaw) return;
    students.push({ grade, name: nameRaw });
  });
  return students;
}

function extractSheetId(url) {
  const m = (url || "").match(/\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

function buildSheetCsvUrl(id) {
  return "https://docs.google.com/spreadsheets/d/" + id + "/gviz/tq?tqx=out:csv";
}
```

`const RosterUtils = { sanitizeKey, makeRosterKey };` 줄을 다음으로 교체한다:

```js
const RosterUtils = { sanitizeKey, makeRosterKey, parseCSV, parseRosterRows, extractSheetId, buildSheetCsvUrl };
```

- [ ] **Step 4: 통과 확인**

Run: `node --test scripts/roster-utils.test.js`
Expected: PASS — 15 tests, 0 failures

- [ ] **Step 5: 커밋**

```bash
git add scripts/roster-utils.js scripts/roster-utils.test.js
git commit -m "feat: add CSV/Google-Sheet roster parsing utilities"
```

---

## Task 3: roster-utils — 조 자동 편성 알고리즘

**Files:**
- Modify: `scripts/roster-utils.js`
- Test: `scripts/roster-utils.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `autoAssignTeams(students: {name: string, grade: number}[], teamCount: number, rng?: () => number): {name: string, grade: number, teamId: number}[]` — `rng`를 생략하면 `Math.random`을 쓰고, 테스트에서는 결정론적 함수를 주입한다.

- [ ] **Step 1: 실패하는 테스트 추가**

`scripts/roster-utils.test.js` 맨 위 import 줄을 다음으로 교체한다:

```js
const { sanitizeKey, makeRosterKey, parseCSV, parseRosterRows, extractSheetId, buildSheetCsvUrl, autoAssignTeams } = require('./roster-utils.js');
```

파일 끝에 추가한다:

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `node --test scripts/roster-utils.test.js`
Expected: FAIL — `autoAssignTeams is not a function`

- [ ] **Step 3: 구현 추가**

`scripts/roster-utils.js`에서 `const RosterUtils = {...}` 줄 위에 추가한다:

```js
function autoAssignTeams(students, teamCount, rng) {
  rng = rng || Math.random;
  const n = teamCount >= 1 ? teamCount : 1;
  const byGrade = {};
  students.forEach(s => { (byGrade[s.grade] = byGrade[s.grade] || []).push(s); });
  const grades = Object.keys(byGrade).map(Number).sort((a, b) => b - a);
  const counts = new Array(n).fill(0);
  const result = [];
  grades.forEach(g => {
    const list = byGrade[g].slice();
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    }
    list.forEach(s => {
      let best = 0;
      for (let t = 1; t < n; t++) if (counts[t] < counts[best]) best = t;
      counts[best]++;
      result.push({ name: s.name, grade: s.grade, teamId: best + 1 });
    });
  });
  return result;
}
```

`const RosterUtils = {...}` 줄을 다음으로 교체한다:

```js
const RosterUtils = { sanitizeKey, makeRosterKey, parseCSV, parseRosterRows, extractSheetId, buildSheetCsvUrl, autoAssignTeams };
```

- [ ] **Step 4: 통과 확인**

Run: `node --test scripts/roster-utils.test.js`
Expected: PASS — 20 tests, 0 failures

- [ ] **Step 5: 커밋**

```bash
git add scripts/roster-utils.js scripts/roster-utils.test.js
git commit -m "feat: add grade-balanced auto team assignment algorithm"
```

---

## Task 4: roster-utils — 학년 대체 규칙 (computeEffectiveGrade)

**Files:**
- Modify: `scripts/roster-utils.js`
- Test: `scripts/roster-utils.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `computeEffectiveGrade(requiredGrade: number, presentGrades: Set<number>, minGrade?: number, maxGrade?: number): number` — `minGrade`/`maxGrade` 생략 시 1/6. 이 함수는 Task 6(학생 화면)과 Task 8(관리자 "담당 학생" 표시)에서 동일하게 재사용된다.

- [ ] **Step 1: 실패하는 테스트 추가**

`scripts/roster-utils.test.js` 맨 위 import 줄을 다음으로 교체한다:

```js
const { sanitizeKey, makeRosterKey, parseCSV, parseRosterRows, extractSheetId, buildSheetCsvUrl, autoAssignTeams, computeEffectiveGrade } = require('./roster-utils.js');
```

파일 끝에 추가한다:

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `node --test scripts/roster-utils.test.js`
Expected: FAIL — `computeEffectiveGrade is not a function`

- [ ] **Step 3: 구현 추가**

`scripts/roster-utils.js`에서 `const RosterUtils = {...}` 줄 위에 추가한다:

```js
function computeEffectiveGrade(requiredGrade, presentGrades, minGrade, maxGrade) {
  const lo = minGrade == null ? 1 : minGrade;
  const hi = maxGrade == null ? 6 : maxGrade;
  if (!presentGrades || presentGrades.size === 0) return requiredGrade;
  if (presentGrades.has(requiredGrade)) return requiredGrade;
  for (let g = requiredGrade + 1; g <= hi; g++) if (presentGrades.has(g)) return g;
  for (let g = requiredGrade - 1; g >= lo; g--) if (presentGrades.has(g)) return g;
  return requiredGrade;
}
```

`const RosterUtils = {...}` 줄을 다음으로 교체한다:

```js
const RosterUtils = { sanitizeKey, makeRosterKey, parseCSV, parseRosterRows, extractSheetId, buildSheetCsvUrl, autoAssignTeams, computeEffectiveGrade };
```

- [ ] **Step 4: 통과 확인**

Run: `node --test scripts/roster-utils.test.js`
Expected: PASS — 25 tests, 0 failures

- [ ] **Step 5: 커밋**

```bash
git add scripts/roster-utils.js scripts/roster-utils.test.js
git commit -m "feat: add cross-grade fallback rule shared by student and admin views"
```

---

## Task 5: index.html 뼈대 — CSS 병합, 상수 통합, appMode 토글, 조 선택 화면

이 작업부터는 브라우저 DOM을 다루므로 자동 테스트가 없다. 각 Step 뒤의 "수동 확인"을 실제로 브라우저에서 수행한다.

**Files:**
- Create: `index.html`
- Read (이식 원본, 수정하지 않음): `escape.html`, `escapeAdmin.html`

**Interfaces:**
- Consumes: `RosterUtils`(전역, `scripts/roster-utils.js`에서 로드)
- Produces: 전역 상태 `appMode`(`'student'|'admin'`), `team`, `teamCount`, `rosterAll`, `view`; 함수 `setAppMode` 대신 `enterAdminMode()`/`exitAdminMode()`, `renderTeamPick()`, `pickTeam(n)`, `connectRoster()` — 이후 Task 6~8이 이 이름들을 그대로 사용한다.

### 배경: 두 파일의 CSS가 같은 클래스명(.card, .btn, .wrap, .hd, .modal-ov 등)을 다른 스타일로 정의하고 있다

그래서 학생 화면 전체를 `<div id="studentRoot">`로, 관리자 화면 전체를 `<div id="adminRoot">`로 감싸고, 각 CSS 블록의 모든 선택자 앞에 해당 컨테이너 ID를 붙여 스코프를 분리한다. `:root` 변수와 `*`/`html`/`body` 리셋은 두 파일에서 값이 동일(관리자 쪽이 학생 쪽의 부분집합)하므로 학생 쪽 `:root`(더 많은 변수를 가짐) 하나만 남기고 전역으로 공유한다.

- [ ] **Step 1: index.html 뼈대 작성 (CSS + body 구조 + 상수 + Firebase init)**

`index.html`을 새로 만든다:

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>🔑 방탈출 놀이</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800;900&display=swap');
:root{--navy:#1B2E4A;--navy-l:#2A4470;--navy-g:#3B6BA5;--sky:#4DA3E8;--sky-p:#E8F4FD;--red:#E0465A;--green:#2DAA6E;--orange:#E8833A;--gold:#D4A017;--purple:#B15CFF;--bg:#F3F5F8;--card:#FFF;--tx:#1E2D3D;--tx2:#6B7D8F;--tx3:#A4B3C2;--bdr:#E0E7EF;--sh:0 1px 4px rgba(27,46,74,.07);--r:12px;}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
html{font-size:16px;}
body{font-family:'Noto Sans KR',sans-serif;background:var(--bg);color:var(--tx);line-height:1.5;min-height:100vh;overflow-x:hidden;}

/* ===== 학생 화면 (#studentRoot 스코프) ===== */
#studentRoot .hd{background:linear-gradient(135deg,var(--navy),var(--navy-g));color:#fff;padding:14px 16px;position:sticky;top:0;z-index:50;box-shadow:0 2px 12px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:space-between;}
#studentRoot .hd-l{display:flex;flex-direction:column;}
#studentRoot .hd-title{font-size:17px;font-weight:900;}
#studentRoot .hd-team{font-size:11px;opacity:.75;margin-top:1px;}
#studentRoot .sync-ind{font-size:10px;opacity:.85;display:flex;align-items:center;gap:4px;}
#studentRoot .sync-dot{width:7px;height:7px;border-radius:50%;display:inline-block;}
#studentRoot .sync-on{background:#4ADE80;}#studentRoot .sync-off{background:#F59E0B;}#studentRoot .sync-err{background:#EF4444;}
#studentRoot .wrap{max-width:640px;margin:0 auto;padding:16px 14px 40px;}
#studentRoot .btn{border:none;border-radius:10px;cursor:pointer;font-family:inherit;font-weight:800;transition:.12s;}
#studentRoot .btn:active{transform:scale(.97);}
#studentRoot .btn-lg{padding:16px;font-size:17px;width:100%;color:#fff;}
#studentRoot .btn-primary{background:linear-gradient(135deg,var(--sky),var(--navy-g));}
#studentRoot .btn-sub{background:#fff;color:var(--navy);border:2px solid var(--bdr);}
#studentRoot .btn-danger{background:var(--red);color:#fff;}
#studentRoot .btn-green{background:var(--green);color:#fff;}
#studentRoot .card{background:var(--card);border-radius:var(--r);box-shadow:var(--sh);padding:18px;margin-bottom:14px;}
#studentRoot .name-row{display:flex;gap:8px;}
#studentRoot .team-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px;}
@media(min-width:480px){#studentRoot .team-grid{grid-template-columns:repeat(3,1fr);}}
#studentRoot .team-btn{padding:26px 10px;border-radius:14px;border:none;cursor:pointer;font-family:inherit;background:#fff;box-shadow:var(--sh);font-size:20px;font-weight:900;color:var(--navy);transition:.12s;}
#studentRoot .team-btn:active{transform:scale(.96);background:var(--sky-p);}
#studentRoot .team-btn.picked{background:var(--sky-p);box-shadow:inset 0 0 0 2px var(--sky);}
#studentRoot .keys-bar{display:flex;align-items:center;justify-content:center;gap:6px;padding:14px;background:linear-gradient(135deg,#FFF7E0,#FFEFC2);border-radius:var(--r);margin-bottom:14px;border:1px solid #F0DFA0;}
#studentRoot .keys-bar .k{font-size:26px;filter:grayscale(1) opacity(.35);}
#studentRoot .keys-bar .k.on{filter:none;}
#studentRoot .keys-txt{font-size:12px;color:#7C5A00;font-weight:700;margin-left:8px;}
#studentRoot .room-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
#studentRoot .room-card{background:#fff;border-radius:14px;box-shadow:var(--sh);padding:16px 12px;text-align:center;border:2px solid transparent;cursor:pointer;}
#studentRoot .room-card.done{border-color:var(--green);background:#F0FBF5;}
#studentRoot .room-card.locked{opacity:.5;}
#studentRoot .lock-msg{font-size:10px;color:var(--tx3);margin-top:6px;font-weight:700;}
#studentRoot .room-emoji{font-size:32px;}
#studentRoot .room-name{font-size:13px;font-weight:800;margin-top:4px;}
#studentRoot .room-prog{font-size:12px;color:var(--tx2);margin-top:4px;font-weight:700;}
#studentRoot .room-bar{height:6px;background:#E7ECF2;border-radius:3px;margin-top:6px;overflow:hidden;}
#studentRoot .room-bar-f{height:100%;background:var(--sky);border-radius:3px;transition:width .3s;}
#studentRoot .room-card.done .room-bar-f{background:var(--green);}
#studentRoot .final-card{background:#fff;border-radius:14px;box-shadow:var(--sh);padding:16px 12px;text-align:center;border:2px solid var(--gold);background:#FFFBEA;margin-top:12px;cursor:pointer;}
#studentRoot .final-card.done{border-color:var(--green);background:#F0FBF5;}
#studentRoot .scan-fab{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);width:min(560px,calc(100% - 32px));z-index:40;}
#studentRoot .scan-fab button{padding:18px;border-radius:16px;font-size:18px;box-shadow:0 6px 20px rgba(27,46,74,.35);}
#studentRoot .team-switch{font-size:11px;color:var(--tx3);text-align:center;margin-top:18px;text-decoration:underline;cursor:pointer;}
#studentRoot .scan-wrap{text-align:center;}
#studentRoot .cam-box{position:relative;width:100%;max-width:420px;margin:10px auto;border-radius:16px;overflow:hidden;background:#000;aspect-ratio:1/1;}
#studentRoot .cam-box video{width:100%;height:100%;object-fit:cover;}
#studentRoot .cam-frame{position:absolute;inset:14%;border:3px solid #fff;border-radius:16px;box-shadow:0 0 0 999px rgba(0,0,0,.35);}
#studentRoot .cam-msg{font-size:12px;color:var(--tx2);margin:8px 0;}
#studentRoot .manual-box{background:#fff;border-radius:var(--r);box-shadow:var(--sh);padding:14px;margin-top:16px;}
#studentRoot .manual-box h4{font-size:13px;color:var(--tx2);margin-bottom:8px;}
#studentRoot .manual-row{display:flex;gap:8px;}
#studentRoot .txt-inp{flex:1;padding:12px;border:2px solid var(--bdr);border-radius:10px;font-size:16px;font-family:inherit;text-transform:uppercase;}
#studentRoot .txt-inp:focus{border-color:var(--sky);outline:none;}
#studentRoot .q-badges{display:flex;gap:6px;align-items:center;margin-bottom:10px;flex-wrap:wrap;}
#studentRoot .badge{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:800;}
#studentRoot .b-id{background:var(--navy);color:#fff;}
#studentRoot .b-grade{background:var(--sky-p);color:var(--navy-g);}
#studentRoot .b-unit{background:#F0F3F7;color:var(--tx2);}
#studentRoot .grade-warn{background:#FFF3D6;border:1px solid #F5DFA0;border-radius:10px;padding:10px 12px;font-size:13px;color:#7C5A00;font-weight:700;margin-bottom:12px;}
#studentRoot .qimg{margin:10px 0;text-align:center;background:#FAFBFC;border:1px solid #E5EAEF;border-radius:10px;padding:10px;}
#studentRoot .qimg svg{width:100%;height:auto;max-width:320px;display:block;margin:0 auto;}
#studentRoot .qimg.wide svg{max-width:600px;}
#studentRoot .qimg table.plain{width:100%;max-width:230px;margin:0 auto 10px;border-collapse:collapse;}
#studentRoot .qimg table.plain th,#studentRoot .qimg table.plain td{border:1px solid #ccc;padding:5px 8px;font-size:12px;text-align:center;}
#studentRoot .qimg table.plain th{background:#F0F3F7;}
#studentRoot .pictogram{font-size:30px;text-align:center;letter-spacing:8px;}
#studentRoot .dotgrid{font-size:19px;text-align:center;letter-spacing:2px;color:var(--navy-g);line-height:1.6;font-weight:700;}
#studentRoot .q-text{font-size:16px;font-weight:600;margin:12px 0;line-height:1.6;}
#studentRoot .ans-row{display:flex;gap:8px;margin-top:10px;}
#studentRoot .ans-row .txt-inp{text-transform:none;}
#studentRoot .fb-box{margin-top:14px;padding:14px;border-radius:12px;font-size:15px;font-weight:800;text-align:center;}
#studentRoot .fb-ok{background:#E8F9EF;color:var(--green);border:1px solid #B9EDCB;}
#studentRoot .fb-bad{background:#FDEEEF;color:var(--red);border:1px solid #F5C6CB;}
#studentRoot .fb-lock{background:#FFF3D6;color:#7C5A00;border:1px solid #F5DFA0;}
#studentRoot .fb-review{background:#EAF2FB;color:var(--navy-g);border:1px solid #C7DCF2;}
#studentRoot .center-icon{font-size:42px;text-align:center;margin-bottom:6px;}
#studentRoot .cooldown-txt{font-size:12px;color:var(--tx3);text-align:center;margin-top:8px;}
#studentRoot .scr-hd{display:flex;align-items:center;justify-content:space-between;margin:14px 0 6px;}
#studentRoot .scr-hd .lbl{font-size:12px;font-weight:800;color:var(--tx2);}
#studentRoot .scr-hd button{border:1px solid var(--bdr);background:#fff;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;color:var(--tx);cursor:pointer;font-family:inherit;}
#studentRoot .canvas-wrap{position:relative;height:220px;border:1px solid var(--bdr);border-radius:10px;background:#fcfcfd;touch-action:none;overflow:hidden;}
#studentRoot .canvas-wrap canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;}
#studentRoot .finale{text-align:center;padding:40px 16px;}
#studentRoot .finale .em{font-size:64px;}
#studentRoot .finale h2{font-size:22px;margin:10px 0;color:var(--navy);}
#studentRoot .finale p{font-size:14px;color:var(--tx2);line-height:1.7;}
#studentRoot .top-back{font-size:13px;color:var(--sky);font-weight:800;cursor:pointer;margin-bottom:10px;display:inline-block;}
#studentRoot .modal-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;}
#studentRoot .modal-box{background:#fff;border-radius:16px;padding:26px 20px;max-width:340px;width:100%;text-align:center;box-shadow:0 16px 48px rgba(0,0,0,.25);}
#studentRoot .modal-box .em{font-size:56px;}
#studentRoot .modal-box h3{font-size:19px;margin:8px 0;color:var(--navy);}
#studentRoot .modal-box p{font-size:13px;color:var(--tx2);line-height:1.6;margin-bottom:16px;}
#studentRoot .grid8{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px;}
#studentRoot .cell8{aspect-ratio:1/1;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;background:#E7ECF2;color:var(--tx3);}
#studentRoot .cell8.solved{background:var(--green);color:#fff;}
#studentRoot .cell8.next{background:var(--sky);color:#fff;box-shadow:0 0 0 3px var(--sky-p);}
#studentRoot .admin-acc{margin-top:24px;text-align:center;}
#studentRoot .admin-acc summary{font-size:11px;color:var(--tx3);cursor:pointer;list-style:none;}
#studentRoot .admin-acc summary::-webkit-details-marker{display:none;}
#studentRoot .admin-acc-body{margin-top:10px;display:flex;gap:8px;justify-content:center;}
#studentRoot .confetti-cv{position:fixed;inset:0;pointer-events:none;z-index:300;}
#studentRoot .celebrate-ov{position:fixed;inset:0;background:rgba(27,46,74,.94);z-index:250;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#fff;text-align:center;padding:20px;}
#studentRoot .celebrate-ov h1{font-size:30px;margin:14px 0;background:linear-gradient(90deg,#FFD700,#FF6B9D,#4DA3E8,#2DAA6E);-webkit-background-clip:text;background-clip:text;color:transparent;animation:hue 3s linear infinite;}
@keyframes hue{0%{filter:hue-rotate(0)}100%{filter:hue-rotate(360deg)}}
#studentRoot .bounce{animation:bounce 1s ease-in-out infinite;}
@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}

/* ===== 관리자 화면 (#adminRoot 스코프) ===== */
#adminRoot .hd{background:linear-gradient(135deg,var(--navy),var(--navy-g));color:#fff;padding:16px 20px;}
#adminRoot .hd h1{font-size:19px;}
#adminRoot .hd .sub{font-size:11px;opacity:.7;margin-top:2px;}
#adminRoot .tabs{display:flex;gap:2px;background:rgba(255,255,255,.15);border-radius:8px;padding:2px;margin-top:10px;max-width:560px;flex-wrap:wrap;}
#adminRoot .empty-msg{color:var(--tx2);font-size:13px;padding:20px;text-align:center;}
#adminRoot select.team-sel{padding:5px 8px;border-radius:6px;border:1px solid var(--bdr);font-family:inherit;font-size:12px;}
#adminRoot .help-card{border:2px solid #F59E0B;background:#FFFBEB;}
#adminRoot .help-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid #FDE68A;}
#adminRoot .help-row:first-of-type{border-top:none;}
#adminRoot .help-title{font-weight:900;color:#92400E;margin-bottom:4px;font-size:14px;}
#adminRoot .modal-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:200;display:none;align-items:center;justify-content:center;padding:16px;}
#adminRoot .modal-ov.show{display:flex;}
#adminRoot .modal-box{background:#fff;border-radius:16px;padding:20px;max-width:760px;width:100%;max-height:85vh;overflow-y:auto;text-align:left;box-shadow:0 16px 48px rgba(0,0,0,.25);}
#adminRoot .modal-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;position:sticky;top:0;background:#fff;padding-bottom:8px;}
#adminRoot .modal-hd h3{font-size:16px;color:var(--navy);}
#adminRoot .work-item{margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--bdr);}
#adminRoot .work-item img{max-width:100%;border:1px solid var(--bdr);border-radius:8px;margin-top:6px;background:#fafbfc;}
#adminRoot .tab{flex:1;padding:8px 6px;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700;background:transparent;color:rgba(255,255,255,.7);font-family:inherit;white-space:nowrap;}
#adminRoot .tab.on{background:#fff;color:var(--navy);}
#adminRoot .wrap{max-width:1000px;margin:0 auto;padding:18px;}
#adminRoot .card{background:var(--card);border-radius:10px;box-shadow:var(--sh);padding:16px;margin-bottom:16px;}
#adminRoot table{width:100%;border-collapse:collapse;font-size:13px;}
#adminRoot th,#adminRoot td{border:1px solid var(--bdr);padding:8px 6px;text-align:center;}
#adminRoot th{background:#F0F3F7;font-size:11px;}
#adminRoot .prog-cell{font-weight:800;}
#adminRoot .prog-full{color:var(--green);background:#EAFBF1;}
#adminRoot .prog-zero{color:#B9C2CC;}
#adminRoot .keycount{font-size:18px;font-weight:900;color:#D4A017;}
#adminRoot .btn{border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-weight:700;padding:9px 16px;font-size:13px;}
#adminRoot .btn-danger{background:var(--red);color:#fff;}
#adminRoot .btn-primary{background:var(--sky);color:#fff;}
#adminRoot .btn-sub{background:#F0F3F7;color:var(--navy);}
#adminRoot .reset-mini{margin-top:4px;border:1px solid var(--bdr);background:#fff;color:var(--tx2);border-radius:6px;cursor:pointer;font-size:12px;padding:2px 8px;}
#adminRoot .reset-mini:hover{background:#FDEEEF;color:var(--red);border-color:#F5C6CB;}
#adminRoot .actions{display:flex;gap:8px;justify-content:flex-end;margin-bottom:10px;}
#adminRoot .room-sec{page-break-inside:avoid;margin-bottom:22px;}
#adminRoot .room-sec h2{font-size:15px;background:var(--navy);color:#fff;padding:6px 10px;border-radius:6px;margin-bottom:10px;}
#adminRoot .qr-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
#adminRoot .qr-card{border:1px solid var(--bdr);border-radius:8px;padding:8px;text-align:center;page-break-inside:avoid;background:#fff;}
#adminRoot .qr-card canvas{width:100%;height:auto;max-width:120px;}
#adminRoot .qr-id{font-weight:900;font-size:12px;margin-top:4px;}
#adminRoot .qr-meta{font-size:10px;color:var(--tx2);}
#adminRoot .qedit{border-top:1px solid var(--bdr);padding:10px 0;}
#adminRoot .qedit textarea{width:100%;min-height:52px;padding:6px;border:1px solid var(--bdr);border-radius:6px;font-size:13px;font-family:inherit;}
#adminRoot .qedit input[type=text],#adminRoot .qedit input:not([type]){padding:5px 8px;border:1px solid var(--bdr);border-radius:6px;font-size:12px;font-family:inherit;}
@media print{
  #adminRoot .hd,#adminRoot .actions,#adminRoot .tabs{display:none!important;}
  #adminRoot .wrap{padding:0;max-width:none;}
  #adminRoot .card{box-shadow:none;border:none;padding:0;}
  #adminRoot .qr-grid{grid-template-columns:repeat(4,1fr);}
  #adminRoot .qr-id,#adminRoot .no-print{display:none!important;}
}
</style>
</head>
<body>
<div id="studentRoot">
  <div class="hd">
    <div class="hd-l">
      <div class="hd-title">🔑 방탈출 놀이</div>
      <div class="hd-team" id="hdTeam">조 선택 전</div>
    </div>
    <div class="sync-ind"><span class="sync-dot sync-off" id="syncDot"></span><span id="syncTxt">연결 중</span></div>
  </div>
  <div class="wrap" id="app"></div>
</div>

<div id="adminRoot" style="display:none">
  <div class="hd">
    <h1>🔑 방탈출 관리자 페이지</h1>
    <div class="sub">실시간 진행 현황 · QR 코드 인쇄</div>
    <div class="tabs">
      <button class="tab on" id="tabDash" onclick="showTab('dash')">📊 대시보드</button>
      <button class="tab" id="tabRoster" onclick="showTab('roster')">🧑‍🤝‍🧑 학생 배정</button>
      <button class="tab" id="tabQuestions" onclick="showTab('questions')">📝 문제 관리</button>
      <button class="tab" id="tabQr" onclick="showTab('qr')">🖨️ QR 인쇄</button>
      <button class="tab" onclick="exitAdminMode()">← 학생 화면으로</button>
    </div>
  </div>
  <div class="wrap">
    <div id="globalErr" style="display:none;color:#E0465A;background:#FDEEEF;border:1px solid #F5C6CB;border-radius:10px;padding:12px;margin-bottom:14px;font-size:13px;"></div>
    <div id="viewDash"></div>
    <div id="viewRoster" style="display:none"></div>
    <div id="viewQuestions" style="display:none"></div>
    <div id="viewQr" style="display:none"></div>
  </div>
  <div class="modal-ov" id="workModalOv">
    <div class="modal-box">
      <div class="modal-hd"><h3 id="workModalTitle"></h3><button class="btn btn-sub" onclick="closeWorkModal()">닫기</button></div>
      <div id="workModalBody"></div>
    </div>
  </div>
</div>

<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
<script src="scripts/roster-utils.js"></script>
<script>
window.addEventListener("error",function(e){
  const el=document.getElementById("globalErr")||document.getElementById("app");
  if(el)el.innerHTML='<div class="card" style="color:#E0465A"><b>화면 오류가 발생했어요.</b><br>'+e.message+'<br><br>학교 와이파이가 구글 서버(Firebase) 접속을 막고 있을 수 있어요. 새로고침해보거나 다른 네트워크로 접속해보세요.</div>';
});
firebase.initializeApp({apiKey:"AIzaSyAKbtiQ1UutXkGI2ozyTNDO3N20NQ9vjDE",authDomain:"jump-rope-43833.firebaseapp.com",databaseURL:"https://jump-rope-43833-default-rtdb.asia-southeast1.firebasedatabase.app",projectId:"jump-rope-43833",storageBucket:"jump-rope-43833.firebasestorage.app",messagingSenderId:"870652268913",appId:"1:870652268913:web:6b45cabb7e317827b1a6d0"});
const db=firebase.database();
const dbRoot=db.ref("escape_data");
</script>
</body>
</html>
```

- [ ] **Step 2: 수동 확인 — 뼈대가 로드되는지**

`index.html`을 더블클릭해 브라우저로 연다.
Expected: 상단에 "🔑 방탈출 놀이" 헤더가 보이고, 콘솔(F12)에 에러가 없다. `#app`은 아직 비어 있다(정상 — 다음 Step에서 채운다).

- [ ] **Step 3: 데이터 상수 통합 (양쪽 파일에 중복 정의되어 있던 것을 한 곳으로)**

`index.html`의 `const db=firebase.database();` 줄과 `const dbRoot=db.ref("escape_data");` 줄 **사이**에, `escape.html`의 153~168번째 줄(`/* ===================== 문제 데이터 ===================== */`부터 `const CODE2QID={};...` 줄까지: `ROOMS`, `FINAL_ROOM`, `POOL_A`, `POOL_B`, `CODES`, `CODE2QID`)을 그대로 복사해 붙여넣는다.

이어서 `escape.html`의 170~279번째 줄(`const QUESTIONS={` 부터 그 객체의 닫는 `};`까지, `R1`~`R6` 방 전체)을 그대로 복사해 붙여넣는다.

이어서 `escapeAdmin.html`의 140~148번째 줄(`// qid, 학년, 유형 라벨만 필요...` 부터 `const QMETA={...R6:...};`까지)을 그대로 복사해 붙여넣는다.

이어서 `escapeAdmin.html`의 153~208번째 줄(`/* 문제 전체 내용... */` 부터 `const QFULL={...R6:...};`까지)을 그대로 복사해 붙여넣는다.

마지막으로 다음 두 줄을 추가한다 (관리자 쪽에서 QR 인쇄/문제 관리 탭이 방+협동미션을 함께 순회할 때 씀):

```js
const ALL_ROOMS=ROOMS.concat([FINAL_ROOM]);
function escapeHtml(s){return (s||"").toString().replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
```

- [ ] **Step 4: 수동 확인 — 콘솔 에러 없이 상수가 로드되는지**

`index.html`을 새로고침한다.
Expected: 콘솔에 `ROOMS is not defined` 같은 에러 없이 조용하다. (화면은 아직 그대로 비어있는 게 정상 — 렌더 함수가 아직 없다.)

- [ ] **Step 5: appMode 토글 + 관리자 로그인 함수 추가**

`escapeHtml` 함수 정의 뒤에 다음을 추가한다:

```js
/* ===================== 상태 ===================== */
let appMode="student";
let team=localStorage.getItem("escape_team")||"";
let teamCount=0;
let rosterAll={};
let teamGrades=new Set();
let solvedIds={},randomPicks={},cooldown={};
let unlocked={},helpRequest=null;
let dbRef=null,myLastSaveTs=0,saveTimer=null,lastNoticeTs=0;
let view="teamPick",activeQid=null,pendingCelebration=false,currentRoomDetailId=null;
let videoStream=null,scanRAF=null;
let canvasCtx=null,drawing=false,lastX=0,lastY=0;
let QOVERRIDE={};
let dashListenerAttached=false;
let currentTab="dash";
let lastAllData={};
let parsedRosterPreview=null;

const urlParams=new URLSearchParams(location.search);
const roomParamFromUrl=urlParams.get("room");

const app=document.getElementById("app");

function tryAdminLogin(){
  const el=document.getElementById("adminPw");
  const v=el?el.value:"";
  if(v==="escape2026"){
    sessionStorage.setItem("escape_admin_ok","1");
    enterAdminMode();
  }else{
    alert("비밀번호가 올바르지 않아요.");
  }
}
function enterAdminMode(){
  appMode="admin";
  document.getElementById("studentRoot").style.display="none";
  document.getElementById("adminRoot").style.display="";
  if(!dashListenerAttached){
    dashListenerAttached=true;
    document.getElementById("viewDash").innerHTML='<div class="card">불러오는 중...</div>';
    dbRoot.on("value",
      snap=>{lastAllData=snap.val()||{};renderDash(lastAllData);},
      err=>{document.getElementById("viewDash").innerHTML='<div class="card" style="color:var(--red)"><b>데이터를 불러오지 못했어요.</b><br>오류: '+err.message+'</div>';}
    );
  }
  renderRosterTab();
  showTab(currentTab);
}
function exitAdminMode(){
  appMode="student";
  document.getElementById("adminRoot").style.display="none";
  document.getElementById("studentRoot").style.display="";
  if(view==="teamPick")renderTeamPick();
  else if(view==="home")renderHome();
  else if(view==="roomDetail")renderRoomDetail(currentRoomDetailId);
}
function showTab(t){
  currentTab=t;
  document.getElementById("tabDash").className="tab"+(t==="dash"?" on":"");
  document.getElementById("tabRoster").className="tab"+(t==="roster"?" on":"");
  document.getElementById("tabQuestions").className="tab"+(t==="questions"?" on":"");
  document.getElementById("tabQr").className="tab"+(t==="qr"?" on":"");
  document.getElementById("viewDash").style.display=t==="dash"?"":"none";
  document.getElementById("viewRoster").style.display=t==="roster"?"":"none";
  document.getElementById("viewQuestions").style.display=t==="questions"?"":"none";
  document.getElementById("viewQr").style.display=t==="qr"?"":"none";
}
function renderDash(all){
  document.getElementById("viewDash").innerHTML='<div class="card">대시보드는 다음 작업(Task 7)에서 채워집니다.</div>';
}
function renderRosterTab(){
  document.getElementById("viewRoster").innerHTML='<div class="card">학생 배정 화면은 다음 작업(Task 7)에서 채워집니다.</div>';
}
```

`renderDash`/`renderRosterTab`은 지금은 자리표시자다 — Task 7에서 실제 구현으로 교체한다(placeholder를 남겨두는 게 아니라 함수 전체를 교체하는 것이므로 최종 산출물에는 placeholder 텍스트가 남지 않는다).

- [ ] **Step 6: 조 선택(첫) 화면 + 부팅 시퀀스 추가**

방금 추가한 블록 뒤, `</script>` 태그 바로 앞에 추가한다:

```js
/* ===================== 학생: 조 선택 ===================== */
function setHeader(){
  const el=document.getElementById("hdTeam");
  if(el)el.textContent=team?(team+"조"):"조 선택 전";
}
function adminAccordionHtml(){
  return '<details class="admin-acc"><summary>⚙️ 관리자 모드</summary>'
    +'<div class="admin-acc-body"><input class="txt-inp" type="password" id="adminPw" placeholder="비밀번호" style="max-width:160px" onkeydown="if(event.key===\'Enter\')tryAdminLogin()">'
    +'<button class="btn btn-sub" onclick="tryAdminLogin()">입장</button></div></details>';
}
function computeTeamGrades(){
  teamGrades=new Set();
  Object.values(rosterAll).forEach(s=>{if(s&&team&&String(s.teamId)===team)teamGrades.add(Number(s.grade));});
}
function renderTeamPick(){
  view="teamPick";
  setHeader();
  if(teamCount<1){
    app.innerHTML='<div class="card" style="text-align:center;"><div class="center-icon">🗂️</div><h2 style="font-size:16px;margin-bottom:8px;">아직 조가 편성되지 않았어요</h2><p style="font-size:12px;color:var(--tx2);">선생님이 명단을 올려서 조를 편성하면 여기에 표시돼요.</p></div>'+adminAccordionHtml();
    return;
  }
  const byTeam={};
  for(let n=1;n<=teamCount;n++)byTeam[n]={};
  Object.values(rosterAll).forEach(s=>{
    if(!s||!s.teamId)return;
    const n=Number(s.teamId);
    if(!byTeam[n])return;
    byTeam[n][s.grade]=(byTeam[n][s.grade]||0)+1;
  });
  let h='<div class="card"><h2 style="font-size:16px;margin-bottom:6px;">조를 선택하세요</h2><p style="font-size:12px;color:var(--tx2);">우리 조를 찾아서 눌러주세요.</p></div>';
  h+='<div class="team-grid">';
  for(let n=1;n<=teamCount;n++){
    const grades=Object.keys(byTeam[n]).map(Number).sort((a,b)=>b-a);
    const badge=grades.length?grades.map(g=>g+"학년 "+byTeam[n][g]).join(" · "):"명단 없음";
    h+='<button class="team-btn" onclick="pickTeam('+n+')" style="display:flex;flex-direction:column;gap:4px;"><span>'+n+'조</span><span style="font-size:11px;font-weight:600;color:var(--tx2)">'+badge+'</span></button>';
  }
  h+='</div>';
  h+=adminAccordionHtml();
  app.innerHTML=h;
}
function pickTeam(n){
  team=String(n);
  localStorage.setItem("escape_team",team);
  computeTeamGrades();
  connectFirebase();
  view="home";renderHome();
}
function renderHome(){
  app.innerHTML='<div class="card">'+team+'조 홈 화면은 다음 작업(Task 6)에서 채워집니다.</div>';
}
function renderRoomDetail(rid){
  app.innerHTML='<div class="card">방 상세 화면은 다음 작업(Task 6)에서 채워집니다.</div>';
}
function connectFirebase(){
  if(!team)return;
  dbRef=db.ref("escape_data/team"+team);
}

/* ===================== 데이터 동기화 (양쪽 화면 공용) ===================== */
function connectRoster(){
  db.ref("escape_data/roster").on("value",snap=>{
    rosterAll=snap.val()||{};
    computeTeamGrades();
    if(view==="teamPick")renderTeamPick();
    else if(view==="home"&&appMode==="student")setHeader();
    if(appMode==="admin")renderRosterTab();
  });
  db.ref("escape_data/meta/teamCount").on("value",snap=>{
    teamCount=snap.val()||0;
    if(view==="teamPick")renderTeamPick();
    if(appMode==="admin")renderRosterTab();
  });
}
function connectQuestionOverrides(){
  db.ref("escape_data/questions").on("value",snap=>{
    QOVERRIDE=snap.val()||{};
    if(view==="home"&&appMode==="student")renderHome();
    if(currentTab==="questions"&&appMode==="admin")renderQuestionsTab();
  });
}
function renderQuestionsTab(){
  document.getElementById("viewQuestions").innerHTML='<div class="card">문제 관리 화면은 이후 작업(Task 8)에서 채워집니다.</div>';
}

/* ===================== 시작 ===================== */
connectQuestionOverrides();
connectRoster();
if(sessionStorage.getItem("escape_admin_ok")==="1"){
  enterAdminMode();
}else if(team){
  connectFirebase();
  view="home";renderHome();
}else{
  view="teamPick";renderTeamPick();
}
```

`renderHome`/`renderRoomDetail`/`renderQuestionsTab`도 지금은 자리표시자다 — Task 6·8에서 함수 전체를 실제 구현으로 교체한다.

- [ ] **Step 7: 수동 확인 — 핵심 흐름이 동작하는지**

`index.html`을 새로고침한다.
1. "아직 조가 편성되지 않았어요" 카드가 보인다 (현재 Firebase에 `meta/teamCount`가 없으므로).
2. 맨 아래 "⚙️ 관리자 모드"를 펼치고 비밀번호에 `escape2026`을 입력, "입장"을 누른다 → 화면이 관리자 대시보드(탭 4개 + "학생 배정은 다음 작업에서..." 자리표시자)로 전환된다.
3. 탭을 몇 개 눌러 전환되는지 확인한다.
4. "← 학생 화면으로"를 누르면 다시 "아직 조가 편성되지 않았어요" 화면으로 돌아온다.
5. 새로고침 후 관리자 비밀번호를 다시 입력하지 않아도 바로 관리자 화면으로 들어가는지 확인한다 (세션 유지).

Expected: 콘솔 에러 없이 위 5가지가 모두 관찰된다.

- [ ] **Step 8: 커밋**

```bash
git add index.html
git commit -m "feat: scaffold merged index.html with appMode toggle and team-pick screen"
```

---

## Task 6: 학생 게임 화면 이식 (홈 / 방 상세 / QR 스캔 / 문제 풀이)

개인 로그인이 없어진 것 말고는 기존 `escape.html`의 게임 플레이 로직을 그대로 옮긴다. 이 작업에서 Task 5가 만든 `renderHome`/`renderRoomDetail`/`connectFirebase`/`pickTeam` 자리표시자를 실제 구현으로 교체한다.

**Files:**
- Modify: `index.html`
- Read (이식 원본): `escape.html`

**Interfaces:**
- Consumes: `RosterUtils.computeEffectiveGrade`(Task 4), `teamGrades`/`team`/`rosterAll`(Task 5)
- Produces: 완전한 학생 게임 플레이 화면 일체. Task 8의 관리자 "담당 학생" 표시가 `QMETA`/`rosterAll`을 같은 방식으로 읽는다.

- [ ] **Step 1: 변경 없이 그대로 옮기는 헬퍼 함수들 추가**

`index.html`의 `function renderHome(){` 정의 바로 앞에, `escape.html`의 다음 줄 범위를 **그대로(변경 없이)** 복사해 붙여넣는다:

- 301~307번째 줄: `findQ` 함수만 (299번째 줄 `sanitizeKey`와 300번째 줄 `escapeHtml`은 옮기지 않는다 — `escapeHtml`은 Task 5에서 이미 추가했고, `sanitizeKey`는 학생 쪽에 더 이상 개인 로그인이 없어 필요 없다. Task 8의 관리자 쪽에서 `RosterUtils.sanitizeKey`를 대신 쓴다)
- 308~323번째 줄: `normalize`, `roomProgress`, `totalKeys`, `finalDone`, `activeRoomId`, `currentHelpRoomId`
- 324~328번째 줄: `loadLocal`, `persistLocal`
- 359~377번째 줄: `requestHelp`, `cancelHelp`
- 378~384번째 줄: `openUnlocked`
- 418~423번째 줄: `setSync`
- 424~433번째 줄: `saveCloud`
- 450~455번째 줄: `showWrongNoticeModal`
- 592~638번째 줄: `openFinalMission`, `showCelebration`, `runConfetti`
- 671~733번째 줄: `openScan`, `goHome`, `submitManual`, `startCamera`, `stopCamera`
- 735~765번째 줄: `handleScan`, `showRoomLockedScreen`
- 767~777번째 줄: `ensureRandomPick`
- 801~853번째 줄: `showQuestionScreen`
- 855~907번째 줄: `initCanvas`, `clearScratch`
- 909~923번째 줄: `renderCooldown`

(Task 5에서 이미 `let videoStream=null,scanRAF=null;`과 `let canvasCtx=null,drawing=false,lastX=0,lastY=0;`를 상태 변수로 선언해 두었으니 다시 선언하지 않는다.)

- [ ] **Step 2: `saveSubmission` 추가 — 개인 이름(`by`) 필드 제거**

방금 옮긴 함수들 옆에 추가한다 (원본 443~449번째 줄에서 `by` 필드만 뺀 버전):

```js
function saveSubmission(qid,val,isCorrect){
  if(!dbRef)return;
  const canvas=document.getElementById("scratchCanvas");
  let work="";
  try{work=canvas?canvas.toDataURL("image/png"):"";}catch(e){}
  dbRef.child("submissions").child(qid).set({value:(val||"").toString(),work,autoCorrect:!!isCorrect,ts:Date.now()});
}
```

- [ ] **Step 3: `showGradeGate` 추가 — 로컬 `computeEffectiveGrade` 대신 `RosterUtils` 사용**

`escape.html` 779~799번째 줄의 `showGradeGate`를 옮기되, `computeEffectiveGrade(q.grade)` 호출 한 곳만 아래처럼 바꾼다:

```js
function showGradeGate(qid,mode){
  view="question";activeQid=qid;
  const q=findQ(qid);
  const rid=qid.slice(0,2);
  const room=ROOMS.find(r=>r.id===rid);
  const eff=RosterUtils.computeEffectiveGrade(q.grade,teamGrades,1,6);
  let warnMsg;
  if(eff===q.grade){
    warnMsg='이 문제는 <b>'+q.grade+'학년</b>이 풀어야 하는 문제입니다.';
  }else{
    warnMsg='이 문제는 원래 <b>'+q.grade+'학년</b> 문제인데, 우리 조에 '+q.grade+'학년 친구가 없어요!<br>그래서 우리 조에서는 <b>'+eff+'학년</b> 친구가 풀 수 있어요.';
  }
  let h='<div class="top-back" onclick="goHome()">← 홈으로</div>';
  h+='<div class="card">';
  h+='<div class="q-badges"><span class="badge b-id">'+qid+"</span><span class=\"badge b-grade\">"+q.grade+"학년</span><span class=\"badge b-unit\">"+room.emoji+" "+room.name+" · "+q.unit+"</span></div>";
  h+='<div class="center-icon">🙋</div>';
  h+='<div class="grade-warn" style="font-size:15px;text-align:center;line-height:1.6;">'+warnMsg+'</div>';
  h+='<button class="btn btn-lg btn-primary" style="margin-top:14px" onclick="showQuestionScreen(\''+qid+'\',\''+mode+'\')">확인</button>';
  h+="</div>";
  app.innerHTML=h;
}
```

- [ ] **Step 4: `submitAnswer` 추가 — 개인 풀이 스냅샷 저장 호출 제거**

`escape.html` 925~959번째 줄의 `submitAnswer`를 옮기되, `saveWorkSnapshot(qid);` 한 줄만 삭제한다 (팀 단위 `submissions`에 이미 캔버스가 저장되므로 중복 저장 불필요):

```js
function submitAnswer(){
  const qid=activeQid,q=findQ(qid);
  const c=cooldown[qid];
  if(c&&c.until>Date.now())return;
  const inp=document.getElementById("ansInp");
  const val=inp?inp.value:"";
  const expected=q.type==="random"?(randomPicks[qid]?randomPicks[qid].en:""):q.answer;
  const fb=document.getElementById("fbArea");
  const isCorrect=normalize(val)===normalize(expected);
  saveSubmission(qid,val,isCorrect);
  if(isCorrect){
    solvedIds[qid]=true;
    delete cooldown[qid];
    saveCloud();
    const rid=qid.slice(0,2);
    if(rid==="R6"){
      pendingCelebration=true;
      fb.innerHTML='<div class="fb-box fb-ok">🎉 협동 미션 성공!</div><button class="btn btn-lg btn-primary" style="margin-top:12px" onclick="goHome()">홈으로</button>';
    }else{
      const roomDone=roomProgress(rid)===8;
      fb.innerHTML='<div class="fb-box fb-ok">🎉 정답입니다!<br>'+(roomDone?"이 방을 모두 클리어했어요! 황금열쇠 조각을 얻었습니다 🔑":"방 안 어딘가에 숨겨진 다음 QR 코드를 찾아보세요!")+'</div><button class="btn btn-lg btn-primary" style="margin-top:12px" onclick="openScan()">📷 다음 QR 스캔하기</button><button class="btn btn-lg btn-sub" style="margin-top:8px" onclick="goHome()">홈으로</button>';
    }
    if(inp)inp.disabled=true;
    const sb=document.getElementById("submitBtn");if(sb)sb.disabled=true;
  }else{
    const attempts=((c&&c.attempts)||0)+1;
    const wait=attempts>=2?60:10;
    cooldown[qid]={until:Date.now()+wait*1000,attempts};
    saveCloud();
    fb.innerHTML='<div class="fb-box fb-bad">❌ 정답이 아니에요. 다시 시도해보세요!</div>';
    if(inp){inp.value="";}
    renderCooldown();
  }
}
```

- [ ] **Step 5: `renderHome` 자리표시자를 실제 구현으로 교체**

`index.html`의 `function renderHome(){...}` 전체(Task 5에서 만든 자리표시자)를 아래로 교체한다 — 원본 531~591번째 줄에서 맨 아래 "⚙️ 관리자 모드" 아코디언 블록만 뺀 버전이다 (조 선택 화면으로 옮겼으므로):

```js
function renderHome(){
  view="home";
  setHeader();
  const keys=totalKeys();
  let h="";
  if(keys===5&&!finalDone()){
    h+='<div class="finale"><div class="em">🔑✨</div><h2>황금열쇠 5조각 완성!</h2><p>마지막 협동 미션이 남았어요!<br>강당에 모여 단체줄넘기 20개에 도전해보세요.</p></div>';
  }
  if(finalDone()){
    h+='<div class="finale"><div class="em">🎉🏆✨</div><h2>모든 미션 완료!</h2><p>정말 대단해요! 우리 조가 방탈출에 성공했어요.</p></div>';
  }
  h+='<div class="keys-bar">';
  for(let i=0;i<5;i++)h+='<span class="k'+(i<keys?" on":"")+'">🔑</span>';
  h+='<span class="keys-txt">'+keys+' / 5 조각 모음</span></div>';
  const active=activeRoomId();
  h+='<div class="room-grid">';
  ROOMS.forEach(r=>{
    const p=roomProgress(r.id),done=p===8;
    const locked=!done&&active&&active!==r.id;
    let extra="";
    if(locked){
      const activeRoom=ROOMS.find(x=>x.id===active);
      extra='<div class="lock-msg">🔒 '+activeRoom.name+' 먼저 끝내세요</div>';
    }else if(!done){
      const roomQids=QUESTIONS[r.id].map(x=>x.qid);
      const nextQid=roomQids[p];
      if(unlocked[nextQid]){
        extra='<button class="btn btn-green" style="width:100%;margin-top:6px;padding:6px;font-size:10.5px;font-weight:800;" onclick="event.stopPropagation();openUnlocked(\''+nextQid+'\')">🔓 선생님이 열어주셨어요!</button>';
      }else if(helpRequest&&helpRequest.qid===nextQid){
        extra='<div style="margin-top:6px;font-size:10px;color:#b45309;font-weight:800;">🙋 요청함 · 기다려주세요<br><span style="text-decoration:underline;cursor:pointer;color:var(--tx3);font-weight:600;" onclick="event.stopPropagation();cancelHelp()">요청 취소</span></div>';
      }else{
        extra='<div style="margin-top:6px;font-size:10px;color:var(--tx3);text-decoration:underline;cursor:pointer;" onclick="event.stopPropagation();requestHelp(\''+r.id+'\')">🙋 QR을 못 찾겠어요</div>';
      }
    }
    h+='<div class="room-card'+(done?" done":"")+(locked?" locked":"")+'" onclick="openRoomDetail(\''+r.id+'\')"><div class="room-emoji">'+r.emoji+"</div>"
      +'<div class="room-name">'+r.name+"</div>"
      +'<div class="room-prog">'+(done?"✅ 완료!":p+" / 8")+"</div>"
      +'<div class="room-bar"><div class="room-bar-f" style="width:'+(p/8*100)+'%"></div></div>'+extra+'</div>';
  });
  h+="</div>";
  if(keys===5){
    const fd=finalDone();
    let finalExtra="";
    if(!fd){
      if(unlocked["R6Q1"]){
        finalExtra='<button class="btn btn-green" style="width:100%;margin-top:6px;padding:6px;font-size:10.5px;font-weight:800;" onclick="event.stopPropagation();openUnlocked(\'R6Q1\')">🔓 선생님이 열어주셨어요!</button>';
      }else if(helpRequest&&helpRequest.qid==="R6Q1"){
        finalExtra='<div style="margin-top:6px;font-size:10px;color:#b45309;font-weight:800;">🙋 요청함 · 기다려주세요<br><span style="text-decoration:underline;cursor:pointer;color:var(--tx3);font-weight:600;" onclick="event.stopPropagation();cancelHelp()">요청 취소</span></div>';
      }
    }
    h+='<div class="final-card'+(fd?" done":"")+'" onclick="openFinalMission()"><div class="room-emoji">🤸</div>'
      +'<div class="room-name">협동 미션 · 강당 단체줄넘기 20개</div>'
      +'<div class="room-prog">'+(fd?"✅ 완료!":"터치해서 도전하기")+'</div>'+finalExtra+'</div>';
  }
  h+='<div style="height:90px"></div>';
  h+='<div class="scan-fab"><button class="btn btn-lg btn-primary" onclick="openScan()">📷 QR 스캔하기</button></div>';
  app.innerHTML=h;
  if(pendingCelebration){pendingCelebration=false;showCelebration();}
}
```

- [ ] **Step 6: `renderRoomDetail` 자리표시자를 실제 구현으로 교체**

`index.html`의 `function renderRoomDetail(rid){...}` 전체(Task 5 자리표시자)를 `escape.html`의 646~669번째 줄 내용으로 그대로 교체한다 (변경 없음).

- [ ] **Step 7: `connectFirebase`를 최소 스텁에서 완전한 구현으로 교체**

`index.html`의 `function connectFirebase(){...}` 전체(Task 5 스텁)를 아래로 교체한다 (원본 330~352번째 줄과 동일, 변경 없음):

```js
function connectFirebase(){
  if(!team)return;
  dbRef=db.ref("escape_data/team"+team);
  dbRef.on("value",snap=>{
    setSync("on");
    const d=snap.val();
    if(d){
      if(!(d.ts&&Math.abs(d.ts-myLastSaveTs)<2000)){
        solvedIds=d.solvedIds||{};randomPicks=d.randomPicks||{};cooldown=d.cooldown||{};
        persistLocal();
      }
      unlocked=d.unlocked||{};
      helpRequest=d.helpRequest||null;
      if(d.notice&&d.notice.ts&&d.notice.ts!==lastNoticeTs){
        lastNoticeTs=d.notice.ts;
        showWrongNoticeModal(d.notice);
        dbRef.child("notice").remove();
      }
    }
    if(view==="home")renderHome();
    else if(view==="roomDetail")renderRoomDetail(currentRoomDetailId);
  },()=>setSync("err"));
}
```

- [ ] **Step 8: `pickTeam`에 `loadLocal()` 호출 추가**

`index.html`의 `function pickTeam(n){...}`을 아래로 교체한다 (Task 5 버전에 `loadLocal();` 한 줄만 추가):

```js
function pickTeam(n){
  team=String(n);
  localStorage.setItem("escape_team",team);
  loadLocal();
  computeTeamGrades();
  connectFirebase();
  view="home";renderHome();
}
```

- [ ] **Step 9: 부팅 시퀀스에도 `loadLocal()` 추가**

`index.html`의 `/* ===================== 시작 ===================== */` 블록에서 `else if(team){connectFirebase();view="home";renderHome();}` 줄을 아래로 교체한다:

```js
}else if(team){
  loadLocal();
  connectFirebase();
  view="home";renderHome();
```

- [ ] **Step 10: 수동 확인 — 관리자 화면에서 임시로 조를 만들어 학생 플레이를 끝까지 확인**

Firebase 콘솔(realtime database, `jump-rope-43833` 프로젝트)에서 `escape_data/meta/teamCount`를 `1`로, `escape_data/roster/테스트_4`를 `{name:"테스트",grade:4,teamId:"1"}`로 수동으로 만든다 (Task 7에서 업로드 UI가 생기기 전까지 임시 확인용).

`index.html`을 새로고침한다.
1. "조를 선택하세요" 화면에 "1조 · 4학년 1"이 보인다. 눌러서 들어간다.
2. 헤더에 "1조"가 표시된다.
3. 방 카드 하나를 눌러 방 상세 화면 → "QR 스캔하러 가기" → 카메라 권한을 거부해도 "카드에 적힌 6자리 코드를 직접 입력하세요" 입력창이 뜬다.
4. `R1Q3`의 코드 `YPS2U6`을 입력해 확인을 누른다 (3학년 문제라 "우리 조에 3학년 친구가 없어서 4학년이 대신 푼다"는 안내가 뜨는지 확인 — `computeEffectiveGrade`가 4를 반환해야 함).
5. 정답 `8`을 입력해 제출하면 정답 처리되고 캔버스/제출 기록이 생긴다.
6. 홈으로 돌아가 진행 상황(1/8)이 반영되어 있는지 확인한다.

Expected: 콘솔 에러 없이 위 6단계가 모두 동작한다.

- [ ] **Step 11: 커밋**

```bash
git add index.html
git commit -m "feat: port student gameplay flow into merged index.html"
```

---

## Task 7: 관리자 대시보드 탭 (조×방 진행 현황 + "담당 학생" 안내)

**Files:**
- Modify: `index.html`
- Read (이식 원본): `escapeAdmin.html`

**Interfaces:**
- Consumes: `teamCount`, `rosterAll`, `RosterUtils.computeEffectiveGrade`(Task 4), `QMETA`/`ROOMS`/`FINAL_ROOM`/`ALL_ROOMS`(Task 5)
- Produces: 완전한 관리자 대시보드. `viewTeamRoom`은 Task 9의 최종 점검에서도 그대로 쓰인다.

- [ ] **Step 1: `renderDash`를 자리표시자에서 실제 구현으로 교체 (teamCount 동적화)**

`index.html`의 `function renderDash(all){...}` 전체(Task 5 자리표시자)를 아래로 교체한다 (원본 230~276번째 줄에서 `for(let n=1;n<=5;n++)`를 `teamCount`로 바꾼 버전):

```js
function renderDash(all){
  lastAllData=all||{};
  const data=lastAllData;

  const helpTeams=[];
  for(let n=1;n<=teamCount;n++){
    const d=data["team"+n];
    if(d&&d.helpRequest)helpTeams.push({n,hr:d.helpRequest});
  }
  let helpHtml="";
  if(helpTeams.length>0){
    helpHtml='<div class="card help-card"><div class="help-title">🙋 도움 요청 ('+helpTeams.length+'건)</div>';
    helpTeams.forEach(({n,hr})=>{
      helpHtml+='<div class="help-row"><div style="flex:1;font-size:13px;"><b>'+n+'조</b>가 <b>'+escapeHtml(hr.roomName||"")+'</b>에서 <b>'+escapeHtml(hr.qid||"")+'</b> 문제를 못 찾겠대요.</div>'
        +'<button class="btn btn-primary" style="padding:6px 12px;font-size:12px" onclick="approveHelp('+n+",'"+hr.qid+'\')">🔓 열어주기</button>'
        +'<button class="btn btn-sub" style="padding:6px 12px;font-size:12px" onclick="dismissHelp('+n+')">무시</button></div>';
    });
    helpHtml+='</div>';
  }

  if(teamCount<1){
    document.getElementById("viewDash").innerHTML=helpHtml+'<div class="card"><div class="empty-msg">아직 편성된 조가 없어요. "학생 배정" 탭에서 명단을 업로드해주세요.</div></div>';
    return;
  }

  let h=helpHtml+'<div class="actions"><button class="btn btn-danger" onclick="resetAll()">🗑 전체 초기화 (모든 조)</button></div>';
  h+='<div class="card"><table><tr><th>조</th>';
  ROOMS.forEach(r=>h+="<th>"+r.emoji+" "+r.name+"</th>");
  h+='<th>'+FINAL_ROOM.emoji+' 협동미션</th>';
  h+="<th>총 진행</th><th>🔑 열쇠</th><th>조 초기화</th></tr>";
  for(let n=1;n<=teamCount;n++){
    const d=data["team"+n]||{};
    const solved=d.solvedIds||{};
    let totalSolved=0,keys=0;
    const members=Object.values(rosterAll).filter(s=>String(s.teamId)===String(n)).map(s=>escapeHtml(s.name)+"("+s.grade+")").join(", ");
    h+="<tr><td><b>"+n+"조</b><br><span style='font-size:9px;color:var(--tx2);font-weight:400;'>"+(members||"-")+"</span></td>";
    ROOMS.forEach(r=>{
      const cnt=QMETA[r.id].filter(q=>solved[q[0]]).length;
      totalSolved+=cnt;
      if(cnt===8)keys++;
      h+='<td class="prog-cell '+(cnt===8?"prog-full":cnt===0?"prog-zero":"")+'">'
        +'<span style="cursor:pointer;text-decoration:underline;" onclick="viewTeamRoom('+n+",'"+r.id+"')\">"+cnt+" / 8</span>"
        +'<br><button class="reset-mini" onclick="resetRoom('+n+",'"+r.id+"')\" title=\""+n+"조 "+r.name+' 초기화">↺</button></td>';
    });
    const finalOk=!!solved["R6Q1"];
    h+='<td class="prog-cell" style="cursor:pointer;'+(finalOk?"color:var(--green)":"")+'" onclick="viewTeamRoom('+n+",'R6')\">"+(finalOk?"✅ 완료":"—")+"</td>";
    h+="<td><b>"+totalSolved+" / 40</b></td><td class=\"keycount\">"+keys+" / 5</td>";
    h+='<td><button class="btn btn-sub" style="padding:5px 10px;font-size:11px" onclick="resetTeam('+n+')">↺ '+n+"조 초기화</button></td></tr>";
  }
  h+="</table></div>";
  document.getElementById("viewDash").innerHTML=h;
}
```

- [ ] **Step 2: `resetAll`/`resetTeam`/`resetRoom`/`approveHelp`/`dismissHelp` 추가 (`resetAll`은 `roster`/`meta`를 지우던 버그 수정)**

원본 `resetAll`(277~282번째 줄)은 `dbRoot.set(updates)`를 쓰는데, `dbRoot`가 `escape_data` 루트를 가리키므로 `.set()`을 쓰면 형제 노드인 `roster`/`meta`까지 통째로 지워지는 버그가 있었다(예전엔 team1~5만 있어서 드러나지 않았을 뿐). `.update()`로 바꿔 형제 데이터를 보존한다.

`renderDash` 옆에 추가한다:

```js
function resetAll(){
  if(!confirm("정말 모든 조의 진행상황을 초기화할까요?\n(리허설 후 실제 행사 전에만 사용하세요)"))return;
  const updates={};
  for(let n=1;n<=teamCount;n++)updates["team"+n]={solvedIds:{},randomPicks:{},cooldown:{},ts:Date.now()};
  dbRoot.update(updates).then(()=>alert("초기화되었습니다."));
}
function resetTeam(n){
  if(!confirm(n+"조의 전체 진행상황을 초기화할까요? (5개 방 + 협동미션 모두)"))return;
  dbRoot.child("team"+n).set({solvedIds:{},randomPicks:{},cooldown:{},ts:Date.now()}).then(()=>alert(n+"조가 초기화되었습니다."));
}
function resetRoom(n,roomId){
  const room=ALL_ROOMS.find(r=>r.id===roomId);
  const roomName=room?room.name:roomId;
  if(!confirm(n+"조의 '"+roomName+"' 진행상황만 초기화할까요? (다른 방 진행상황은 그대로 유지됩니다)"))return;
  const d=lastAllData["team"+n]||{};
  const solved=Object.assign({},d.solvedIds||{});
  const picks=Object.assign({},d.randomPicks||{});
  const cd=Object.assign({},d.cooldown||{});
  QMETA[roomId].forEach(q=>{delete solved[q[0]];delete picks[q[0]];delete cd[q[0]];});
  dbRoot.child("team"+n).set({solvedIds:solved,randomPicks:picks,cooldown:cd,ts:Date.now()}).then(()=>alert(n+"조의 '"+roomName+"'이(가) 초기화되었습니다."));
}
function approveHelp(n,qid){
  dbRoot.child("team"+n).child("unlocked").child(qid).set(true);
  dbRoot.child("team"+n).child("helpRequest").remove();
}
function dismissHelp(n){
  dbRoot.child("team"+n).child("helpRequest").remove();
}
```

- [ ] **Step 3: `viewTeamRoom`/`markWrong`/`closeWorkModal` 추가 — 문제별 "담당 학생" 안내 포함**

원본 `viewTeamRoom`(312~338번째 줄)에 학년별 담당 학생 이름 표시를 추가하고, 더는 저장하지 않는 `s.by` 참조를 뺀다:

```js
function viewTeamRoom(n,roomId){
  const room=ALL_ROOMS.find(r=>r.id===roomId);
  const d=lastAllData["team"+n]||{};
  const solved=d.solvedIds||{};
  const subs=d.submissions||{};
  const teamGradeSet=new Set(Object.values(rosterAll).filter(s=>s&&String(s.teamId)===String(n)).map(s=>Number(s.grade)));
  document.getElementById("workModalTitle").textContent=n+"조 · "+room.emoji+" "+room.name+" 문제 확인";
  let body="";
  QMETA[roomId].forEach(q=>{
    const qid=q[0];
    const requiredGrade=q[1];
    const isSolved=!!solved[qid];
    const s=subs[qid];
    let assignHtml="";
    if(requiredGrade){
      const eff=RosterUtils.computeEffectiveGrade(requiredGrade,teamGradeSet,1,6);
      const names=Object.values(rosterAll).filter(m=>m&&String(m.teamId)===String(n)&&Number(m.grade)===eff).map(m=>m.name);
      assignHtml='<div style="font-size:11px;color:var(--tx2);margin-top:2px;">담당: '+(names.length?escapeHtml(names.join(", "))+"("+eff+"학년)":"명단 없음")+'</div>';
    }
    body+='<div class="work-item"><b>'+qid+'</b> · '+(requiredGrade?requiredGrade+"학년 · ":"")+escapeHtml(q[2])
      +' &nbsp; '+(isSolved?'<span style="color:var(--green);font-weight:800">✅ 정답</span>':'<span style="color:var(--tx2)">미해결</span>')
      +assignHtml;
    if(s){
      body+='<div style="font-size:12px;color:var(--tx2);margin-top:4px;">제출한 답: <b>'+escapeHtml(s.value||"")+'</b></div>';
      if(s.work)body+="<img src='"+s.work+"' alt='풀이과정'>";
    }else{
      body+='<div style="font-size:12px;color:#B9C2CC;margin-top:4px;">아직 제출 기록 없음</div>';
    }
    if(isSolved){
      body+='<button class="btn btn-danger" style="padding:5px 10px;font-size:11px;margin-top:6px" onclick="markWrong('+n+",'"+roomId+"','"+qid+"')\">❌ 오답 처리(다시 풀게 하기)</button>";
    }
    body+="</div>";
  });
  document.getElementById("workModalBody").innerHTML=body;
  document.getElementById("workModalOv").className="modal-ov show";
}
function markWrong(n,roomId,qid){
  if(!confirm(qid+" 문제를 오답 처리할까요?\n이 문제와 이후 문제들이 다시 풀어야 하는 상태로 초기화됩니다."))return;
  const d=lastAllData["team"+n]||{};
  const solved=Object.assign({},d.solvedIds||{});
  const roomQids=QMETA[roomId].map(q=>q[0]);
  const idx=roomQids.indexOf(qid);
  roomQids.slice(idx).forEach(id=>{delete solved[id];});
  const room=ALL_ROOMS.find(r=>r.id===roomId);
  dbRoot.child("team"+n).update({
    solvedIds:solved,
    notice:{qid:qid,roomId:roomId,roomName:room.name,msg:"'"+qid+"' 문제를 다시 확인해주세요. 처음부터 다시 풀어야 해요.",ts:Date.now()}
  }).then(()=>{alert("오답 처리되었습니다. 학생 화면에 안내가 표시됩니다.");closeWorkModal();});
}
function closeWorkModal(){
  document.getElementById("workModalOv").className="modal-ov";
}
```

- [ ] **Step 4: 수동 확인 — 대시보드가 teamCount 기준으로 뜨는지, 담당 학생이 표시되는지**

Task 6에서 만들어둔 Firebase 테스트 데이터(`meta/teamCount=1`, `roster/테스트_4`)가 남아있는 상태에서 `index.html`을 새로고침한다.
1. 관리자 모드로 들어가 "대시보드" 탭을 본다. 표에 "1조" 행 하나만 있고 "테스트(4)"가 표시된다.
2. `R1Q3`(3학년 문제) 진행 셀의 밑줄 친 숫자를 클릭한다 → 모달에서 `R1Q3` 항목에 "담당: 테스트(4학년)"이 보이는지 확인한다 (팀에 3학년이 없어 4학년으로 대체되었음을 보여주는 것).
3. Task 6에서 풀었던 `R1Q3` 항목에 제출한 답 "8"과 풀이 캔버스 이미지가 보이는지 확인한다.
4. "❌ 오답 처리" 버튼을 눌러 학생 화면에 알림이 뜨는지 확인한다 (관리자 화면 "학생 화면으로" → 홈 → 알림 모달 확인 후 다시 관리자로).
5. "🗑 전체 초기화" 실행 후에도 `meta/teamCount`와 `roster`가 그대로 남아있는지 Firebase 콘솔에서 확인한다 (버그 수정 검증).

Expected: 콘솔 에러 없이 위 5가지가 모두 관찰된다.

- [ ] **Step 5: 커밋**

```bash
git add index.html
git commit -m "feat: port admin dashboard tab with per-question assignee labels"
```

---

## Task 8: 관리자 "학생 배정" 탭 — 명단 업로드 + 미리보기 + 자동 조 편성

**Files:**
- Modify: `index.html`
- Read: `scripts/roster-utils.js` (Task 1~4에서 만든 `RosterUtils`)

**Interfaces:**
- Consumes: `RosterUtils.{extractSheetId,buildSheetCsvUrl,parseCSV,parseRosterRows,autoAssignTeams,makeRosterKey}`(Task 1~4), 전역 `XLSX`(CDN)
- Produces: `escape_data/roster`, `escape_data/meta/teamCount`에 실제 데이터를 쓰는 유일한 경로.

- [ ] **Step 1: `renderRosterTab`을 자리표시자에서 실제 구현으로 교체**

`index.html`의 `function renderRosterTab(){...}` 전체(Task 5 자리표시자)를 아래로 교체한다:

```js
function renderRosterTab(){
  let h='<div class="card"><h3 style="margin-bottom:8px;">명단 업로드</h3>';
  h+='<div style="margin-bottom:10px;"><label style="font-size:12px;font-weight:700;color:var(--tx2);">조 개수&nbsp;</label><input type="number" id="teamCountInp" min="1" max="30" value="'+(teamCount||5)+'" style="width:70px;padding:6px;border:1px solid var(--bdr);border-radius:6px;"></div>';
  h+='<div style="margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">';
  h+='<input type="text" id="sheetUrlInp" placeholder="구글시트 링크 붙여넣기" style="flex:1;min-width:220px;padding:8px;border:1px solid var(--bdr);border-radius:6px;font-size:12px;">';
  h+='<button class="btn btn-primary" onclick="loadFromGoogleSheet()">불러오기</button>';
  h+='</div>';
  h+='<div style="font-size:11px;color:var(--tx2);margin-bottom:14px;">※ 구글시트는 공유 설정이 "링크가 있는 모든 사용자 - 뷰어"여야 불러올 수 있어요. "학년, 이름" 두 열 형식이어야 해요.</div>';
  h+='<div style="margin-bottom:10px;"><input type="file" id="excelFileInp" accept=".xlsx,.xls" onchange="loadFromExcelFile(this.files[0])"></div>';
  h+='<div id="rosterUploadErr" style="display:none;color:var(--red);font-size:12px;margin-bottom:10px;"></div>';
  h+='</div>';

  if(parsedRosterPreview){
    h+='<div class="card"><h3 style="margin-bottom:8px;">명단 미리보기 · 확인 후 수정 가능 ('+parsedRosterPreview.length+'명)</h3>';
    h+='<table><tr><th>학년</th><th>이름</th><th></th></tr>';
    parsedRosterPreview.forEach((s,i)=>{
      h+='<tr><td><input type="number" min="1" max="6" value="'+s.grade+'" style="width:50px" onchange="updatePreviewRow('+i+',\'grade\',this.value)"></td>';
      h+='<td><input type="text" value="'+escapeHtml(s.name)+'" onchange="updatePreviewRow('+i+',\'name\',this.value)"></td>';
      h+='<td><button class="btn btn-sub" style="padding:4px 8px;font-size:11px" onclick="removePreviewRow('+i+')">삭제</button></td></tr>';
    });
    h+='</table>';
    h+='<div class="actions" style="margin-top:10px;"><button class="btn btn-sub" onclick="addPreviewRow()">+ 행 추가</button><button class="btn btn-primary" onclick="confirmAutoAssign()">이 명단으로 조 편성하기</button></div>';
    h+='</div>';
  }

  const keys=Object.keys(rosterAll);
  if(keys.length===0){
    h+='<div class="card"><div class="empty-msg">아직 편성된 명단이 없어요.</div></div>';
    document.getElementById("viewRoster").innerHTML=h;
    return;
  }
  const teamCounts={};
  for(let n=1;n<=teamCount;n++)teamCounts[n]=0;
  keys.forEach(k=>{const t=rosterAll[k].teamId;if(t)teamCounts[Number(t)]=(teamCounts[Number(t)]||0)+1;});
  h+='<div class="card"><b>조별 인원</b> &nbsp; ';
  for(let n=1;n<=teamCount;n++)h+="<span style='margin-right:14px'>"+n+"조 "+(teamCounts[n]||0)+"명</span>";
  h+='</div>';
  h+='<div class="card"><table><tr><th>이름</th><th>학년</th><th>조 배정</th><th>삭제</th></tr>';
  keys.sort((a,b)=>{
    const A=rosterAll[a],B=rosterAll[b];
    if(A.grade!==B.grade)return A.grade-B.grade;
    return (A.name||"").localeCompare(B.name||"","ko");
  }).forEach(key=>{
    const s=rosterAll[key];
    h+="<tr><td><b>"+escapeHtml(s.name||key)+"</b></td><td>"+s.grade+"학년</td>";
    h+='<td><select class="team-sel" onchange="assignTeam(\''+key+'\',this.value)">';
    h+='<option value=""'+(!s.teamId?" selected":"")+'>미배정</option>';
    for(let n=1;n<=teamCount;n++)h+='<option value="'+n+'"'+(String(s.teamId)===String(n)?" selected":"")+'>'+n+'조</option>';
    h+='</select></td>';
    h+='<td><button class="btn btn-danger" style="padding:5px 10px;font-size:11px" onclick="deleteRoster(\''+key+'\')">🗑</button></td></tr>';
  });
  h+="</table></div>";
  document.getElementById("viewRoster").innerHTML=h;
}
```

- [ ] **Step 2: 업로드/미리보기/편성 확정 함수 추가**

`renderRosterTab` 옆에 추가한다:

```js
function showRosterUploadErr(msg){
  const el=document.getElementById("rosterUploadErr");
  if(!el)return;
  el.style.display="";
  el.textContent=msg;
}
function setParsedRoster(students){
  const errEl=document.getElementById("rosterUploadErr");
  if(errEl)errEl.style.display="none";
  parsedRosterPreview=students;
  renderRosterTab();
}
function updatePreviewRow(i,field,val){
  if(!parsedRosterPreview||!parsedRosterPreview[i])return;
  parsedRosterPreview[i][field]=field==="grade"?Number(val):val;
}
function removePreviewRow(i){
  parsedRosterPreview.splice(i,1);
  renderRosterTab();
}
function addPreviewRow(){
  parsedRosterPreview.push({name:"",grade:1});
  renderRosterTab();
}
async function loadFromGoogleSheet(){
  const url=document.getElementById("sheetUrlInp").value.trim();
  const id=RosterUtils.extractSheetId(url);
  if(!id){showRosterUploadErr("올바른 구글시트 링크가 아니에요.");return;}
  try{
    const res=await fetch(RosterUtils.buildSheetCsvUrl(id));
    if(!res.ok)throw new Error("fetch failed");
    const text=await res.text();
    const rows=RosterUtils.parseCSV(text);
    const students=RosterUtils.parseRosterRows(rows);
    if(students.length===0){showRosterUploadErr("명단을 읽지 못했어요. '학년, 이름' 두 열 형식인지 확인해주세요.");return;}
    setParsedRoster(students);
  }catch(e){
    showRosterUploadErr("시트를 불러오지 못했어요. 공유 설정이 '링크가 있는 모든 사용자 - 뷰어'인지 확인해주세요.");
  }
}
function loadFromExcelFile(file){
  if(!file)return;
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const wb=XLSX.read(e.target.result,{type:"array"});
      const sheet=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(sheet,{header:1}).map(r=>r.map(c=>(c===undefined||c===null)?"":String(c)));
      const students=RosterUtils.parseRosterRows(rows);
      if(students.length===0){showRosterUploadErr("명단을 읽지 못했어요. '학년, 이름' 두 열 형식인지 확인해주세요.");return;}
      setParsedRoster(students);
    }catch(err){
      showRosterUploadErr("엑셀 파일을 읽지 못했어요.");
    }
  };
  reader.readAsArrayBuffer(file);
}
function confirmAutoAssign(){
  if(!parsedRosterPreview||parsedRosterPreview.length===0)return;
  const n=Number(document.getElementById("teamCountInp").value)||1;
  if(!confirm(parsedRosterPreview.length+"명을 "+n+"개 조로 편성할까요? 기존 명단/조 배정을 덮어씁니다. (방탈출 진행 기록은 그대로 유지됩니다)"))return;
  const assigned=RosterUtils.autoAssignTeams(parsedRosterPreview,n);
  const existingKeys=new Set();
  const rosterUpdate={};
  assigned.forEach(s=>{
    const key=RosterUtils.makeRosterKey(s.name,s.grade,existingKeys);
    existingKeys.add(key);
    rosterUpdate[key]={name:s.name,grade:s.grade,teamId:String(s.teamId),ts:Date.now()};
  });
  db.ref("escape_data").update({roster:rosterUpdate,"meta/teamCount":n}).then(()=>{
    parsedRosterPreview=null;
    alert("조 편성이 완료되었습니다.");
  });
}
function assignTeam(key,val){
  db.ref("escape_data/roster/"+key+"/teamId").set(val?val:null);
}
function deleteRoster(key){
  const name=(rosterAll[key]&&rosterAll[key].name)||key;
  if(!confirm(name+" 학생을 명단에서 삭제할까요?"))return;
  db.ref("escape_data/roster/"+key).remove();
}
```

- [ ] **Step 3: 수동 확인 — 엑셀 업로드로 실제 편성 흐름 확인**

메모장이나 엑셀로 `테스트명단.xlsx`를 만든다 (A열: 학년, B열: 이름, 헤더 없이):
```
6	김하늘
6	이서준
5	박지우
4	최민준
3	정다은
3	한소이
1	오유진
```
1. 관리자 모드 → "학생 배정" 탭에서 조 개수를 `3`으로 두고 위 엑셀 파일을 선택한다.
2. 미리보기 표에 7명이 학년/이름과 함께 뜨는지 확인한다. 아무 셀이나 값을 고쳐보고 반영되는지 확인한다.
3. "이 명단으로 조 편성하기"를 누른다 → 확인창 → "조 편성이 완료되었습니다" 알림.
4. 조별 인원 요약과 표에 7명이 학년순으로 나열되는지, 각자 조 배정 드롭다운 값이 채워져 있는지 확인한다.
5. "학생 화면으로" 이동 → "조를 선택하세요" 화면에 1~3조 카드가 학년 구성과 함께 뜨는지 확인한다 (예: 6학년이 조마다 고르게 나뉘어 있어야 함).
6. 드롭다운으로 한 학생의 조를 수동으로 바꿔보고 즉시 반영되는지 확인한다.

Expected: 콘솔 에러 없이 위 6단계가 모두 동작하고, 6학년(2명)이 서로 다른 조에 먼저 배치된다.

- [ ] **Step 4: 커밋**

```bash
git add index.html
git commit -m "feat: add roster upload, preview, and grade-balanced auto-assign UI"
```

---

## Task 9: 관리자 "문제 관리" + "QR 인쇄" 탭 이식

이 두 탭은 조 편성 개편과 무관하게 동작이 그대로다. `escapeAdmin.html`에서 옮기되, 학생 쪽과 통합되면서 이름이 `qOverride`→`QOVERRIDE`로, 첫 탭 전환 시 렌더를 트리거하는 부분만 바뀐다.

**Files:**
- Modify: `index.html`
- Read (이식 원본): `escapeAdmin.html`

**Interfaces:**
- Consumes: `QFULL`/`QMETA`/`CODES`/`ALL_ROOMS`(Task 5), `QOVERRIDE`(Task 5의 `connectQuestionOverrides`가 채움)

- [ ] **Step 1: `renderQuestionsTab`을 자리표시자에서 실제 구현으로 교체 (`qOverride`→`QOVERRIDE`)**

`index.html`의 `function renderQuestionsTab(){...}` 전체(Task 5 자리표시자)를 아래로 교체한다:

```js
function renderQuestionsTab(){
  let h='<div class="card" style="font-size:12px;color:var(--tx2)">문제 내용을 고치고 저장하면 학생 화면에 바로 반영됩니다. (그림/도형은 여기서 수정할 수 없어요 — 필요하면 별도로 요청해주세요)</div>';
  ALL_ROOMS.forEach(r=>{
    h+='<div class="card"><h3 style="margin-bottom:6px">'+r.emoji+' '+r.name+'</h3>';
    (QFULL[r.id]||[]).forEach(q=>{
      const [qid,grade,unit,answer,text]=q;
      const ov=(QOVERRIDE[r.id]&&QOVERRIDE[r.id][qid])||{};
      const curText=ov.text!==undefined?ov.text:text;
      const curAnswer=ov.answer!==undefined?ov.answer:answer;
      const curUnit=ov.unit!==undefined?ov.unit:unit;
      const curGrade=ov.grade!==undefined?ov.grade:grade;
      const isRandom=answer===null;
      h+='<div class="qedit">';
      h+='<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap;"><b>'+qid+'</b>';
      h+='<select id="qg_'+qid+'" style="padding:4px 6px;border-radius:6px;border:1px solid var(--bdr);font-size:12px;">';
      for(let g=0;g<=6;g++)h+='<option value="'+g+'"'+(Number(curGrade)===g?" selected":"")+'>'+(g===0?"공통":g+"학년")+'</option>';
      h+='</select>';
      h+='<input type="text" id="qu_'+qid+'" value="'+escapeHtml(curUnit)+'" style="flex:1;min-width:140px;"></div>';
      h+='<textarea id="qt_'+qid+'">'+escapeHtml(curText)+'</textarea>';
      h+='<div style="display:flex;gap:8px;margin-top:6px;align-items:center;flex-wrap:wrap;">';
      h+='<label style="font-size:12px;color:var(--tx2)">정답</label>';
      h+=isRandom?'<span style="font-size:11px;color:var(--tx2)">(랜덤 출제라 정답 수정 불가)</span>':'<input type="text" id="qa_'+qid+'" value="'+escapeHtml(curAnswer)+'">';
      h+='<button class="btn btn-primary" style="padding:6px 12px;font-size:11px;margin-left:auto" onclick="saveQuestion(\''+r.id+'\',\''+qid+'\','+isRandom+')">💾 저장</button>';
      h+='</div></div>';
    });
    h+='</div>';
  });
  document.getElementById("viewQuestions").innerHTML=h;
}
function saveQuestion(rid,qid,isRandom){
  const grade=Number(document.getElementById("qg_"+qid).value);
  const unit=document.getElementById("qu_"+qid).value.trim();
  const text=document.getElementById("qt_"+qid).value.trim();
  const upd={grade,unit,text};
  if(!isRandom){
    const a=document.getElementById("qa_"+qid);
    if(a)upd.answer=a.value.trim();
  }
  db.ref("escape_data/questions/"+rid+"/"+qid).update(upd).then(()=>alert(qid+" 문제가 저장되었습니다. 학생 화면에 바로 반영됩니다."));
}
```

- [ ] **Step 2: `renderQrPage` 추가**

방금 추가한 함수들 옆에 추가한다 (원본 491~523번째 줄과 동일, 변경 없음):

```js
let qrRendered=false;
function renderQrPage(){
  if(qrRendered)return;
  qrRendered=true;
  let h='<div class="actions"><button class="btn btn-primary" onclick="window.print()">🖨️ 인쇄하기</button></div>';
  ALL_ROOMS.forEach(r=>{
    h+='<div class="room-sec"><h2>'+r.emoji+" "+r.name+' <span class="no-print" style="opacity:.6;font-weight:400;">('+r.id+")</span></h2><div class=\"qr-grid\">";
    QMETA[r.id].forEach(q=>{
      h+='<div class="qr-card"><canvas id="qr_'+q[0]+'"></canvas><div class="qr-id">'+q[0]+'</div><div class="qr-meta">'+(q[1]?q[1]+"학년 · ":"")+q[2]+"</div><div class=\"qr-meta\">코드: "+CODES[q[0]]+"</div></div>";
    });
    h+="</div></div>";
  });
  document.getElementById("viewQr").innerHTML=h;
  if(typeof QRCode==="undefined"){
    const el=document.getElementById("globalErr");
    if(el){el.style.display="";el.innerHTML="<b>QR 생성 라이브러리를 불러오지 못했어요.</b><br>새로고침해보거나 다른 네트워크로 접속해보세요.";}
    return;
  }
  ALL_ROOMS.forEach(r=>{
    QMETA[r.id].forEach(q=>{
      const cv=document.getElementById("qr_"+q[0]);
      const code=CODES[q[0]]||q[0];
      try{
        QRCode.toCanvas(cv,code,{width:140,margin:1},function(err){
          if(err&&cv)cv.replaceWith(document.createTextNode("QR 생성 실패: "+q[0]));
        });
      }catch(e){
        if(cv)cv.replaceWith(document.createTextNode("QR 생성 실패: "+q[0]));
      }
    });
  });
}
```

- [ ] **Step 3: `showTab`이 탭 전환 시 두 렌더 함수를 트리거하도록 수정**

`index.html`의 `function showTab(t){...}` 안, `document.getElementById("viewQr").style.display=t==="qr"?"":"none";` 줄 바로 뒤에 다음 두 줄을 추가한다:

```js
  if(t==="qr")renderQrPage();
  if(t==="questions")renderQuestionsTab();
```

- [ ] **Step 4: 수동 확인**

1. 관리자 모드 → "문제 관리" 탭 → `R1Q1` 문제의 정답을 임시로 `99`로 바꾸고 저장한다 → "저장되었습니다" 알림.
2. "학생 화면으로" → 1조로 들어가 `R1Q1`(코드 `DKMFR5`)을 스캔/입력해서 정답이 `99`로 바뀐 게 반영되는지 확인한다.
3. 다시 관리자 모드 → 정답을 원래 값 `6`으로 되돌려 저장한다.
4. "QR 인쇄" 탭 → 방마다 QR 코드 그리드가 그려지는지 확인한다 (인쇄 미리보기까지는 안 해도 됨, 화면에 QR 이미지가 보이면 충분).

Expected: 콘솔 에러 없이 위 4단계가 모두 동작한다.

- [ ] **Step 5: 커밋**

```bash
git add index.html
git commit -m "feat: port admin question-editing and QR-printing tabs"
```

---

## Task 10: 최종 점검 — 하드코딩 스윕, 전체 시나리오 검증, 구 파일 삭제

**Files:**
- Modify: `index.html` (스윕에서 문제 발견 시)
- Delete: `escape.html`, `escapeAdmin.html`

**Interfaces:**
- Consumes: 이전 모든 작업의 산출물
- Produces: 배포 가능한 최종 `index.html` 하나

- [ ] **Step 1: 하드코딩/죽은 코드 스윕**

`index.html` 안에서 아래 문자열들을 검색해 하나도 나오지 않는지 확인한다 (VS Code에서 Ctrl+F로 충분하다):

- `escapeAdmin.html` — 나오면 안 됨(별도 페이지로의 참조가 남아있다는 뜻)
- `myName`, `safeKey`, `renderNameEntry`, `pickGrade(`, `submitNameGrade`, `renderWaiting`, `function logout` — 나오면 안 됨(개인 로그인 잔재)
- `saveWorkSnapshot`, `function viewWork` — 나오면 안 됨(개인 풀이 스냅샷 기능 잔재)
- `lastRosterData`, `const rosterRef=` — 나오면 안 됨(`rosterAll`로 통합되었어야 함)
- `s.by` 또는 `escapeHtml(s.by` — 나오면 안 됨(제출자 개인 이름 필드 잔재)
- `for(let n=1;n<=5;n++)` — 나오면 안 됨(모두 `teamCount`를 써야 함). 이 패턴이 하나라도 나오면 해당 함수를 찾아 `teamCount`로 바꾼다.
- `function computeEffectiveGrade` (전역 함수 정의) — 나오면 안 됨(`RosterUtils.computeEffectiveGrade`만 있어야 함)
- `function sanitizeKey` (전역 함수 정의) — 나오면 안 됨(`RosterUtils.sanitizeKey`만 있어야 함, `scripts/roster-utils.js` 안의 정의는 별개이므로 그건 있어도 됨)

뭔가 나오면 해당 잔재를 지우거나 지금까지의 작업 내용에 맞게 고친 뒤 다음 스텝으로 넘어간다.

- [ ] **Step 2: 브라우저 콘솔에서 전역 이름 충돌 확인**

`index.html`을 새로고침하고 개발자 도구 콘솔에 다음을 입력해 각각 함수/객체인지 확인한다:

```js
typeof renderHome === "function"
typeof renderDash === "function"
typeof RosterUtils.computeEffectiveGrade === "function"
typeof RosterUtils.autoAssignTeams === "function"
```

Expected: 4개 모두 `true`가 출력된다. (여기서 걸러지는 흔한 실수: 같은 이름의 함수를 두 번 정의해 뒤에 정의한 쪽이 이긴 경우 — 위 스텝 1에서 이미 걸렀어야 하지만 한 번 더 확인하는 차원.)

- [ ] **Step 3: 새 명단으로 전체 시나리오 처음부터 끝까지 검증**

지금까지 Task 6~8 검증에서 만든 테스트 데이터(1조 "테스트" 학생 등)를 실제 학교 명단으로 덮어씌워 깨끗하게 다시 검증한다.

1. Firebase 콘솔에서 `escape_data/roster`와 `escape_data/meta`를 수동으로 삭제한다 (또는 아래 4번에서 업로드로 덮어써도 됨).
2. `index.html`을 새로고침 → "아직 조가 편성되지 않았어요" 화면이 뜨는지 확인 (스펙 검증 계획 1번).
3. 관리자 모드 → 학생 배정 탭에서 Task 8 때 만든 엑셀 파일(7명)을 조 4개로 다시 업로드 → 미리보기 → 편성.
4. 조 카드마다 학년 구성이 정확히 반영되는지 확인 (스펙 검증 계획 2번).
5. 학생 화면에서 아무 조나 골라 문제를 하나 풀고 제출 → 관리자 대시보드에서 담당 학생 이름과 함께 답안/캔버스가 뜨는지 확인 (스펙 검증 계획 3번).
6. 관리자 로그인이 페이지 이동 없이 학생 화면 안에서 전환되는지 확인 — 브라우저 주소창의 URL이 로그인 전후로 바뀌지 않아야 한다 (스펙 검증 계획 4번).
7. QR 인쇄 탭에서 인쇄 미리보기(Ctrl+P)를 열어 QR 그리드만 나오고 헤더/탭/버튼이 인쇄 미리보기에서 빠지는지 확인 (스펙 검증 계획 5번).

Expected: 7단계 모두 통과.

- [ ] **Step 4: 테스트 진행 기록 정리**

관리자 대시보드 → "🗑 전체 초기화"를 눌러 Step 3에서 만든 테스트용 방탈출 진행 기록을 지운다. (명단/조 편성은 초기화되지 않고 그대로 남는다 — Task 7에서 고친 버그가 여기서도 확인된다.)

- [ ] **Step 5: 구 파일 삭제 및 커밋**

```bash
git rm escape.html escapeAdmin.html
git add index.html
git commit -m "chore: remove standalone escape.html/escapeAdmin.html now merged into index.html"
```

- [ ] **Step 6: GitHub Pages 링크로 최종 확인 (원격 push는 사용자 확인 후 별도 진행)**

이 작업까지는 로컬 커밋만 한다. 원격에 push하면 실제 GitHub Pages 링크(`https://imzerguser-cpu.github.io/escape/`)가 바뀌므로, push는 사용자에게 먼저 확인받고 진행한다. push 후에는 그 링크를 새로고침해 Step 3의 1~2번(조 미편성 안내, 관리자 로그인)만이라도 다시 한번 확인한다.

---
