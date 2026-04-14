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
export let income = await dbQuery.collection('incomeByKommun').find({}).limit(25);

// MONGODB (age)
export let ages = await dbQuery.collection('ageByKommun').find({}).limit(25);

// NEO4J
//export let electionResults = await dbQuery('MATCH (n:Partiresultat) RETURN n LIMIT 25');
export let electionResults = await dbQuery('MATCH (n:Partiresultat) RETURN n');