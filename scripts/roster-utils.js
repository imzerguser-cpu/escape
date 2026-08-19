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

const RosterUtils = { sanitizeKey, makeRosterKey, parseCSV, parseRosterRows, extractSheetId, buildSheetCsvUrl };

if (typeof module !== "undefined" && module.exports) {
  module.exports = RosterUtils;
}
if (typeof window !== "undefined") {
  window.RosterUtils = RosterUtils;
}
