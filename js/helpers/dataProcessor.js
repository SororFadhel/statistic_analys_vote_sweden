import { income, ages, electionResults } from "./dataLoader.js";

// Fix Neo4j structure
let resultsArray = [];

if (Array.isArray(electionResults)) {
  resultsArray = electionResults;
} else if (electionResults?.records) {
  resultsArray = electionResults.records.map(r => r._fields[0].properties);
} else {
  console.error("Wrong electionResults format:", electionResults);
}

// Combine ALL data
export function getCombinedData() {
  return resultsArray.map(r => {
    let incomeData = income.find(i => i.kommun === r.kommun);
    let ageData = ages.find(a => a.kommun === r.kommun);

    return {
      kommun: r.kommun,
      parti: r.parti,
      voteChange: (r.roster2022 || 0) - (r.roster2018 || 0),
      income: incomeData?.value || 0,
      age: ageData?.value || 0
    };
  });
}