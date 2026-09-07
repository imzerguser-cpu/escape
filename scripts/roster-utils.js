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

function parseCSV(text) {
  return text
    .split(/\r\n|\r|\n/)
    .filter(line => line.trim() !== "")
    .map(line => line.split(",").map(cell => cell.trim().replace(/^"|"$/g, "")));
}

function parseRosterRows(rows) {
  // 시트 전체에 3번째 칸(반)에 값이 하나라도 있으면 "학년,반,이름" 3칸 형식으로,
  // 없으면 기존처럼 "학년,이름" 2칸 형식으로 본다(칸 하나만 보고 판단하면 우연한
  // 빈 칸/트레일링 콤마에 오작동하므로 시트 전체를 보고 한 번만 판단).
  const hasClsCol = rows.some(row => (row[2] || "").toString().trim() !== "");
  const students = [];
  rows.forEach((row, i) => {
    const gradeRaw = (row[0] || "").toString().trim();
    const clsRaw = hasClsCol ? (row[1] || "").toString().trim() : "";
    const nameRaw = (hasClsCol ? row[2] : row[1] || "").toString().trim();
    if (i === 0 && !/^\d+$/.test(gradeRaw)) return; // 헤더 행으로 간주하고 건너뜀
    const grade = parseInt(gradeRaw, 10);
    if (!Number.isInteger(grade) || grade < 1 || grade > 6) return;
    if (!nameRaw) return;
    students.push({ grade, cls: clsRaw, name: nameRaw });
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
      result.push({ name: s.name, grade: s.grade, cls: s.cls || "", teamId: best + 1 });
    });
  });
  return result;
}

/* 반(cls)이 다른 학생은 같은 조에 섞이지 않도록, 반별로 따로 조를 편성한다.
   조 개수는 반별 인원수에 비례해 최대 나머지법으로 나누되(반마다 최소 1개조는
   보장) — 반 개수가 targetTeamCount보다 많으면 그만큼 총 조 개수가 늘어난다. */
function autoAssignTeamsByClass(students, targetTeamCount, rng) {
  rng = rng || Math.random;
  const n = targetTeamCount >= 1 ? targetTeamCount : 1;
  const byClass = {};
  const classOrder = [];
  students.forEach(s => {
    const key = s.cls || "";
    if (!byClass[key]) { byClass[key] = []; classOrder.push(key); }
    byClass[key].push(s);
  });
  const total = students.length || 1;
  const raw = classOrder.map(k => byClass[k].length / total * n);
  const teamsPerClass = raw.map(x => Math.max(1, Math.floor(x)));
  let allocated = teamsPerClass.reduce((a, b) => a + b, 0);
  if (allocated < n) {
    const remainders = raw.map((x, i) => ({ i, r: x - Math.floor(x) }))
      .sort((a, b) => b.r - a.r);
    let idx = 0;
    while (allocated < n && remainders.length > 0) {
      teamsPerClass[remainders[idx % remainders.length].i]++;
      allocated++;
      idx++;
    }
  }
  const result = [];
  let teamOffset = 0;
  classOrder.forEach((key, ci) => {
    const assigned = autoAssignTeams(byClass[key], teamsPerClass[ci], rng);
    assigned.forEach(s => result.push({ name: s.name, grade: s.grade, cls: s.cls, teamId: s.teamId + teamOffset }));
    teamOffset += teamsPerClass[ci];
  });
  return result;
}

function computeEffectiveGrade(requiredGrade, presentGrades, minGrade, maxGrade) {
  const lo = minGrade == null ? 1 : minGrade;
  const hi = maxGrade == null ? 6 : maxGrade;
  if (!presentGrades || presentGrades.size === 0) return requiredGrade;
  if (presentGrades.has(requiredGrade)) return requiredGrade;
  for (let g = requiredGrade + 1; g <= hi; g++) if (presentGrades.has(g)) return g;
  for (let g = requiredGrade - 1; g >= lo; g--) if (presentGrades.has(g)) return g;
  return requiredGrade;
}

const RosterUtils = { sanitizeKey, makeRosterKey, parseCSV, parseRosterRows, extractSheetId, buildSheetCsvUrl, autoAssignTeams, autoAssignTeamsByClass, computeEffectiveGrade };

if (typeof module !== "undefined" && module.exports) {
  module.exports = RosterUtils;
}
if (typeof window !== "undefined") {
  window.RosterUtils = RosterUtils;
}
