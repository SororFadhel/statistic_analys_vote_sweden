import dbInfoOk, { displayDbNotOkText } from "./dbInfoOk.js";

addMdToPage(`# Sweden Elections Analysis`);

if (!dbInfoOk) {
  displayDbNotOkText();
  return;
}

addMdToPage(`
## Our Story

This project investigates:

👉 What explains changes in voting patterns between 2018 and 2022 in Sweden?

We analyze:
- Income
- Age
- Geography
- Statistical relationships

Our goal is to understand **why voters changed their behavior**.
`);