import { income, ages, electionResults } from "./dataLoader.js";
import { groupByKommun, average } from "./utils.js";

// ===============================
// ⭐ Kommun Normalization
// ===============================
function normalizeKommun(name) {
  if (!name) return "";
  return String(name)
    .toLowerCase()
    .replace(" kommun", "")
    .replace("s kommun", "")
    .replace(" stad", "")
    .trim();
}

// ===============================
// ⭐ Safe Number Conversion
// ===============================
function fixNumber(value) {
  if (value === null || value === undefined) return 0;

  let cleaned = String(value)
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");

  let num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

// ===============================
// ⭐ Index Data (PERFORMANCE FIX)
// ===============================
function indexByKommun(arr) {
  const map = {};
  arr.forEach(row => {
    const key = normalizeKommun(row.kommun);
    if (!map[key]) map[key] = [];
    map[key].push(row);
  });
  return map;
}

const incomeMap = indexByKommun(income);
const ageMap = indexByKommun(ages);

// ===============================
// ⭐ Clean Election Data
// ===============================
function cleanElectionData(raw) {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw.map(item => {
      let node = item.n || item;
      let props = node.properties || node;

      return {
        kommun: normalizeKommun(props.kommun),
        parti: props.parti,
        roster2018: fixNumber(props.roster2018),
        roster2022: fixNumber(props.roster2022)
      };
    });
  }

  if (raw.records) {
    return raw.records.map(r => {
      let props = r._fields[0].properties;

      return {
        kommun: normalizeKommun(props.kommun),
        parti: props.parti,
        roster2018: fixNumber(props.roster2018),
        roster2022: fixNumber(props.roster2022)
      };
    });
  }

  return [];
}

// ===============================
// ⭐ Extract Latest Age
// ===============================
function extractAge(rows) {
  if (!rows || !rows.length) return 0;

  let r = rows[0];

  return fixNumber(
    r.medelalderAr2022 ??
    r.medelalderAr2021 ??
    r.medelalderAr2020 ??
    r.medelalderAr2019 ??
    r.medelalderAr2018 ??
    0
  );
}

// ===============================
// ⭐ Extract Latest Income
// ===============================
function extractIncome(rows) {
  if (!rows || !rows.length) return 0;

  let r = rows[0];

  return fixNumber(
    r.medelInkomst2022 ??
    r.medelInkomst2021 ??
    r.medelInkomst2020 ??
    r.medelInkomst2019 ??
    r.medelInkomst2018 ??
    0
  );
}

// ===============================
// ⭐ % Vote Change
// ===============================
function calcVoteChangePercent(v18, v22) {
  if (v18 === 0) return 0;
  return ((v22 - v18) / v18) * 100;
}

// ===============================
// ⭐ Build Dataset
// ===============================
function buildRawData() {
  const results = cleanElectionData(electionResults);

  return results.map(r => {
    const incomeRows = incomeMap[r.kommun] || [];
    const ageRows = ageMap[r.kommun] || [];

    return {
      kommun: r.kommun,
      parti: r.parti,

      voteChangePercent: calcVoteChangePercent(
        r.roster2018,
        r.roster2022
      ),

      income: extractIncome(incomeRows),
      age: extractAge(ageRows)
    };
  });
}

// ===============================
// ⭐ Final Kommun Dataset
// ===============================
export function getCombinedData() {
  const raw = buildRawData();
  if (!raw.length) return [];

  const grouped = groupByKommun(raw);

  return Object.keys(grouped).map(kommun => {
    const rows = grouped[kommun];

    return {
      kommun,
      avgVoteChange: average(rows.map(r => r.voteChangePercent)),
      income: rows[0].income,
      age: rows[0].age
    };
  });
}