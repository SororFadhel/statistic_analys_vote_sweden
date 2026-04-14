import dbInfoOk, { displayDbNotOkText } from "./helpers/dbInfoOk.js";
import { income, ages, electionResults } from "./dataLoader.js";
import { getCombinedData } from "./dataProcessor.js";

if (!dbInfoOk) {
    displayDbNotOkText();
    return;
}

// =====================
// GET CLEAN COMBINED DATA
// =====================

let combined = getCombinedData();   // ⭐ replaces ALL your manual cleaning code

console.log("FINAL CLEANED DATA:", combined);

// =====================
// PAGE CONTENT
// =====================

addMdToPage(`# 👥 Ålder & Inkomst vs Röstförändring`);

// =====================
// CHART 1 — AGE
// =====================

drawGoogleChart({
    type: "ScatterChart",
    data: [
        ["Ålder", "Röstförändring"],
        ...combined.map(d => [d.age, d.avgVoteChange])
    ],
    options: {
        title: "📊 Hur påverkar ålder röstförändring?",
        hAxis: { title: "Ålder" },
        vAxis: { title: "Röstförändring" }
    }
});

// =====================
// CHART 2 — INCOME
// =====================

drawGoogleChart({
    type: "ScatterChart",
    data: [
        ["Inkomst", "Röstförändring"],
        ...combined.map(d => [d.income, d.avgVoteChange])
    ],
    options: {
        title: "💰 Hur påverkar inkomst röstförändring?",
        hAxis: { title: "Inkomst" },
        vAxis: { title: "Röstförändring" }
    }
});

addMdToPage(`### Slutsats: Ålder och inkomst har svag påverkan.`);
