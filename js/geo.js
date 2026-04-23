import dbInfoOk, { displayDbNotOkText } from "./helpers/dbInfoOk.js";
import { valdataKommun, geoData } from "./helpers/dataLoader.js";
import { average, correlation, sortByNumeric } from "./helpers/utils.js";

// ===============================
// Hjälpfunktioner
// ===============================

function toNum(v) {
  if (v === null || v === undefined) return 0;
  const cleaned = String(v).replace(/\s/g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function safeText(v) {
  return v == null ? "" : String(v);
}

function normalizeName(str) {
  return safeText(str)
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*kommuns?\s*$/i, "")
    .replace(/\s*stad\s*$/i, "")
    .replace(/\s*municipality\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getRoot() {
  return (
    document.querySelector("main") ||
    document.querySelector("#content") ||
    document.querySelector(".content") ||
    document.body
  );
}

function clearElement(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function addHtml(parent, html) {
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  parent.appendChild(wrap);
}

function createTable(parent, rows) {
  if (!rows.length) {
    const p = document.createElement("p");
    p.textContent = "Ingen data att visa.";
    parent.appendChild(p);
    return;
  }

  const table = document.createElement("table");
  table.style.cssText = "width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px;";

  const columns = Object.keys(rows[0]);

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  columns.forEach(col => {
    const th = document.createElement("th");
    th.textContent = col;
    th.style.cssText = "text-align:left;border-bottom:2px solid #666;padding:8px;background:#f5f5f5;";
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach((row, i) => {
    const tr = document.createElement("tr");
    tr.style.background = i % 2 === 0 ? "#fff" : "#fafafa";
    columns.forEach(col => {
      const td = document.createElement("td");
      td.textContent = row[col];
      td.style.cssText = "padding:8px;border-bottom:1px solid #ddd;";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  parent.appendChild(table);
}

function createChartContainer(parent, titleText) {
  const wrap = document.createElement("div");
  wrap.style.marginBottom = "28px";

  const h3 = document.createElement("h3");
  h3.textContent = titleText;
  wrap.appendChild(h3);

  const chartDiv = document.createElement("div");
  chartDiv.style.cssText = "width:100%;min-height:420px;";
  wrap.appendChild(chartDiv);

  parent.appendChild(wrap);
  return chartDiv;
}

function drawScatterChart(el, rows, title, xLabel, yLabel) {
  if (!window.google || !google.visualization) {
    el.textContent = "Google Charts kunde inte laddas.";
    return;
  }
  const dataTable = google.visualization.arrayToDataTable([
    [xLabel, yLabel],
    ...rows
  ]);
  const chart = new google.visualization.ScatterChart(el);
  chart.draw(dataTable, {
    title,
    hAxis: { title: xLabel },
    vAxis: { title: yLabel },
    trendlines: { 0: { color: "red", lineWidth: 2, opacity: 0.8 } },
    legend: "none",
    height: 420
  });
}

function drawColumnChart(el, rows, title) {
  if (!window.google || !google.visualization) {
    el.textContent = "Google Charts kunde inte laddas.";
    return;
  }
  const dataTable = google.visualization.arrayToDataTable(rows);
  const chart = new google.visualization.ColumnChart(el);
  chart.draw(dataTable, {
    title,
    height: 420,
    legend: { position: "top" },
    colors: ["#1a73e8"]
  });
}

function interpretationText(r) {
  if (!Number.isFinite(r)) return "Kunde inte beräknas";
  if (Math.abs(r) > 0.5) return "Starkt samband";
  if (Math.abs(r) > 0.2) return "Måttligt samband";
  return "Svagt samband";
}

function shortDirectionText(r) {
  if (!Number.isFinite(r)) return "oklart samband";
  if (r > 0.2) return "positivt samband";
  if (r < -0.2) return "negativt samband";
  return "svagt eller inget tydligt samband";
}

// ===============================
// Bygg data
// ===============================

function buildData() {
  const rows = Array.isArray(valdataKommun) ? valdataKommun : [];
  const geoRows = Array.isArray(geoData) ? geoData : [];

  // Bygg geo-karta med alla möjliga namnfält
  const geoMap = new Map();
  for (const g of geoRows) {
    const lat = Number(g.latitude);
    if (!Number.isFinite(lat) || lat === 0) continue;
    const candidates = [g.municipality, g.Locality, g.county, g.name, g.kommun];
    for (const c of candidates) {
      const key = normalizeName(c || "");
      if (key && !geoMap.has(key)) geoMap.set(key, lat);
    }
  }

  const merged = rows.map(r => {
    const kommun = safeText(r["Kommunnamn"] || "");
    const latitude = geoMap.get(normalizeName(kommun)) ?? null;

    const density2018 = toNum(r["Befolkningstäthet_2018"]);
    const density2022 = toNum(r["Befolkningstäthet_2022"]);
    const densityChange = density2022 - density2018;

    const total18 =
      toNum(r["Arbetarepartiet-Socialdemokraterna_2018"]) +
      toNum(r["Centerpartiet_2018"]) +
      toNum(r["Kristdemokraterna_2018"]) +
      toNum(r["Liberalerna (tidigare Folkpartiet)_2018"]) +
      toNum(r["Miljöpartiet de gröna_2018"]) +
      toNum(r["Moderaterna_2018"]) +
      toNum(r["Sverigedemokraterna_2018"]) +
      toNum(r["Vänsterpartiet_2018"]);

    const total22 =
      toNum(r["Arbetarepartiet-Socialdemokraterna_2022"]) +
      toNum(r["Centerpartiet_2022"]) +
      toNum(r["Kristdemokraterna_2022"]) +
      toNum(r["Liberalerna (tidigare Folkpartiet)_2022"]) +
      toNum(r["Miljöpartiet de gröna_2022"]) +
      toNum(r["Moderaterna_2022"]) +
      toNum(r["Sverigedemokraterna_2022"]) +
      toNum(r["Vänsterpartiet_2022"]);

    const right18 =
      toNum(r["Moderaterna_2018"]) +
      toNum(r["Kristdemokraterna_2018"]) +
      toNum(r["Liberalerna (tidigare Folkpartiet)_2018"]) +
      toNum(r["Sverigedemokraterna_2018"]);

    const right22 =
      toNum(r["Moderaterna_2022"]) +
      toNum(r["Kristdemokraterna_2022"]) +
      toNum(r["Liberalerna (tidigare Folkpartiet)_2022"]) +
      toNum(r["Sverigedemokraterna_2022"]);

    const voteChange =
      total18 > 0 && total22 > 0
        ? ((right22 / total22) - (right18 / total18)) * 100
        : 0;

    // SD:s förändring i andel (procentenheter)
    const sd18 = total18 > 0 ? (toNum(r["Sverigedemokraterna_2018"]) / total18) * 100 : 0;
    const sd22 = total22 > 0 ? (toNum(r["Sverigedemokraterna_2022"]) / total22) * 100 : 0;
    const sdChange = Number((sd22 - sd18).toFixed(2));

    return {
      kommun,
      valkrets: safeText(r["Riksdagsvalkrets"] || ""),
      density2018,
      density2022,
      densityChange: Number(densityChange.toFixed(2)),
      latitude,
      voteChange: Number(voteChange.toFixed(2)),
      sdChange
    };
  }).filter(d => d.kommun && d.density2022 > 0);

  // Regionindelning baserad på latitud
  const withLatitude = merged.filter(d => Number.isFinite(d.latitude));

  if (withLatitude.length >= 9) {
    const sortedGeo = [...withLatitude].sort((a, b) => b.latitude - a.latitude);
    const size = Math.floor(sortedGeo.length / 3);
    const northSet = new Set(sortedGeo.slice(0, size).map(d => d.kommun));
    const middleSet = new Set(sortedGeo.slice(size, size * 2).map(d => d.kommun));

    return merged.map(d => ({
      ...d,
      region: northSet.has(d.kommun)
        ? "Norr"
        : middleSet.has(d.kommun)
          ? "Mitten"
          : Number.isFinite(d.latitude) ? "Söder" : null
    }));
  }

  return merged.map(d => ({ ...d, region: null }));
}

// ===============================
// Rendera sidan
// ===============================

function renderPage(data) {
  const root = getRoot();

  // Statisk sektion – ritas bara en gång
  if (!document.getElementById("geo-static")) {
    const staticSection = document.createElement("section");
    staticSection.id = "geo-static";
    staticSection.innerHTML = `
      <h1>🗺️ Geografi och förändring i valresultat</h1>
      <h2>🎯 Frågeställning</h2>
      <p>Kan geografiska faktorer – befolkningstäthet och region (norr/mitten/söder) –
      förklara förändringar i högerblockets röstandel mellan riksdagsvalen 2018 och 2022?</p>
      <h2>🧠 Varför är detta viktigt?</h2>
      <p>Var människor bor påverkar tillgång till arbete, service, utbildning och vilka politiska
      frågor som upplevs som viktigast. Glesbefolkade kommuner och storstäder har olika
      förutsättningar – och kanske också olika politisk utveckling.</p>
    `;
    root.appendChild(staticSection);
  }

  // Dynamisk sektion
  const hasRegionData = data.some(d => d.region);

  const allSorted = [...data].sort((a, b) => a.density2022 - b.density2022);
  const allMid = Math.floor(allSorted.length / 2);
  const allLow = allSorted.slice(0, allMid);
  const allHigh = allSorted.slice(allMid);
  const allNorth = data.filter(d => d.region === "Norr");
  const allMiddle = data.filter(d => d.region === "Mitten");
  const allSouth = data.filter(d => d.region === "Söder");

  // Dropdown – skapas bara en gång
  let controlsSection = document.getElementById("geo-controls");
  let select;
  if (!controlsSection) {
    controlsSection = document.createElement("div");
    controlsSection.id = "geo-controls";
    controlsSection.style.cssText = "margin-bottom:24px;padding:12px;background:#f0f0f0;border-radius:8px;";

    const label = document.createElement("label");
    label.textContent = "🎛️ Filtrera data: ";
    label.setAttribute("for", "geo-filter");
    label.style.cssText = "margin-right:8px;font-weight:bold;";

    select = document.createElement("select");
    select.id = "geo-filter";
    select.style.cssText = "padding:6px 12px;font-size:15px;border-radius:4px;";

    const options = [
      { value: "all", text: `Alla kommuner (${data.length})` },
      { value: "low", text: `Låg befolkningstäthet (${allLow.length})` },
      { value: "high", text: `Hög befolkningstäthet (${allHigh.length})` }
    ];
    if (hasRegionData) {
      options.push(
        { value: "north", text: `Norr (${allNorth.length})` },
        { value: "middle", text: `Mitten (${allMiddle.length})` },
        { value: "south", text: `Söder (${allSouth.length})` }
      );
    }
    options.forEach(opt => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.text;
      select.appendChild(o);
    });

    controlsSection.appendChild(label);
    controlsSection.appendChild(select);
    root.appendChild(controlsSection);
  } else {
    select = document.getElementById("geo-filter");
  }

  // Output-yta – skapas bara en gång, rensas vid omritning
  let output = document.getElementById("geo-output");
  if (!output) {
    output = document.createElement("div");
    output.id = "geo-output";
    root.appendChild(output);
  }
  clearElement(output);

  // Filterfunktion
  function filterData(type) {
    const sorted = [...data].sort((a, b) => a.density2022 - b.density2022);
    const mid = Math.floor(sorted.length / 2);
    if (type === "low") return sorted.slice(0, mid);
    if (type === "high") return sorted.slice(mid);
    if (type === "north") return data.filter(d => d.region === "Norr");
    if (type === "middle") return data.filter(d => d.region === "Mitten");
    if (type === "south") return data.filter(d => d.region === "Söder");
    return data;
  }

  // Rita allt innehåll
  function draw(selected, selectedLabel) {
    clearElement(output);

    addHtml(output, `<p><strong>Valt filter:</strong> ${selectedLabel} &nbsp;|&nbsp; <strong>Antal kommuner:</strong> ${selected.length}</p>`);

    // Tabell
    addHtml(output, `<h2>📋 Dataöversikt (topp 10 kommuner)</h2>`);
    createTable(output, selected.slice(0, 10).map(d => ({
      "Kommun": d.kommun,
      "Valkrets": d.valkrets,
      "Täthet 2018": d.density2018,
      "Täthet 2022": d.density2022,
      "Förändring täthet": d.densityChange,
      "Högerblock förändring (%)": d.voteChange,
      "Region": d.region || "-"
    })));

    // Diagram 1
    addHtml(output, `<h2>📈 Diagram 1: Befolkningstäthet 2022 och röstförändring</h2>`);
    addHtml(output, `<p>Varje punkt representerar en kommun. X-axeln visar hur tät kommunen är (invånare per km²) och Y-axeln visar hur mycket högerblockets röstandel förändrades mellan 2018 och 2022. Den röda trendlinjen visar det övergripande sambandet – lutar den nedåt betyder det att tätare kommuner tenderade att rösta <em>mindre</em> åt höger, lutar den uppåt röstade de <em>mer</em> åt höger.</p>`);
    const el1 = createChartContainer(output, "Befolkningstäthet 2022 vs förändring i högerblock (%)");
    drawScatterChart(el1, selected.map(d => [d.density2022, d.voteChange]),
      "Täthet 2022 vs Röstförändring", "Befolkningstäthet 2022 (inv/km²)", "Förändring högerblock (%)");

    // Diagram 2
    addHtml(output, `<h2>📈 Diagram 2: Befolkningstäthet 2018 och röstförändring</h2>`);
    addHtml(output, `<p>Här används kommunernas befolkningstäthet år 2018 – alltså <em>innan</em> valet – för att se om utgångsläget hängde ihop med hur röstmönstren senare förändrades. Jämför med diagram 1: ser sambandet likadant ut för 2018 som för 2022, eller finns det skillnader?</p>`);
    const el2 = createChartContainer(output, "Befolkningstäthet 2018 vs förändring i högerblock (%)");
    drawScatterChart(el2, selected.map(d => [d.density2018, d.voteChange]),
      "Täthet 2018 vs Röstförändring", "Befolkningstäthet 2018 (inv/km²)", "Förändring högerblock (%)");

    // Diagram 3
    addHtml(output, `<h2>📈 Diagram 3: Förändring i befolkningstäthet och röstförändring</h2>`);
    addHtml(output, `<p>Istället för att titta på tätheten ett visst år tittar vi här på <em>förändringen</em> i täthet – dvs. om kommunen blivit tätare eller glesare. Visar om kommuner som vuxit i befolkningstäthet mellan 2018 och 2022 också förändrade sitt röstmönster på ett annat sätt än kommuner som blivit glesare.</p>`);
    const el3 = createChartContainer(output, "Förändring i täthet vs förändring i högerblock (%)");
    drawScatterChart(el3, selected.map(d => [d.densityChange, d.voteChange]),
      "Täthetsutveckling vs Röstförändring", "Förändring i befolkningstäthet", "Förändring högerblock (%)");

    // Diagram 4 – stapel låg vs hög
    addHtml(output, `<h2>📊 Diagram 4: Genomsnittlig röstförändring – låg vs hög täthet</h2>`);
    addHtml(output, `<p>För att göra det lättare att jämföra delar vi kommunerna i två lika stora grupper: den hälften med lägst täthet (landsbygd) och den hälften med högst täthet (mer tätbefolkade). Staplarnas höjd visar genomsnittlig röstförändring för varje grupp – en tydlig skillnad mellan staplarna tyder på att täthet spelar roll.</p>`);
    const sortedSel = [...selected].sort((a, b) => a.density2022 - b.density2022);
    const midSel = Math.floor(sortedSel.length / 2);
    const low = sortedSel.slice(0, midSel);
    const high = sortedSel.slice(midSel);
    const lowAvg = average(low.map(d => d.voteChange));
    const highAvg = average(high.map(d => d.voteChange));
    const el4 = createChartContainer(output, "Genomsnittlig röstförändring: låg vs hög täthet");
    drawColumnChart(el4, [
      ["Grupp", "Genomsnittlig förändring (%)"],
      [`Låg täthet (${low.length})`, lowAvg],
      [`Hög täthet (${high.length})`, highAvg]
    ], "Genomsnittlig röstförändring efter befolkningstäthet");

    // Diagram 5 – region
    if (hasRegionData) {
      const north = selected.filter(d => d.region === "Norr");
      const middle = selected.filter(d => d.region === "Mitten");
      const south = selected.filter(d => d.region === "Söder");

      function std(arr) {
        if (arr.length === 0) return 0;
        const mean = average(arr);
        return Math.sqrt(arr.reduce((sum, x) => sum + (x - mean) ** 2, 0) / arr.length);
      }

      const nAvg = average(north.map(d => d.voteChange));
      const mAvg = average(middle.map(d => d.voteChange));
      const sAvg = average(south.map(d => d.voteChange));
      const nStd = std(north.map(d => d.voteChange));
      const mStd = std(middle.map(d => d.voteChange));
      const sStd = std(south.map(d => d.voteChange));

      addHtml(output, `<h2>🧭 Diagram 5: Regionjämförelse – Norr, Mitten, Söder</h2>`);
      addHtml(output, `<p>Vi delar Sverige i tre lika stora delar baserat på kommunernas geografiska läge (latitud): Norr = nordligaste tredjedelen av kommunerna, Mitten = mellersta tredjedelen, Söder = sydligaste tredjedelen. Staplarnas höjd visar hur mycket högerblockets röstandel förändrades i genomsnitt i varje region. Skiljer sig regionerna åt tyder det på att var i landet man bor påverkar den politiska utvecklingen.</p>`);

      const el5 = createChartContainer(output, "Genomsnittlig röstförändring per region");
      drawColumnChart(el5, [
        ["Region", "Genomsnittlig förändring (%)"],
        [`Norr (${north.length})`, nAvg],
        [`Mitten (${middle.length})`, mAvg],
        [`Söder (${south.length})`, sAvg]
      ], "Genomsnittlig röstförändring per region");

      addHtml(output, `
        <h3>📊 Regionstatistik – medelvärde och spridning</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:14px;">
          <thead><tr style="background:#f0f0f0;">
            <th style="padding:8px;text-align:left;border-bottom:2px solid #999;">Region</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #999;">Antal kommuner</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #999;">Medelvärde (%)</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #999;">Standardavvikelse</th>
          </tr></thead>
          <tbody>
            <tr>
              <td style="padding:8px;border-bottom:1px solid #ddd;">Norr</td>
              <td style="padding:8px;border-bottom:1px solid #ddd;">${north.length}</td>
              <td style="padding:8px;border-bottom:1px solid #ddd;">${nAvg.toFixed(2)}</td>
              <td style="padding:8px;border-bottom:1px solid #ddd;">${nStd.toFixed(2)}</td>
            </tr>
            <tr style="background:#fafafa;">
              <td style="padding:8px;border-bottom:1px solid #ddd;">Mitten</td>
              <td style="padding:8px;border-bottom:1px solid #ddd;">${middle.length}</td>
              <td style="padding:8px;border-bottom:1px solid #ddd;">${mAvg.toFixed(2)}</td>
              <td style="padding:8px;border-bottom:1px solid #ddd;">${mStd.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding:8px;">Söder</td>
              <td style="padding:8px;">${south.length}</td>
              <td style="padding:8px;">${sAvg.toFixed(2)}</td>
              <td style="padding:8px;">${sStd.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        <p>En hög standardavvikelse betyder att kommunerna inom regionen spretar mycket i sin röstförändring. En låg standardavvikelse betyder att kommunerna är mer lika varandra.</p>
      `);
    }

    // ---- SD-diagram ----
    addHtml(output, `<h2>🟡 Diagram 6: Sverigedemokraternas förändring och befolkningstäthet</h2>`);
    addHtml(output, `<p>Sverigedemokraterna var det parti som förändrades mest mellan 2018 och 2022. Här undersöker vi om SD ökade mer i glesbygd (låg täthet) eller i städer (hög täthet). Varje punkt är en kommun – X-axeln visar täthet och Y-axeln visar hur mycket SD:s röstandel förändrades i procentenheter. En nedåtlutande trendlinje betyder att SD ökade mer i glesbygd, uppåtlutande att de ökade mer i städer.</p>`);

    const el6 = createChartContainer(output, "Befolkningstäthet 2022 vs SD:s förändring (%)");
    drawScatterChart(el6, selected.map(d => [d.density2022, d.sdChange]),
      "Täthet vs SD-förändring", "Befolkningstäthet 2022 (inv/km²)", "SD förändring (procentenheter)");

    if (hasRegionData) {
      const northSD = selected.filter(d => d.region === "Norr");
      const middleSD = selected.filter(d => d.region === "Mitten");
      const southSD = selected.filter(d => d.region === "Söder");

      addHtml(output, `<h2>🟡 Diagram 7: SD:s förändring per region</h2>`);
      addHtml(output, `<p>Här ser vi SD:s genomsnittliga röstandelsförändring uppdelat på de tre regionerna. Jämför detta med diagram 5 (högerblockets regionförändring) – liknar SD:s geografiska mönster högerblockets mönster, eller skiljer de sig åt? En skillnad kan tyda på att SD drog väljare från andra partier i vissa regioner.</p>`);

      const el7 = createChartContainer(output, "Genomsnittlig SD-förändring per region");
      drawColumnChart(el7, [
        ["Region", "SD förändring (%)"],
        [`Norr (${northSD.length})`, average(northSD.map(d => d.sdChange))],
        [`Mitten (${middleSD.length})`, average(middleSD.map(d => d.sdChange))],
        [`Söder (${southSD.length})`, average(southSD.map(d => d.sdChange))]
      ], "Genomsnittlig SD-förändring per region");

      addHtml(output, `
        <h3>📊 SD-statistik per region</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:14px;">
          <thead><tr style="background:#f0f0f0;">
            <th style="padding:8px;text-align:left;border-bottom:2px solid #999;">Region</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #999;">Antal kommuner</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #999;">SD medelvärde (%)</th>
          </tr></thead>
          <tbody>
            <tr>
              <td style="padding:8px;border-bottom:1px solid #ddd;">Norr</td>
              <td style="padding:8px;border-bottom:1px solid #ddd;">${northSD.length}</td>
              <td style="padding:8px;border-bottom:1px solid #ddd;">${average(northSD.map(d => d.sdChange)).toFixed(2)}</td>
            </tr>
            <tr style="background:#fafafa;">
              <td style="padding:8px;border-bottom:1px solid #ddd;">Mitten</td>
              <td style="padding:8px;border-bottom:1px solid #ddd;">${middleSD.length}</td>
              <td style="padding:8px;border-bottom:1px solid #ddd;">${average(middleSD.map(d => d.sdChange)).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding:8px;">Söder</td>
              <td style="padding:8px;">${southSD.length}</td>
              <td style="padding:8px;">${average(southSD.map(d => d.sdChange)).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        <p>Jämför detta med högerblockets förändring ovan – liknar mönstren varandra eller skiljer de sig åt?</p>
      `);
    }

    // Korrelationer
    const corr2018 = correlation(selected.map(d => d.density2018), selected.map(d => d.voteChange));
    const corr2022 = correlation(selected.map(d => d.density2022), selected.map(d => d.voteChange));
    const corrChange = correlation(selected.map(d => d.densityChange), selected.map(d => d.voteChange));

    addHtml(output, `
      <h2>📉 Korrelationsanalys</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead><tr style="background:#f0f0f0;">
          <th style="padding:8px;text-align:left;border-bottom:2px solid #999;">Variabel</th>
          <th style="padding:8px;text-align:left;border-bottom:2px solid #999;">r-värde</th>
          <th style="padding:8px;text-align:left;border-bottom:2px solid #999;">Tolkning</th>
        </tr></thead>
        <tbody>
          <tr><td style="padding:8px;border-bottom:1px solid #ddd;">Befolkningstäthet 2018</td>
              <td style="padding:8px;border-bottom:1px solid #ddd;">${Number.isFinite(corr2018) ? corr2018.toFixed(3) : "-"}</td>
              <td style="padding:8px;border-bottom:1px solid #ddd;">${interpretationText(corr2018)}</td></tr>
          <tr style="background:#fafafa;">
              <td style="padding:8px;border-bottom:1px solid #ddd;">Befolkningstäthet 2022</td>
              <td style="padding:8px;border-bottom:1px solid #ddd;">${Number.isFinite(corr2022) ? corr2022.toFixed(3) : "-"}</td>
              <td style="padding:8px;border-bottom:1px solid #ddd;">${interpretationText(corr2022)}</td></tr>
          <tr><td style="padding:8px;">Förändring i täthet</td>
              <td style="padding:8px;">${Number.isFinite(corrChange) ? corrChange.toFixed(3) : "-"}</td>
              <td style="padding:8px;">${interpretationText(corrChange)}</td></tr>
        </tbody>
      </table>
      <p style="font-size:13px;color:#555;">r ≈ 0 = inget samband &nbsp;|&nbsp; r ≈ 1 = starkt positivt &nbsp;|&nbsp; r ≈ -1 = starkt negativt</p>

      <h2>🧠 Tolkning av resultaten</h2>
      <p>Sambandet mellan befolkningstäthet 2022 och röstförändring är
      <strong>${interpretationText(corr2022).toLowerCase()}</strong> (r = ${Number.isFinite(corr2022) ? corr2022.toFixed(3) : "-"}).
      Tätare kommuner tenderade att ${corr2022 < 0 ? "minska mer" : "öka mer"} i högerblock jämfört med glesare kommuner.</p>
      <p>Kommuner med låg täthet hade i genomsnitt <strong>${lowAvg.toFixed(2)} procentenheters</strong> förändring,
      medan kommuner med hög täthet hade <strong>${highAvg.toFixed(2)} procentenheters</strong> förändring.
      ${Math.abs(lowAvg - highAvg) > 1 ? "Det finns en tydlig skillnad mellan grupperna." : "Skillnaden mellan grupperna är liten."}</p>

      <h2>⚠️ Korrelation är inte kausalitet</h2>
      <p>Även om vi ser samband mellan geografi och valförändringar betyder det <strong>inte</strong>
      att befolkningstäthet i sig orsakade förändringen. Geografi samvarierar med faktorer som
      inkomst, ålder och utbildningsnivå.</p>

      <h2>🏁 Slutsats</h2>
      <p>Analysen visar att geografiska faktorer – befolkningstäthet och regional tillhörighet – har ett samband med hur röstmönstren förändrades mellan riksdagsvalen 2018 och 2022. Kommuner med lägre befolkningstäthet (glesbygd) tenderade att öka mer i högerblock och SD jämfört med tätare kommuner. Regionalt syns också skillnader mellan Norr, Mitten och Söder.</p>
      <p>Sambanden är dock inte tillräckligt starka för att geografi ensam ska kunna förklara hela förändringen. En trolig förklaring är att geografi <em>samvarierar</em> med andra bakomliggande faktorer:</p>
      <ul>
        <li><strong>Inkomst</strong> – glesbygdskommuner har ofta lägre medelinkomst, vilket enligt projektets ekonomianalys också hänger ihop med röstförändring.</li>
        <li><strong>Ålder</strong> – glesbygdskommuner har ofta en äldre befolkning, vilket enligt projektets åldersanalys kan påverka röstmönstren.</li>
      </ul>
      <p>Det mest rimliga är därför att geografi, inkomst och ålder tillsammans bidrar till att förklara varför Sverige förändrades politiskt mellan 2018 och 2022 – ingen faktor räcker ensam.</p>
    `);
  }

  // Starta med alla kommuner
  draw(data, `Alla kommuner (${data.length})`);

  // Dropdown – stoppa reload, rita om direkt
  select.addEventListener("change", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const val = select.value;
    const labelText = select.options[select.selectedIndex].text;
    draw(filterData(val), labelText);
  });

  select.addEventListener("click", (e) => {
    e.stopPropagation();
  });
}

// ===============================
// Start
// ===============================

if (!dbInfoOk) {
  displayDbNotOkText();
} else {
  const data = buildData();
  renderPage(data);
}