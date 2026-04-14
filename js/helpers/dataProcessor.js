import { income, ages, electionResults } from "./dataLoader.js";
import { groupByKommun, average } from "./utils.js";

// CLEAN NEO4J DATA
function cleanElectionData(raw) {
  if (!raw) {
    console.error("❌ electionResults is undefined/null");
    return [];
  }

  // Case 1: Already an array
  if (Array.isArray(raw)) {
    return raw.map(item => {
      let node = item.n || item;
      let props = node.properties || node;

      return {
        kommun: props.kommun,
        parti: props.parti,
        roster2018: Number(props.roster2018) || 0,
        roster2022: Number(props.roster2022) || 0
      };
    });
  }

  // Case 2: Neo4j driver format
  if (raw.records) {
    return raw.records.map(r => {
      let props = r._fields[0].properties;

      return {
        kommun: props.kommun,
        parti: props.parti,
        roster2018: Number(props.roster2018) || 0,
        roster2022: Number(props.roster2022) || 0
      };
    });
  }

  console.error("❌ Unknown electionResults format:", raw);
  return [];
}

// BUILD RAW DATA
function buildRawData() {
  let resultsArray = cleanElectionData(electionResults);

  return resultsArray.map(r => {
    let incomeData = income.find(i => i.kommun === r.kommun);
    let ageData = ages.find(a => a.kommun === r.kommun);

    return {
      kommun: r.kommun,
      parti: r.parti,
      roster2018: r.roster2018,
      roster2022: r.roster2022,
      voteChange: r.roster2022 - r.roster2018,
      income: Number(incomeData?.value) || 0,
      age: Number(ageData?.value) || 0
    };
  });
}

// FINAL CLEAN DATA
export function getCombinedData() {
  let rawData = buildRawData();

  if (!rawData.length) {
    console.warn("⚠️ No data available");
    return [];
  }

  let grouped = groupByKommun(rawData);

  let finalData = Object.keys(grouped).map(kommun => {
    let rows = grouped[kommun];

    return {
      kommun,
      avgVoteChange: average(rows.map(r => r.voteChange)),
      income: rows[0].income,
      age: rows[0].age
    };
  });

  return finalData;
}
