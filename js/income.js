import { buildKommunData } from "./helpers/dataProcessor.js";

addMdToPage(`# Income vs Voting`);

let data = buildKommunData();

let chartData = [["Income", "Vote Change"]];

data.forEach(d => {
  chartData.push([d.income, d.voteChange]);
});

google.charts.load('current', { packages: ['corechart'] });
google.charts.setOnLoadCallback(drawChart);

function drawChart() {
  let dt = google.visualization.arrayToDataTable(chartData);

  let chart = new google.visualization.ScatterChart(document.getElementById('chart'));
  chart.draw(dt, {
    title: "Income vs Voting Change"
  });
}