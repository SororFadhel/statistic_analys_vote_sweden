import dbInfoOk, { displayDbNotOkText } from "./helpers/dbInfoOk.js";
import { income, electionResults } from "./helpers/dataLoader.js";

addMdToPage(`
# 📊 Income vs Voting

## 🎯 Research Question
Does income explain changes in voting between 2018 and 2022?

---

## 🧠 Why This Matters
Income can reflect economic conditions in different municipalities. By comparing income levels with changes in voting, we can investigate whether wealthier and less wealthy municipalities changed politically in different ways.

---
`);

if (!dbInfoOk) {
  displayDbNotOkText();
} else {
  // -----------------------------
  // 🔧 PREPARE ELECTION DATA
  // -----------------------------
  let resultsArray = [];

  if (Array.isArray(electionResults)) {
    resultsArray = electionResults.map(item => {
      let node = item.n || item;
      let props = node.properties || node;

      return {
        kommun: props.kommun,
        parti: props.parti,
        roster2018: Number(props.roster2018) || 0,
        roster2022: Number(props.roster2022) || 0
      };
    });
  } else if (electionResults?.records) {
    resultsArray = electionResults.records.map(r => {
      let props = r._fields[0].properties;

      return {
        kommun: props.kommun,
        parti: props.parti,
        roster2018: Number(props.roster2018) || 0,
        roster2022: Number(props.roster2022) || 0
      };
    });
  }

  // -----------------------------
  // 🔗 MERGE DATA
  // -----------------------------
  let mergedRaw = resultsArray.map(r => {
    let incomeData =
      income.find(i => i.kommun === r.kommun && i.kon === "totalt") ||
      income.find(i => i.kommun === r.kommun);

    let factorValue = Number(incomeData?.medianInkomst2022) || 0;

    return {
      kommun: r.kommun,
      parti: r.parti,
      voteChange: (r.roster2022 || 0) - (r.roster2018 || 0),
      factor: factorValue
    };
  }).filter(d => d.factor > 0 && !isNaN(d.voteChange));

  // -----------------------------
  // 🧹 GROUP BY KOMMUN
  // -----------------------------
  let grouped = {};

  mergedRaw.forEach(row => {
    if (!grouped[row.kommun]) {
      grouped[row.kommun] = [];
    }
    grouped[row.kommun].push(row);
  });

  let merged = Object.keys(grouped).map(kommun => {
    let rows = grouped[kommun];

    let avgVoteChange =
      rows.reduce((sum, row) => sum + row.voteChange, 0) / rows.length;

    return {
      kommun,
      voteChange: avgVoteChange,
      factor: rows[0].factor
    };
  });

  // -----------------------------
  // 🎛️ DROPDOWN FILTER
  // -----------------------------
  addMdToPage(`## 🎛️ Filter Data`);

  let select = addSelectToPage({
    label: "Select Group",
    options: [
      { value: "all", text: "All" },
      { value: "low", text: "Low income" },
      { value: "high", text: "High income" }
    ]
  });

  function filterData(type) {
    let sorted = [...merged].sort((a, b) => a.factor - b.factor);
    let mid = Math.floor(sorted.length / 2);

    if (type === "low") return sorted.slice(0, mid);
    if (type === "high") return sorted.slice(mid);

    return merged;
  }

  // -----------------------------
  // 📊 CORRELATION FUNCTION
  // -----------------------------
  function correlation(data) {
    let x = data.map(d => d.factor);
    let y = data.map(d => d.voteChange);

    let meanX = x.reduce((a, b) => a + b, 0) / x.length;
    let meanY = y.reduce((a, b) => a + b, 0) / y.length;

    let num = x.reduce((sum, xi, i) =>
      sum + (xi - meanX) * (y[i] - meanY), 0);

    let den = Math.sqrt(
      x.reduce((sum, xi) => sum + (xi - meanX) ** 2, 0) *
      y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0)
    );

    if (den === 0) return "0.000";
    return (num / den).toFixed(3);
  }

  // -----------------------------
  // 📈 DRAW FUNCTION
  // -----------------------------
  function draw(data) {
    addMdToPage(`---`);

    addMdToPage(`## 📊 Data Preview`);
    tableFromData({ data: data.slice(0, 10) });

    addMdToPage(`## 📈 Scatter Plot`);

    drawGoogleChart({
      type: "ScatterChart",
      data: [
        ["Income", "Vote Change"],
        ...data.map(d => [d.factor, d.voteChange])
      ],
      options: {
        title: "Income vs Voting Change",
        hAxis: { title: "Median income 2022" },
        vAxis: { title: "Average vote change" },
        trendlines: { 0: {} }
      }
    });

    let sorted = [...data].sort((a, b) => a.factor - b.factor);
    let mid = Math.floor(sorted.length / 2);

    let low = sorted.slice(0, mid);
    let high = sorted.slice(mid);

    let avg = arr =>
      arr.length
        ? arr.reduce((a, b) => a + b.voteChange, 0) / arr.length
        : 0;

    addMdToPage(`## 📊 Group Comparison`);

    drawGoogleChart({
      type: "ColumnChart",
      data: [
        ["Group", "Average Vote Change"],
        ["Low income", avg(low)],
        ["High income", avg(high)]
      ],
      options: {
        title: "Low vs High Income Municipalities"
      }
    });

    let corr = correlation(data);

    addMdToPage(`
## 📉 Correlation Analysis

Correlation (r) = **${corr}**

- r ≈ 0 = No relationship
- r ≈ 1 = Strong positive
- r ≈ -1 = Strong negative

👉 Interpretation:
${Math.abs(corr) > 0.5
        ? "Strong relationship"
        : Math.abs(corr) > 0.2
          ? "Moderate relationship"
          : "Weak relationship"}

---
`);

    addMdToPage(`
## 🧠 Analysis

The data shows a ${Math.abs(corr) > 0.5
        ? "strong"
        : Math.abs(corr) > 0.2
          ? "moderate"
          : "weak"
      } relationship between **income** and voting change.

This means that income may help explain some of the differences between municipalities, but the variation in the data also suggests that income is not the only factor.

---
`);

    addMdToPage(`
## ⚠️ Correlation vs Causation

Even if we find a correlation, this does **not** prove causation.

Income may be related to voting change, but other factors such as age, migration background, education level, geography, or local political issues may also influence the result.

---
`);

    addMdToPage(`
## 🏁 Conclusion

Income has a ${Math.abs(corr) > 0.5
        ? "strong"
        : Math.abs(corr) > 0.2
          ? "moderate"
          : "weak"
      } relationship with voting changes between 2018 and 2022.

👉 Income contributes to the explanation, but it is not enough on its own.
`);
  }

  // -----------------------------
  // 🔁 INITIAL DRAW
  // -----------------------------
  draw(merged);

  // -----------------------------
  // 🎛️ INTERACTION
  // -----------------------------
  select.onchange = () => {
    let filtered = filterData(select.value);
    draw(filtered);
  };
}