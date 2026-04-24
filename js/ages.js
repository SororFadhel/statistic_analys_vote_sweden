import { getCombinedData } from "./helpers/dataProcessor.js";
import { correlation, average } from "./helpers/utils.js";

// ==============================
// HJÄLPFUNKTIONER
// ==============================

function std(arr) {
  let mean = average(arr);
  return Math.sqrt(
    arr.reduce((sum, x) => sum + (x - mean) ** 2, 0) / arr.length
  );
}

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

function formatNumber(value, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "saknas";
  return value.toLocaleString("sv-SE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function correlationLabel(r) {
  if (r === null) return "kan inte beräknas";
  const abs = Math.abs(r);
  if (abs >= 0.5) return "starkt";
  if (abs >= 0.2) return "måttligt";
  return "svagt";
}

// ==============================
// HUVUDDEL
// ==============================

addMdToPage(`
# Ålder och förändring i valresultat
`);

const allData = getCombinedData().filter(
  d => d.age > 0 && d.avgVoteChange !== 0
);

if (!allData.length) {
  addMdToPage(`
    <div class="info-note">
      <strong>Ingen data tillgänglig.</strong> Kontrollera att datakällorna är korrekt anslutna.
    </div>
  `);
} else {

  const dataset = allData.map(d => ({
    ...d,
    voteChangePercent: d.avgVoteChange
  }));

  addToPage(`
    <div class="page-hero">
      <h2>Ålder och förändring i valresultat</h2>
      <p>Skiljer sig förändringar i valresultat mellan kommuner med yngre och äldre befolkning?</p>
      <div class="hero-tags">
        <span class="hero-tag">${dataset.length} kommuner</span>
        <span class="hero-tag">Riksdagsvalet 2018-2022</span>
        <span class="hero-tag">Ålder</span>
      </div>
    </div>
  `);

  // =====================
  // STEG 1: GRUPPERING
  // =====================
  let sorted = [...dataset].sort((a, b) => a.age - b.age);
  let size = Math.floor(sorted.length / 3);

  let young = sorted.slice(0, size);
  let middle = sorted.slice(size, size * 2);
  let old = sorted.slice(size * 2);

  let youngAvg = average(young.map(d => d.voteChangePercent));
  let middleAvg = average(middle.map(d => d.voteChangePercent));
  let oldAvg = average(old.map(d => d.voteChangePercent));

  let youngStd = std(young.map(d => d.voteChangePercent));
  let middleStd = std(middle.map(d => d.voteChangePercent));
  let oldStd = std(old.map(d => d.voteChangePercent));

  addToPage(`
    <div class="stat-grid">
      <div class="stat-card">
        <h4>Antal kommuner</h4>
        <div class="value">${dataset.length}</div>
      </div>
      <div class="stat-card">
        <h4>Genomsnittlig ålder (alla)</h4>
        <div class="value">${formatNumber(average(dataset.map(d => d.age)), 1)} <span class="value-unit">år</span></div>
      </div>
      <div class="stat-card">
        <h4>Genomsnittlig förändring (alla)</h4>
        <div class="value">${formatNumber(average(dataset.map(d => d.voteChangePercent)), 2)} <span class="value-unit">%</span></div>
      </div>
      <div class="stat-card">
        <h4>Standardavvikelse</h4>
        <div class="value">${formatNumber(std(dataset.map(d => d.voteChangePercent)), 2)}</div>
      </div>
      <div class="stat-card">
        <h4>Åldersgrupp Unga</h4>
        <div class="value">${formatNumber(youngAvg, 2)} <span class="value-unit">%</span></div>
      </div>
      <div class="stat-card">
        <h4>Åldersgrupp Äldre</h4>
        <div class="value">${formatNumber(oldAvg, 2)} <span class="value-unit">%</span></div>
      </div>
    </div>
  `);

  addMdToPage(`## Åldersgrupper och röstförändring`);
  addMdToPage(`Kommunerna delas in i tre lika stora grupper baserat på medelålder: Unga, Medel och Äldre.`);

  drawGoogleChart({
    type: "ColumnChart",
    data: [
      ["Åldersgrupp", "Genomsnittlig % förändring", { role: "style" }],
      ["Unga", youngAvg, "#1a2b4a"],
      ["Medel", middleAvg, "#c8963e"],
      ["Äldre", oldAvg, "#3b6d11"]
    ],
    options: {
      title: "Genomsnittlig procentuell röstförändring per åldersgrupp",
      legend: "none",
      colors: ["#1a2b4a"],
      chartArea: { left: 80, top: 50, right: 30, bottom: 80 },
      height: 400
    }
  });

  addMdToPage(`### Sammanfattning av åldersgrupper`);

  tableFromData({
    data: [
      { group: "Unga", avg: formatNumber(youngAvg, 2), std: formatNumber(youngStd, 2), count: young.length, min: formatNumber(Math.min(...young.map(d => d.voteChangePercent)), 2), max: formatNumber(Math.max(...young.map(d => d.voteChangePercent)), 2) },
      { group: "Medel", avg: formatNumber(middleAvg, 2), std: formatNumber(middleStd, 2), count: middle.length, min: formatNumber(Math.min(...middle.map(d => d.voteChangePercent)), 2), max: formatNumber(Math.max(...middle.map(d => d.voteChangePercent)), 2) },
      { group: "Äldre", avg: formatNumber(oldAvg, 2), std: formatNumber(oldStd, 2), count: old.length, min: formatNumber(Math.min(...old.map(d => d.voteChangePercent)), 2), max: formatNumber(Math.max(...old.map(d => d.voteChangePercent)), 2) }
    ]
  });

  addToPage(`
    <div class="info-note">
      Varje grupp innehåller ungefär en tredjedel av alla kommuner. <strong>Unga</strong> = lägsta tredjedelen av medelålder, <strong>Äldre</strong> = högsta tredjedelen.
    </div>
  `);

  // =====================
  // STEG 2: KORRELATION
  // =====================
  addMdToPage(`## Samband mellan ålder och röstförändring`);

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
      trendlines: { 0: { color: "#c8963e", lineWidth: 2 } },
      colors: ["#1a2b4a"],
      hAxis: { title: "Medelålder" },
      vAxis: { title: "Röstförändring (%)" },
      chartArea: { left: 80, top: 50, right: 30, bottom: 80 },
      height: 400
    }
  });

  const corrStrength = correlationLabel(corr);

  addToPage(`
    <div class="analysis-box">
      <h3>Korrelationsanalys</h3>
      <p>
        <strong>Korrelationskoefficient (r):</strong>
        <span class="corr-value">${corr === null ? 'saknas' : formatNumber(corr, 3)}</span>
        — ${corrStrength} samband
      </p>
      <p>Korrelationskoefficienten visar hur starkt två variabler samvarierar. Ett värde nära 0 tyder på svagt samband medan värden närmare 1 eller −1 tyder på starkare samband. Korrelation visar dock inte orsakssamband.</p>
    </div>
  `);

  // =====================
  // STEG 3: T-TEST
  // =====================
  addMdToPage(`## Statistiskt test (t-test)`);
  addMdToPage(`**Hypoteser:** H₀: Ingen skillnad mellan unga och äldre kommuner. H₁: Det finns en skillnad.`);

  let tValue = tTest(
    young.map(d => d.voteChangePercent),
    old.map(d => d.voteChangePercent)
  );

  const isSignificant = Math.abs(tValue) >= 2;

  addToPage(`
    <div class="analysis-box">
      <h3>t-test: Unga vs Äldre</h3>
      <p>
        <strong>t-värde:</strong>
        <span class="corr-value">${formatNumber(tValue, 3)}</span>
        — ${isSignificant ? "statistiskt signifikant" : "inte statistiskt signifikant"}
      </p>
      <p>Tolkning: |t| ≥ 2 indikerar statistiskt signifikant skillnad mellan grupperna.</p>
    </div>
  `);

  // =====================
  // DATAPREVIEW
  // =====================
  addMdToPage(`## Datapreview`);
  addMdToPage(`Här visas de första 10 raderna från datasetet.`);

  tableFromData({
    data: dataset.slice(0, 10).map(d => ({
      'Kommun': d.kommun,
      'Medelålder': d.age,
      'Röstförändring (%)': formatNumber(d.voteChangePercent, 2)
    }))
  });

  // =====================
  // SLUTSATSER
  // =====================
  addToPage(`
    <div class="analysis-box" style="margin-top: 1rem;">
      <h3>Analys</h3>
      <p>Resultaten visar ett <strong>${corrStrength}</strong> samband mellan ålder och förändring i röster. Korrelationskoefficienten är <strong>${formatNumber(corr, 3)}</strong>.</p>
      <p>t-testet mellan unga och äldre kommuner ger ett värde på <strong>${formatNumber(tValue, 3)}</strong>, vilket ${isSignificant ? "tyder på en statistiskt signifikant skillnad" : "inte räcker för att påvisa en signifikant skillnad"}.</p>
      <p>Skillnaden mellan grupperna är <strong>${formatNumber(Math.abs(youngAvg - oldAvg), 2)}%</strong>.</p>
    </div>

    <div class="analysis-box" style="margin-top: 1rem;">
      <h3>Kausalitet vs korrelation</h3>
      <p>Även om vi ser ett samband mellan ålder och röstförändring kan vi inte fastställa orsakssamband. Det är möjligt att:</p>
      <ul>
        <li>Ålder påverkar politiska preferenser direkt</li>
        <li>Andra faktorer (inkomst, geografi, migration) påverkar både ålder och röstning</li>
        <li>Sambandet är slumpmässigt eller beror på dataens begränsningar</li>
      </ul>
    </div>

    <div class="analysis-box" style="margin-top: 1rem;">
      <h3>Begränsningar</h3>
      <ul>
        <li>Analysen bygger på korrelation och kan inte fastställa orsakssamband.</li>
        <li>Ålder representeras som medelålder per kommun — individuella skillnader inom kommunen fångas inte.</li>
        <li>Andra variabler kan också påverka förändringar i röster.</li>
      </ul>
    </div>

    <div class="analysis-box" style="margin-top: 1rem;">
      <h3>Slutsats</h3>
      <p>
        ${isSignificant && Math.abs(corr) >= 0.1
      ? "Ålder har en statistiskt säkerställd men svag effekt på röstningsförändringar. Effekten är liten och andra faktorer har troligen större betydelse."
      : "Ålder är inte en stark förklaringsfaktor för förändringar i valresultat. Andra faktorer som inkomst, geografi och lokala förhållanden verkar ha större betydelse."
    }
      </p>
    </div>
  `);
}