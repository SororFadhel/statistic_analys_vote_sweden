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

  const cleaned = String(value)
    .replace(/\s/g, "")
    .replace(",", ".");

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

  const numerator = x.reduce((sum, xi, i) => {
    return sum + (xi - meanX) * (y[i] - meanY);
  }, 0);

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
    const kommun =
      row.kommun ||
      row.Kommun ||
      row.name ||
      row.kommunnamn ||
      row.municipality;

    if (!kommun) continue;

    const roster2018 = getElectionValue(row, [
      "roster2018",
      "votes2018",
      "vote2018",
      "result2018",
      "andel2018",
      "share2018"
    ]);

    const roster2022 = getElectionValue(row, [
      "roster2022",
      "votes2022",
      "vote2022",
      "result2022",
      "andel2022",
      "share2022"
    ]);

    map.set(normalizeText(kommun), {
      kommun,
      roster2018,
      roster2022,
      voteChange:
        roster2018 !== null && roster2022 !== null
          ? roster2022 - roster2018
          : null
    });
  }

  return map;
}

function buildLanKommunMap(rows) {
  const map = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const kommunKod = String(row.kommunKod ?? "").trim();
    const lan = row.lan ?? null;
    const kommun = row.kommun ?? null;

    if (!kommunKod || !lan) continue;

    map.set(kommunKod, {
      lan,
      kommun
    });
  }

  return map;
}

function buildUnemploymentMap(rows) {
  const map = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const lan = row.region ?? row.lan ?? null;
    const kon = normalizeGender(row.kon);
    const ar = toNumber(row.ar);
    const arbetsloshet = toNumber(row.arbetsloshet);

    if (!lan || !kon || ar === null || arbetsloshet === null) continue;

    map.set(`${normalizeText(lan)}__${kon}__${ar}`, arbetsloshet);
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
      map.set(key, {
        kommun,
        kon,
        lan,
        inkomst_2018: null,
        inkomst_2022: null,
        arbetsloshet_2018: null,
        arbetsloshet_2022: null
      });
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
      inkomst_forandring:
        item.inkomst_2018 !== null && item.inkomst_2022 !== null
          ? item.inkomst_2022 - item.inkomst_2018
          : null,
      arbetsloshet_forandring:
        item.arbetsloshet_2018 !== null && item.arbetsloshet_2022 !== null
          ? item.arbetsloshet_2022 - item.arbetsloshet_2018
          : null,
      roster2018: election.roster2018,
      roster2022: election.roster2022,
      voteChange: election.voteChange
    });
  }

  return merged;
}

function splitLowHigh(data, key) {
  const valid = data
    .filter(d => toNumber(d[key]) !== null)
    .sort((a, b) => toNumber(a[key]) - toNumber(b[key]));

  const mid = Math.floor(valid.length / 2);

  return {
    low: valid.slice(0, mid),
    high: valid.slice(mid)
  };
}

function getRootContainer() {
  let root = document.getElementById("income-analysis-root");

  if (!root) {
    root = document.createElement("div");
    root.id = "income-analysis-root";

    const target =
      document.querySelector("main") ||
      document.querySelector("#content") ||
      document.body;

    target.appendChild(root);
  }

  return root;
}

function ensureStyles() {
  if (document.getElementById("income-analysis-styles")) return;

  const style = document.createElement("style");
  style.id = "income-analysis-styles";
  style.textContent = `
    #income-analysis-root {
      margin-top: 1rem;
    }

    .income-topbar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      flex-wrap: wrap;
      margin-bottom: 1rem;
    }

    .income-filter-box {
      min-width: 220px;
      text-align: right;
    }

    .income-filter-box label {
      display: block;
      font-weight: 600;
      margin-bottom: 0.35rem;
    }

    .income-filter-box select {
      width: 100%;
      max-width: 220px;
      padding: 0.45rem 0.6rem;
      border: 1px solid #ccc;
      border-radius: 8px;
      background: #fff;
    }

    .income-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 0.9rem;
      margin: 1rem 0 1.25rem 0;
    }

    .income-card {
      border: 1px solid #e3e3e3;
      border-radius: 12px;
      padding: 1rem;
      background: #fafafa;
    }

    .income-card h4 {
      margin: 0 0 0.4rem 0;
      font-size: 0.95rem;
    }

    .income-card .value {
      font-size: 1.35rem;
      font-weight: 700;
    }

    .income-section {
      margin-top: 1.5rem;
    }

    .income-chart {
      width: 100%;
      min-height: 430px;
      margin-top: 0.75rem;
    }

    .income-table-wrap {
      overflow-x: auto;
      margin-top: 0.75rem;
    }

    .income-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.95rem;
    }

    .income-table th,
    .income-table td {
      border: 1px solid #ddd;
      padding: 0.55rem 0.65rem;
      text-align: left;
    }

    .income-table th {
      background: #f3f3f3;
    }

    .income-note {
      background: #fff8e6;
      border: 1px solid #f0d98c;
      padding: 0.9rem 1rem;
      border-radius: 10px;
      margin-top: 1rem;
    }
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
            <th>Inkomst 2018</th>
            <th>Inkomst 2022</th>
            <th>Arbetslöshet 2018</th>
            <th>Arbetslöshet 2022</th>
            <th>Förändring i valresultat</th>
          </tr>
        </thead>
        <tbody>
          ${preview.map(row => `
            <tr>
              <td>${escapeHtml(row.kommun)}</td>
              <td>${escapeHtml(row.lan ?? "")}</td>
              <td>${formatNumber(row.inkomst_2018, 1)}</td>
              <td>${formatNumber(row.inkomst_2022, 1)}</td>
              <td>${row.arbetsloshet_2018 === null ? "saknas" : formatPercent(row.arbetsloshet_2018, 1)}</td>
              <td>${row.arbetsloshet_2022 === null ? "saknas" : formatPercent(row.arbetsloshet_2022, 1)}</td>
              <td>${formatNumber(row.voteChange, 2)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function drawScatterChart(containerId, data, xKey, yKey, title, xTitle, yTitle) {
  if (!window.google?.visualization) return;

  const chartData = [[xTitle, yTitle]];

  data.forEach(row => {
    const x = toNumber(row[xKey]);
    const y = toNumber(row[yKey]);

    if (x !== null && y !== null) {
      chartData.push([x, y]);
    }
  });

  if (chartData.length <= 1) {
    document.getElementById(containerId).innerHTML = "<p>Det finns inte tillräckligt med data för att rita detta diagram.</p>";
    return;
  }

  const dataTable = google.visualization.arrayToDataTable(chartData);
  const chart = new google.visualization.ScatterChart(document.getElementById(containerId));

  chart.draw(dataTable, {
    title,
    hAxis: { title: xTitle },
    vAxis: { title: yTitle },
    legend: "none",
    trendlines: { 0: {} },
    chartArea: {
      left: 70,
      top: 50,
      width: "75%",
      height: "68%"
    }
  });
}

function drawColumnChart(containerId, lowAvg, highAvg, title, lowLabel, highLabel) {
  if (!window.google?.visualization) return;

  if (lowAvg === null || highAvg === null) {
    document.getElementById(containerId).innerHTML = "<p>Det finns inte tillräckligt med data för att rita detta diagram.</p>";
    return;
  }

  const dataTable = google.visualization.arrayToDataTable([
    ["Grupp", "Genomsnittlig förändring i valresultat"],
    [lowLabel, lowAvg],
    [highLabel, highAvg]
  ]);

  const chart = new google.visualization.ColumnChart(document.getElementById(containerId));
  chart.draw(dataTable, {
    title,
    legend: "none",
    hAxis: { title: "Grupp" },
    vAxis: { title: "Genomsnittlig förändring i valresultat" },
    chartArea: {
      left: 70,
      top: 50,
      width: "75%",
      height: "68%"
    }
  });
}

function createAnalysisText({
  incomeCorr,
  unemploymentCorr,
  selectedGender
}) {
  const genderLabel =
    selectedGender === "kvinnor" ? "kvinnor" :
      selectedGender === "män" ? "män" :
        "totalt";

  const incomeStrength = correlationLabel(incomeCorr);
  const unemploymentStrength = correlationLabel(unemploymentCorr);

  return `
    <div class="income-section">
      <h2>Korrelationsanalys</h2>
      <p><strong>Inkomst och förändring i valresultat:</strong> ${incomeCorr === null ? "kan inte beräknas" : `${formatNumber(incomeCorr, 3)} (${incomeStrength} samband)`
    }</p>
      <p><strong>Arbetslöshet och förändring i valresultat:</strong> ${unemploymentCorr === null ? "kan inte beräknas" : `${formatNumber(unemploymentCorr, 3)} (${unemploymentStrength} samband)`
    }</p>
      <p>
        Korrelationskoefficienten visar hur starkt två variabler samvarierar.
        Ett värde nära 0 tyder på svagt samband medan värden närmare 1 eller -1 tyder på starkare samband.
        Korrelation visar dock inte orsakssamband.
      </p>
    </div>

    <div class="income-section">
      <h2>Analys</h2>
      <p>
        För gruppen <strong>${genderLabel}</strong> visar resultaten ett <strong>${incomeStrength}</strong> samband
        mellan inkomst och förändring i valresultat. Det betyder att ekonomiska skillnader kan ha betydelse,
        men att variationen mellan kommunerna också tyder på att fler faktorer påverkar utvecklingen.
      </p>
      <p>
        Sambandet mellan arbetslöshet och förändring i valresultat framstår som <strong>${unemploymentStrength}</strong>.
        Eftersom arbetslöshetsdata finns på länsnivå och har kopplats till kommuner via en mapping-tabell
        fångas inte variation inom län fullt ut.
      </p>
      <p>
        Resultaten bör därför tolkas försiktigt. Ekonomi verkar spela en roll, men väljarbeteende påverkas
        sannolikt också av till exempel ålder, migration, geografi och lokala förutsättningar.
      </p>
    </div>

    <div class="income-section">
      <h2>Begränsningar</h2>
      <ul>
        <li>Analysen bygger på korrelation och kan därför inte fastställa orsakssamband.</li>
        <li>Arbetslöshetsdata finns på länsnivå och har tilldelats kommuner via mapping.</li>
        <li>Andra variabler som inte ingår här kan också påverka förändringar i valresultat.</li>
      </ul>
    </div>

    <div class="income-section">
      <h2>Slutsats</h2>
      <p>
        Ekonomiska faktorer som inkomst och arbetslöshet verkar ha en viss koppling till förändringar i valresultatet mellan 2018 och 2022.
        Sambanden är dock inte tillräckligt starka för att ensamma förklara utvecklingen.
        Slutsatsen är därför att ekonomi spelar en roll, men att flera faktorer tillsammans påverkar hur valmönster förändras.
      </p>
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
    <div class="income-topbar">
      <div>
        <h2> Frågeställning</h2>
        <p>Kan ekonomiska faktorer som inkomst och arbetslöshet förklara förändringar i valresultatet mellan 2018 och 2022?</p>

        <h2> Varför är detta viktigt?</h2>
        <p>Ekonomiska förhållanden påverkar ofta politiska preferenser. Här undersöker vi om skillnader i inkomst och arbetslöshet mellan kommuner hänger ihop med hur valresultatet förändrats över tid.</p>
      </div>

      <div class="income-filter-box">
        <label for="genderFilter">Kön</label>
        <select id="genderFilter">
          <option value="totalt" selected>Totalt</option>
          <option value="kvinnor">Kvinnor</option>
          <option value="män">Män</option>
        </select>
      </div>
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
        <h2>Databeskrivning</h2>
        <p>
          Analysen baseras på kommunnivå och kombinerar valdata med ekonomisk data för 2018 och 2022.
          Förvald vy är <strong>totalt</strong>, men analysen kan filtreras på kvinnor och män.
        </p>
      </div>

      <div class="income-grid">
        <div class="income-card">
          <h4>Antal kommuner i analysen</h4>
          <div class="value">${filtered.length}</div>
        </div>
        <div class="income-card">
          <h4>Genomsnittlig inkomst 2018</h4>
          <div class="value">${formatNumber(avgIncome2018, 1)}</div>
        </div>
        <div class="income-card">
          <h4>Genomsnittlig inkomst 2022</h4>
          <div class="value">${formatNumber(avgIncome2022, 1)}</div>
        </div>
        <div class="income-card">
          <h4>Genomsnittlig förändring i valresultat</h4>
          <div class="value">${formatNumber(avgVoteChange, 2)}</div>
        </div>
        <div class="income-card">
          <h4>Genomsnittlig arbetslöshet 2018</h4>
          <div class="value">${formatPercent(avgUnemployment2018, 1)}</div>
        </div>
        <div class="income-card">
          <h4>Genomsnittlig arbetslöshet 2022</h4>
          <div class="value">${formatPercent(avgUnemployment2022, 1)}</div>
        </div>
      </div>

      <div class="income-section">
        <h2>Datapreview</h2>
        <p>Här visas de första 10 raderna från det sammanslagna datasetet.</p>
        ${renderTable(filtered)}
      </div>

      <div class="income-section">
        <h2>Samband mellan inkomst och förändring i valresultat</h2>
        <p>Diagrammet visar om kommuner med högre inkomstnivå 2022 också tenderar att ha en annan förändring i valresultatet mellan 2018 och 2022.</p>
        <div id="incomeScatterChart" class="income-chart"></div>
      </div>

      <div class="income-section">
        <h2>Jämförelse mellan låg och hög inkomst</h2>
        <p>Kommunerna delas här upp i två grupper utifrån inkomstnivå 2022 för att tydligare jämföra genomsnittlig förändring i valresultat.</p>
        <div id="incomeGroupChart" class="income-chart"></div>
      </div>

      <div class="income-section">
        <h2>Samband mellan arbetslöshet och förändring i valresultat</h2>
        <p>Här undersöks om länsbaserad arbetslöshet, kopplad till kommuner via mapping, samvarierar med förändringar i valresultatet.</p>
        <div id="unemploymentScatterChart" class="income-chart"></div>
      </div>

      ${createAnalysisText({
      incomeCorr,
      unemploymentCorr,
      selectedGender
    })}
    `;

    drawScatterChart(
      "incomeScatterChart",
      filtered,
      "inkomst_2022",
      "voteChange",
      "Inkomst 2022 vs förändring i valresultat",
      "Inkomst 2022",
      "Förändring i valresultat"
    );

    drawColumnChart(
      "incomeGroupChart",
      lowIncomeAvgVote,
      highIncomeAvgVote,
      "Låg vs hög inkomst",
      "Låg inkomst",
      "Hög inkomst"
    );

    drawScatterChart(
      "unemploymentScatterChart",
      filtered,
      "arbetsloshet_2022",
      "voteChange",
      "Arbetslöshet 2022 vs förändring i valresultat",
      "Arbetslöshet 2022",
      "Förändring i valresultat"
    );
  }

  function startRender() {
    render("totalt");

    genderFilter.addEventListener("change", () => {
      render(genderFilter.value);
    });
  }

  if (window.google?.charts) {
    google.charts.load("current", { packages: ["corechart"] });
    google.charts.setOnLoadCallback(startRender);
  } else {
    dynamicContent.innerHTML = `
      <div class="income-note">
        Google Charts verkar inte vara laddat. Kontrollera projektmallen.
      </div>
    `;
  }
}