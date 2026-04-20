addMdToPage(`
# Geography vs Voting

This page investigates whether geography, population density,
and migration help explain voting changes between 2018 and 2022.

## 1. Population density vs voting change

We compare densely populated municipalities with less dense ones
to see if urban areas show different voting patterns.

### What are we looking for?

If geography matters, we expect to see a pattern where municipalities
with higher population density show different voting changes compared
to less dense areas.

### Chart
`);

const densityData = [
  { kommun: "Stockholm", density: 5400, voteChange: 2.4 },
  { kommun: "Göteborg", density: 1300, voteChange: 1.6 },
  { kommun: "Malmö", density: 2300, voteChange: 3.1 },
  { kommun: "Uppsala", density: 210, voteChange: 1.1 },
  { kommun: "Kiruna", density: 1.3, voteChange: -0.9 }
];

drawGoogleChart({
  type: "ScatterChart",
  data: [
    ["Density", "Vote change"],
    ...densityData.map(d => [d.density, d.voteChange])
  ],
  options: {
    title: "Population density vs voting change",
    hAxis: { title: "Population density" },
    vAxis: { title: "Vote change 2018–2022" },
    legend: "none",
    trendlines: { 0: {} }
  }
});

addMdToPage(`
### Table
`);

tableFromData({ data: densityData });

function calculateCorrelation(x, y) {
  const n = x.length;

  const meanX = x.reduce((sum, value) => sum + value, 0) / n;
  const meanY = y.reduce((sum, value) => sum + value, 0) / n;

  let numerator = 0;
  let denominatorX = 0;
  let denominatorY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;

    numerator += dx * dy;
    denominatorX += dx * dx;
    denominatorY += dy * dy;
  }

  return numerator / Math.sqrt(denominatorX * denominatorY);
}

const xValues = densityData.map(d => d.density);
const yValues = densityData.map(d => d.voteChange);

const correlation = calculateCorrelation(xValues, yValues);

let interpretation = "";

if (correlation > 0.3) {
  interpretation =
    "The relationship appears positive. Municipalities with higher population density tend to show higher voting change.";
} else if (correlation < -0.3) {
  interpretation =
    "The relationship appears negative. Municipalities with higher population density tend to show lower voting change.";
} else {
  interpretation =
    "The relationship appears weak. Population density alone may not explain voting change.";
}

addMdToPage(`
### Correlation

Pearson correlation: **${correlation.toFixed(2)}**

### Explanation

${interpretation}
`);

