import { income, ages, electionResults } from "./dataLoader.js";

// DEBUG (VERY IMPORTANT)
console.log("electionResults:", electionResults);

// Neo4j structure
let resultsArray = [];

if (Array.isArray(electionResults)) {
  resultsArray = electionResults;
} else if (electionResults?.records) {
  resultsArray = electionResults.records.map(r => r._fields[0].properties);
} else {
  console.error("❌ Wrong electionResults format:", electionResults);
}

// BUILD COMBINED DATASET
export function getCombinedData() {

  if (!resultsArray.length) {
    console.warn("⚠️ No election data available");
    return [];
  }

  return resultsArray.map(r => {

    let incomeData = income.find(i => i.kommun === r.kommun);
    let ageData = ages.find(a => a.kommun === r.kommun);

    return {
      kommun: r.kommun,
      parti: r.parti,

      roster2018: r.roster2018 || 0,
      roster2022: r.roster2022 || 0,

      voteChange: (r.roster2022 || 0) - (r.roster2018 || 0),

      income: incomeData?.value || 0,
      age: ageData?.value || 0
    };
  });
}