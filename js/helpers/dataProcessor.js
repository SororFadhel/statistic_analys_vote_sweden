import { income, ages, electionResults } from "./dataLoader.js";

export function buildKommunData() {

  // ✅ ADD IT HERE
  console.log("electionResults:", electionResults);
  console.log("isArray:", Array.isArray(electionResults));

  let results = Array.isArray(electionResults) ? electionResults : [];

  let incomeMap = {};
  income.forEach(x => incomeMap[x.kommun] = x);

  let ageMap = {};
  ages.forEach(x => ageMap[x.kommun] = x);

  return results.map(e => {
    let data = e.n ? e.n : e;

    let inc = incomeMap[data.kommun];
    let age = ageMap[data.kommun] = ageMap[data.kommun];

    return {
      kommun: data.kommun,
      parti: data.parti,
      votes2018: data.roster2018,
      votes2022: data.roster2022,
      voteChange: data.roster2022 - data.roster2018,
      income: inc?.medelInkomst2022,
      age: age?.medelalderAr2022
    };
  }).filter(x => x.income && x.age);
}