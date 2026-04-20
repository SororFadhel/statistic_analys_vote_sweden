// IMPORTANT: No if() outside functions!
// Only export data

// SQLITE
dbQuery.use('counties-sqlite');
export let countyInfo = await dbQuery('SELECT * FROM countyInfo');

// MYSQL
dbQuery.use('geo-mysql');
export let geoData = await dbQuery('SELECT * FROM geoData ORDER BY latitude');

// MONGODB (income)
dbQuery.use('kommun-info-mongodb');
export let income = await dbQuery.collection('incomeByKommun').find({});

// MONGODB (age)
dbQuery.use('kommun-info-mongodb');
export let ages = await dbQuery.collection('ageByKommun').find({});

// NEO4J
dbQuery.use('riksdagsval-neo4j');
export let electionResults = await dbQuery('MATCH (n:Partiresultat) RETURN n');

// LOAD UNEMPLOYEMENT DATA FROM CSV
export let unemployement = await csvLoad('arbetsloshetByLan.csv');

console.log(unemployement)
