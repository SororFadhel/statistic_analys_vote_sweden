import fs from 'fs';
import path from 'path';

// db drivers
import Database from 'better-sqlite3';
import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import neo4j from 'neo4j-driver';

// Copy the example-databases-in-use.json file if the databases-in-use-json does not exist
// (it is git ignored!)
let dirname = import.meta.dirname;
let dbInUseFile = path.join(dirname, '..', 'databases', 'databases-in-use.json');
let exampleDbInUseFile = path.join(dirname, 'example-databases-in-use.json');
if (!fs.existsSync(dbInUseFile)) { fs.copyFileSync(exampleDbInUseFile, dbInUseFile); }


export default async function dbRouter(app, databasesFolder, sqliteFolder) {

  // read info from databases-in-use.json
  let dbInfoFile = path.join(databasesFolder, 'databases-in-use.json');
  let dbInfos = [];
  if (fs.existsSync(dbInfoFile)) {
    try {
      dbInfos = JSON.parse(fs.readFileSync(dbInfoFile, 'utf-8'));
    }
    catch (_e) { }
  }

  let types = ['sqlite', 'mysql', 'mongodb', 'neo4j'];

  // make database connections and store them
  let connections = {};
  for (let { name, type: t, file, credentials } of dbInfos) {
    let type = types.find(x => x.includes(t.toLowerCase()));
    if (!type) { return; }
    type = type.toLowerCase();
    try {
      if (type === 'sqlite') {
        file = path.join(sqliteFolder, file);
        fs.existsSync(file)
          && (connections[name] = { type: 'sqlite', con: new Database(file) });
      }
      if (type === 'mysql') {
        connections[name] = { type: 'mysql', con: await mysql.createConnection(credentials) };
      }
      if (type === 'mongodb') {
        const client = new MongoClient(credentials.connectionString);
        await client.connect();
        const db = client.db(credentials.database);
        connections[name] = { type: 'mongodb', con: db };
      }
      if (type === 'neo4j') {
        let { host, port, user, password, database } = credentials;
        let driver = neo4j.driver(
          'neo4j://' + host + ':' + port,
          neo4j.auth.basic(user, password),
          { disableLosslessIntegers: true }
        );
        connections[name] = {
          type: 'neo4j',
          con: driver.session({
            database,
            defaultAccessMode: neo4j.session.READ
          })
        };
      }
    }
    catch (e) { console.log("DB Connection", e + ''); }
    connections.default = connections[Object.keys(connections)[0]];
  }

  // perform databases query from a simple rest route
  // note: all the connected databases can be queried
  // but only read queries
  app.get('/api/dbquery/:name/:query', async (req, res) => {
    let name = req.params.name;
    let connection = connections[name];
    let query = req.params.query;
    if (!connection) { res.json({ error: 'No such db name' }); return; }
    let { type, con } = connection;
    let result;
    try {
      if (type === 'sqlite') {
        if (!(query + '').trim().toLowerCase().startsWith('select')) {
          result = { error: 'Only SELECT queries allowed' };
        }
        else {
          result = con.prepare(query).all();
        }
      }
      if (type === 'mysql') {
        if (!(query + '').trim().toLowerCase().startsWith('select')) {
          result = { error: 'Only SELECT queries allowed' };
        }
        else {
          result = (await con.query(query))[0];
        }
      }
      if (type === 'mongodb') {
        let obj = con;
        for (let { command, args } of JSON.parse(query)) {
          obj = obj[command](...args);
        }
        result = await obj.toArray();
      }
      if (type === 'neo4j') {
        const raw = await con.run(query);
        result = [];
        if (raw.records[0]._fields[0].properties) {
          try {
            raw.records.forEach(x => result.push(x._fields[0]));
            // simplify result to one object per recoder
            // put all (3!) ids inside the property ids
            // and add labels as a property
            result = result.map(({ properties, labels, identity, elementId }) => ({
              ...properties,
              id: undefined,
              ids: { id: properties.id, identity, elementId },
              labels
            }));
          }
          catch (e) {
            result = raw;
          }
        }
        else {
          for (let record of raw.records) {
            let obj = {}, co = 0;
            for (let key of record.keys) {
              obj[key] = record._fields[co++];
            }
            result.push(obj);
          }
        }
      }
    } catch (e) {
      result = { error: e + '' };
    }
    return res.json(result || { error: 'No database query ran' });
  });

}
