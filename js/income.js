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
    const kommun = row.kommun || row.Kommun || row.name || row.kommunnamn || row.municipality;
    if (!kommun) continue;
    const roster2018 = getElectionValue(row, ["roster2018", "votes2018", "vote2018", "result2018", "andel2018", "share2018"]);
    const roster2022 = getElectionValue(row, ["roster2022", "votes2022", "vote2022", "result2022", "andel2022", "share2022"]);
    map.set(normalizeText(kommun), {
      kommun, roster2018, roster2022,
      voteChange: roster2018 !== null && roster2022 !== null ? roster2022 - roster2018 : null
    });
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
      inkomst_forandring: item.inkomst_2018 !== null && item.inkomst_2022 !== null ? item.inkomst_2022 - item.inkomst_2018 : null,
      arbetsloshet_forandring: item.arbetsloshet_2018 !== null && item.arbetsloshet_2022 !== null ? item.arbetsloshet_2022 - item.arbetsloshet_2018 : null,
      roster2018: election.roster2018,
      roster2022: election.roster2022,
      voteChange: election.voteChange
    });
  }
  return merged;
}

function splitLowHigh(data, key) {
  const valid = data.filter(d => toNumber(d[key]) !== null).sort((a, b) => toNumber(a[key]) - toNumber(b[key]));
  const mid = Math.floor(valid.length / 2);
  return { low: valid.slice(0, mid), high: valid.slice(mid) };
}

function buildLanData(data) {
  const lanMap = new Map();
  for (const row of data) {
    if (!row.lan) continue;
    if (!lanMap.has(row.lan)) {
      lanMap.set(row.lan, {
        lan: row.lan,
        voteChanges: [],
        arbetsloshet_2022: row.arbetsloshet_2022
      });
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

function getRootContainer() {
  let root = document.getElementById("income-analysis-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "income-analysis-root";
    const target = document.querySelector("main") || document.querySelector("#content") || document.body;
    target.appendChild(root);
  }
  return root;
}

function ensureStyles() {
  if (document.getElementById("income-analysis-styles")) return;
  const style = document.createElement("style");
  style.id = "income-analysis-styles";
  style.textContent = `
    #income-analysis-root { margin-top: 1rem; }

    .income-hero {
      background: #1a2b4a;
      border-radius: 12px;
      padding: 1.75rem 2rem;
      margin-bottom: 1.5rem;
    }
    .income-hero h2 { color: #fff; font-size: 1.3rem; font-weight: 600; margin: 0 0 0.5rem; }
    .income-hero p { color: #a8bcd4; font-size: 0.95rem; margin: 0 0 1rem; line-height: 1.6; }
    .income-hero-tags { display: flex; gap: 0.6rem; flex-wrap: wrap; }
    .income-hero-tag { background: rgba(255,255,255,0.1); color: #c8d8ea; font-size: 0.8rem; padding: 4px 12px; border-radius: 20px; border: 0.5px solid rgba(255,255,255,0.2); }

    .income-filter-row { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
    .income-filter-row label { font-size: 0.9rem; color: #555; font-weight: 600; }
    .income-filter-row select { padding: 0.45rem 0.8rem; border: 1px solid #ccc; border-radius: 8px; background: #fff; font-size: 0.9rem; }

    .income-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.9rem;
      margin-bottom: 1.5rem;
    }
    @media (max-width: 700px) { .income-grid { grid-template-columns: 1fr; } }

    .income-card { background: #fff; border: 1px solid #e3e3e3; border-top: 3px solid #1a2b4a; border-radius: 12px; padding: 1rem 1.25rem; }
    .income-card h4 { margin: 0 0 0.4rem; font-size: 0.85rem; color: #666; font-weight: 500; }
    .income-card .value { font-size: 1.5rem; font-weight: 700; color: #c8963e; }
    .income-card .value-unit { font-size: 0.9rem; font-weight: 400; color: #888; }

    .income-section-title { font-size: 1rem; font-weight: 600; color: #1a2b4a; margin: 1.5rem 0 0.75rem; padding-left: 10px; border-left: 3px solid #1a2b4a; }
    .income-section { margin-top: 1.5rem; }
    .income-chart { width: 100%; min-height: 430px; margin-top: 0.75rem; }

    .income-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid #e0e0e0; }
    .income-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    .income-table thead tr { background: #1a2b4a; }
    .income-table th { color: #fff; padding: 10px 12px; text-align: left; font-weight: 500; }
    .income-table td { padding: 9px 12px; border-bottom: 1px solid #f0f0f0; color: #333; }
    .income-table tbody tr:nth-child(even) td { background: #f7f9fc; }
    .income-table tbody tr:last-child td { border-bottom: none; }
    .income-table tbody tr:hover td { background: #eef2f8; }

    .income-info-note { background: #e8f0fb; border: 1px solid #b5d4f4; border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.85rem; color: #185fa5; margin-top: 0.75rem; }

    .income-analysis-box { background: #f7f9fc; border: 1px solid #e0e8f4; border-radius: 10px; padding: 1.25rem 1.5rem; margin-top: 1rem; }
    .income-analysis-box h3 { color: #1a2b4a; font-size: 1rem; font-weight: 600; margin: 0 0 0.5rem; }
    .income-analysis-box p, .income-analysis-box li { font-size: 0.92rem; color: #444; line-height: 1.7; }
    .income-corr-value { display: inline-block; background: #1a2b4a; color: #fff; font-size: 0.85rem; padding: 2px 10px; border-radius: 20px; margin-left: 6px; }

    .lan-chart-wrap { background: #fff; border: 1px solid #e0e0e0; border-radius: 12px; padding: 1.5rem; margin-top: 0.75rem; }
    .lan-bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .lan-bar-label { font-size: 12px; color: #444; width: 180px; flex-shrink: 0; text-align: right; }
    .lan-bar-track { flex: 1; height: 22px; background: #f0f0f0; border-radius: 4px; overflow: hidden; }
    .lan-bar-pos { height: 100%; border-radius: 4px; background: #1a2b4a; }
    .lan-bar-neg { height: 100%; border-radius: 4px; background: #c8963e; }
    .lan-bar-value { font-size: 11px; color: #555; width: 55px; flex-shrink: 0; }
    .lan-badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; flex-shrink: 0; }
    .lan-badge-high { background: #faeeda; color: #854f0b; }
    .lan-badge-mid { background: #e8f0fb; color: #185fa5; }
    .lan-badge-low { background: #eaf3de; color: #3b6d11; }
    .lan-legend { display: flex; gap: 1.5rem; margin-bottom: 1rem; font-size: 12px; color: #555; flex-wrap: wrap; }
    .lan-legend-dot { width: 12px; height: 12px; border-radius: 2px; display: inline-block; margin-right: 4px; vertical-align: middle; }
  `;
  document.head.appendChild(style);
}

function renderTable(data) {
  const preview = data.slice(0, 10);
  return `
    <div class="income-table-wrap">
      <table class="income-table">
        <thead>
          <tr>
            <th>Kommun</th>
            <th>Län</th>
            <th>Inkomst 2018 (tkr)</th>
            <th>Inkomst 2022 (tkr)</th>
            <th>Arbetslöshet 2018 (länsnivå)</th>
            <th>Arbetslöshet 2022 (länsnivå)</th>
            <th>Förändring i röster (2018→2022)</th>
          </tr>
        </thead>
        <tbody>
          ${preview.map(row => `
            <tr>
              <td>${escapeHtml(row.kommun)}</td>
              <td>${escapeHtml(row.lan ?? "")}</td>
              <td>${formatNumber(row.inkomst_2018, 1)} tkr</td>
              <td>${formatNumber(row.inkomst_2022, 1)} tkr</td>
              <td>${row.arbetsloshet_2018 === null ? "saknas" : formatPercent(row.arbetsloshet_2018, 1)}</td>
              <td>${row.arbetsloshet_2022 === null ? "saknas" : formatPercent(row.arbetsloshet_2022, 1)}</td>
              <td>${formatNumber(row.voteChange, 2)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    <div class="income-info-note">
      ℹ️ Arbetslöshetsdata är tillgänglig på <strong>länsnivå</strong> och har kopplats till kommuner via en mapping-tabell. Alla kommuner inom samma län delar därför samma arbetslöshetsvärde. Förändring i röster avser skillnaden i antal röster för riksdagsvalet mellan 2018 och 2022.
    </div>
  `;
}

function renderLanChart(data) {
  const lanData = buildLanData(data);
  if (!lanData.length) return "<p>Inte tillräckligt med data för att visa diagrammet.</p>";

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

function drawScatterChart(containerId, data, xKey, yKey, title, xTitle, yTitle) {
  if (!window.google?.visualization) return;
  const chartData = [[xTitle, yTitle]];
  data.forEach(row => {
    const x = toNumber(row[xKey]);
    const y = toNumber(row[yKey]);
    if (x !== null && y !== null) chartData.push([x, y]);
  });
  if (chartData.length <= 1) {
    document.getElementById(containerId).innerHTML = "<p>Det finns inte tillräckligt med data för att rita detta diagram.</p>";
    return;
  }
  const dataTable = google.visualization.arrayToDataTable(chartData);
  const chart = new google.visualization.ScatterChart(document.getElementById(containerId));
  chart.draw(dataTable, {
    title, hAxis: { title: xTitle }, vAxis: { title: yTitle },
    legend: "none",
    trendlines: { 0: { color: "#c8963e", lineWidth: 2 } },
    colors: ["#1a2b4a"],
    chartArea: { left: 70, top: 50, width: "75%", height: "68%" }
  });
}

function drawColumnChart(containerId, lowAvg, highAvg, title, lowLabel, highLabel) {
  if (!window.google?.visualization) return;
  if (lowAvg === null || highAvg === null) {
    document.getElementById(containerId).innerHTML = "<p>Det finns inte tillräckligt med data för att rita detta diagram.</p>";
    return;
  }
  const dataTable = google.visualization.arrayToDataTable([
    ["Grupp", "Genomsnittlig förändring i röster"],
    [lowLabel, lowAvg],
    [highLabel, highAvg]
  ]);
  const chart = new google.visualization.ColumnChart(document.getElementById(containerId));
  chart.draw(dataTable, {
    title, legend: "none",
    colors: ["#1a2b4a"],
    hAxis: { title: "Grupp" }, vAxis: { title: "Genomsnittlig förändring i röster" },
    chartArea: { left: 70, top: 50, width: "75%", height: "68%" }
  });
}

function createAnalysisText({ incomeCorr, unemploymentCorr, selectedGender }) {
  const genderLabel = selectedGender === "kvinnor" ? "kvinnor" : selectedGender === "män" ? "män" : "totalt";
  const incomeStrength = correlationLabel(incomeCorr);
  const unemploymentStrength = correlationLabel(unemploymentCorr);
  return `
    <div class="income-analysis-box">
      <h3>Korrelationsanalys</h3>
      <p>
        <strong>Inkomst och förändring i röster:</strong>
        <span class="income-corr-value">${incomeCorr === null ? "saknas" : formatNumber(incomeCorr, 3)}</span>
        — ${incomeStrength} samband
      </p>
      <p>
        <strong>Arbetslöshet (länsnivå) och förändring i röster:</strong>
        <span class="income-corr-value">${unemploymentCorr === null ? "saknas" : formatNumber(unemploymentCorr, 3)}</span>
        — ${unemploymentStrength} samband
      </p>
      <p>Korrelationskoefficienten visar hur starkt två variabler samvarierar. Ett värde nära 0 tyder på svagt samband medan värden närmare 1 eller -1 tyder på starkare samband. Korrelation visar dock inte orsakssamband.</p>
    </div>

    <div class="income-analysis-box" style="margin-top: 1rem;">
      <h3>Analys</h3>
      <p>För gruppen <strong>${genderLabel}</strong> visar resultaten ett <strong>${incomeStrength}</strong> samband mellan inkomst och förändring i röster. Det betyder att ekonomiska skillnader kan ha betydelse, men att variationen mellan kommunerna också tyder på att fler faktorer påverkar utvecklingen.</p>
      <p>Sambandet mellan arbetslöshet och förändring i röster framstår som <strong>${unemploymentStrength}</strong>. Eftersom arbetslöshetsdata finns på länsnivå fångas inte variation inom län fullt ut. Länsstapeldiagrammet ovan ger en mer nyanserad bild av hur länen med hög respektive låg arbetslöshet förändrats.</p>
      <p>Ekonomi verkar spela en roll, men väljarbeteende påverkas sannolikt också av ålder, migration, geografi och lokala förutsättningar.</p>
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
  ensureStyles();

  const allMerged = mergeData();
  const root = getRootContainer();

  root.innerHTML = `
    <div class="income-hero">
      <h2>Inkomst och arbetslöshet vs förändring i valresultat</h2>
      <p>Kan ekonomiska faktorer förklara hur valresultatet förändrades mellan 2018 och 2022?</p>
      <div class="income-hero-tags">
        <span class="income-hero-tag">287 kommuner</span>
        <span class="income-hero-tag">Riksdagsvalet 2018–2022</span>
        <span class="income-hero-tag">Inkomst + Arbetslöshet</span>
      </div>
    </div>

    <div class="income-filter-row">
      <label for="genderFilter">Filtrera på kön:</label>
      <select id="genderFilter">
        <option value="totalt">Totalt</option>
        <option value="kvinnor">Kvinnor</option>
        <option value="män">Män</option>
      </select>
    </div>

    <div id="income-dynamic-content"></div>
  `;

  const genderFilter = document.getElementById("genderFilter");
  const dynamicContent = document.getElementById("income-dynamic-content");

  function render(selectedGender = "totalt") {
    let filtered = allMerged.filter(row => normalizeGender(row.kon) === selectedGender);
    if (!filtered.length && selectedGender !== "totalt") {
      filtered = allMerged.filter(row => normalizeGender(row.kon) === "totalt");
    }

    const avgIncome2018 = average(filtered.map(d => d.inkomst_2018));
    const avgIncome2022 = average(filtered.map(d => d.inkomst_2022));
    const avgUnemployment2018 = average(filtered.map(d => d.arbetsloshet_2018));
    const avgUnemployment2022 = average(filtered.map(d => d.arbetsloshet_2022));
    const avgVoteChange = average(filtered.map(d => d.voteChange));
    const incomeCorr = correlation(filtered, "inkomst_2022", "voteChange");
    const unemploymentCorr = correlation(filtered, "arbetsloshet_2022", "voteChange");
    const incomeGroups = splitLowHigh(filtered, "inkomst_2022");
    const lowIncomeAvgVote = average(incomeGroups.low.map(d => d.voteChange));
    const highIncomeAvgVote = average(incomeGroups.high.map(d => d.voteChange));

    dynamicContent.innerHTML = `
      <div class="income-section">
        <p>Analysen baseras på kommunnivå och kombinerar valdata med ekonomisk data för 2018 och 2022. Förvald vy är <strong>totalt</strong>, men analysen kan filtreras på kvinnor och män.</p>
      </div>

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
          <div class="value">${formatNumber(avgVoteChange, 2)}</div>
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

      <p class="income-section-title">Datapreview</p>
      <p style="font-size:0.9rem;color:#555;">Här visas de första 10 raderna från det sammanslagna datasetet.</p>
      ${renderTable(filtered)}

      <p class="income-section-title">Samband mellan inkomst och förändring i röster</p>
      <p style="font-size:0.9rem;color:#555;">Diagrammet visar om kommuner med högre inkomstnivå 2022 tenderar att ha en annan förändring i röster.</p>
      <div id="incomeScatterChart" class="income-chart"></div>

      <p class="income-section-title">Jämförelse mellan låg och hög inkomst</p>
      <p style="font-size:0.9rem;color:#555;">Kommunerna delas upp i två grupper utifrån inkomstnivå 2022.</p>
      <div id="incomeGroupChart" class="income-chart"></div>

      <p class="income-section-title">Förändring i röster per län - sorterat efter arbetslöshet</p>
      <p style="font-size:0.9rem;color:#555;">Varje stapel visar genomsnittlig förändring i röster per län. Länens arbetslöshetsnivå visas som badge till höger.</p>
      ${renderLanChart(filtered)}

      ${createAnalysisText({ incomeCorr, unemploymentCorr, selectedGender })}
    `;

    drawScatterChart("incomeScatterChart", filtered, "inkomst_2022", "voteChange", "Inkomst 2022 vs förändring i röster", "Inkomst 2022 (tkr)", "Förändring i röster");
    drawColumnChart("incomeGroupChart", lowIncomeAvgVote, highIncomeAvgVote, "Låg vs hög inkomst", "Låg inkomst", "Hög inkomst");
  }

  genderFilter.addEventListener("change", () => {
    sessionStorage.setItem("selectedGender", genderFilter.value);
    render(genderFilter.value);
  });

  function startRender() {
    const savedGender = sessionStorage.getItem("selectedGender") || "totalt";
    genderFilter.value = savedGender;
    render(savedGender);
  }

  if (window.google?.charts) {
    google.charts.load("current", { packages: ["corechart"] });
    google.charts.setOnLoadCallback(startRender);
  } else {
    dynamicContent.innerHTML = `
      <div class="income-info-note">
        Google Charts verkar inte vara laddat. Kontrollera projektmallen.
      </div>
    `;
  }
}
