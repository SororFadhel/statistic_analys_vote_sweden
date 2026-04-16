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
    .replace(/s$/, "")       // remove trailing s
    .normalize("NFD")        // remove accents
    .replace(/[\u0300-\u036f]/g, "")
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
// ⭐ Clean Neo4j Election Data
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
// ⭐ Extract Latest Age (ANY row for kommun)
// ===============================
function extractAge(ageRows) {
  if (!ageRows || ageRows.length === 0) return 0;

  // Pick the row with the latest available year
  let latest = ageRows[0];

  let value =
    latest.medelalderAr2022 ??
    latest.medelalderAr2021 ??
    latest.medelalderAr2020 ??
    latest.medelalderAr2019 ??
    latest.medelalderAr2018 ??
    0;

  return fixNumber(value);
}


// ===============================
// ⭐ Extract Latest Income (ANY row for kommun)
// ===============================
function extractIncome(incomeRows) {
  if (!incomeRows || incomeRows.length === 0) return 0;

  // Pick ANY row for the kommun (you said ignore gender)
  let row = incomeRows[0];

  let value =
    row.medelInkomst2022 ??
    row.medelInkomst2021 ??
    row.medelInkomst2020 ??
    row.medelInkomst2019 ??
    row.medelInkomst2018 ??
    0;

  return fixNumber(value);
}



// ===============================
// ⭐ Build Raw Combined Rows
// ===============================
function buildRawData() {
  let resultsArray = cleanElectionData(electionResults);

  return resultsArray.map(r => {
    let incomeRows = income.filter(i => normalizeKommun(i.kommun) === r.kommun);
    let ageRows = ages.filter(a => normalizeKommun(a.kommun) === r.kommun);

    return {
      kommun: r.kommun,
      parti: r.parti,

      roster2018: r.roster2018,
      roster2022: r.roster2022,

      voteChange: fixNumber(r.roster2022) - fixNumber(r.roster2018),

      income: extractIncome(incomeRows),
      age: extractAge(ageRows)
    };
  });
}


// ===============================
// ⭐ Final Combined Dataset
// ===============================
export function getCombinedData() {
  let rawData = buildRawData();

  if (!rawData.length) return [];

  let grouped = groupByKommun(rawData);

  return Object.keys(grouped).map(kommun => {
    let rows = grouped[kommun];

    return {
      kommun,
      avgVoteChange: fixNumber(average(rows.map(r => r.voteChange))),
      income: fixNumber(rows[0].income),
      age: fixNumber(rows[0].age)
    };
  });
}
