export function groupByKommun(data) {
  let map = {};

  data.forEach(d => {
    if (!map[d.kommun]) {
      map[d.kommun] = [];
    }
    map[d.kommun].push(d);
  });

  return map;
}


export function average(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}