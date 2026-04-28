import dbInfoOk, { displayDbNotOkText } from "./helpers/dbInfoOk.js";
import { COLORS, pageHero, statGrid, statCard, infoNote, analysisBox, lanChart } from "./helpers/components.js";

addMdToPage(`
  ## Kom igång!
  Den här övningen syftar till att du ska lära dig arbeta med data från flera olika källor.
`);

if (!dbInfoOk) {
  displayDbNotOkText();
}
else {
  addMdToPage(`
  # 📂 Databild – Översikt

  Denna sida ger en översikt av de datamängder som används i analysen.
  Syftet är att visa struktur, nivå (kommun/län) och exempelrader.
  `);

  addMdToPage(`
  ### Länsinfo, från SQlite
  Info om våra 21 svenska län, bland annat hur tätbefolkade de är!
  `);
  dbQuery.use('counties-sqlite');
  let countyInfo = await dbQuery('SELECT * FROM countyInfo');
  tableFromData({ data: countyInfo });
  console.log('countyInfo', countyInfo);

  addMdToPage(`
  ### Arbetslöshet, från SQlite
  Info om våra arbetslöshet i varje län, i procent. (Endast de 25 första av många poster.)
  `);
  dbQuery.use('counties-sqlite');
  let unemployment = await dbQuery('SELECT * FROM arbetsloshet_by_lan');
  tableFromData({ 
  data: unemployment.slice(0, 25).map(row => ({
    ...row,
    '2018': row['2018'] === null ? 'saknas' : row['2018'],
    '2022': row['2022'] === null ? 'saknas' : row['2022']
  }))
  });
  tableFromData({ data: unemployment.slice(0, 25) });
  console.log('unemployment', unemployment);

  addToPage(infoNote(
  'Vissa län saknar arbetslöshetsdata för specifika kön eller år. Detta beror på att SCB inte mätte eller publicerade dessa värden. Gotlands län saknar mest data. Värden som saknas visas som "saknas" i tabellen.'
  ));

  addMdToPage(`
  ### Kommun i län, från SQlite
  Info om kommunernas lägen i varje län. (Endast de 25 första av många poster.)
  `);
  dbQuery.use('counties-sqlite');
  let lanKommun = await dbQuery('SELECT * FROM lan_kommun');
  tableFromData({ data: lanKommun.slice(0, 25) });
  console.log('lanKommun', lanKommun);

  addMdToPage(`
  ### Kommuninfo, från SQlite
  Info om kommunernas egenskaper. (Endast de 25 första av många poster.)
  `);
  dbQuery.use('counties-sqlite');
  let valdataKommun = await dbQuery('SELECT * FROM valdata_kommun');
  tableFromData({ data: valdataKommun.slice(0, 25) });
  console.log('valdataKommun', valdataKommun);

  addMdToPage(`
  ### Geografisk info, från MySQL
  Var alla svenska tätorter finns på kartan. (Endast de 25 första av många poster.)
  `);
  dbQuery.use('geo-mysql');
  let geoData = await dbQuery('SELECT * FROM geoData  ORDER BY latitude LIMIT 25');
  tableFromData({ data: geoData.map(x => ({ ...x, position: JSON.stringify(x.position) })) });
  console.log('geoData from mysql', geoData);

  addMdToPage(`
  ### Medel- och medianårsinkomst i tusentals kronor, per kommun, från MongoDB
  (Endast de 25 första av många poster.)
  `);
  dbQuery.use('kommun-info-mongodb');
  let income = await dbQuery.collection('incomeByKommun').find({}).limit(25);
  tableFromData({ data: income });
  console.log('income from mongodb', income);

  addMdToPage(`
  ### Medelålder, per kommun, från MongoDB
  (Endast de 25 första av många poster.)
  `);
  dbQuery.use('kommun-info-mongodb');
  let ages = await dbQuery.collection('ageByKommun').find({}).limit(25);
  tableFromData({ data: ages });
  console.log('ages from mongodb', ages);

  addMdToPage(`
  ### Valresultat från riksdagsvalen 2018 och 2022 uppdelade efter kommuner, från Neo4j
  (Endast de 25 första av många poster.)
  `);
  dbQuery.use('riksdagsval-neo4j');
  let electionResults = await dbQuery('MATCH (n:Partiresultat) RETURN n LIMIT 25');
  tableFromData({
    data: electionResults
      // egenskaper/kolumner kommer i lite konstig ordning från Neo - mappa i trevligare ordning
      .map(({ ids, kommun, roster2018, roster2022, parti, labels }) => ({ ids: ids.identity, kommun, roster2018, roster2022, parti, labels }))
  });
  console.log('electionResults from neo4j', electionResults);
};