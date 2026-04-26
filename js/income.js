import dbInfoOk, { displayDbNotOkText } from "./helpers/dbInfoOk.js";
import { income, unemployment, lanKommun, electionResults } from "./helpers/dataLoader.js";
import { average, correlation } from "./helpers/utils.js";
import { COLORS, pageHero, statGrid, statCard, infoNote, analysisBox, lanChart } from "./helpers/components.js";

// ===============================
// 🔧 HJÄLPFUNKTIONER
// Små verktyg som används överallt i filen
// ===============================

// Tar bort accenter och gör texten lowercase för säker jämförelse
function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

// Normaliserar könsvärden till svenska: män, kvinnor, totalt
function normalizeGender(value) {
  const v = normalizeText(value);
  if (["man", "män", "male", "m"].includes(v)) return "män";
  if (["kvinna", "kvinnor", "female", "f"].includes(v)) return "kvinnor";
  if (["totalt", "total", "alla", "all"].includes(v)) return "totalt";
  return v || "totalt";
}

// Omvandlar ett värde till ett tal, returnerar null om det inte går
function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const cleaned = String(value).replace(/\s/g, "").replace(",", ".");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

// Formaterar ett tal med svenska decimaler, t.ex. 325,6
function formatNumber(value, decimals = 1) {
  const num = toNumber(value);
  if (num === null) return "saknas";
  return num.toLocaleString("sv-SE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

// Formaterar ett tal som procent, t.ex. 6,9 %
function formatPercent(value, decimals = 1) {
  const num = toNumber(value);
  if (num === null) return "saknas";
  return `${num.toLocaleString("sv-SE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })} %`;
}

// Översätter korrelationsvärde till text: starkt, måttligt eller svagt
function correlationLabel(r) {
  if (r === null) return "kan inte beräknas";
  const abs = Math.abs(r);
  if (abs >= 0.5) return "starkt";
  if (abs >= 0.2) return "måttligt";
  return "svagt";
}

// ===============================
// 🗂️ DATABEARBETNING
// Hämtar, rensar och slår ihop data från olika källor
// ===============================

// Hanterar olika format från Neo4j — returnerar alltid en array
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

// Bygger en map med valresultat per kommun (röster 2018, 2022 och procentuell förändring)
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
    if (item.roster2018 === 0) {
      item.voteChange = null;
    } else {
      item.voteChange = ((item.roster2022 - item.roster2018) / item.roster2018) * 100;
    }
  }
  return map;
}

// Bygger en map från kommunKod → län (för att koppla inkomst till rätt län)
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

// Bygger en map med arbetslöshet per län, kön och år
// OBS: arbetslöshet finns bara på länsnivå, inte kommunnivå
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

// Bygger en map med inkomst per kommun och kön
// Kopplar också på arbetslöshet från länet kommunen tillhör
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

// Slår ihop inkomst, arbetslöshet och valresultat till ett dataset
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

// ===============================
// 📊 DIAGRAMBYGGARE
// Förbereder data i rätt format för Google Charts
// ===============================

// Grupperar kommuner i inkomstintervall och räknar snittröstförändring
function buildIncomeIntervalData(data) {
  const intervals = [
    { label: "300-330 tkr", min: 300, max: 330 },
    { label: "330-360 tkr", min: 330, max: 360 },
    { label: "360-390 tkr", min: 360, max: 390 },
    { label: "390-420 tkr", min: 390, max: 420 },
    { label: "420-470 tkr", min: 420, max: 470 },
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

// Delar upp kommuner i tre inkomstgrupper (låg/medel/hög)
function buildIncomeGroupData(data) {
  const sorted = [...data]
    .filter(d => toNumber(d.inkomst_2022) !== null)
    .sort((a, b) => toNumber(a.inkomst_2022) - toNumber(b.inkomst_2022));
  const third = Math.floor(sorted.length / 3);
  return [
    { label: "Låg inkomst", avgVoteChange: average(sorted.slice(0, third).map(d => d.voteChange)) ?? 0 },
    { label: "Medel inkomst", avgVoteChange: average(sorted.slice(third, third * 2).map(d => d.voteChange)) ?? 0 },
    { label: "Hög inkomst", avgVoteChange: average(sorted.slice(third * 2).map(d => d.voteChange)) ?? 0 }
  ];
}

// Grupperar data per län, räknar snittröstförändring och hämtar arbetslöshet
// Sorterar länen efter arbetslöshet (högst först)
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

// ===============================
// 🚀 HUVUDDEL
// Sidans innehåll — rubriker, filter, tabeller, diagram och analys
// ===============================

addMdToPage(`# Inkomst och arbetslöshet vs förändring i valresultat`);

if (!dbInfoOk) {
  displayDbNotOkText();
} else {

  const allMerged = mergeData();

  // Hero-ruta överst på sidan
  addToPage(pageHero(
    'Inkomst och arbetslöshet vs förändring i valresultat',
    'Kan ekonomiska faktorer förklara hur valresultatet förändrades mellan 2018 och 2022?',
    [
      `${allMerged.filter(d => normalizeGender(d.kon) === 'totalt').length} kommuner`,
      'Riksdagsvalet 2018-2022',
      'Inkomst + Arbetslöshet'
    ]
  ));

  // Dropdown för att filtrera på kön
  let selectedGender = addDropdown('Filtrera på kön', ['Totalt', 'Kvinnor', 'Män'], 'Totalt');
  selectedGender = selectedGender.toLowerCase();

  // Filtrera data baserat på valt kön, fallback till totalt
  let filtered = allMerged.filter(row => normalizeGender(row.kon) === selectedGender);
  if (!filtered.length) filtered = allMerged.filter(row => normalizeGender(row.kon) === 'totalt');

  // Beräkna statistik för statistikkorten
  const avgIncome2018 = average(filtered.map(d => d.inkomst_2018));
  const avgIncome2022 = average(filtered.map(d => d.inkomst_2022));
  const avgUnemployment2018 = average(filtered.map(d => d.arbetsloshet_2018));
  const avgUnemployment2022 = average(filtered.map(d => d.arbetsloshet_2022));
  const avgVoteChange = average(filtered.map(d => d.voteChange));

  // Beräkna korrelation (anpassad till utils signatur: xs, ys)
  const incomeXs = filtered.filter(d => toNumber(d.inkomst_2022) !== null).map(d => toNumber(d.inkomst_2022));
  const incomeYs = filtered.filter(d => toNumber(d.inkomst_2022) !== null).map(d => toNumber(d.voteChange));
  const unemploymentXs = filtered.filter(d => toNumber(d.arbetsloshet_2022) !== null).map(d => toNumber(d.arbetsloshet_2022));
  const unemploymentYs = filtered.filter(d => toNumber(d.arbetsloshet_2022) !== null).map(d => toNumber(d.voteChange));

  const incomeCorr = correlation(incomeXs, incomeYs);
  const unemploymentCorr = correlation(unemploymentXs, unemploymentYs);
  const incomeStrength = correlationLabel(incomeCorr);
  const unemploymentStrength = correlationLabel(unemploymentCorr);
  const genderLabel = selectedGender === 'kvinnor' ? 'kvinnor' : selectedGender === 'män' ? 'män' : 'totalt';

  // Statistikkort med nyckeltal
  addToPage(statGrid([
    statCard('Antal kommuner', filtered.length),
    statCard('Genomsnittlig inkomst 2018 (tkr)', `${formatNumber(avgIncome2018, 1)} <span class="value-unit">tkr</span>`),
    statCard('Genomsnittlig inkomst 2022 (tkr)', `${formatNumber(avgIncome2022, 1)} <span class="value-unit">tkr</span>`),
    statCard('Genomsnittlig förändring i röster %', formatNumber(avgVoteChange, 2) + ' %'),
    statCard('Arbetslöshet 2018 (länsnivå)', formatPercent(avgUnemployment2018, 1)),
    statCard('Arbetslöshet 2022 (länsnivå)', formatPercent(avgUnemployment2022, 1))
  ]));

  // Inforuta om länsnivå
  addToPage(infoNote(
    'Arbetslöshetsdata är tillgänglig på <strong>länsnivå</strong>. Alla kommuner inom samma län delar samma värde. Förändring i röster är beräknad som procentuell förändring mellan riksdagsvalet 2018 och 2022.'
  ));

  // Datapreview — visar de 10 första raderna
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
      'Röster 2018': row.roster2018,
      'Röster 2022': row.roster2022,
      'Förändring i röster % (2018-2022)': row.voteChange === null ? 'saknas' : formatNumber(row.voteChange, 2) + ' %'
    }))
  });

  // Diagram 1 — inkomstintervall vs röstförändring med trendlinje
  addMdToPage(`## Samband mellan inkomst och förändring i röster`);
  addMdToPage(`Kommunerna grupperas i inkomstintervall för att tydligare visa trenden mellan inkomstnivå och röstförändring.`);

  const intervalData = buildIncomeIntervalData(filtered);
  drawGoogleChart({
    type: 'LineChart',
    data: [
      ['Inkomstintervall', 'Genomsnittlig förändring i röster (%)'],
      ...intervalData.map(d => [d.label, Math.round(d.avgVoteChange)])
    ],
    options: {
      title: 'Inkomstintervall vs genomsnittlig förändring i röster (%)',
      hAxis: { title: 'Inkomstintervall (tkr)' },
      vAxis: { title: 'Genomsnittlig förändring i röster (%)' },
      colors: [COLORS.primary],
      trendlines: { 0: { color: COLORS.secondary, lineWidth: 2 } },
      pointSize: 6,
      chartArea: { left: 80, top: 50, right: 30, bottom: 80 },
      height: 400
    }
  });

  // Diagram 2 — låg/medel/hög inkomstgrupp vs röstförändring
  addMdToPage(`## Jämförelse mellan låg, medel och hög inkomst`);
  addMdToPage(`Kommunerna delas upp i tre grupper utifrån inkomstnivå 2022.`);

  const groupData = buildIncomeGroupData(filtered);
  drawGoogleChart({
    type: 'LineChart',
    data: [
      ['Grupp', 'Genomsnittlig förändring i röster (%)'],
      ...groupData.map(d => [d.label, Math.round(d.avgVoteChange)])
    ],
    options: {
      title: 'Inkomstgrupp vs genomsnittlig förändring i röster (%)',
      hAxis: { title: 'Inkomstgrupp' },
      vAxis: { title: 'Genomsnittlig förändring i röster (%)' },
      colors: [COLORS.primary],
      pointSize: 8,
      curveType: 'function',
      chartArea: { left: 80, top: 50, right: 30, bottom: 80 },
      height: 400
    }
  });

  // Diagram 3 — länsstapeldiagram med arbetslöshetsbadges
  addMdToPage(`## Förändring i röster per län — sorterat efter arbetslöshet`);
  addMdToPage(`Varje stapel visar genomsnittlig procentuell förändring i röster per län.`);
  addToPage(lanChart(buildLanData(filtered), formatPercent));

  // Analysrutor — korrelation, analys, kausalitet, begränsningar, slutsats
  addToPage(analysisBox('Korrelationsanalys', `
    <p>
      <strong>Inkomst och förändring i röster:</strong>
      <span class="corr-value">${incomeCorr === null ? 'saknas' : formatNumber(incomeCorr, 3)}</span>
      — ${incomeStrength} samband
    </p>
    <p>
      <strong>Arbetslöshet (länsnivå) och förändring i röster:</strong>
      <span class="corr-value">${unemploymentCorr === null ? 'saknas' : formatNumber(unemploymentCorr, 3)}</span>
      — ${unemploymentStrength} samband
    </p>
    <p>Korrelationskoefficienten visar hur starkt två variabler samvarierar. Ett värde nära 0 tyder på svagt samband medan värden närmare 1 eller −1 tyder på starkare samband. Korrelation visar dock inte orsakssamband.</p>
  `));

  addToPage(analysisBox('Analys', `
    <p>För gruppen <strong>${genderLabel}</strong> visar resultaten ett <strong>${incomeStrength}</strong> samband mellan inkomst och förändring i röster.</p>
    <p>Sambandet mellan arbetslöshet och förändring i röster framstår som <strong>${unemploymentStrength}</strong>.</p>
    <p>Ekonomi verkar spela en roll, men väljarbeteende påverkas sannolikt också av ålder, migration, geografi och lokala förutsättningar.</p>
  `, true));

  addToPage(analysisBox('Kausalitet vs korrelation', `
    <p>Även om vi ser ett samband kan vi inte fastställa orsakssamband. Det är möjligt att:</p>
    <ul>
      <li>Ekonomiska faktorer påverkar politiska preferenser direkt</li>
      <li>Andra faktorer (ålder, geografi, migration) påverkar både ekonomi och röstning</li>
      <li>Sambandet är slumpmässigt eller beror på dataens begränsningar</li>
    </ul>
  `, true));

  addToPage(analysisBox('Begränsningar', `
    <ul>
      <li>Analysen bygger på korrelation och kan inte fastställa orsakssamband.</li>
      <li>Arbetslöshetsdata finns på länsnivå — alla kommuner i samma län delar samma värde.</li>
      <li>Andra variabler kan också påverka förändringar i röster.</li>
    </ul>
  `, true));

  addToPage(analysisBox('Slutsats', `
    <p>Ekonomiska faktorer som inkomst och arbetslöshet verkar ha en viss koppling till förändringar i röster mellan 2018 och 2022. Sambanden är dock inte tillräckligt starka för att ensamma förklara utvecklingen.</p>
  `, true));
}