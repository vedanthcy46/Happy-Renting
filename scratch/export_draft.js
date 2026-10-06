const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'services', 'billingServiceV2.js');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /module\.exports = \{/;
const replacement = `module.exports = {
  ensureMonthlyBillDraft,`;

code = code.replace(regex, replacement);

fs.writeFileSync(filePath, code);
console.log("Exported ensureMonthlyBillDraft");
