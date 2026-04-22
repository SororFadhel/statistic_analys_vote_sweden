import { getCombinedData } from "./helpers/dataProcessor.js";
import { correlation, average } from "./helpers/utils.js";

// =====================
// LADDA & FILTRERA DATA
// =====================
let data = getCombinedData().filter(
  d => d.age > 0 && d.avgVoteChange !== 0
);

// =====================
// HJÄLPFUNKTIONER
// =====================
function std(arr) {
  let mean = average(arr);
  return Math.sqrt(
    arr.reduce((sum, x) => sum + (x - mean) ** 2, 0) / arr.length
  );
}

// Oberoende t-test (Young vs Old)
function tTest(arr1, arr2) {
  let m1 = average(arr1);
  let m2 = average(arr2);

  let s1 = std(arr1);
  let s2 = std(arr2);

  let n1 = arr1.length;
  let n2 = arr2.length;

  let numerator = m1 - m2;
  let denominator = Math.sqrt((s1 ** 2 / n1) + (s2 ** 2 / n2));

  return denominator === 0 ? 0 : numerator / denominator;
}

// =====================
// TITEL
// =====================
addMdToPage(`
# Påverkar ålder röstningsförändringar i Sverige?

**Huvudfråga:**  
Skiljer sig förändringar i valresultat mellan kommuner med yngre och äldre befolkning?

Analysen omfattar samtliga svenska kommuner och bygger på statistiska metoder.
`);

// =====================
// METOD
// =====================
addMdToPage(`
---
## Metod

Vi använder **procentuell förändring i röster** för att möjliggöra rättvisa jämförelser mellan kommuner av olika storlek.

Analysen inkluderar:
- Gruppjämförelser (unga vs gamla)
- Korrelationsanalys
- Statistiskt test (t-test)
`);

// =====================
// FÖRBERED DATA
// =====================
let dataset = data.map(d => ({
  ...d,
  voteChangePercent: d.avgVoteChange
}));

// =====================
// STEG 1: GRUPPERING
// =====================
addMdToPage(`
---
## Steg 1: Indelning efter ålder

Kommunerna delas in i tre lika stora grupper:
- Unga
- Medel
- Äldre
`);

let sorted = [...dataset].sort((a, b) => a.age - b.age);
let size = Math.floor(sorted.length / 3);

let young = sorted.slice(0, size);
let middle = sorted.slice(size, size * 2);
let old = sorted.slice(size * 2);

// Medelvärden
let youngAvg = average(young.map(d => d.voteChangePercent));
let middleAvg = average(middle.map(d => d.voteChangePercent));
let oldAvg = average(old.map(d => d.voteChangePercent));

// Standardavvikelse
let youngStd = std(young.map(d => d.voteChangePercent));
let middleStd = std(middle.map(d => d.voteChangePercent));
let oldStd = std(old.map(d => d.voteChangePercent));

drawGoogleChart({
  type: "ColumnChart",
  data: [
    ["Åldersgrupp", "Genomsnittlig % förändring", { role: "style" }],
    ["Unga", youngAvg, "#3498db"],
    ["Medel", middleAvg, "#2ecc71"],
    ["Äldre", oldAvg, "#e74c3c"]
  ],
  options: {
    title: "Genomsnittlig procentuell röstförändring per åldersgrupp",
    legend: "none",
    width: 600,
    height: 400
  }
});

addMdToPage(`
**Resultat:**
- Unga: ${youngAvg.toFixed(2)}% (± ${youngStd.toFixed(2)})
- Medel: ${middleAvg.toFixed(2)}% (± ${middleStd.toFixed(2)})
- Äldre: ${oldAvg.toFixed(2)}% (± ${oldStd.toFixed(2)})
`);

// =====================
// JADWAL 1: SAMMANFATTNING AV ÅLDERSGRUPPER
// =====================
addMdToPage(`
---
### 📊 Sammanfattning av åldersgrupper
`);

tableFromData({
  data: [
    { group: "Unga", avg: youngAvg.toFixed(2), std: youngStd.toFixed(2), count: young.length },
    { group: "Medel", avg: middleAvg.toFixed(2), std: middleStd.toFixed(2), count: middle.length },
    { group: "Äldre", avg: oldAvg.toFixed(2), std: oldStd.toFixed(2), count: old.length }
  ]
});

// =====================
// STEG 2: KORRELATION
// =====================
addMdToPage(`
---
## Steg 2: Samband mellan ålder och röstförändring
`);

let corr = correlation(
  dataset.map(d => d.age),
  dataset.map(d => d.voteChangePercent)
);

drawGoogleChart({
  type: "ScatterChart",
  data: [
    ["Ålder", "Röstförändring (%)"],
    ...dataset.map(d => [d.age, d.voteChangePercent])
  ],
  options: {
    title: "Ålder vs röstförändring (%)",
    pointSize: 5,
    trendlines: { 0: { color: "red", lineWidth: 2 } },
    width: 700,
    height: 400
  }
});

addMdToPage(`
**Korrelationskoefficient (r):** ${corr.toFixed(3)}

Tolkning:
- |r| < 0.1 → inget samband  
- 0.1–0.3 → svagt samband  
- > 0.3 → måttligt samband  
`);

// =====================
// JADWAL 2: PROV PÅ RÅDATA (FÖRSTA 20 RADER)
// =====================
addMdToPage(`
---
### 📋 Prov på rådata (första 20 kommunerna)
`);

tableFromData({
  data: dataset.slice(0, 20).map(d => ({
    kommun: d.kommun,
    age: d.age,
    voteChangePercent: d.voteChangePercent.toFixed(2)
  }))
});

// =====================
// STEG 3: T-TEST
// =====================
addMdToPage(`
---
## Steg 3: Statistiskt test (t-test)

**Hypoteser:**
- H₀: Ingen skillnad mellan unga och äldre kommuner  
- H₁: Det finns en skillnad  
`);

let tValue = tTest(
  young.map(d => d.voteChangePercent),
  old.map(d => d.voteChangePercent)
);

addMdToPage(`
**t-värde:** ${tValue.toFixed(3)}

Tolkning:
- |t| < 2 → inte statistiskt signifikant  
- |t| ≥ 2 → statistiskt signifikant  
`);

// =====================
// JADWAL 3: JÄMFÖRELSE AV ALLA TRE GRUPPER (MIN, MAX, MEDEL, STD)
// =====================
addMdToPage(`
---
### 🔍 Detaljerad jämförelse av alla tre åldersgrupper
`);

tableFromData({
  data: [
    { 
      group: "Unga", 
      avg: youngAvg.toFixed(2), 
      std: youngStd.toFixed(2),
      count: young.length,
      min: Math.min(...young.map(d => d.voteChangePercent)).toFixed(2),
      max: Math.max(...young.map(d => d.voteChangePercent)).toFixed(2)
    },
    { 
      group: "Medel", 
      avg: middleAvg.toFixed(2), 
      std: middleStd.toFixed(2),
      count: middle.length,
      min: Math.min(...middle.map(d => d.voteChangePercent)).toFixed(2),
      max: Math.max(...middle.map(d => d.voteChangePercent)).toFixed(2)
    },
    { 
      group: "Äldre", 
      avg: oldAvg.toFixed(2), 
      std: oldStd.toFixed(2),
      count: old.length,
      min: Math.min(...old.map(d => d.voteChangePercent)).toFixed(2),
      max: Math.max(...old.map(d => d.voteChangePercent)).toFixed(2)
    }
  ]
});

// =====================
// SLUTSATS
// =====================
addMdToPage(`
---
# Slutsats

## Påverkar ålder röstningsförändringar?

**Resultat:**
- Skillnad: ${Math.abs(youngAvg - oldAvg).toFixed(2)}%
- Korrelation: ${corr.toFixed(3)}
- t-värde: ${tValue.toFixed(3)}

**Statistisk slutsats:**
${
  Math.abs(tValue) >= 2
    ? "Det finns en statistiskt signifikant skillnad mellan åldersgrupper."
    : "Det finns ingen statistiskt signifikant skillnad mellan åldersgrupper."
}

**Tolkning:**
${
  Math.abs(corr) < 0.1
    ? "Det finns inget tydligt samband mellan ålder och röstförändring."
    : Math.abs(corr) < 0.3
    ? "Det finns ett svagt samband mellan ålder och röstförändring."
    : "Det finns ett måttligt samband mellan ålder och röstförändring."
}

**Slutsvar:**
${
  Math.abs(tValue) >= 2 && Math.abs(corr) >= 0.1
    ? "Ålder har en statistiskt säkerställd men svag effekt på röstningsförändringar."
    : "Ålder är inte en stark förklaringsfaktor för förändringar i valresultat."
}

**Vad innebär detta?**
Även om en skillnad kan påvisas statistiskt, är effekten liten.  
Det tyder på att andra faktorer, såsom inkomst, geografi och lokala förhållanden, har större betydelse.
`);

