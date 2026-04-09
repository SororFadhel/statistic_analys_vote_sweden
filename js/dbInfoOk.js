let dbsInUse = await jload('/databases/databases-in-use.json');
let neededDbs = ['counties-sqlite', 'geo-mysql', 'kommun-info-mongodb', 'riksdagsval-neo4j'];
export default neededDbs.map(x => !!dbsInUse.find(y => y.name == x)).every(x => x);

export function displayDbNotOkText() {
  addMdToPage(`
  ### Obs!
  * Innan du genomföra övningen måste din lärare ge dig ny info att klistra in/ersätta nuvarande data i filen **databases/databases-in-use** med!
  * När du har gjort detta kommer informationen här att uppdateras!
  `);
}