// generate.js
const fs = require("fs");

const randomData = Math.random().toString(36).substring(2, 15);
fs.writeFileSync("CHANGELOG_PUBLIC.md", `Random data: ${randomData}\n`, "utf8");

console.log("✅ test.txt generated with random data.");
