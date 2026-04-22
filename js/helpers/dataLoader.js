// IMPORTANT: No if() outside functions!
// Only export data

// SQLITE
dbQuery.use('counties-sqlite');
// export let countyInfo = await dbQuery('SELECT * FROM countyInfo');
export let unemployment = await dbQuery('SELECT * FROM arbetsloshet_clean');
export let income = await dbQuery('SELECT * FROM income_kommun');
export let lanKommun = await dbQuery('SELECT * FROM lan_kommun');

// MYSQL
dbQuery.use('geo-mysql');
export let geoData = await dbQuery('SELECT * FROM geoData ORDER BY latitude');

// MONGODB (age)
dbQuery.use('kommun-info-mongodb');
export let ages = await dbQuery.collection('ageByKommun').find({});

// NEO4J
dbQuery.use('riksdagsval-neo4j');
export let electionResults = await dbQuery('MATCH (n:Partiresultat) RETURN n');