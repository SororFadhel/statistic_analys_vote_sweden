import dbInfoOk, { displayDbNotOkText } from "./helpers/dbInfoOk.js";

addMdToPage(`
  ## Kom igång!
  Den här övningen syftar till att du ska lära dig arbeta med data från flera olika källor.
`);

if (!dbInfoOk) {
  displayDbNotOkText();
}
else {
  addMdToPage(`
  ### Starthjälp
  * För att ge dig starthjälp med övningen visar vi nedan data från 4 olika databaser (varav två olika collections hämtade från MongoDB). Detta är datan du har tillgång till.
  * När du tittat lite på datan (och kanske även på koden som hämtar den) kan du [läsa instruktionerna för övningen](#ovningsinstruktioner)!
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