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
