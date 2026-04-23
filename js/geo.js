import dbInfoOk, { displayDbNotOkText } from "./helpers/dbInfoOk.js";
import { valdataKommun, geoData } from "./helpers/dataLoader.js";
import { average, correlation } from "./helpers/utils.js";
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

function std(arr) {
  if (arr.length === 0) return 0;
  const mean = average(arr);
  return Math.sqrt(arr.reduce((sum, x) => sum + (x - mean) ** 2, 0) / arr.length);
}

// ===============================
// Bygg data
// ===============================

function buildData() {
  const rows = Array.isArray(valdataKommun) ? valdataKommun : [];
  const geoRows = Array.isArray(geoData) ? geoData : [];

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
  const hasRegionData = data.some(d => d.region);

  const allSorted = [...data].sort((a, b) => a.density2022 - b.density2022);
  const allMid = Math.floor(allSorted.length / 2);
  const allLow = allSorted.slice(0, allMid);
  const allHigh = allSorted.slice(allMid);
  const allNorth = data.filter(d => d.region === "Norr");
  const allMiddle = data.filter(d => d.region === "Mitten");
  const allSouth = data.filter(d => d.region === "Söder");

  // Hero-sektion
  addToPage(`
    <div class="page-hero">
      <h2>Geografi och förändring i valresultat</h2>
      <p>Kan befolkningstäthet och geografisk region förklara hur valresultatet förändrades mellan riksdagsvalen 2018 och 2022?</p>
      <div class="hero-tags">
        <span class="hero-tag">${data.length} kommuner</span>
        <span class="hero-tag">Riksdagsvalet 2018–2022</span>
        <span class="hero-tag">Täthet + Region</span>
        <span class="hero-tag">SD-analys</span>
      </div>
    </div>
  `);

  // Dropdown
  let chosenFilter = addDropdown("Filtrera data:", [
    `Alla kommuner (${data.length})`,
    `Låg befolkningstäthet (${allLow.length})`,
    `Hög befolkningstäthet (${allHigh.length})`,
    ...(hasRegionData ? [
      `Norr (${allNorth.length})`,
      `Mitten (${allMiddle.length})`,
      `Söder (${allSouth.length})`
    ] : [])
  ]);

  function getFiltered() {
    const val = typeof chosenFilter === "string" ? chosenFilter : (chosenFilter.value || "");
    const sorted = [...data].sort((a, b) => a.density2022 - b.density2022);
    const mid = Math.floor(sorted.length / 2);
    if (val.startsWith("Låg")) return sorted.slice(0, mid);
    if (val.startsWith("Hög")) return sorted.slice(mid);
    if (val.startsWith("Norr")) return data.filter(d => d.region === "Norr");
    if (val.startsWith("Mitten")) return data.filter(d => d.region === "Mitten");
    if (val.startsWith("Söder")) return data.filter(d => d.region === "Söder");
    return data;
  }

  function draw() {
    const selected = getFiltered();

    // Stat-kort
    const sortedSel = [...selected].sort((a, b) => a.density2022 - b.density2022);
    const midSel = Math.floor(sortedSel.length / 2);
    const low = sortedSel.slice(0, midSel);
    const high = sortedSel.slice(midSel);
    const lowAvg = average(low.map(d => d.voteChange));
    const highAvg = average(high.map(d => d.voteChange));
    const avgDensity = average(selected.map(d => d.density2022)).toFixed(1);
    const avgVoteChange = average(selected.map(d => d.voteChange)).toFixed(2);
    const avgSdChange = average(selected.map(d => d.sdChange)).toFixed(2);
    const corr2022 = correlation(selected.map(d => d.density2022), selected.map(d => d.voteChange));

    addToPage(`
      <div class="stat-grid">
        <div class="stat-card">
          <h4>Antal kommuner i urvalet</h4>
          <div class="value">${selected.length}</div>
        </div>
        <div class="stat-card">
          <h4>Genomsnittlig täthet 2022</h4>
          <div class="value">${avgDensity} <span class="value-unit">inv/km²</span></div>
        </div>
        <div class="stat-card">
          <h4>Genomsnittlig röstförändring</h4>
          <div class="value">${avgVoteChange} <span class="value-unit">%</span></div>
        </div>
        <div class="stat-card">
          <h4>Genomsnittlig SD-förändring</h4>
          <div class="value">${avgSdChange} <span class="value-unit">%</span></div>
        </div>
        <div class="stat-card">
          <h4>Låg täthet – snitt röstförändring</h4>
          <div class="value">${lowAvg.toFixed(2)} <span class="value-unit">%</span></div>
        </div>
        <div class="stat-card">
          <h4>Hög täthet – snitt röstförändring</h4>
          <div class="value">${highAvg.toFixed(2)} <span class="value-unit">%</span></div>
        </div>
      </div>
    `);

    // Tabell
    addMdToPage(`## Dataöversikt (topp 10 kommuner)`);
    tableFromData({
      data: selected.slice(0, 10).map(d => ({
        "Kommun": d.kommun,
        "Valkrets": d.valkrets,
        "Täthet 2018": d.density2018,
        "Täthet 2022": d.density2022,
        "Förändring täthet": d.densityChange,
        "Högerblock förändring (%)": d.voteChange,
        "SD förändring (%)": d.sdChange,
        "Region": d.region || "-"
      }))
    });

    // Diagram 1
    addMdToPage(`## Diagram 1: Befolkningstäthet 2022 och röstförändring`);
    addToPage(`<div class="info-note">Varje punkt representerar en kommun. X-axeln visar hur tät kommunen är (inv/km²) och Y-axeln visar hur mycket högerblockets röstandel förändrades. Den röda trendlinjen visar om tätare kommuner röstade mer eller mindre åt höger.</div>`);
    drawGoogleChart({
      type: "ScatterChart",
      data: [
        ["Befolkningstäthet 2022 (inv/km²)", "Förändring högerblock (%)"],
        ...selected.map(d => [d.density2022, d.voteChange])
      ],
      options: {
        title: "Befolkningstäthet 2022 vs röstförändring",
        hAxis: { title: "Befolkningstäthet 2022 (inv/km²)" },
        vAxis: { title: "Förändring högerblock (procentenheter)" },
        trendlines: { 0: { color: "red", lineWidth: 2, opacity: 0.8 } },
        legend: "none", height: 420
      }
    });

    // Diagram 2
    addMdToPage(`## Diagram 2: Befolkningstäthet 2018 och röstförändring`);
    addToPage(`<div class="info-note">Här används kommunernas befolkningstäthet år 2018 – alltså innan valet – för att se om utgångsläget hängde ihop med hur röstmönstren senare förändrades.</div>`);
    drawGoogleChart({
      type: "ScatterChart",
      data: [
        ["Befolkningstäthet 2018 (inv/km²)", "Förändring högerblock (%)"],
        ...selected.map(d => [d.density2018, d.voteChange])
      ],
      options: {
        title: "Befolkningstäthet 2018 vs röstförändring",
        hAxis: { title: "Befolkningstäthet 2018 (inv/km²)" },
        vAxis: { title: "Förändring högerblock (procentenheter)" },
        trendlines: { 0: { color: "red", lineWidth: 2, opacity: 0.8 } },
        legend: "none", height: 420
      }
    });

    // Diagram 3
    addMdToPage(`## Diagram 3: Förändring i befolkningstäthet och röstförändring`);
    addToPage(`<div class="info-note">Visar om kommuner som vuxit i befolkningstäthet mellan 2018 och 2022 också förändrade sitt röstmönster på ett annat sätt än kommuner som blivit glesare.</div>`);
    drawGoogleChart({
      type: "ScatterChart",
      data: [
        ["Förändring i befolkningstäthet", "Förändring högerblock (%)"],
        ...selected.map(d => [d.densityChange, d.voteChange])
      ],
      options: {
        title: "Täthetsutveckling vs röstförändring",
        hAxis: { title: "Förändring i befolkningstäthet" },
        vAxis: { title: "Förändring högerblock (procentenheter)" },
        trendlines: { 0: { color: "red", lineWidth: 2, opacity: 0.8 } },
        legend: "none", height: 420
      }
    });

    // Diagram 4
    addMdToPage(`## Diagram 4: Genomsnittlig röstförändring – låg vs hög täthet`);
    addToPage(`<div class="info-note">Kommunerna delas i två lika stora grupper baserat på befolkningstäthet 2022. En tydlig skillnad mellan staplarna tyder på att täthet spelar roll.</div>`);
    drawGoogleChart({
      type: "ColumnChart",
      data: [
        ["Grupp", "Genomsnittlig förändring (%)"],
        [`Låg täthet (${low.length})`, lowAvg],
        [`Hög täthet (${high.length})`, highAvg]
      ],
      options: {
        title: "Genomsnittlig röstförändring efter befolkningstäthet",
        hAxis: { title: "Grupp" },
        vAxis: { title: "Genomsnittlig förändring (%)" },
        colors: ["#1a2b4a"], legend: "none", height: 420
      }
    });

    // Diagram 5 – region
    if (hasRegionData) {
      const north = selected.filter(d => d.region === "Norr");
      const middle = selected.filter(d => d.region === "Mitten");
      const south = selected.filter(d => d.region === "Söder");

      const nAvg = average(north.map(d => d.voteChange));
      const mAvg = average(middle.map(d => d.voteChange));
      const sAvg = average(south.map(d => d.voteChange));
      const nStd = std(north.map(d => d.voteChange));
      const mStd = std(middle.map(d => d.voteChange));
      const sStd = std(south.map(d => d.voteChange));

      addMdToPage(`## Diagram 5: Regionjämförelse – Norr, Mitten, Söder`);
      addToPage(`<div class="info-note">Sverige delas i tre lika stora delar baserat på kommunernas latitud. Skiljer sig regionerna åt tyder det på att var i landet man bor påverkar den politiska utvecklingen.</div>`);

      drawGoogleChart({
        type: "ColumnChart",
        data: [
          ["Region", "Genomsnittlig förändring (%)"],
          [`Norr (${north.length})`, nAvg],
          [`Mitten (${middle.length})`, mAvg],
          [`Söder (${south.length})`, sAvg]
        ],
        options: {
          title: "Genomsnittlig röstförändring per region",
          hAxis: { title: "Region" },
          vAxis: { title: "Genomsnittlig förändring (%)" },
          colors: ["#1a2b4a"], legend: "none", height: 420
        }
      });

      addToPage(`
        <div class="analysis-box">
          <h3>Regionstatistik – medelvärde och spridning</h3>
          <table style="width:100%;border-collapse:collapse;font-size:0.92rem;">
            <thead><tr style="background:#e8f0fb;">
              <th style="padding:8px;text-align:left;border-bottom:2px solid #b5d4f4;">Region</th>
              <th style="padding:8px;text-align:left;border-bottom:2px solid #b5d4f4;">Antal kommuner</th>
              <th style="padding:8px;text-align:left;border-bottom:2px solid #b5d4f4;">Medelvärde (%)</th>
              <th style="padding:8px;text-align:left;border-bottom:2px solid #b5d4f4;">Standardavvikelse</th>
            </tr></thead>
            <tbody>
              <tr><td style="padding:8px;border-bottom:1px solid #e0e8f4;">Norr</td>
                  <td style="padding:8px;border-bottom:1px solid #e0e8f4;">${north.length}</td>
                  <td style="padding:8px;border-bottom:1px solid #e0e8f4;">${nAvg.toFixed(2)}</td>
                  <td style="padding:8px;border-bottom:1px solid #e0e8f4;">${nStd.toFixed(2)}</td></tr>
              <tr style="background:#f7f9fc;">
                  <td style="padding:8px;border-bottom:1px solid #e0e8f4;">Mitten</td>
                  <td style="padding:8px;border-bottom:1px solid #e0e8f4;">${middle.length}</td>
                  <td style="padding:8px;border-bottom:1px solid #e0e8f4;">${mAvg.toFixed(2)}</td>
                  <td style="padding:8px;border-bottom:1px solid #e0e8f4;">${mStd.toFixed(2)}</td></tr>
              <tr><td style="padding:8px;">Söder</td>
                  <td style="padding:8px;">${south.length}</td>
                  <td style="padding:8px;">${sAvg.toFixed(2)}</td>
                  <td style="padding:8px;">${sStd.toFixed(2)}</td></tr>
            </tbody>
          </table>
          <p>En hög standardavvikelse betyder att kommunerna inom regionen spretar mycket. En låg standardavvikelse betyder att kommunerna är mer lika varandra.</p>
        </div>
      `);
    }

    // Diagram 6 – SD scatter
    addMdToPage(`## Diagram 6: Sverigedemokraternas förändring och befolkningstäthet`);
    addToPage(`<div class="info-note">SD var det parti som förändrades mest 2018–2022. En nedåtlutande trendlinje betyder att SD ökade mer i glesbygd, uppåtlutande att de ökade mer i städer.</div>`);
    drawGoogleChart({
      type: "ScatterChart",
      data: [
        ["Befolkningstäthet 2022 (inv/km²)", "SD förändring (procentenheter)"],
        ...selected.map(d => [d.density2022, d.sdChange])
      ],
      options: {
        title: "Täthet vs SD-förändring",
        hAxis: { title: "Befolkningstäthet 2022 (inv/km²)" },
        vAxis: { title: "SD förändring (procentenheter)" },
        trendlines: { 0: { color: "red", lineWidth: 2, opacity: 0.8 } },
        legend: "none", height: 420
      }
    });

    // Diagram 7 – SD region
    if (hasRegionData) {
      const northSD = selected.filter(d => d.region === "Norr");
      const middleSD = selected.filter(d => d.region === "Mitten");
      const southSD = selected.filter(d => d.region === "Söder");

      addMdToPage(`## Diagram 7: SD:s förändring per region`);
      addToPage(`<div class="info-note">Jämför SD:s geografiska mönster med högerblockets mönster i diagram 5 – liknar de varandra eller skiljer de sig åt?</div>`);

      drawGoogleChart({
        type: "ColumnChart",
        data: [
          ["Region", "SD förändring (%)"],
          [`Norr (${northSD.length})`, average(northSD.map(d => d.sdChange))],
          [`Mitten (${middleSD.length})`, average(middleSD.map(d => d.sdChange))],
          [`Söder (${southSD.length})`, average(southSD.map(d => d.sdChange))]
        ],
        options: {
          title: "Genomsnittlig SD-förändring per region",
          hAxis: { title: "Region" },
          vAxis: { title: "SD förändring (%)" },
          colors: ["#c8963e"], legend: "none", height: 420
        }
      });
    }

    // Korrelationsanalys
    const corr2018 = correlation(selected.map(d => d.density2018), selected.map(d => d.voteChange));
    const corr2022val = correlation(selected.map(d => d.density2022), selected.map(d => d.voteChange));
    const corrChange = correlation(selected.map(d => d.densityChange), selected.map(d => d.voteChange));

    addToPage(`
      <div class="analysis-box">
        <h3>Korrelationsanalys</h3>
        <p><strong>Befolkningstäthet 2018 och röstförändring:</strong>
          <span class="corr-value">${Number.isFinite(corr2018) ? corr2018.toFixed(3) : "-"}</span>
          — ${interpretationText(corr2018).toLowerCase()}
        </p>
        <p><strong>Befolkningstäthet 2022 och röstförändring:</strong>
          <span class="corr-value">${Number.isFinite(corr2022val) ? corr2022val.toFixed(3) : "-"}</span>
          — ${interpretationText(corr2022val).toLowerCase()}
        </p>
        <p><strong>Förändring i täthet och röstförändring:</strong>
          <span class="corr-value">${Number.isFinite(corrChange) ? corrChange.toFixed(3) : "-"}</span>
          — ${interpretationText(corrChange).toLowerCase()}
        </p>
        <p>Korrelationskoefficienten visar hur starkt två variabler samvarierar. Ett värde nära 0 tyder på svagt samband medan värden närmare 1 eller −1 tyder på starkare samband. Korrelation visar dock inte orsakssamband.</p>
      </div>

      <div class="analysis-box" style="margin-top:1rem;">
        <h3>Tolkning av resultaten</h3>
        <p>Sambandet mellan befolkningstäthet 2022 och röstförändring är <strong>${interpretationText(corr2022val).toLowerCase()}</strong> (r = ${Number.isFinite(corr2022val) ? corr2022val.toFixed(3) : "-"}). Tätare kommuner tenderade att ${corr2022val < 0 ? "minska mer" : "öka mer"} i högerblock jämfört med glesare kommuner.</p>
        <p>Kommuner med låg täthet hade i genomsnitt <strong>${lowAvg.toFixed(2)} procentenheters</strong> förändring, medan kommuner med hög täthet hade <strong>${highAvg.toFixed(2)} procentenheters</strong> förändring. ${Math.abs(lowAvg - highAvg) > 1 ? "Det finns en tydlig skillnad mellan grupperna." : "Skillnaden mellan grupperna är liten."}</p>
      </div>

      <div class="analysis-box" style="margin-top:1rem;">
        <h3>Korrelation är inte kausalitet</h3>
        <p>Även om vi ser samband mellan geografi och valförändringar betyder det inte att befolkningstäthet i sig orsakade förändringen. Det är möjligt att:</p>
        <ul>
          <li>Geografiska faktorer påverkar politiska preferenser direkt</li>
          <li>Andra faktorer (inkomst, ålder, migration) påverkar både geografi och röstning</li>
          <li>Sambandet speglar strukturella skillnader mellan stad och landsbygd</li>
        </ul>
      </div>

      <div class="analysis-box" style="margin-top:1rem;">
        <h3>Slutsats</h3>
        <p>Analysen visar att geografiska faktorer – befolkningstäthet och regional tillhörighet – har ett samband med hur röstmönstren förändrades mellan riksdagsvalen 2018 och 2022. Kommuner med lägre befolkningstäthet (glesbygd) tenderade att öka mer i högerblock och SD jämfört med tätare kommuner.</p>
        <p>Sambanden är dock inte tillräckligt starka för att geografi ensam ska kunna förklara hela förändringen. En trolig förklaring är att geografi samvarierar med andra bakomliggande faktorer:</p>
        <ul>
          <li><strong>Inkomst</strong> – glesbygdskommuner har ofta lägre medelinkomst, vilket enligt projektets ekonomianalys också hänger ihop med röstförändring.</li>
          <li><strong>Ålder</strong> – glesbygdskommuner har ofta en äldre befolkning, vilket enligt projektets åldersanalys kan påverka röstmönstren.</li>
        </ul>
        <p>Det mest rimliga är därför att geografi, inkomst och ålder tillsammans bidrar till att förklara varför Sverige förändrades politiskt mellan 2018 och 2022 – ingen faktor räcker ensam.</p>
      </div>
    `);
  }

  draw();
  if (chosenFilter && chosenFilter.addEventListener) {
    chosenFilter.addEventListener("change", (e) => {
      e.preventDefault();
      e.stopPropagation();
      draw();
    });
    chosenFilter.addEventListener("click", (e) => { e.stopPropagation(); });
  }
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