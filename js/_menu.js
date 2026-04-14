createMenu('Sweden Elections Analysis', [
  { name: 'Introduction', script: 'intro.js' },

  { name: 'Analysis', sub: [
    { name: 'Income vs Voting', script: 'income.js' },
    { name: 'Age vs Voting', script: 'age.js' },
    { name: 'Geography', script: 'geo.js' }
  ]},

  { name: 'Hypothesis Testing', script: 'hypothesis.js' },
  { name: 'Data Sources', script: 'sources.js' },
  { name: 'Conclusion', script: 'conclusion.js' },
  { name: 'Startpage', script: 'startpage.js' }
]);