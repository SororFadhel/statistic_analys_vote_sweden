// IMPORTANT: No if() outside functions!
// Only export data

// SQLITE
dbQuery.use('counties-sqlite');
export let countyInfo = await dbQuery('SELECT * FROM countyInfo');
export let unemployement = await dbQuery('SELECT * FROM arbetsloshet_by_lan');
export let income = await dbQuery('SELECT * FROM income_clean');

// MYSQL
dbQuery.use('geo-mysql');
export let geoData = await dbQuery('SELECT * FROM geoData ORDER BY latitude');

// MONGODB (age)
dbQuery.use('kommun-info-mongodb');
export let ages = await dbQuery.collection('ageByKommun').find({});

// NEO4J
dbQuery.use('riksdagsval-neo4j');
export let electionResults = await dbQuery('MATCH (n:Partiresultat) RETURN n');

// LOAD UNEMPLOYEMENT DATA FROM CSV
//export let unemployement = await csvLoad('arbetsloshetByLan.csv');
//export let lanKommun = await csvLoad('lanKommun.csv');

//console.log(lanKommun)