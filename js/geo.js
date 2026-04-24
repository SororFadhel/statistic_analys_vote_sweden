import dbInfoOk, { displayDbNotOkText } from "./helpers/dbInfoOk.js";
import { valdataKommun, geoData } from "./helpers/dataLoader.js";
import { average, correlation } from "./helpers/utils.js";
import { COLORS, pageHero, statGrid, statCard, infoNote, analysisBox } from "./helpers/components.js";



// ===============================
// Hjälpfunktioner – omvandlar och rensar data
// ===============================



// Omvandlar ett värde till ett tal, returnerar 0 om ogiltigt
function toNum(v) {
  if (v === null || v === undefined) return 0;
  const cleaned = String(v).replace(/\s/g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}



// Omvandlar ett värde till en sträng, returnerar tom sträng om null
function safeText(v) {
  return v == null ? "" : String(v);
}



// Normaliserar kommunnamn för matchning (tar bort accenter, "kommun", etc.)
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



// Tolkar ett r-värde (korrelation) och returnerar en textbeskrivning
function interpretationText(r) {
  if (!Number.isFinite(r)) return "Kunde inte beräknas";
  if (Math.abs(r) > 0.5) return "Starkt samband";
  if (Math.abs(r) > 0.2) return "Måttligt samband";
  return "Svagt samband";
}



// Beräknar standardavvikelse för en array av tal
function std(arr) {
  if (arr.length === 0) return 0;
  const mean = average(arr);
  return Math.sqrt(arr.reduce((sum, x) => sum + (x - mean) ** 2, 0) / arr.length);
}



// ===============================
// Bygg data – hämtar och bearbetar all rådata
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
// Rendera sidan – visar all data och diagram
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



  addToPage(pageHero(
    "Geografi och förändring i valresultat",
    "Kan befolkningstäthet och geografisk region förklara hur valresultatet förändrades mellan riksdagsvalen 2018 och 2022?",
    [`${data.length} kommuner`, "Riksdagsvalet 2018–2022", "Täthet + Region", "SD-analys"]
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
    const lowAvg = average(low.map(d => d.voteChange));
    const highAvg = average(high.map(d => d.voteChange));
    const avgDensity = average(selected.map(d => d.density2022)).toFixed(1);
    const avgVoteChange = average(selected.map(d => d.voteChange)).toFixed(2);
    const avgSdChange = average(selected.map(d => d.sdChange)).toFixed(2);



    addToPage(statGrid([
      statCard("Antal kommuner i urvalet", selected.length),
      statCard("Genomsnittlig täthet 2022", `${avgDensity} <span class="value-unit">inv/km²</span>`),
      statCard("Genomsnittlig röstförändring", `${avgVoteChange} <span class="value-unit">%</span>`),
      statCard("Genomsnittlig SD-förändring", `${avgSdChange} <span class="value-unit">%</span>`),
      statCard("Låg täthet – snitt röstförändring", `${lowAvg.toFixed(2)} <span class="value-unit">%</span>`),
      statCard("Hög täthet – snitt röstförändring", `${highAvg.toFixed(2)} <span class="value-unit">%</span>`)
    ]));



    addMdToPage(`## Topp 10 kommuner med störst röstförändring`);
    tableFromData({
      data: [...selected]
        .sort((a, b) => b.voteChange - a.voteChange)
        .slice(0, 10)
        .map(d => ({
          "Kommun": d.kommun,
          "Täthet 2022": d.density2022,
          "Högerblock förändring (%)": d.voteChange,
          "SD förändring (%)": d.sdChange,
          "Region": d.region || "-"
        }))
    });



    addMdToPage(`## Röstade tätare kommuner annorlunda?`);
    addToPage(infoNote("Kommunerna grupperas i täthetsintervall. En nedåtgående linje betyder att tätare kommuner tenderade att rösta mindre åt höger."));



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
        title: "Befolkningstäthet 2022 och genomsnittlig röstförändring",
        hAxis: { title: "Befolkningstäthet 2022 (inv/km²)" },
        vAxis: { title: "Genomsnittlig röstförändring (%)" },
        colors: [COLORS.primary],
        pointSize: 6,
        curveType: "function",
        legend: "none",
        height: 420
      }
    });



    addMdToPage(`## Spelade utgångsläget 2018 roll?`);
    addToPage(infoNote("Samma analys fast med täthetsdata från 2018 – alltså innan valet. Visar om kommunernas utgångsläge hängde ihop med hur röstmönstren senare förändrades."));



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
        title: "Befolkningstäthet 2018 och genomsnittlig röstförändring",
        hAxis: { title: "Befolkningstäthet 2018 (inv/km²)" },
        vAxis: { title: "Genomsnittlig röstförändring (%)" },
        colors: [COLORS.primary],
        pointSize: 6,
        curveType: "function",
        legend: "none",
        height: 420
      }
    });



    addMdToPage(`## Påverkade täthetsutvecklingen röstningen?`);
    addToPage(infoNote("Kommunerna delas upp i tre grupper: minskad, stabil eller ökad befolkningstäthet."));



    const decreased = selected.filter(d => d.densityChange < -1);
    const stable = selected.filter(d => d.densityChange >= -1 && d.densityChange <= 10);
    const increased = selected.filter(d => d.densityChange > 10);



    drawGoogleChart({
      type: "ColumnChart",
      data: [
        ["Täthetsutveckling", "Högerblock förändring (%)", "SD förändring (%)"],
        [`Minskad täthet (${decreased.length})`, average(decreased.map(d => d.voteChange)), average(decreased.map(d => d.sdChange))],
        [`Stabil täthet (${stable.length})`, average(stable.map(d => d.voteChange)), average(stable.map(d => d.sdChange))],
        [`Ökad täthet (${increased.length})`, average(increased.map(d => d.voteChange)), average(increased.map(d => d.sdChange))]
      ],
      options: {
        title: "Röstförändring efter täthetsutveckling",
        hAxis: { title: "Täthetsutveckling" },
        vAxis: { title: "Genomsnittlig förändring (%)" },
        colors: [COLORS.primary, COLORS.secondary],
        legend: { position: "top" },
        height: 420
      }
    });



    addMdToPage(`## Glesbygd vs stad – vem förändrade sin röst mest?`);
    addToPage(infoNote("Kommunerna delas i två lika stora grupper. En tydlig skillnad mellan staplarna tyder på att täthet spelar roll."));



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
        colors: [COLORS.primary],
        legend: "none",
        height: 420
      }
    });



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
      addToPage(infoNote("Sverige delas i tre lika stora delar baserat på kommunernas latitud."));



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
          colors: [COLORS.primary],
          legend: "none",
          height: 420
        }
      });



      addMdToPage(`### Regionstatistik – medelvärde och spridning`);
      tableFromData({
        data: [
          { "Region": "Norr", "Antal kommuner": north.length, "Medelvärde (%)": nAvg.toFixed(2), "Standardavvikelse": nStd.toFixed(2) },
          { "Region": "Mitten", "Antal kommuner": middle.length, "Medelvärde (%)": mAvg.toFixed(2), "Standardavvikelse": mStd.toFixed(2) },
          { "Region": "Söder", "Antal kommuner": south.length, "Medelvärde (%)": sAvg.toFixed(2), "Standardavvikelse": sStd.toFixed(2) }
        ]
      });



      addMdToPage(`*En hög standardavvikelse betyder att kommunerna inom regionen spretar mycket. En låg standardavvikelse betyder att kommunerna är mer lika varandra.*`);
    }



    addMdToPage(`## Var ökade SD mest – stad eller glesbygd?`);
    addToPage(infoNote("SD var det parti som förändrades mest 2018–2022. Kommunerna grupperas i täthetsintervall för att visa var SD ökade mest."));



    const intervalsSD = [
      { label: "0–50", min: 0, max: 50 },
      { label: "50–100", min: 50, max: 100 },
      { label: "100–500", min: 100, max: 500 },
      { label: "500–1000", min: 500, max: 1000 },
      { label: "1000–3000", min: 1000, max: 3000 },
      { label: "3000+", min: 3000, max: Infinity }
    ];
    const lineDataSD = intervalsSD.map(iv => {
      const group = selected.filter(d => d.density2022 >= iv.min && d.density2022 < iv.max);
      return [iv.label, group.length > 0 ? average(group.map(d => d.sdChange)) : null];
    }).filter(d => d[1] !== null);



    drawGoogleChart({
      type: "LineChart",
      data: [["Befolkningstäthet 2022 (inv/km²)", "Genomsnittlig SD-förändring (%)"], ...lineDataSD],
      options: {
        title: "Befolkningstäthet och SD:s röstandelsförändring",
        hAxis: { title: "Befolkningstäthet 2022 (inv/km²)" },
        vAxis: { title: "Genomsnittlig SD-förändring (%)" },
        colors: [COLORS.secondary],
        pointSize: 6,
        curveType: "function",
        legend: "none",
        height: 420
      }
    });



    if (hasRegionData) {
      const northSD = selected.filter(d => d.region === "Norr");
      const middleSD = selected.filter(d => d.region === "Mitten");
      const southSD = selected.filter(d => d.region === "Söder");



      addMdToPage(`## Var i Sverige ökade SD mest?`);
      addToPage(infoNote("Jämför SD:s geografiska mönster med högerblockets mönster."));



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
          colors: [COLORS.secondary],
          legend: "none",
          height: 420
        }
      });
    }



    // ---- KORRELATIONSANALYS ----
    const corr2018 = correlation(selected.map(d => d.density2018), selected.map(d => d.voteChange));
    const corr2022val = correlation(selected.map(d => d.density2022), selected.map(d => d.voteChange));
    const corrChange = correlation(selected.map(d => d.densityChange), selected.map(d => d.voteChange));



    addMdToPage(`## Korrelationsanalys`);
    tableFromData({
      data: [
        { 'Variabel': 'Befolkningstäthet 2018', 'r-värde': Number.isFinite(corr2018) ? corr2018.toFixed(3) : '-', 'Tolkning': interpretationText(corr2018) },
        { 'Variabel': 'Befolkningstäthet 2022', 'r-värde': Number.isFinite(corr2022val) ? corr2022val.toFixed(3) : '-', 'Tolkning': interpretationText(corr2022val) },
        { 'Variabel': 'Förändring i täthet', 'r-värde': Number.isFinite(corrChange) ? corrChange.toFixed(3) : '-', 'Tolkning': interpretationText(corrChange) }
      ]
    });



    addMdToPage(`*r ≈ 0 = inget samband | r ≈ 1 = starkt positivt | r ≈ -1 = starkt negativt*`);



    addMdToPage(`## Tolkning av resultaten`);
    addMdToPage(`
Sambandet mellan befolkningstäthet 2022 och röstförändring är **${interpretationText(corr2022val).toLowerCase()}** (r = ${Number.isFinite(corr2022val) ? corr2022val.toFixed(3) : "-"}). Tätare kommuner tenderade att ${corr2022val < 0 ? "minska mer" : "öka mer"} i högerblock jämfört med glesare kommuner.

 

Kommuner med låg täthet hade i genomsnitt **${lowAvg.toFixed(2)} procentenheters** förändring, medan kommuner med hög täthet hade **${highAvg.toFixed(2)} procentenheters** förändring. ${Math.abs(lowAvg - highAvg) > 1 ? "Det finns en tydlig skillnad mellan grupperna." : "Skillnaden mellan grupperna är liten."}
    `);



    addToPage(analysisBox('Korrelation är inte kausalitet', `
<p>Även om vi ser samband mellan geografi och valförändringar betyder det inte att befolkningstäthet i sig orsakade förändringen. Det är möjligt att:</p>
<ul>
<li>Geografiska faktorer påverkar politiska preferenser direkt</li>
<li>Andra faktorer (inkomst, ålder, migration) påverkar både geografi och röstning</li>
<li>Sambandet speglar strukturella skillnader mellan stad och landsbygd</li>
</ul>
    `));



    addToPage(analysisBox('Slutsats', `
<p>Analysen visar att geografiska faktorer – befolkningstäthet och regional tillhörighet – har ett samband med hur röstmönstren förändrades mellan riksdagsvalen 2018 och 2022. Kommuner med lägre befolkningstäthet (glesbygd) tenderade att öka mer i högerblock och SD jämfört med tätare kommuner.</p>
<p>Sambanden är dock inte tillräckligt starka för att geografi ensam ska kunna förklara hela förändringen – andra faktorer spelar också in och analyseras på övriga sidor i projektet.</p>
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



// ===============================
// Start – kontrollera databas och starta rendering
// ===============================



if (!dbInfoOk) {
  displayDbNotOkText();
} else {
  const data = buildData();
  renderPage(data);
}

 

 



