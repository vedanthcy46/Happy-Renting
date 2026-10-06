const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'BillingScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /\/\/ Include next month \(i = -1\) so owners can prepare bills in advance\s*for \(let i = -1; i < 6; i\+\+\) \{/;
const replacement = `for (let i = 0; i < 6; i++) {`;

code = code.replace(regex, replacement);
fs.writeFileSync(filePath, code);
console.log("Reverted monthOptions to not include next month.");
