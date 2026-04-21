import dbInfoOk, { displayDbNotOkText } from "./helpers/dbInfoOk.js";
import { income, electionResults } from "./helpers/dataLoader.js";

addMdToPage(`
# Inkomst och förändring i valresultat

## Frågeställning
Kan inkomst hjälpa till att förklara förändringar i valresultat mellan 2018 och 2022?

## Varför är detta viktigt?
Inkomst kopplas ofta till politiska skillnader. Här undersöker vi om län med högre eller lägre inkomst också visar olika förändringar i valresultatet.
`);

if (!dbInfoOk) {
  displayDbNotOkText();
} else {

  // ===== FIXA VALDATA =====
  let resultsArray = [];

  if (Array.isArray(electionResults)) {
    resultsArray = electionResults;
  } else if (electionResults?.records) {
    resultsArray = electionResults.records.map(r => r._fields[0].properties);
  }

  // ===== FIXA INCOME =====
  let incomeArray = Array.isArray(income) ? income : [];
  let incomeTotal = incomeArray.filter(d => d.kon === "totalt");

  let incomeMap = {};

  incomeTotal.forEach(d => {
    let key = d.lan.toLowerCase().replace(" län", "");
    if (!incomeMap[key]) incomeMap[key] = {};
    incomeMap[key][d.ar] = Number(d.inkomst);
  });

  // ===== MERGE =====
  let merged = resultsArray.map(r => {
    let kommun = r.kommun || "";
    let lanKey = kommun.toLowerCase(); // tillfällig koppling

    let inc = incomeMap[lanKey] || null;

    return {
      kommun: kommun,
      rostForandring: Number(r.roster2022 || 0) - Number(r.roster2018 || 0),
      inkomst2018: Number(inc?.[2018] || 0),
      inkomst2022: Number(inc?.[2022] || 0),
      inkomst: Number(inc?.[2022] || 0),
      inkomstForandring: Number(inc?.[2022] || 0) - Number(inc?.[2018] || 0)
    };
  }).filter(d => d.inkomst > 0);

  // ===== FILTER =====
  addMdToPage(`## Filtrera data`);

  let select = document.createElement("select");

  ["all", "low", "high"].forEach(v => {
    let option = document.createElement("option");
    option.value = v;
    option.textContent = v === "all" ? "Alla" : v === "low" ? "Låg inkomst" : "Hög inkomst";
    select.appendChild(option);
  });

  document.body.appendChild(select);

  function filterData(type) {
    let sorted = [...merged].sort((a, b) => a.inkomst - b.inkomst);
    let mid = Math.floor(sorted.length / 2);

    if (type === "low") return sorted.slice(0, mid);
    if (type === "high") return sorted.slice(mid);

    return merged;
  }

  // ===== KORRELATION =====
  function correlation(data) {
    let x = data.map(d => d.inkomst);
    let y = data.map(d => d.rostForandring);

    if (x.length < 2) return "Ingen beräkning möjlig";

    let meanX = x.reduce((a, b) => a + b) / x.length;
    let meanY = y.reduce((a, b) => a + b) / y.length;

    let num = x.reduce((sum, xi, i) =>
      sum + (xi - meanX) * (y[i] - meanY), 0);

    let den = Math.sqrt(
      x.reduce((sum, xi) => sum + (xi - meanX) ** 2, 0) *
      y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0)
    );

    return den === 0 ? "Ingen beräkning möjlig" : (num / den).toFixed(3);
  }

  // ===== DRAW =====
  function draw(data) {

    addMdToPage(`---`);

    addMdToPage(`## Datavisning`);

    if (data.length > 0) {
      tableFromData({ data });
    } else {
      addMdToPage(`Ingen data.`);
    }

    addMdToPage(`
## Förändring i inkomst

Här analyserar vi både nivå och förändring i inkomst mellan 2018 och 2022.
`);

    // SCATTER
    addMdToPage(`## Spridningsdiagram`);

    if (data.length > 0) {
      drawGoogleChart({
        type: "ScatterChart",
        data: [
          ["Inkomst", "Röstförändring"],
          ...data.map(d => [d.inkomst, d.rostForandring])
        ],
        options: {
          title: "Inkomst vs förändring i valresultat",
          trendlines: { 0: {} }
        }
      });
    }

    // GRUPP
    let sorted = [...data].sort((a, b) => a.inkomst - b.inkomst);
    let mid = Math.floor(sorted.length / 2);

    let low = sorted.slice(0, mid);
    let high = sorted.slice(mid);

    let avg = arr => arr.length ? arr.reduce((a, b) => a + b.rostForandring, 0) / arr.length : 0;

    addMdToPage(`## Gruppjämförelse`);

    drawGoogleChart({
      type: "ColumnChart",
      data: [
        ["Grupp", "Genomsnitt"],
        ["Låg inkomst", avg(low)],
        ["Hög inkomst", avg(high)]
      ]
    });

    // TOPP / BOTTEN
    let sortedIncome = [...data].sort((a, b) => b.inkomst - a.inkomst);

    addMdToPage(`## Högst och lägst inkomst`);

    drawGoogleChart({
      type: "BarChart",
      data: [
        ["Område", "Inkomst"],
        ...sortedIncome.slice(0, 5).map(d => [d.kommun, d.inkomst]),
        ...sortedIncome.slice(-5).map(d => [d.kommun, d.inkomst])
      ]
    });

    // KORRELATION
    let corr = correlation(data);

    addMdToPage(`
## Korrelation

r = ${corr}
`);

    // ANALYS
    addMdToPage(`
## Analys

Vi ser ett samband mellan inkomst och förändring i valresultat, men sambandet är inte tillräckligt starkt för att ensam förklara förändringen.

Detta tyder på att fler faktorer påverkar väljarmönster.
`);

    // SLUTSATS
    addMdToPage(`
## Slutsats

Inkomst spelar en roll, men är bara en del av förklaringen.
`);
  }

  draw(merged);

  select.onchange = () => draw(filterData(select.value));
}