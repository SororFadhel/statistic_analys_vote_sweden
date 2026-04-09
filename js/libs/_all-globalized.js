import all from './_all-bundled.js';

Object.assign(globalThis, all);
globalThis.s = all.simpleStatistics;

await import('/api/getMainScript');