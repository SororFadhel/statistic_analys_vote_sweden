// ===============================
// 📦 COMPONENTS.JS
// Alla återanvändbara HTML-komponenter och färger
// Importeras av alla sidor i projektet
// ===============================


// ===============================
// 🎨 FÄRGPALETT
// Gemensamma färger för hela projektet
// Används i Google Charts och övrig styling
// ===============================

export const COLORS = {
  primary: '#1a2b4a',
  secondary: '#c8963e'
};


// ===============================
// 🦸 PAGE HERO
// Stor rubrikruta överst på sidan
// Tar emot titel, beskrivning och array av taggar
// Användning: addToPage(pageHero('Titel', 'Beskrivning', ['Tagg 1', 'Tagg 2']))
// ===============================

export function pageHero(title, description, tags = []) {
  const tagHtml = tags.map(tag => `<span class="hero-tag">${tag}</span>`).join('');
  return `
    <div class="page-hero">
      <h2>${title}</h2>
      <p>${description}</p>
      <div class="hero-tags">${tagHtml}</div>
    </div>
  `;
}


// ===============================
// 📊 STAT GRID
// Rutnät som håller statistikkorten
// Tar emot en array av statCard()
// Användning: addToPage(statGrid([statCard(...), statCard(...)]))
// ===============================

export function statGrid(cards) {
  return `<div class="stat-grid">${cards.join('')}</div>`;
}


// ===============================
// 📋 STAT CARD
// Enskilt statistikkort med titel och värde
// Användning: statCard('Antal kommuner', 287)
// ===============================

export function statCard(title, value) {
  return `
    <div class="stat-card">
      <h4>${title}</h4>
      <div class="value">${value}</div>
    </div>
  `;
}


// ===============================
// ℹ️ INFO NOTE
// Informationsruta för viktiga noter
// Användning: addToPage(infoNote('text här'))
// ===============================

export function infoNote(text) {
  return `<div class="info-note">${text}</div>`;
}


// ===============================
// 🧠 ANALYSIS BOX
// Ruta för analys, slutsatser och förklaringar
// Tar emot titel och HTML-innehåll
// Användning: analysisBox('Analys', '<p>text här</p>')
// ===============================

export function analysisBox(title, content, marginTop = false) {
  return `
    <div class="analysis-box"${marginTop ? ' style="margin-top: 1rem;"' : ''}>
      <h3>${title}</h3>
      ${content}
    </div>
  `;
}


// ===============================
// 🗺️ LAN CHART
// Länsstapeldiagram med badges för arbetslöshetsnivå
// Tar emot data från buildLanData()
// Användning: addToPage(lanChart(data, formatPercent))
// ===============================

export function lanChart(lanData, formatPercent) {
  if (!lanData.length) return "<p>Inte tillräckligt med data.</p>";

  const maxAbs = Math.max(...lanData.map(d => Math.abs(d.avgVoteChange)));
  const thresholdHigh = lanData.map(d => d.arbetsloshet_2022).sort((a, b) => b - a)[Math.floor(lanData.length / 3)];
  const thresholdLow = lanData.map(d => d.arbetsloshet_2022).sort((a, b) => b - a)[Math.floor(2 * lanData.length / 3)];

  function getBadgeClass(val) {
    if (val >= thresholdHigh) return "lan-badge lan-badge-high";
    if (val >= thresholdLow) return "lan-badge lan-badge-mid";
    return "lan-badge lan-badge-low";
  }

  function getBadgeLabel(val) {
    if (val >= thresholdHigh) return "Hög";
    if (val >= thresholdLow) return "Medel";
    return "Låg";
  }

  const rows = lanData.map(d => {
    const pct = Math.round((Math.abs(d.avgVoteChange) / maxAbs) * 100);
    const isPos = d.avgVoteChange >= 0;
    const sign = isPos ? "+" : "-";
    const barClass = isPos ? "lan-bar-pos" : "lan-bar-neg";
    return `
      <div class="lan-bar-row">
        <span class="lan-bar-label">${d.lan}</span>
        <div class="lan-bar-track"><div class="${barClass}" style="width:${pct}%"></div></div>
        <span class="lan-bar-value">${sign}${Math.abs(Math.round(d.avgVoteChange))}</span>
        <span class="${getBadgeClass(d.arbetsloshet_2022)}">${getBadgeLabel(d.arbetsloshet_2022)} (${formatPercent(d.arbetsloshet_2022, 1)})</span>
      </div>
    `;
  }).join("");

  return `
    <div class="lan-chart-wrap">
      <div class="lan-legend">
        <span><span class="lan-legend-dot" style="background:${COLORS.primary}"></span> Ökade röster</span>
        <span><span class="lan-legend-dot" style="background:${COLORS.secondary}"></span> Minskade röster</span>
        <span><span class="lan-legend-dot" style="background:#faeeda;border:1px solid ${COLORS.secondary}"></span> Hög arbetslöshet</span>
        <span><span class="lan-legend-dot" style="background:#e8f0fb;border:1px solid #185fa5"></span> Medel arbetslöshet</span>
        <span><span class="lan-legend-dot" style="background:#eaf3de;border:1px solid #3b6d11"></span> Låg arbetslöshet</span>
      </div>
      ${rows}
    </div>
  `;
}