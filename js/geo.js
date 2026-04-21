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


addMdToPage(`
## 2. North, Middle and South

We divide municipalities into three broad geographical groups
to see whether voting changes differ across Sweden.

### What are we looking for?

If geography matters on a regional level, municipalities in the north,
middle, and south may show different average voting changes.

### Chart
`);

const regionData = [
  { kommun: "Kiruna", region: "North", voteChange: -0.9 },
  { kommun: "Jokkmokk", region: "North", voteChange: -1.2 },
  { kommun: "Umeå", region: "North", voteChange: 0.3 },

  { kommun: "Sundsvall", region: "Middle", voteChange: 0.4 },
  { kommun: "Uppsala", region: "Middle", voteChange: 1.1 },
  { kommun: "Västerås", region: "Middle", voteChange: 0.8 },

  { kommun: "Stockholm", region: "South", voteChange: 2.4 },
  { kommun: "Malmö", region: "South", voteChange: 3.1 },
  { kommun: "Göteborg", region: "South", voteChange: 1.6 }
];

function averageVoteChangeByRegion(data) {
  const groups = {};

  data.forEach(d => {
    if (!groups[d.region]) {
      groups[d.region] = [];
    }
    groups[d.region].push(d.voteChange);
  });

  return Object.entries(groups).map(([region, values]) => {
    const average =
      values.reduce((sum, value) => sum + value, 0) / values.length;

    return {
      region,
      averageVoteChange: Number(average.toFixed(2))
    };
  });
}

const regionAverages = averageVoteChangeByRegion(regionData);

drawGoogleChart({
  type: "ColumnChart",
  data: [
    ["Region", "Average vote change"],
    ...regionAverages.map(d => [d.region, d.averageVoteChange])
  ],
  options: {
    title: "Average voting change by region",
    legend: "none",
    hAxis: { title: "Region" },
    vAxis: { title: "Average vote change 2018–2022" }
  }
});

addMdToPage(`
### Table
`);

tableFromData({ data: regionData });

addMdToPage(`
### Comparison
`);

tableFromData({ data: regionAverages });

let regionInterpretation = "";

const north = regionAverages.find(d => d.region === "North")?.averageVoteChange ?? 0;
const middle = regionAverages.find(d => d.region === "Middle")?.averageVoteChange ?? 0;
const south = regionAverages.find(d => d.region === "South")?.averageVoteChange ?? 0;

if (south > middle && middle > north) {
  regionInterpretation =
    "The pattern suggests that municipalities in the south show the highest average voting change, while municipalities in the north show the lowest.";
} else if (north > middle && middle > south) {
  regionInterpretation =
    "The pattern suggests that municipalities in the north show the highest average voting change, while municipalities in the south show the lowest.";
} else {
  regionInterpretation =
    "The regional pattern is visible, but not perfectly linear. This suggests that geography may matter, although regional location alone may not fully explain voting change.";
}

addMdToPage(`
### Explanation

${regionInterpretation}
`);

addMdToPage(`
## 3. Migration + Geography

We compare high-migration urban municipalities with low-migration rural municipalities.

### What are we looking for?

If migration and geography interact, municipalities with high migration
and urban characteristics may show different voting changes than
low-migration rural municipalities.

### Chart
`);

const migrationGeoData = [
  { kommun: "Stockholm", group: "High migration + urban", voteChange: 2.4 },
  { kommun: "Malmö", group: "High migration + urban", voteChange: 3.1 },
  { kommun: "Göteborg", group: "High migration + urban", voteChange: 1.6 },
  { kommun: "Uppsala", group: "High migration + urban", voteChange: 1.1 },

  { kommun: "Arjeplog", group: "Low migration + rural", voteChange: -1.5 },
  { kommun: "Jokkmokk", group: "Low migration + rural", voteChange: -1.2 },
  { kommun: "Kiruna", group: "Low migration + rural", voteChange: -0.9 },
  { kommun: "Åsele", group: "Low migration + rural", voteChange: -0.6 }
];

function averageVoteChangeByGroup(data) {
  const groups = {};

  data.forEach(d => {
    if (!groups[d.group]) {
      groups[d.group] = [];
    }
    groups[d.group].push(d.voteChange);
  });

  return Object.entries(groups).map(([group, values]) => {
    const average =
      values.reduce((sum, value) => sum + value, 0) / values.length;

    return {
      group,
      averageVoteChange: Number(average.toFixed(2))
    };
  });
}

const groupAverages = averageVoteChangeByGroup(migrationGeoData);

drawGoogleChart({
  type: "ColumnChart",
  data: [
    ["Group", "Average vote change"],
    ...groupAverages.map(d => [d.group, d.averageVoteChange])
  ],
  options: {
    title: "Average voting change by migration and geography",
    legend: "none",
    hAxis: { title: "Group" },
    vAxis: { title: "Average vote change 2018–2022" }
  }
});

addMdToPage(`
### Table
`);

tableFromData({ data: migrationGeoData });

addMdToPage(`
### Comparison
`);

tableFromData({ data: groupAverages });

const urbanGroup =
  groupAverages.find(d => d.group === "High migration + urban")?.averageVoteChange ?? 0;

const ruralGroup =
  groupAverages.find(d => d.group === "Low migration + rural")?.averageVoteChange ?? 0;

let migrationInterpretation = "";

if (urbanGroup > ruralGroup) {
  migrationInterpretation =
    "The comparison suggests that high-migration urban municipalities show a higher average voting change than low-migration rural municipalities.";
} else if (urbanGroup < ruralGroup) {
  migrationInterpretation =
    "The comparison suggests that low-migration rural municipalities show a higher average voting change than high-migration urban municipalities.";
} else {
  migrationInterpretation =
    "The two groups appear very similar. This suggests that migration and geography may not create a strong difference on their own.";
}

addMdToPage(`
### Explanation

${migrationInterpretation}
`);