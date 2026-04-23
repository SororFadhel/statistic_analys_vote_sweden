import dbInfoOk, { displayDbNotOkText } from "./helpers/dbInfoOk.js";
import { income, unemployment, lanKommun, electionResults } from "./helpers/dataLoader.js";

// ==============================
// HJÄLPFUNKTIONER
// ==============================

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeGender(value) {
  const v = normalizeText(value);
  if (["man", "män", "male", "m"].includes(v)) return "män";
  if (["kvinna", "kvinnor", "female", "f"].includes(v)) return "kvinnor";
  if (["totalt", "total", "alla", "all"].includes(v)) return "totalt";
  return v || "totalt";
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const cleaned = String(value).replace(/\s/g, "").replace(",", ".");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function average(arr) {
  const valid = arr.filter(v => v !== null && v !== undefined && !Number.isNaN(v));
  if (!valid.length) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

function correlation(data, xKey, yKey) {
  const points = data
    .map(d => ({ x: toNumber(d[xKey]), y: toNumber(d[yKey]) }))
    .filter(d => d.x !== null && d.y !== null);
  if (points.length < 2) return null;
  const x = points.map(d => d.x);
  const y = points.map(d => d.y);
  const meanX = average(x);
  const meanY = average(y);
  const numerator = x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0);
  const denominator = Math.sqrt(
    x.reduce((sum, xi) => sum + (xi - meanX) ** 2, 0) *
    y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0)
  );
  if (!denominator) return null;
  return numerator / denominator;
}

function correlationLabel(r) {
  if (r === null) return "kan inte beräknas";
  const abs = Math.abs(r);
  if (abs >= 0.5) return "starkt";
  if (abs >= 0.2) return "måttligt";
  return "svagt";
}

function formatNumber(value, decimals = 1) {
  const num = toNumber(value);
  if (num === null) return "saknas";
  return num.toLocaleString("sv-SE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function formatPercent(value, decimals = 1) {
  const num = toNumber(value);
  if (num === null) return "saknas";
  return `${num.toLocaleString("sv-SE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })} %`;
}

function getElectionValue(row, keys) {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && row[key] !== "") {
      const num = toNumber(row[key]);
      if (num !== null) return num;
    }
  }
  return null;
}

function extractElectionRows(source) {
  if (Array.isArray(source)) return source;
  if (source?.records && Array.isArray(source.records)) {
    return source.records.map(record => {
      if (record?._fields?.[0]?.properties) return record._fields[0].properties;
      if (record?.properties) return record.properties;
      return record;
    });
  }
  return [];
}

function buildElectionMap(results) {
  const rows = extractElectionRows(results);
  const map = new Map();

  for (const row of rows) {
    const kommun = row.kommun || row.Kommun;
    if (!kommun) continue;

    const r2018 = toNumber(row.roster2018) ?? 0;
    const r2022 = toNumber(row.roster2022) ?? 0;
    const key = normalizeText(kommun);

    if (!map.has(key)) {
      map.set(key, { kommun, roster2018: 0, roster2022: 0 });
    }

    const item = map.get(key);
    item.roster2018 += r2018;
    item.roster2022 += r2022;
  }

  for (const item of map.values()) {
    item.voteChange = item.roster2022 - item.roster2018;
  }

  return map;
}

function buildLanKommunMap(rows) {
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const kommunKod = String(row.kommunKod ?? "").trim();
    const lan = row.lan ?? null;
    if (!kommunKod || !lan) continue;
    map.set(kommunKod, { lan, kommun: row.kommun ?? null });
  }
  return map;
}

function buildUnemploymentMap(rows) {
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const lan = row.region ?? row.lan ?? null;
    const kon = normalizeGender(row.gender ?? row.kon);
    if (!lan || !kon) continue;
    const a2018 = toNumber(row["2018"] ?? row.arbetsloshet_2018);
    const a2022 = toNumber(row["2022"] ?? row.arbetsloshet_2022);
    if (a2018 !== null) map.set(`${normalizeText(lan)}__${kon}__2018`, a2018);
    if (a2022 !== null) map.set(`${normalizeText(lan)}__${kon}__2022`, a2022);
  }
  return map;
}

function buildIncomeMap(rows, lanMap, unemploymentMap) {
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const kommun = row.kommun ?? null;
    const kon = normalizeGender(row.kon);
    const ar = toNumber(row.ar);
    const inkomstValue = toNumber(row.inkomst);
    const regionKod = String(row.Region ?? "").trim();
    if (!kommun || !kon || ar === null || inkomstValue === null || !regionKod) continue;
    const lanInfo = lanMap.get(regionKod);
    const lan = lanInfo?.lan ?? null;
    const key = `${normalizeText(kommun)}__${kon}`;
    if (!map.has(key)) {
      map.set(key, { kommun, kon, lan, inkomst_2018: null, inkomst_2022: null, arbetsloshet_2018: null, arbetsloshet_2022: null });
    }
    const item = map.get(key);
    if (lan && !item.lan) item.lan = lan;
    if (ar === 2018) item.inkomst_2018 = inkomstValue;
    if (ar === 2022) item.inkomst_2022 = inkomstValue;
    if (lan) {
      const arbetsloshet = unemploymentMap.get(`${normalizeText(lan)}__${kon}__${ar}`);
      if (ar === 2018) item.arbetsloshet_2018 = arbetsloshet ?? null;
      if (ar === 2022) item.arbetsloshet_2022 = arbetsloshet ?? null;
    }
  }
  return map;
}

function mergeData() {
  const electionMap = buildElectionMap(electionResults);
  const lanMap = buildLanKommunMap(lanKommun);
  const unemploymentMap = buildUnemploymentMap(unemployment);
  const incomeMap = buildIncomeMap(income, lanMap, unemploymentMap);
  const merged = [];
  for (const item of incomeMap.values()) {
    const election = electionMap.get(normalizeText(item.kommun));
    if (!election) continue;
    if (election.voteChange === null) continue;
    if (item.inkomst_2018 === null && item.inkomst_2022 === null) continue;
    merged.push({
      kommun: item.kommun,
      kon: item.kon,
      lan: item.lan,
      inkomst_2018: item.inkomst_2018,
      inkomst_2022: item.inkomst_2022,
      arbetsloshet_2018: item.arbetsloshet_2018,
      arbetsloshet_2022: item.arbetsloshet_2022,
      roster2018: election.roster2018,
      roster2022: election.roster2022,
      voteChange: election.voteChange
    });
  }
  return merged;
}

function buildIncomeIntervalData(data) {
  const intervals = [
    { label: "300–330 tkr", min: 300, max: 330 },
    { label: "330–360 tkr", min: 330, max: 360 },
    { label: "360–390 tkr", min: 360, max: 390 },
    { label: "390–420 tkr", min: 390, max: 420 },
    { label: "420–470 tkr", min: 420, max: 470 },
    { label: "470+ tkr", min: 470, max: Infinity }
  ];

  return intervals.map(interval => {
    const group = data.filter(d => {
      const inc = toNumber(d.inkomst_2022);
      return inc !== null && inc >= interval.min && inc < interval.max;
    });
    return {
      label: interval.label,
      avgVoteChange: average(group.map(d => d.voteChange)) ?? 0,
      count: group.length
    };
  }).filter(d => d.count > 0);
}

function buildIncomeGroupData(data) {
  const sorted = [...data]
    .filter(d => toNumber(d.inkomst_2022) !== null)
    .sort((a, b) => toNumber(a.inkomst_2022) - toNumber(b.inkomst_2022));

  const third = Math.floor(sorted.length / 3);
  const low = sorted.slice(0, third);
  const mid = sorted.slice(third, third * 2);
  const high = sorted.slice(third * 2);

  return [
    { label: "Låg inkomst", avgVoteChange: average(low.map(d => d.voteChange)) ?? 0 },
    { label: "Medel inkomst", avgVoteChange: average(mid.map(d => d.voteChange)) ?? 0 },
    { label: "Hög inkomst", avgVoteChange: average(high.map(d => d.voteChange)) ?? 0 }
  ];
}

function buildLanData(data) {
  const lanMap = new Map();
  for (const row of data) {
    if (!row.lan) continue;
    if (!lanMap.has(row.lan)) {
      lanMap.set(row.lan, { lan: row.lan, voteChanges: [], arbetsloshet_2022: row.arbetsloshet_2022 });
    }
    const item = lanMap.get(row.lan);
    if (row.voteChange !== null) item.voteChanges.push(row.voteChange);
    if (item.arbetsloshet_2022 === null && row.arbetsloshet_2022 !== null) {
      item.arbetsloshet_2022 = row.arbetsloshet_2022;
    }
  }

  return Array.from(lanMap.values())
    .map(item => ({
      lan: item.lan,
      avgVoteChange: average(item.voteChanges),
      arbetsloshet_2022: item.arbetsloshet_2022
    }))
    .filter(d => d.avgVoteChange !== null && d.arbetsloshet_2022 !== null)
    .sort((a, b) => b.arbetsloshet_2022 - a.arbetsloshet_2022);
}


function renderLanChart(data) {
  const lanData = buildLanData(data);
  if (!lanData.length) return "<p>Inte tillräckligt med data.</p>";

  const maxAbs = Math.max(...lanData.map(d => Math.abs(d.avgVoteChange)));
  const thresholdHigh = lanData.map(d => d.arbetsloshet_2022).sort((a, b) => b - a)[Math.floor(lanData.length / 3)];
  const thresholdLow = lanData.map(d => d.arbetsloshet_2022).sort((a, b) => b - a)[Math.floor(2 * lanData.length / 3)];

  function getBadgeClass(val) {
    if (val >= thresholdHigh) return "lan-badge lan-badge-high";
    if (val >= thresholdLow) return "lan-badge lan-badge-mid";
    return "lan-badge lan-badge-low";
  }

  function getBadgeLabel(val) {
    if (val >= thresholdHigh) return "Hög";
    if (val >= thresholdLow) return "Medel";
    return "Låg";
  }

  const rows = lanData.map(d => {
    const pct = Math.round((Math.abs(d.avgVoteChange) / maxAbs) * 100);
    const isPos = d.avgVoteChange >= 0;
    const sign = isPos ? "+" : "−";
    const barClass = isPos ? "lan-bar-pos" : "lan-bar-neg";
    return `
      <div class="lan-bar-row">
        <span class="lan-bar-label">${escapeHtml(d.lan)}</span>
        <div class="lan-bar-track"><div class="${barClass}" style="width:${pct}%"></div></div>
        <span class="lan-bar-value">${sign}${Math.abs(Math.round(d.avgVoteChange))}</span>
        <span class="${getBadgeClass(d.arbetsloshet_2022)}">${getBadgeLabel(d.arbetsloshet_2022)} (${formatPercent(d.arbetsloshet_2022, 1)})</span>
      </div>
    `;
  }).join("");

  return `
    <div class="lan-chart-wrap">
      <div class="lan-legend">
        <span><span class="lan-legend-dot" style="background:#1a2b4a"></span> Ökade röster</span>
        <span><span class="lan-legend-dot" style="background:#c8963e"></span> Minskade röster</span>
        <span><span class="lan-legend-dot" style="background:#faeeda;border:1px solid #c8963e"></span> Hög arbetslöshet</span>
        <span><span class="lan-legend-dot" style="background:#e8f0fb;border:1px solid #185fa5"></span> Medel arbetslöshet</span>
        <span><span class="lan-legend-dot" style="background:#eaf3de;border:1px solid #3b6d11"></span> Låg arbetslöshet</span>
      </div>
      ${rows}
    </div>
  `;
}

// ==============================
// HUVUDDEL
// ==============================

addMdToPage(`
# Inkomst och arbetslöshet vs förändring i valresultat
`);

if (!dbInfoOk) {
  displayDbNotOkText();
} else {

  const allMerged = mergeData();

  // Hero banner
  addToPage(`
    <div class="income-hero">
      <h2>Inkomst och arbetslöshet vs förändring i valresultat</h2>
      <p>Kan ekonomiska faktorer förklara hur valresultatet förändrades mellan 2018 och 2022?</p>
      <div class="income-hero-tags">
        <span class="income-hero-tag">${allMerged.filter(d => normalizeGender(d.kon) === 'totalt').length} kommuner</span>
        <span class="income-hero-tag">Riksdagsvalet 2018–2022</span>
        <span class="income-hero-tag">Inkomst + Arbetslöshet</span>
      </div>
    </div>
  `);

  // Dropdown med mallens funktion
  let selectedGender = addDropdown('Filtrera på kön', ['Totalt', 'Kvinnor', 'Män'], 'Totalt');
  selectedGender = selectedGender.toLowerCase();

  // Filtrera data
  let filtered = allMerged.filter(row => normalizeGender(row.kon) === selectedGender);
  if (!filtered.length) {
    filtered = allMerged.filter(row => normalizeGender(row.kon) === 'totalt');
  }

  // Statistikkort
  const avgIncome2018 = average(filtered.map(d => d.inkomst_2018));
  const avgIncome2022 = average(filtered.map(d => d.inkomst_2022));
  const avgUnemployment2018 = average(filtered.map(d => d.arbetsloshet_2018));
  const avgUnemployment2022 = average(filtered.map(d => d.arbetsloshet_2022));
  const avgVoteChange = average(filtered.map(d => d.voteChange));
  const incomeCorr = correlation(filtered, 'inkomst_2022', 'voteChange');
  const unemploymentCorr = correlation(filtered, 'arbetsloshet_2022', 'voteChange');

  addToPage(`
    <div class="income-grid">
      <div class="income-card">
        <h4>Antal kommuner</h4>
        <div class="value">${filtered.length}</div>
      </div>
      <div class="income-card">
        <h4>Genomsnittlig inkomst 2018 (tkr)</h4>
        <div class="value">${formatNumber(avgIncome2018, 1)} <span class="value-unit">tkr</span></div>
      </div>
      <div class="income-card">
        <h4>Genomsnittlig inkomst 2022 (tkr)</h4>
        <div class="value">${formatNumber(avgIncome2022, 1)} <span class="value-unit">tkr</span></div>
      </div>
      <div class="income-card">
        <h4>Genomsnittlig förändring i röster</h4>
        <div class="value">${formatNumber(avgVoteChange, 1)}</div>
      </div>
      <div class="income-card">
        <h4>Arbetslöshet 2018 (länsnivå)</h4>
        <div class="value">${formatPercent(avgUnemployment2018, 1)}</div>
      </div>
      <div class="income-card">
        <h4>Arbetslöshet 2022 (länsnivå)</h4>
        <div class="value">${formatPercent(avgUnemployment2022, 1)}</div>
      </div>
    </div>
  `);

  // Datapreview med mallens tableFromData
  addMdToPage(`## Datapreview`);
  addMdToPage(`Här visas de första 10 raderna från det sammanslagna datasetet.`);

  tableFromData({
    data: filtered.slice(0, 10).map(row => ({
      'Kommun': row.kommun,
      'Län': row.lan ?? '',
      'Inkomst 2018 (tkr)': formatNumber(row.inkomst_2018, 1),
      'Inkomst 2022 (tkr)': formatNumber(row.inkomst_2022, 1),
      'Arbetslöshet 2018 (länsnivå)': row.arbetsloshet_2018 === null ? 'saknas' : formatPercent(row.arbetsloshet_2018, 1),
      'Arbetslöshet 2022 (länsnivå)': row.arbetsloshet_2022 === null ? 'saknas' : formatPercent(row.arbetsloshet_2022, 1),
      'Röster 2022': row.roster2022,
      'Röster 2018': row.roster2018,
      'Förändring i röster (2018-2022)': toNumber(row.voteChange) ?? 0
    }))
  });

  addToPage(`
    <div class="income-info-note">
      ℹ️ Arbetslöshetsdata är tillgänglig på <strong>länsnivå</strong>. Alla kommuner inom samma län delar samma värde. Förändring i röster avser skillnaden i totalt antal röster per kommun mellan riksdagsvalet 2018 och 2022.
    </div>
  `);

  // Diagram 1 — Linjediagram inkomstintervall
  addMdToPage(`## Samband mellan inkomst och förändring i röster`);
  addMdToPage(`Kommunerna grupperas i inkomstintervall för att tydligare visa trenden mellan inkomstnivå och röstförändring.`);

  const intervalData = buildIncomeIntervalData(filtered);
  drawGoogleChart({
    type: 'LineChart',
    data: [
      ['Inkomstintervall', 'Genomsnittlig förändring i röster'],
      ...intervalData.map(d => [d.label, Math.round(d.avgVoteChange)])
    ],
    options: {
      title: 'Inkomstintervall vs genomsnittlig förändring i röster',
      hAxis: { title: 'Inkomstintervall (tkr)' },
      vAxis: { title: 'Genomsnittlig förändring i röster' },
      colors: ['#1a2b4a'],
      trendlines: { 0: { color: '#c8963e', lineWidth: 2 } },
      pointSize: 6,
      chartArea: { left: 80, top: 50, right: 30, bottom: 80 },
      height: 400
    }
  });

  // Diagram 2 — Linjediagram låg/medel/hög inkomst
  addMdToPage(`## Jämförelse mellan låg, medel och hög inkomst`);
  addMdToPage(`Kommunerna delas upp i tre grupper utifrån inkomstnivå 2022.`);

  const groupData = buildIncomeGroupData(filtered);
  drawGoogleChart({
    type: 'LineChart',
    data: [
      ['Grupp', 'Genomsnittlig förändring i röster'],
      ...groupData.map(d => [d.label, Math.round(d.avgVoteChange)])
    ],
    options: {
      title: 'Inkomstgrupp vs genomsnittlig förändring i röster',
      hAxis: { title: 'Inkomstgrupp' },
      vAxis: { title: 'Genomsnittlig förändring i röster' },
      colors: ['#1a2b4a'],
      pointSize: 8,
      curveType: 'function',
      chartArea: { left: 80, top: 50, right: 30, bottom: 80 },
      height: 400
    }
  });

  // Diagram 3 — Länsstapeldiagram
  addMdToPage(`## Förändring i röster per län — sorterat efter arbetslöshet`);
  addMdToPage(`Varje stapel visar genomsnittlig förändring i röster per län. Länens arbetslöshetsnivå visas som badge till höger.`);
  addToPage(renderLanChart(filtered));

  // Korrelationsanalys
  const incomeStrength = correlationLabel(incomeCorr);
  const unemploymentStrength = correlationLabel(unemploymentCorr);
  const genderLabel = selectedGender === 'kvinnor' ? 'kvinnor' : selectedGender === 'män' ? 'män' : 'totalt';

  addToPage(`
    <div class="income-analysis-box">
      <h3>Korrelationsanalys</h3>
      <p>
        <strong>Inkomst och förändring i röster:</strong>
        <span class="income-corr-value">${incomeCorr === null ? 'saknas' : formatNumber(incomeCorr, 3)}</span>
        — ${incomeStrength} samband
      </p>
      <p>
        <strong>Arbetslöshet (länsnivå) och förändring i röster:</strong>
        <span class="income-corr-value">${unemploymentCorr === null ? 'saknas' : formatNumber(unemploymentCorr, 3)}</span>
        — ${unemploymentStrength} samband
      </p>
      <p>Korrelationskoefficienten visar hur starkt två variabler samvarierar. Ett värde nära 0 tyder på svagt samband medan värden närmare 1 eller −1 tyder på starkare samband. Korrelation visar dock inte orsakssamband.</p>
    </div>

    <div class="income-analysis-box" style="margin-top: 1rem;">
      <h3>Analys</h3>
      <p>För gruppen <strong>${genderLabel}</strong> visar resultaten ett <strong>${incomeStrength}</strong> samband mellan inkomst och förändring i röster. Linjediagrammet visar att kommuner med högre inkomst tenderar att ha en annan röstförändring än kommuner med lägre inkomst.</p>
      <p>Sambandet mellan arbetslöshet och förändring i röster framstår som <strong>${unemploymentStrength}</strong>. Länsstapeldiagrammet visar hur länen med hög respektive låg arbetslöshet förändrats, vilket ger en mer nyanserad bild än en enkel korrelation.</p>
      <p>Ekonomi verkar spela en roll, men väljarbeteende påverkas sannolikt också av ålder, migration, geografi och lokala förutsättningar.</p>
    </div>

    <div class="income-analysis-box" style="margin-top: 1rem;">
      <h3>Kausalitet vs korrelation</h3>
      <p>Även om vi ser ett samband mellan inkomst/arbetslöshet och röstförändring kan vi inte fastställa orsakssamband. Det är möjligt att:</p>
      <ul>
        <li>Ekonomiska faktorer påverkar politiska preferenser direkt</li>
        <li>Andra faktorer (ålder, geografi, migration) påverkar både ekonomi och röstning</li>
        <li>Sambandet är slumpmässigt eller beror på dataens begränsningar</li>
      </ul>
    </div>

    <div class="income-analysis-box" style="margin-top: 1rem;">
      <h3>Begränsningar</h3>
      <ul>
        <li>Analysen bygger på korrelation och kan inte fastställa orsakssamband.</li>
        <li>Arbetslöshetsdata finns på länsnivå — alla kommuner i samma län delar samma värde.</li>
        <li>Andra variabler kan också påverka förändringar i röster.</li>
      </ul>
    </div>

    <div class="income-analysis-box" style="margin-top: 1rem;">
      <h3>Slutsats</h3>
      <p>Ekonomiska faktorer som inkomst och arbetslöshet verkar ha en viss koppling till förändringar i röster mellan 2018 och 2022. Sambanden är dock inte tillräckligt starka för att ensamma förklara utvecklingen. Ekonomi spelar en roll, men flera faktorer tillsammans påverkar hur valmönster förändras.</p>
    </div>
  `);
}
