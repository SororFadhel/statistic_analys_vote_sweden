import { getCombinedData } from "./helpers/dataProcessor.js";
import { correlation, average } from "./helpers/utils.js";
import { COLORS, pageHero, statGrid, statCard, infoNote, analysisBox } from "./helpers/components.js";

// ===============================
// 🔧 HJÄLPFUNKTIONER
// Små verktyg som används överallt i filen.
// ===============================

// Standardavvikelse för en array
function std(arr) {
  let mean = average(arr);
  return Math.sqrt(
    arr.reduce((sum, x) => sum + (x - mean) ** 2, 0) / arr.length
  );
}

// Oberoende t-test (Welch's t-test) mellan två grupper
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

// Formaterar ett tal med svenska decimaler
function formatNumber(value, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "saknas";
  return value.toLocaleString("sv-SE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

// Översätter korrelationsvärde till text: starkt, måttligt eller svagt
function correlationLabel(r) {
  if (r === null) return "kan inte beräknas";
  const abs = Math.abs(r);
  if (abs >= 0.5) return "starkt";
  if (abs >= 0.2) return "måttligt";
  return "svagt";
}

// Identifierar outliers med IQR-metoden
function findOutliersIQR(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor((sorted.length - 1) * 0.25)];
  const q3 = sorted[Math.floor((sorted.length - 1) * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  return sorted.filter(v => v < lowerBound || v > upperBound);
}

// Gör första bokstaven i en text stor
function capitalizeName(name) {
  if (!name) return "";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ===============================
// 🗂️ DATABEARBETNING
// ===============================

// Delar upp kommuner i tre åldersgrupper (Unga, Medel, Äldre)
function buildAgeGroups(dataset) {
  let sorted = [...dataset].sort((a, b) => a.age - b.age);
  let size = Math.floor(sorted.length / 3);

  let young = sorted.slice(0, size);
  let middle = sorted.slice(size, size * 2);
  let old = sorted.slice(size * 2);

  return { young, middle, old, size };
}

// ===============================
// 🚀 HUVUDDEL
// Sidans innehåll — rubriker, filter, tabeller, diagram och analys
// ===============================

addMdToPage(`# Ålder och förändring i valresultat`);

const allData = getCombinedData().filter(
  d => d.age > 0 && !isNaN(d.avgVoteChange));

if (!allData.length) {
  addToPage(infoNote(
    '<strong>Ingen data tillgänglig.</strong> Kontrollera att datakällorna är korrekt anslutna.'
  ));
} else {

  const dataset = allData.map(d => ({
    ...d,
    voteChangePercent: d.avgVoteChange
  }));

  // Hero-ruta överst på sidan
  addToPage(pageHero(
    'Ålder och förändring i valresultat',
    'Skiljer sig förändringar i valresultat mellan kommuner med yngre och äldre befolkning?',
    [
      `${dataset.length} kommuner`,
      'Riksdagsvalet 2018-2022',
      'Ålder'
    ]
  ));

  // Dela upp i åldersgrupper
  const { young, middle, old } = buildAgeGroups(dataset);

  let youngAvg = average(young.map(d => d.voteChangePercent));
  let middleAvg = average(middle.map(d => d.voteChangePercent));
  let oldAvg = average(old.map(d => d.voteChangePercent));

  let youngStd = std(young.map(d => d.voteChangePercent));
  let middleStd = std(middle.map(d => d.voteChangePercent));
  let oldStd = std(old.map(d => d.voteChangePercent));

  // Beräkna korrelation (anpassad till utils signatur: xs, ys)
  const ageXs = dataset.map(d => d.age);
  const ageYs = dataset.map(d => d.voteChangePercent);
  const corr = correlation(ageXs, ageYs);
  const corrStrength = correlationLabel(corr);

  // t-test mellan unga och äldre
  const tValue = tTest(
    young.map(d => d.voteChangePercent),
    old.map(d => d.voteChangePercent)
  );
  const isSignificant = Math.abs(tValue) >= 2;

  // Identifiera outliers i röstförändring
  const voteChanges = dataset.map(d => d.voteChangePercent);
  const outliers = findOutliersIQR(voteChanges);

  // Statistikkort med nyckeltal
  addToPage(statGrid([
    statCard('Antal kommuner', dataset.length),
    statCard('Genomsnittlig ålder', `${formatNumber(average(dataset.map(d => d.age)), 1)} <span class="value-unit">år</span>`),
    statCard('Genomsnittlig förändring', `${formatNumber(average(dataset.map(d => d.voteChangePercent)), 2)} <span class="value-unit">%</span>`),
    statCard('Standardavvikelse', formatNumber(std(dataset.map(d => d.voteChangePercent)), 2)),
    statCard('Åldersgrupp Unga', `${formatNumber(youngAvg, 2)} <span class="value-unit">%</span>`),
    statCard('Åldersgrupp Äldre', `${formatNumber(oldAvg, 2)} <span class="value-unit">%</span>`)
  ]));

  // Inforuta om gruppering
  addToPage(infoNote(
    'Kommunerna delas in i tre lika stora grupper baserat på medelålder. <strong>Unga</strong> = lägsta tredjedelen, <strong>Medel</strong> = mellersta tredjedelen, <strong>Äldre</strong> = högsta tredjedelen.'
  ));

  // Inforuta om outliers
  addToPage(infoNote(
    `Vi har identifierat ${outliers.length} avvikande värden (outliers) i datan. ` +
    `Outliers är extrema värden som ligger ovanför eller under det normala spannet för majoriteten av datapunkterna. ` +
    `De behålls i analysen eftersom de representerar verkliga förhållanden i kommunerna och kan bidra till en mer komplett bild.`
  ));

  // Diagram 1 — Åldersgrupper vs röstförändring
  addMdToPage(`## Åldersgrupper och röstförändring`);

  drawGoogleChart({
    type: "ColumnChart",
    data: [
      ["Åldersgrupp", "Genomsnittlig % förändring", { role: "style" }],
      ["Unga", youngAvg, COLORS.primary],
      ["Medel", middleAvg, COLORS.secondary],
      ["Äldre", oldAvg, COLORS.success]
    ],
    options: {
      title: "Genomsnittlig procentuell röstförändring per åldersgrupp",
      legend: "none",
      colors: [COLORS.primary],
      chartArea: { left: 80, top: 50, right: 30, bottom: 80 },
      height: 400
    }
  });

  addMdToPage(`### Sammanfattning av åldersgrupper`);

  tableFromData({
    data: [
      { Grupp: "Unga", Genomsnitt: formatNumber(youngAvg, 2), Standardavvikelse: formatNumber(youngStd, 2), Antal: young.length, Minimum: formatNumber(Math.min(...young.map(d => d.voteChangePercent)), 2), Maximum: formatNumber(Math.max(...young.map(d => d.voteChangePercent)), 2) },
      { Grupp: "Medel", Genomsnitt: formatNumber(middleAvg, 2), Standardavvikelse: formatNumber(middleStd, 2), Antal: middle.length, Minimum: formatNumber(Math.min(...middle.map(d => d.voteChangePercent)), 2), Maximum: formatNumber(Math.max(...middle.map(d => d.voteChangePercent)), 2) },
      { Grupp: "Äldre", Genomsnitt: formatNumber(oldAvg, 2), Standardavvikelse: formatNumber(oldStd, 2), Antal: old.length, Minimum: formatNumber(Math.min(...old.map(d => d.voteChangePercent)), 2), Maximum: formatNumber(Math.max(...old.map(d => d.voteChangePercent)), 2) }
    ]
  });

  // Diagram 2 — Trend chart: Ålder vs röstförändring
  addMdToPage(`## Samband mellan ålder och röstförändring`);

  const trendData = [...dataset]
    .sort((a, b) => a.age - b.age)
    .map(d => [d.age, d.voteChangePercent]);

  drawGoogleChart({
    type: "ScatterChart",
    data: [
      ["Ålder", "Röstförändring (%)"],
      ...dataset.map(d => [d.age, d.voteChangePercent])
    ],
    options: {
      title: "Ålder vs röstförändring (%)",
      pointSize: 5,
      trendlines: { 0: { color: COLORS.secondary, lineWidth: 2 } },
      colors: [COLORS.primary],
      hAxis: { title: "Medelålder" },
      vAxis: { title: "Röstförändring (%)" },
      chartArea: { left: 80, top: 50, right: 30, bottom: 80 },
      height: 400
    }
  });

  // Analysrutor — korrelation, t-test, analys, kausalitet, begränsningar, slutsats
  addToPage(analysisBox('Korrelationsanalys', `
    <p>
      <strong>Korrelationskoefficient (r):</strong>
      <span class="corr-value">${corr === null ? 'saknas' : formatNumber(corr, 3)}</span>
      — ${corrStrength} samband
    </p>
    <p>Korrelationskoefficienten visar hur starkt två variabler samvarierar. Ett värde nära 0 tyder på svagt samband medan värden närmare 1 eller −1 tyder på starkare samband. Korrelation visar dock inte orsakssamband.</p>
  `));

  addToPage(analysisBox('Statistiskt test (t-test)', `
    <p><strong>Hypoteser:</strong> H₀: Ingen skillnad mellan unga och äldre kommuner. H₁: Det finns en skillnad.</p>
    <p>
      <strong>t-värde:</strong>
      <span class="corr-value">${formatNumber(tValue, 3)}</span>
      — ${isSignificant ? "statistiskt signifikant" : "inte statistiskt signifikant"}
    </p>
    <p>Tolkning: |t| ≥ 2 indikerar statistiskt signifikant skillnad mellan grupperna.</p>
  `, true));

  // Datapreview
  addMdToPage(`## Datapreview`);
  addMdToPage(`Här visas de första 10 raderna från datasetet.`);

  tableFromData({
    data: dataset.slice(0, 10).map(d => ({
      'Kommun': capitalizeName(d.kommun),
      'Medelålder': d.age,
      'Röstförändring (%)': formatNumber(d.voteChangePercent, 2)
    }))
  });

  // Slutsatsrutor
  addToPage(analysisBox('Analys', `
    <p>Resultaten visar ett <strong>${corrStrength}</strong> samband mellan ålder och förändring i röster. Korrelationskoefficienten är <strong>${formatNumber(corr, 3)}</strong>.</p>
    <p>t-testet mellan unga och äldre kommuner ger ett värde på <strong>${formatNumber(tValue, 3)}</strong>, vilket ${isSignificant ? "tyder på en statistiskt signifikant skillnad" : "inte räcker för att påvisa en signifikant skillnad"}.</p>
    <p>Skillnaden mellan grupperna är <strong>${formatNumber(Math.abs(youngAvg - oldAvg), 2)}%</strong>.</p>
  `, true));

  addToPage(analysisBox('Kausalitet vs korrelation', `
    <p>Även om vi ser ett samband mellan ålder och röstförändring kan vi inte fastställa orsakssamband. Det är möjligt att:</p>
    <ul>
      <li>Ålder påverkar politiska preferenser direkt</li>
      <li>Andra faktorer (inkomst, geografi, migration) påverkar både ålder och röstning</li>
      <li>Sambandet är slumpmässigt eller beror på dataens begränsningar</li>
    </ul>
  `, true));

  addToPage(analysisBox('Begränsningar', `
    <ul>
      <li>Analysen bygger på korrelation och kan inte fastställa orsakssamband.</li>
      <li>Ålder representeras som medelålder per kommun — individuella skillnader inom kommunen fångas inte.</li>
      <li>Andra variabler kan också påverka förändringar i röster.</li>
    </ul>
  `, true));

  addToPage(analysisBox('Slutsats', `
    <p>${isSignificant && Math.abs(corr) >= 0.1
      ? "Ålder har en statistiskt säkerställd men svag effekt på röstningsförändringar. Effekten är liten och andra faktorer har troligen större betydelse."
      : "Ålder är inte en stark förklaringsfaktor för förändringar i valresultat. Andra faktorer som inkomst, geografi och lokala förhållanden verkar ha större betydelse."
    }</p>
  `, true));
}

