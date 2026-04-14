import dbInfoOk, { displayDbNotOkText } from "./helpers/dbInfoOk.js";
import { countyInfo } from "./helpers/dataLoader.js";


addMdToPage(`
# 🇸🇪 Sweden’s Changing Political Landscape (2018 → 2022)

## 🧠 A Data-Driven Story

Between the Swedish parliamentary elections of 2018 and 2022, something changed.

Some municipalities shifted politically.  
Some parties gained support — others lost it.  

But the key question is:

## ❓ *Why did voting patterns change?*

Was it:
- 💰 Income differences?
- 👥 Age distribution?
- 🌍 Geography and where people live?

Or something more complex?

---

## 🎯 Purpose of This Project

In this project, we explore how **social and economic factors** may explain changes in voter behavior across Sweden.

We combine data from multiple sources:

- 🗳 Election results (2018 & 2022)
- 💰 Income data per municipality
- 👥 Age distribution
- 🌍 Geographic information

By connecting these datasets, we aim to uncover:

> 📊 Patterns, trends, and possible relationships between society and politics.

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

  //add safety check
  if (Array.isArray(countyInfo)) {
    tableFromData({
      data: countyInfo.slice(0, 5)
    });
  } else {
    console.log("countyInfo not ready:", countyInfo);
  }
}