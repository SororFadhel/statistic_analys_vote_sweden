import dbInfoOk, { displayDbNotOkText } from "./helpers/dbInfoOk.js";
import { valdataKommun, geoData } from "./helpers/dataLoader.js";
import { average, correlation } from "./helpers/utils.js";
import { COLORS, pageHero, statGrid, statCard, infoNote, analysisBox } from "./helpers/components.js";

function toNum(v) {
  if (v === null || v === undefined) return 0;
  const cleaned = String(v).replace(/\s/g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function safeText(v) {
  return v == null ? "" : String(v);
}

function normalizeKommun(name) {
  if (!name) return "";
  return String(name)
    .toLowerCase()
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

function std(arr) {
  if (arr.length === 0) return 0;
  const mean = average(arr);
  return Math.sqrt(arr.reduce((sum, x) => sum + (x - mean) ** 2, 0) / arr.length);
}

function indexGeoData(arr) {
  const temp = {};
  arr.forEach(row => {
    const key = normalizeKommun(row.municipality || "");
    if (!temp[key]) temp[key] = [];
    temp[key].push(Number(row.latitude));
  });
  const map = {};
  Object.keys(temp).forEach(key => {
    const values = temp[key].filter(v => !isNaN(v));
    if (values.length > 0) {
      map[key] = values.reduce((sum, v) => sum + v, 0) / values.length;
    }
  });
  return map;
}

function getRegion(lat) {
  if (lat === null || lat === undefined || isNaN(lat)) return null;
  if (lat < 57) return "Söder";
  if (lat < 62) return "Mitten";
  return "Norr";
}

function buildData() {
  const rows = Array.isArray(valdataKommun) ? valdataKommun : [];
  const geoRows = Array.isArray(geoData) ? geoData : [];

  const geoMap = indexGeoData(geoRows);

  geoMap["jarfalla"] = 59.42;
  geoMap["salem"] = 59.20;
  geoMap["solna"] = 59.36;
  geoMap["sundbyberg"] = 59.36;
  geoMap["tyreso"] = 59.25;

  return rows.map(r => {
    const kommun = safeText(r["Kommunnamn"] || "");
    const normalizedKommun = normalizeKommun(kommun);
    const latitude = geoMap[normalizedKommun] ?? null;
    const region = getRegion(latitude);

    const density2018 = toNum(r["Befolkningstäthet_2018"]);
    const density2022 = toNum(r["Befolkningstäthet_2022"]);
    const densityChange = density2022 - density2018;

    const pop2018 = toNum(r["Befolkning_2018"]);
    const pop2022 = toNum(r["Befolkning_2022"]);

    const total18 =
      toNum(r["Arbetarepartiet-Socialdemokraterna_2018"]) +
      toNum(r["Centerpartiet_2018"]) +
      toNum(r["Kristdemokraterna_2018"]) +
      toNum(r["Liberalerna (tidigare Folkpartiet)_2018"]) +
      toNum(r["Miljöpartiet de gröna_2018"]) +
      toNum(r["Moderaterna_2018"]) +
      toNum(r["Sverigedemokraterna_2018"]) +
      toNum(r["Vänsterpartiet_2018"]) +
      toNum(r["Övriga anmälda partier_2018"]);

    const total22 =
      toNum(r["Arbetarepartiet-Socialdemokraterna_2022"]) +
      toNum(r["Centerpartiet_2022"]) +
      toNum(r["Kristdemokraterna_2022"]) +
      toNum(r["Liberalerna (tidigare Folkpartiet)_2022"]) +
      toNum(r["Miljöpartiet de gröna_2022"]) +
      toNum(r["Moderaterna_2022"]) +
      toNum(r["Sverigedemokraterna_2022"]) +
      toNum(r["Vänsterpartiet_2022"]) +
      toNum(r["Övriga anmälda partier_2022"]);

    // Valdeltagande = totala röster / befolkning * 100
    const turnout2018 = pop2018 > 0 ? Number(((total18 / pop2018) * 100).toFixed(2)) : 0;
    const turnout2022 = pop2022 > 0 ? Number(((total22 / pop2022) * 100).toFixed(2)) : 0;
    const turnoutChange = Number((turnout2022 - turnout2018).toFixed(2));

    return {
      kommun,
      valkrets: safeText(r["Riksdagsvalkrets"] || ""),
      density2018,
      density2022,
      densityChange: Number(densityChange.toFixed(2)),
      latitude,
      region,
      turnout2018,
      turnout2022,
      turnoutChange
    };
  }).filter(d => d.kommun && d.density2022 > 0);
}

function renderPage(data) {
  const hasRegionData = data.some(d => d.region);

  const allSorted = [...data].sort((a, b) => a.density2022 - b.density2022);
  const allMid = Math.floor(allSorted.length / 2);
  const allLow = allSorted.slice(0, allMid);
  const allHigh = allSorted.slice(allMid);
  const allNorth = data.filter(d => d.region === "Norr");
  const allMiddle = data.filter(d => d.region === "Mitten");
  const allSouth = data.filter(d => d.region === "Söder");

  addToPage(pageHero(
    "Geografi och valdeltagande",
    "Påverkar befolkningstäthet och geografisk region hur mycket folk röstar? Jämförelse av valdeltagande mellan riksdagsvalen 2018 och 2022.",
    [`${data.length} kommuner`, "Riksdagsvalet 2018–2022", "Täthet + Region", "Valdeltagande"]
  ));

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

    const sortedSel = [...selected].sort((a, b) => a.density2022 - b.density2022);
    const midSel = Math.floor(sortedSel.length / 2);
    const low = sortedSel.slice(0, midSel);
    const high = sortedSel.slice(midSel);
    const lowAvg = average(low.map(d => d.turnoutChange));
    const highAvg = average(high.map(d => d.turnoutChange));
    const avgDensity = average(selected.map(d => d.density2022)).toFixed(1);
    const avgTurnout2018 = average(selected.map(d => d.turnout2018)).toFixed(2);
    const avgTurnout2022 = average(selected.map(d => d.turnout2022)).toFixed(2);
    const avgTurnoutChange = average(selected.map(d => d.turnoutChange)).toFixed(2);

    // ── FRÅGESTÄLLNING ──────────────────────────────────────────────────────
    addMdToPage(`Förklarar geografiska faktorer – befolkningstäthet och region – hur valdeltagandet förändrades mellan riksdagsvalen 2018 och 2022?
Analysen jämför hur stor andel av befolkningen som röstade i kommuner med hög vs låg täthet, samt Norr vs Mitten vs Söder.`);

    // ── STATISTIKKORT ───────────────────────────────────────────────────────
    addToPage(statGrid([
      statCard("Antal kommuner", selected.length),
      statCard("Snitt valdeltagande 2018", `${avgTurnout2018} %`),
      statCard("Snitt valdeltagande 2022", `${avgTurnout2022} %`),
      statCard("Snitt förändring 2018→2022", `${avgTurnoutChange} %`),
      statCard("Låg täthet – snitt förändring", `${lowAvg.toFixed(2)} %`),
      statCard("Hög täthet – snitt förändring", `${highAvg.toFixed(2)} %`)
    ]));

    // ── TABELL: Topp 10 ─────────────────────────────────────────────────────
    addMdToPage(`## Topp 10 kommuner med störst förändring i valdeltagande`);
    addToPage(infoNote("Tabellen visar hur valdeltagandet förändrades mellan 2018 och 2022. En negativ förändring betyder att färre röstade 2022 jämfört med 2018."));

    const top10 = [...selected]
      .sort((a, b) => Math.abs(b.turnoutChange) - Math.abs(a.turnoutChange))
      .slice(0, 10);

    tableFromData({
      data: top10.map(d => ({
        "Kommun": d.kommun,
        "Region": d.region || "-",
        "Täthet 2022 (inv/km²)": d.density2022,
        "Valdeltagande 2018 (%)": d.turnout2018,
        "Valdeltagande 2022 (%)": d.turnout2022,
        "Förändring (procentenheter)": d.turnoutChange
      }))
    });

    // ── DIAGRAM 1: Scatter plot med outliers ────────────────────────────────
    addMdToPage(`## Röstade folk i tätare kommuner mer?`);
    addToPage(infoNote("Varje punkt är en kommun. Röda punkter är outliers – kommuner som sticker ut extremt från mönstret. Håll muspekaren för detaljer. Trendlinjen visar det övergripande sambandet."));

    const turnoutChanges = selected.map(d => d.turnoutChange);
    const meanTC = average(turnoutChanges);
    const stdTC = std(turnoutChanges);

    const normalPoints = selected.filter(d => Math.abs(d.turnoutChange - meanTC) <= 2 * stdTC);
    const outlierPoints = selected.filter(d => Math.abs(d.turnoutChange - meanTC) > 2 * stdTC);

    drawGoogleChart({
      type: "ScatterChart",
      data: [
        [
          "Befolkningstäthet 2022 (inv/km²)",
          "Förändring i valdeltagande (%)",
          { role: "tooltip", type: "string", p: { html: true } }
        ],
        ...normalPoints.map(d => [
          d.density2022,
          d.turnoutChange,
          `<div style="padding:10px;font-family:Georgia;min-width:160px">
            <b>${d.kommun}</b><br>
            Täthet: ${d.density2022} inv/km²<br>
            Valdeltagande 2018: ${d.turnout2018}%<br>
            Valdeltagande 2022: ${d.turnout2022}%<br>
            Förändring: ${d.turnoutChange > 0 ? "+" : ""}${d.turnoutChange}%<br>
            Region: ${d.region || "-"}
          </div>`
        ]),
        ...outlierPoints.map(d => [
          d.density2022,
          d.turnoutChange,
          `<div style="padding:10px;font-family:Georgia;min-width:160px;border-left:3px solid #E24B4A">
            <b>⚠ Outlier: ${d.kommun}</b><br>
            Täthet: ${d.density2022} inv/km²<br>
            Valdeltagande 2018: ${d.turnout2018}%<br>
            Valdeltagande 2022: ${d.turnout2022}%<br>
            Förändring: ${d.turnoutChange > 0 ? "+" : ""}${d.turnoutChange}%<br>
            Region: ${d.region || "-"}
          </div>`
        ])
      ],
      options: {
        title: "Befolkningstäthet 2022 vs förändring i valdeltagande (2018→2022)",
        fontName: "Georgia",
        hAxis: {
          title: "Befolkningstäthet 2022 (inv/km²)",
          titleTextStyle: { italic: false },
          scaleType: "log",
          gridlines: { count: 5 },
          minorGridlines: { count: 0 }
        },
        vAxis: {
          title: "Förändring i valdeltagande (procentenheter, 2018→2022)",
          titleTextStyle: { italic: false },
          gridlines: { count: 5 },
          minorGridlines: { count: 0 }
        },
        colors: [COLORS.primary, "#E24B4A"],
        trendlines: {
          0: { color: COLORS.secondary, lineWidth: 2, opacity: 0.7, labelInLegend: "Trendlinje" }
        },
        tooltip: { isHtml: true },
        legend: "none",
        height: 450,
        chartArea: { left: 80, top: 40, width: "80%", height: "70%" }
      }
    });

    addMdToPage(`**Outliers (${outlierPoints.length} kommuner):** ${outlierPoints.length > 0 ? outlierPoints.map(d => d.kommun).join(", ") : "Inga"} – dessa kommuner avviker mer än 2 standardavvikelser från genomsnittet (${meanTC.toFixed(2)}%).

**Vad gör man med outliers?** De tas inte bort ur analysen – de är verkliga kommuner med verkliga resultat. Däremot markeras de separat så att man är medveten om att de kan påverka korrelationsvärdet (r). Man bör tolka sambandet med försiktighet när outliers finns.`);

    // ── DIAGRAM 2: AreaChart – fördelning/skewness ──────────────────────────
    addMdToPage(`## Hur är förändringen i valdeltagande fördelad?`);
    addToPage(infoNote("Diagrammet visar hur många kommuner som hade olika stor förändring i valdeltagande. X-axeln visar förändringens storlek, y-axeln visar antal kommuner. En kurva som toppar i mitten tyder på normalfördelning."));

    const histBins = [-6, -4, -2, 0, 2, 4, 6, 8];
    const histData = histBins.slice(0, -1).map((min, i) => {
      const max = histBins[i + 1];
      const count = selected.filter(d => d.turnoutChange >= min && d.turnoutChange < max).length;
      return [`${min} till ${max}%`, count];
    });

    const n = selected.length;
    const sigma = stdTC;
    const skewness = selected.reduce((sum, d) => sum + ((d.turnoutChange - meanTC) / sigma) ** 3, 0) / n;
    const skewnessText = skewness > 0.5
      ? "positivt skev – fler kommuner ökade sitt valdeltagande"
      : skewness < -0.5
        ? "negativt skev – fler kommuner minskade sitt valdeltagande"
        : "ungefär normalfördelad – förändringarna är jämnt spridda runt genomsnittet";

    drawGoogleChart({
      type: "AreaChart",
      data: [["Förändring i valdeltagande", "Antal kommuner"], ...histData],
      options: {
        title: "Fördelning av förändring i valdeltagande (2018→2022)",
        fontName: "Georgia",
        hAxis: {
          title: "Förändring (procentenheter)",
          titleTextStyle: { italic: false }
        },
        vAxis: {
          title: "Antal kommuner",
          titleTextStyle: { italic: false },
          gridlines: { count: 4 },
          minorGridlines: { count: 0 }
        },
        colors: [COLORS.primary],
        legend: "none",
        areaOpacity: 0.3,
        height: 360,
        chartArea: { left: 70, top: 40, width: "80%", height: "65%" }
      }
    });

    addMdToPage(`**Hur läser man diagrammet?** Varje område visar hur många kommuner som hade en viss förändring i valdeltagande. En stor area till vänster om 0 betyder att de flesta kommuner hade ett lägre valdeltagande 2022 jämfört med 2018. En area till höger om 0 skulle innebära att fler kommuner ökade sitt valdeltagande.

**Skewness = ${skewness.toFixed(2)}** – fördelningen är ${skewnessText}. Medelvärde: ${meanTC.toFixed(2)}%, standardavvikelse: ${sigma.toFixed(2)}%.`);

    // ── DIAGRAM 3: Täthetsutveckling ────────────────────────────────────────
    addMdToPage(`## Påverkade täthetsutvecklingen valdeltagandet?`);
    addToPage(infoNote("Kommunerna delas i tre grupper baserat på om befolkningstätheten minskade, var stabil eller ökade mellan 2018 och 2022. Diagrammet visar genomsnittlig förändring i valdeltagande för varje grupp."));

    const decreased = selected.filter(d => d.densityChange < -1);
    const stable = selected.filter(d => d.densityChange >= -1 && d.densityChange <= 10);
    const increased = selected.filter(d => d.densityChange > 10);

    const decAvg = average(decreased.map(d => d.turnoutChange));
    const stabAvg = average(stable.map(d => d.turnoutChange));
    const incAvg = average(increased.map(d => d.turnoutChange));

    drawGoogleChart({
      type: "ColumnChart",
      data: [
        [
          "Täthetsutveckling",
          "Förändring i valdeltagande (%)",
          { role: "annotation" },
          { role: "tooltip", type: "string", p: { html: true } }
        ],
        [
          `Minskad täthet (${decreased.length})`,
          decAvg,
          `${decAvg.toFixed(2)}%`,
          `<div style="padding:10px;font-family:Georgia"><b>Minskad täthet</b><br>${decreased.length} kommuner<br>Snitt förändring i valdeltagande: ${decAvg.toFixed(2)}%<br>Dessa kommuner tappade invånare 2018–2022</div>`
        ],
        [
          `Stabil täthet (${stable.length})`,
          stabAvg,
          `${stabAvg.toFixed(2)}%`,
          `<div style="padding:10px;font-family:Georgia"><b>Stabil täthet</b><br>${stable.length} kommuner<br>Snitt förändring i valdeltagande: ${stabAvg.toFixed(2)}%<br>Dessa kommuner hade oförändrad befolkningstäthet</div>`
        ],
        [
          `Ökad täthet (${increased.length})`,
          incAvg,
          `${incAvg.toFixed(2)}%`,
          `<div style="padding:10px;font-family:Georgia"><b>Ökad täthet</b><br>${increased.length} kommuner<br>Snitt förändring i valdeltagande: ${incAvg.toFixed(2)}%<br>Dessa kommuner växte kraftigt 2018–2022</div>`
        ]
      ],
      options: {
        title: "Förändring i valdeltagande (2018→2022) efter täthetsutveckling",
        fontName: "Georgia",
        hAxis: { title: "Täthetsutveckling", titleTextStyle: { italic: false } },
        vAxis: {
          title: "Genomsnittlig förändring i valdeltagande (%)",
          titleTextStyle: { italic: false },
          gridlines: { count: 4 },
          minorGridlines: { count: 0 }
        },
        colors: [COLORS.primary],
        legend: "none",
        tooltip: { isHtml: true },
        annotations: { alwaysOutside: true, textStyle: { fontSize: 12, bold: true } },
        height: 380,
        chartArea: { left: 80, top: 40, width: "80%", height: "65%" }
      }
    });

    addMdToPage(`**Hur tolkar man detta?** Staplarna visar om valdeltagandet ökade eller minskade i genomsnitt. En negativ stapel betyder att kommunerna i den gruppen i genomsnitt hade färre röstande 2022 jämfört med 2018. Kommuner med minskad täthet (avfolkningskommuner) hade ${decAvg < 0 ? "ett minskat" : "ett ökat"} valdeltagande på ${decAvg.toFixed(2)}%, medan kommuner med ökad täthet (växande kommuner) hade ${incAvg.toFixed(2)}%.`);

    // ── DIAGRAM 4: Glesbygd vs stad ─────────────────────────────────────────
    addMdToPage(`## Glesbygd vs stad – var förändrades valdeltagandet mest?`);
    addToPage(infoNote("Kommunerna delas i två lika stora grupper baserat på befolkningstäthet 2022. Förändringen visar skillnaden i valdeltagande mellan valet 2018 och valet 2022."));

    drawGoogleChart({
      type: "ColumnChart",
      data: [
        [
          "Grupp",
          "Genomsnittlig förändring i valdeltagande (%)",
          { role: "annotation" },
          { role: "tooltip", type: "string", p: { html: true } }
        ],
        [
          `Låg täthet – glesbygd (${low.length})`,
          lowAvg,
          `${lowAvg.toFixed(2)}%`,
          `<div style="padding:10px;font-family:Georgia"><b>Glesbygd</b><br>${low.length} kommuner (lägst täthet 2022)<br>Snitt förändring i valdeltagande 2018→2022: ${lowAvg.toFixed(2)}%</div>`
        ],
        [
          `Hög täthet – stad (${high.length})`,
          highAvg,
          `${highAvg.toFixed(2)}%`,
          `<div style="padding:10px;font-family:Georgia"><b>Stad</b><br>${high.length} kommuner (högst täthet 2022)<br>Snitt förändring i valdeltagande 2018→2022: ${highAvg.toFixed(2)}%</div>`
        ]
      ],
      options: {
        title: "Genomsnittlig förändring i valdeltagande (2018→2022) – glesbygd vs stad",
        fontName: "Georgia",
        hAxis: { title: "Grupp", titleTextStyle: { italic: false } },
        vAxis: {
          title: "Genomsnittlig förändring i valdeltagande (%)",
          titleTextStyle: { italic: false },
          gridlines: { count: 4 },
          minorGridlines: { count: 0 }
        },
        colors: [COLORS.primary],
        legend: "none",
        tooltip: { isHtml: true },
        annotations: { alwaysOutside: true, textStyle: { fontSize: 13, bold: true } },
        height: 380,
        chartArea: { left: 80, top: 40, width: "80%", height: "65%" }
      }
    });

    addMdToPage(`**Hur tolkar man detta?** Grupperingen baseras på befolkningstäthet år 2022, men förändringen mäter skillnaden i valdeltagande mellan 2018 och 2022. Glesbygdskommuner (låg täthet) hade i genomsnitt ${lowAvg.toFixed(2)} procentenheters förändring, medan städer (hög täthet) hade ${highAvg.toFixed(2)} procentenheters förändring. ${Math.abs(lowAvg - highAvg) > 0.5 ? `Det finns en skillnad på ${Math.abs(lowAvg - highAvg).toFixed(2)} procentenheter mellan stad och glesbygd.` : "Skillnaden mellan stad och glesbygd är liten."}`);

    // ── DIAGRAM 5: Region BarChart ──────────────────────────────────────────
    if (hasRegionData) {
      const north = selected.filter(d => d.region === "Norr");
      const middle = selected.filter(d => d.region === "Mitten");
      const south = selected.filter(d => d.region === "Söder");

      const nAvg = average(north.map(d => d.turnoutChange));
      const mAvg = average(middle.map(d => d.turnoutChange));
      const sAvg = average(south.map(d => d.turnoutChange));
      const nStd = std(north.map(d => d.turnoutChange));
      const mStd = std(middle.map(d => d.turnoutChange));
      const sStd = std(south.map(d => d.turnoutChange));

      addMdToPage(`## Norr vs Söder – var röstade fler 2022?`);
      addToPage(infoNote("Regioner baserade på latitud: Söder = under 57°, Mitten = 57–62°, Norr = över 62°. Staplarna visar genomsnittlig förändring i valdeltagande mellan 2018 och 2022."));

      drawGoogleChart({
        type: "BarChart",
        data: [
          [
            "Region",
            "Genomsnittlig förändring i valdeltagande (%)",
            { role: "annotation" },
            { role: "tooltip", type: "string", p: { html: true } }
          ],
          [
            `Norr (${north.length} kommuner)`,
            nAvg,
            `${nAvg.toFixed(2)}%`,
            `<div style="padding:10px;font-family:Georgia"><b>Norr</b><br>${north.length} kommuner<br>Medel förändring 2018→2022: ${nAvg.toFixed(2)}%<br>Spridning (std): ${nStd.toFixed(2)}%</div>`
          ],
          [
            `Mitten (${middle.length} kommuner)`,
            mAvg,
            `${mAvg.toFixed(2)}%`,
            `<div style="padding:10px;font-family:Georgia"><b>Mitten</b><br>${middle.length} kommuner<br>Medel förändring 2018→2022: ${mAvg.toFixed(2)}%<br>Spridning (std): ${mStd.toFixed(2)}%</div>`
          ],
          [
            `Söder (${south.length} kommuner)`,
            sAvg,
            `${sAvg.toFixed(2)}%`,
            `<div style="padding:10px;font-family:Georgia"><b>Söder</b><br>${south.length} kommuner<br>Medel förändring 2018→2022: ${sAvg.toFixed(2)}%<br>Spridning (std): ${sStd.toFixed(2)}%</div>`
          ]
        ],
        options: {
          title: "Genomsnittlig förändring i valdeltagande (2018→2022) per region",
          fontName: "Georgia",
          hAxis: {
            title: "Genomsnittlig förändring i valdeltagande (%)",
            titleTextStyle: { italic: false },
            gridlines: { count: 4 },
            minorGridlines: { count: 0 }
          },
          vAxis: { titleTextStyle: { italic: false } },
          colors: [COLORS.primary],
          legend: "none",
          tooltip: { isHtml: true },
          annotations: { alwaysOutside: true, textStyle: { fontSize: 12, bold: true } },
          height: 300,
          chartArea: { left: 180, top: 40, width: "65%", height: "65%" }
        }
      });

      addMdToPage(`**Hur tolkar man detta?** Staplarna visar om valdeltagandet i genomsnitt ökade eller minskade i varje region. Norr hade ${nAvg.toFixed(2)}%, Mitten ${mAvg.toFixed(2)}% och Söder ${sAvg.toFixed(2)}%. ${nAvg < sAvg ? "Södra Sverige hade alltså ett högre valdeltagande 2022 jämfört med 2018 än norra Sverige." : "Norra Sverige hade alltså en större förändring i valdeltagande än södra Sverige."}`);

      addMdToPage(`### Regionstatistik – medelvärde och spridning`);
      tableFromData({
        data: [
          { "Region": "Norr", "Antal kommuner": north.length, "Förändring valdeltagande 2018→2022 (%)": nAvg.toFixed(2), "Standardavvikelse": nStd.toFixed(2) },
          { "Region": "Mitten", "Antal kommuner": middle.length, "Förändring valdeltagande 2018→2022 (%)": mAvg.toFixed(2), "Standardavvikelse": mStd.toFixed(2) },
          { "Region": "Söder", "Antal kommuner": south.length, "Förändring valdeltagande 2018→2022 (%)": sAvg.toFixed(2), "Standardavvikelse": sStd.toFixed(2) }
        ]
      });

      addMdToPage(`**Hur läser man tabellen?** Medelvärdet visar den genomsnittliga förändringen i valdeltagande för kommunerna i regionen mellan 2018 och 2022. Standardavvikelsen visar hur mycket kommunerna skiljer sig åt inom regionen – ett högt värde (t.ex. Mitten: ${mStd.toFixed(2)}%) betyder att det finns stor variation, dvs. vissa kommuner förändrades mycket mer än andra.`);
    }

    // ── KORRELATIONSANALYS ──────────────────────────────────────────────────
    const corr2018 = correlation(selected.map(d => d.density2018), selected.map(d => d.turnoutChange));
    const corr2022val = correlation(selected.map(d => d.density2022), selected.map(d => d.turnoutChange));
    const corrChange = correlation(selected.map(d => d.densityChange), selected.map(d => d.turnoutChange));

    addMdToPage(`## Korrelationsanalys`);
    addToPage(infoNote("r-värdet mäter styrkan på sambandet mellan två variabler. Ett negativt r betyder att när en variabel ökar, minskar den andra. Här mäts sambandet mellan befolkningstäthet och förändring i valdeltagande 2018→2022."));

    tableFromData({
      data: [
        { "Variabel": "Befolkningstäthet 2018", "r-värde": Number.isFinite(corr2018) ? corr2018.toFixed(3) : "-", "Tolkning": interpretationText(corr2018) },
        { "Variabel": "Befolkningstäthet 2022", "r-värde": Number.isFinite(corr2022val) ? corr2022val.toFixed(3) : "-", "Tolkning": interpretationText(corr2022val) },
        { "Variabel": "Förändring i täthet 2018→2022", "r-värde": Number.isFinite(corrChange) ? corrChange.toFixed(3) : "-", "Tolkning": interpretationText(corrChange) }
      ]
    });

    addMdToPage(`**Hur läser man tabellen?** r nära 0 = inget samband | r nära 1 = starkt positivt samband (båda ökar tillsammans) | r nära -1 = starkt negativt samband (när täthet ökar, minskar valdeltagandeförändringen).`);

    // ── FÖRKLARING ──────────────────────────────────────────────────────────
    addMdToPage(`
## Linearitet

Scatter ploten visar sambandet mellan befolkningstäthet och förändring i valdeltagande. Sambandet är inte perfekt linjärt – det finns en krökning, särskilt för extremt täta kommuner (storstäder). Logaritmisk skala på x-axeln gör sambandet mer linjärt och motiverar användningen av Pearsons korrelationskoefficient.

## Tolkning av resultaten

Sambandet mellan befolkningstäthet 2022 och förändring i valdeltagande är **${interpretationText(corr2022val).toLowerCase()}** (r = ${Number.isFinite(corr2022val) ? corr2022val.toFixed(3) : "-"}). Det betyder att ${corr2022val < 0 ? "tätare kommuner tenderade att ha ett lägre valdeltagande 2022 jämfört med 2018, medan glesare kommuner förändrades mindre negativt." : "tätare kommuner tenderade att ha ett högre valdeltagande 2022 jämfört med 2018."}

Kommuner med låg täthet (glesbygd) hade i genomsnitt **${lowAvg.toFixed(2)} procentenheters** förändring i valdeltagande, medan kommuner med hög täthet (städer) hade **${highAvg.toFixed(2)} procentenheters** förändring. ${Math.abs(lowAvg - highAvg) > 0.5 ? `Det finns en skillnad på ${Math.abs(lowAvg - highAvg).toFixed(2)} procentenheter mellan stad och glesbygd.` : "Skillnaden mellan stad och glesbygd är liten."}

## Kritisk tolkning av korrelationen

- **R² = ${Number.isFinite(corr2022val) ? (corr2022val ** 2 * 100).toFixed(1) : "-"}%** – befolkningstäthet förklarar ungefär ${Number.isFinite(corr2022val) ? (corr2022val ** 2 * 100).toFixed(1) : "-"}% av variationen i valdeltagandeförändring. Det betyder att ${Number.isFinite(corr2022val) ? (100 - corr2022val ** 2 * 100).toFixed(0) : "80"}% beror på andra faktorer.
- **Outliers** – ${outlierPoints.length} kommuner avviker extremt och kan påverka r-värdet, men de är med i analysen eftersom de är verkliga resultat.
- **Ekologisk felslutning** – vi analyserar kommuner, inte individer. Sambandet på kommunnivå speglar inte nödvändigtvis individuellt beteende.
- **Konfunderande variabler** – täthet samvarierar med inkomst, ålder och utbildningsnivå vilket gör det svårt att isolera geografins effekt.
    `);

    addToPage(analysisBox("Korrelation är inte kausalitet", `
      <p>Sambandet mellan geografi och valdeltagandeförändringar betyder <b>inte</b> att befolkningstäthet i sig orsakade förändringen. Det kan bero på lokala politiska händelser, demografiska förändringar eller ekonomiska faktorer. Geografi samvarierar med många andra variabler.</p>
    `));

    addToPage(analysisBox("Slutsats", `
      <p><b>Vad visar analysen?</b> Valdeltagandet förändrades mellan riksdagsvalen 2018 och 2022, och förändringen varierade mellan kommuner beroende på befolkningstäthet och geografisk region.</p>
      <p><b>Vad betyder det?</b> Det finns ett ${interpretationText(corr2022val).toLowerCase()} (r = ${Number.isFinite(corr2022val) ? corr2022val.toFixed(3) : "-"}) mellan befolkningstäthet och förändring i valdeltagande. ${corr2022val < 0 ? "Tätare kommuner (städer) tenderade att ha ett något lägre valdeltagande 2022 jämfört med 2018, medan glesbygdskommuner förändrades annorlunda." : "Tätare kommuner tenderade att ha ett högre valdeltagande."} Regionalt syns också skillnader mellan Norr, Mitten och Söder.</p>
      <p><b>Vad förklarar inte analysen?</b> Ungefär ${Number.isFinite(corr2022val) ? (100 - corr2022val ** 2 * 100).toFixed(0) : "80"}% av variationen beror på andra faktorer – inkomst, ålder, utbildning och lokala förhållanden analyseras på övriga sidor i projektet.</p>
    `, true));
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

if (!dbInfoOk) {
  displayDbNotOkText();
} else {
  const data = buildData();
  renderPage(data);
}