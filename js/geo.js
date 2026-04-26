import dbInfoOk, { displayDbNotOkText } from "./helpers/dbInfoOk.js";
import { valdataKommun, geoData } from "./helpers/dataLoader.js";
import { average, correlation } from "./helpers/utils.js";
import { COLORS, pageHero, statGrid, statCard, infoNote, analysisBox } from "./helpers/components.js";

// Omvandlar ett värde till ett tal, returnerar 0 om ogiltigt
function toNum(v) {
  if (v === null || v === undefined) return 0;
  const cleaned = String(v).replace(/\s/g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// Omvandlar ett värde till en sträng
function safeText(v) {
  return v == null ? "" : String(v);
}

// Normaliserar kommunnamn för matchning mot geoData
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

// Tolkar ett r-värde och returnerar textbeskrivning
function interpretationText(r) {
  if (!Number.isFinite(r)) return "Kunde inte beräknas";
  if (Math.abs(r) > 0.5) return "Starkt samband";
  if (Math.abs(r) > 0.2) return "Måttligt samband";
  return "Svagt samband";
}

// Beräknar standardavvikelse
function std(arr) {
  if (arr.length === 0) return 0;
  const mean = average(arr);
  return Math.sqrt(arr.reduce((sum, x) => sum + (x - mean) ** 2, 0) / arr.length);
}

// Bygger latitudkarta från geoData (MySQL)
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

// Bestämmer region baserat på latitud (geografiskt korrekt)
// Under 57 grader = Söder, 57-62 grader = Mitten, over 62 grader = Norr
function getRegion(lat) {
  if (lat === null || lat === undefined || isNaN(lat)) return null;
  if (lat < 57) return "Söder";
  if (lat < 62) return "Mitten";
  return "Norr";
}



// Bygger och bearbetar all data
function buildData() {
  const rows = Array.isArray(valdataKommun) ? valdataKommun : [];
  const geoRows = Array.isArray(geoData) ? geoData : [];

  // Bygg latitudkarta
  const geoMap = indexGeoData(geoRows);

  // Manuellt tillagda kommuner som saknas i geoData
  geoMap["jarfalla"] = 59.42;  // Järfälla
  geoMap["salem"] = 59.20;  // Salem
  geoMap["solna"] = 59.36;  // Solna
  geoMap["sundbyberg"] = 59.36;  // Sundbyberg
  geoMap["tyreso"] = 59.25;  // Tyresö

  return rows.map(r => {
    const kommun = safeText(r["Kommunnamn"] || "");
    const normalizedKommun = normalizeKommun(kommun);
    const latitude = geoMap[normalizedKommun] ?? null;
    const region = getRegion(latitude);

    const density2018 = toNum(r["Befolkningstäthet_2018"]);
    const density2022 = toNum(r["Befolkningstäthet_2022"]);
    const densityChange = density2022 - density2018;

    // Totala röster 2018 och 2022
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

    // Röstförändring = förändring i andel röster för högerblocket
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

    return {
      kommun,
      valkrets: safeText(r["Riksdagsvalkrets"] || ""),
      density2018,
      density2022,
      densityChange: Number(densityChange.toFixed(2)),
      latitude,
      region,
      voteChange: Number(voteChange.toFixed(2))
    };
  }).filter(d => d.kommun && d.density2022 > 0);
}

// Renderar hela sidan
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
  addToPage(pageHero(
    "Geografi och förändring i valresultat",
    "Kan befolkningstäthet och geografisk region förklara hur valresultatet förändrades mellan riksdagsvalen 2018 och 2022?",
    [`${data.length} kommuner`, "Riksdagsvalet 2018–2022", "Täthet + Region"]
  ));

  // Dropdown-filter
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

  // Returnerar filtrerad data
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

  // Ritar all data, tabeller och diagram
  function draw() {
    const selected = getFiltered();

    const sortedSel = [...selected].sort((a, b) => a.density2022 - b.density2022);
    const midSel = Math.floor(sortedSel.length / 2);
    const low = sortedSel.slice(0, midSel);
    const high = sortedSel.slice(midSel);
    const lowAvg = average(low.map(d => d.voteChange));
    const highAvg = average(high.map(d => d.voteChange));
    const avgDensity = average(selected.map(d => d.density2022)).toFixed(1);
    const avgVoteChange = average(selected.map(d => d.voteChange)).toFixed(2);

    // Statistikkort
    addToPage(statGrid([
      statCard("Antal kommuner i urvalet", selected.length),
      statCard("Genomsnittlig täthet 2022", `${avgDensity} inv/km²`),
      statCard("Genomsnittlig röstförändring", `${avgVoteChange} %`),
      statCard("Låg täthet – snitt", `${lowAvg.toFixed(2)} %`),
      statCard("Hög täthet – snitt", `${highAvg.toFixed(2)} %`),
      statCard("Kommuner med regiondata", `${selected.filter(d => d.region).length}`)
    ]));

    // Tabell: Topp 10 kommuner med störst röstförändring
    addMdToPage(`## Topp 10 kommuner med störst röstförändring`);
    tableFromData({
      data: [...selected]
        .sort((a, b) => b.voteChange - a.voteChange)
        .slice(0, 10)
        .map(d => ({
          "Kommun": d.kommun,
          "Täthet 2022": d.density2022,
          "Röstförändring (%)": d.voteChange,
          "Region": d.region || "-"
        }))
    });

    // Diagram 1: Linjediagram täthet 2022 vs röstförändring
    addMdToPage(`## Röstade tätare kommuner annorlunda?`);
    addToPage(infoNote("Kommunerna grupperas i täthetsintervall. En nedåtgående linje betyder att tätare kommuner tenderade att rösta annorlunda."));

    const intervals1 = [
      { label: "0–50", min: 0, max: 50 },
      { label: "50–100", min: 50, max: 100 },
      { label: "100–500", min: 100, max: 500 },
      { label: "500–1000", min: 500, max: 1000 },
      { label: "1000–3000", min: 1000, max: 3000 },
      { label: "3000+", min: 3000, max: Infinity }
    ];
    const lineData1 = intervals1.map(iv => {
      const group = selected.filter(d => d.density2022 >= iv.min && d.density2022 < iv.max);
      return [iv.label, group.length > 0 ? average(group.map(d => d.voteChange)) : null];
    }).filter(d => d[1] !== null);

    drawGoogleChart({
      type: "LineChart",
      data: [["Befolkningstäthet 2022 (inv/km²)", "Genomsnittlig röstförändring (%)"], ...lineData1],
      options: {
        title: "Befolkningstäthet 2022 och röstförändring",
        hAxis: { title: "Befolkningstäthet 2022 (inv/km²)" },
        vAxis: { title: "Genomsnittlig röstförändring (%)" },
        colors: [COLORS.primary],
        pointSize: 6,
        curveType: "function",
        legend: "none",
        height: 420
      }
    });

    // Diagram 2: Linjediagram täthet 2018 vs röstförändring
    addMdToPage(`## Spelade utgångsläget 2018 roll?`);
    addToPage(infoNote("Samma analys med täthetsdata från 2018 – alltså innan valet."));

    const intervals2 = [
      { label: "0–50", min: 0, max: 50 },
      { label: "50–100", min: 50, max: 100 },
      { label: "100–500", min: 100, max: 500 },
      { label: "500–1000", min: 500, max: 1000 },
      { label: "1000–3000", min: 1000, max: 3000 },
      { label: "3000+", min: 3000, max: Infinity }
    ];
    const lineData2 = intervals2.map(iv => {
      const group = selected.filter(d => d.density2018 >= iv.min && d.density2018 < iv.max);
      return [iv.label, group.length > 0 ? average(group.map(d => d.voteChange)) : null];
    }).filter(d => d[1] !== null);

    drawGoogleChart({
      type: "LineChart",
      data: [["Befolkningstäthet 2018 (inv/km²)", "Genomsnittlig röstförändring (%)"], ...lineData2],
      options: {
        title: "Befolkningstäthet 2018 och röstförändring",
        hAxis: { title: "Befolkningstäthet 2018 (inv/km²)" },
        vAxis: { title: "Genomsnittlig röstförändring (%)" },
        colors: [COLORS.primary],
        pointSize: 6,
        curveType: "function",
        legend: "none",
        height: 420
      }
    });

    // Diagram 3: Minskad/stabil/ökad täthet
    addMdToPage(`## Påverkade täthetsutvecklingen röstningen?`);
    addToPage(infoNote("Kommunerna delas i tre grupper: minskad, stabil eller ökad befolkningstäthet mellan 2018 och 2022."));

    const decreased = selected.filter(d => d.densityChange < -1);
    const stable = selected.filter(d => d.densityChange >= -1 && d.densityChange <= 10);
    const increased = selected.filter(d => d.densityChange > 10);

    drawGoogleChart({
      type: "ColumnChart",
      data: [
        ["Täthetsutveckling", "Röstförändring (%)"],
        [`Minskad täthet (${decreased.length})`, average(decreased.map(d => d.voteChange))],
        [`Stabil täthet (${stable.length})`, average(stable.map(d => d.voteChange))],
        [`Ökad täthet (${increased.length})`, average(increased.map(d => d.voteChange))]
      ],
      options: {
        title: "Röstförändring efter täthetsutveckling",
        hAxis: { title: "Täthetsutveckling" },
        vAxis: { title: "Genomsnittlig röstförändring (%)" },
        colors: [COLORS.primary],
        legend: "none",
        height: 420
      }
    });

    // Diagram 4: Glesbygd vs stad
    addMdToPage(`## Glesbygd vs stad – vem förändrade sin röst mest?`);
    addToPage(infoNote("Kommunerna delas i två lika stora grupper baserat på befolkningstäthet 2022."));

    drawGoogleChart({
      type: "ColumnChart",
      data: [
        ["Grupp", "Genomsnittlig röstförändring (%)"],
        [`Låg täthet (${low.length})`, lowAvg],
        [`Hög täthet (${high.length})`, highAvg]
      ],
      options: {
        title: "Genomsnittlig röstförändring – glesbygd vs stad",
        hAxis: { title: "Grupp" },
        vAxis: { title: "Genomsnittlig röstförändring (%)" },
        colors: [COLORS.primary],
        legend: "none",
        height: 420
      }
    });

    // Diagram 5: Region (baserat på latitud)
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

      addMdToPage(`## Norr vs Söder – vem förändrades mest?`);
      addToPage(infoNote("Regioner baserade på latitud: Söder = under 57°, Mitten = 57–62°, Norr = över 62°."));

      drawGoogleChart({
        type: "ColumnChart",
        data: [
          ["Region", "Genomsnittlig röstförändring (%)"],
          [`Norr (${north.length})`, nAvg],
          [`Mitten (${middle.length})`, mAvg],
          [`Söder (${south.length})`, sAvg]
        ],
        options: {
          title: "Genomsnittlig röstförändring per region",
          hAxis: { title: "Region" },
          vAxis: { title: "Genomsnittlig röstförändring (%)" },
          colors: [COLORS.primary],
          legend: "none",
          height: 420
        }
      });

      // Tabell: Regionstatistik
      addMdToPage(`### Regionstatistik – medelvärde och spridning`);
      tableFromData({
        data: [
          { "Region": "Norr", "Antal kommuner": north.length, "Medelvärde (%)": nAvg.toFixed(2), "Standardavvikelse": nStd.toFixed(2) },
          { "Region": "Mitten", "Antal kommuner": middle.length, "Medelvärde (%)": mAvg.toFixed(2), "Standardavvikelse": mStd.toFixed(2) },
          { "Region": "Söder", "Antal kommuner": south.length, "Medelvärde (%)": sAvg.toFixed(2), "Standardavvikelse": sStd.toFixed(2) }
        ]
      });

      addMdToPage(`*En hög standardavvikelse betyder att kommunerna inom regionen spretar mycket i sin röstförändring.*`);
    }

    // Korrelationsanalys
    const corr2018 = correlation(selected.map(d => d.density2018), selected.map(d => d.voteChange));
    const corr2022val = correlation(selected.map(d => d.density2022), selected.map(d => d.voteChange));
    const corrChange = correlation(selected.map(d => d.densityChange), selected.map(d => d.voteChange));

    addMdToPage(`## Korrelationsanalys`);
    tableFromData({
      data: [
        { "Variabel": "Befolkningstäthet 2018", "r-värde": Number.isFinite(corr2018) ? corr2018.toFixed(3) : "-", "Tolkning": interpretationText(corr2018) },
        { "Variabel": "Befolkningstäthet 2022", "r-värde": Number.isFinite(corr2022val) ? corr2022val.toFixed(3) : "-", "Tolkning": interpretationText(corr2022val) },
        { "Variabel": "Förändring i täthet", "r-värde": Number.isFinite(corrChange) ? corrChange.toFixed(3) : "-", "Tolkning": interpretationText(corrChange) }
      ]
    });

    addMdToPage(`*r nära 0 = inget samband | r nära 1 = starkt positivt | r nära -1 = starkt negativt*`);

    addMdToPage(`
## Tolkning av resultaten

Sambandet mellan befolkningstäthet 2022 och röstförändring är **${interpretationText(corr2022val).toLowerCase()}** (r = ${Number.isFinite(corr2022val) ? corr2022val.toFixed(3) : "-"}). Det tyder på att ${corr2022val < 0 ? "tätare kommuner tenderade att ha en lägre röstförändring än glesare kommuner" : "tätare kommuner tenderade att ha en högre röstförändring än glesare kommuner"}.

Sambandet mellan täthetsutvecklingen (förändring i täthet) och röstförändring är **${interpretationText(corrChange).toLowerCase()}** (r = ${Number.isFinite(corrChange) ? corrChange.toFixed(3) : "-"}), vilket visar om kommuner som växte i täthet också förändrade sin röstning annorlunda.

Kommuner med låg befolkningstäthet hade i genomsnitt **${lowAvg.toFixed(2)} procentenheters** röstförändring, medan kommuner med hög befolkningstäthet hade **${highAvg.toFixed(2)} procentenheters** röstförändring. ${Math.abs(lowAvg - highAvg) > 1 ? "Det finns en tydlig skillnad mellan stad och glesbygd." : "Skillnaden mellan stad och glesbygd är liten."}
    `);

    addToPage(analysisBox("Korrelation är inte kausalitet", `
      <p>Även om vi ser samband mellan geografi och valförändringar betyder det inte att befolkningstäthet i sig orsakade förändringen. Geografi samvarierar med faktorer som inkomst, ålder och utbildningsnivå.</p>
    `));

    addToPage(analysisBox("Slutsats", `
      <p>Analysen visar att geografiska faktorer – befolkningstäthet och regional tillhörighet – har ett samband med hur röstmönstren förändrades mellan riksdagsvalen 2018 och 2022. Kommuner med lägre befolkningstäthet (glesbygd) tenderade att förändras mer än tätare kommuner. Regionalt syns också skillnader mellan Norr, Mitten och Söder.</p>
      <p>Sambanden är dock inte tillräckligt starka för att geografi ensam ska förklara hela bilden – andra faktorer analyseras på övriga sidor i projektet.</p>
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
  // Debug visade att 5 kommuner saknade region i geoData:
  // Järfälla, Salem, Solna, Sundbyberg, Tyresö
  // Dessa har lagts till manuellt i FALLBACK_LATITUDES ovan
  renderPage(data);
}