// ===============================
// 📌 Group by kommun
// ===============================
export function groupByKommun(data) {
  const map = {};

  data.forEach(row => {
    const key = row.kommun;
    if (!key) return;

    if (!map[key]) map[key] = [];
    map[key].push(row);
  });

  return map;
}

// ===============================
// 📌 Average
// ===============================
export function average(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce((sum, v) => sum + Number(v), 0) / arr.length;
}

// ===============================
// 📌 Correlation (Pearson)
// ===============================
export function correlation(xs, ys) {
  if (xs.length !== ys.length || xs.length === 0) return 0;

  const meanX = average(xs);
  const meanY = average(ys);

  let num = 0, denX = 0, denY = 0;

  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;

    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  return denX && denY ? num / Math.sqrt(denX * denY) : 0;
}