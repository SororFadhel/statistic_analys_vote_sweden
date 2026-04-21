import dbInfoOk, { displayDbNotOkText } from "./helpers/dbInfoOk.js";
import { countyInfo } from "./helpers/dataLoader.js";


addMdToPage(`
# 🇸🇪 Sveriges föränderliga politiska landskap (2018 → 2022)

## 🧠 En datadriven analys

Mellan riksdagsvalet 2018 och 2022 skedde märkbara förändringar mellan kommunerna.

Vissa regioner ändrade politisk inriktning, medan andra förblev stabila.
Vissa partier fick stöd, medan andra tappade mark.

Detta väcker en central fråga:

## ❓ Vad förklarar förändringar i röstningsmönster?

Är dessa förändringar kopplade till:

- 💰 Inkomstskillnader mellan kommuner?
- 👥 Variationer i åldersfördelning?
- 🌍 Geografisk plats och regionala egenskaper?

Eller är mönstren mer komplexa?

---

## 🎯 Studiens syfte

Syftet med detta projekt är att undersöka om **socioekonomiska och demografiska faktorer är kopplade till förändringar i röstningsbeteende** i hela Sverige.

Snarare än att bara beskriva resultat fokuserar analysen på på:

> 📊 Identifiera mönster, jämföra grupper och utvärdera statistiska samband.

---

## 🗂 Datakällor

Analysen kombinerar flera datamängder:

- 🗳 Valresultat (2018 och 2022)
- 💰 Genomsnittlig inkomst per kommun
- 👥 Åldersfördelning
- 🌍 Geografisk information

Dessa datamängder är integrerade på kommunnivå för att möjliggöra jämförelse och analys.

---

## 🔬 Analytiskt tillvägagångssätt

Projektet följer en strukturerad statistisk process:

1. **Deskriptiv analys**
→ Identifiera mönster och fördelningar

2. **Jämförande analys**
→ Jämför olika grupper (t.ex. inkomstnivåer)

3. **Hypotesprövning**
→ Testa om observerade skillnader är statistiskt signifikanta

4. **Korrelationsanalys**
→ Mäta samband mellan variabler

---

## 🚀 Strukturen hos Analys

Varje del av projektet bygger mot att besvara den huvudsakliga forskningsfrågan, och går från grundläggande utforskning till djupare statistisk utvärdering.

---

## 🚀 Let’s Begin

Use the menu to explore the analysis.
`);


// CHECK DATABASE FIRST
if (!dbInfoOk) {
  displayDbNotOkText();
} else {

  addMdToPage(`
  ---
  ## 📊 Data Preview
  `);

  // add safety check
  if (Array.isArray(countyInfo)) {
    tableFromData({
      data: countyInfo.slice(0, 5)
    });
  } else {
    console.log("countyInfo not ready:", countyInfo);
  }
}