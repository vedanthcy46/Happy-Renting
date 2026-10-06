const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'BillingScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /const monthOptions = \(\) => \{\s*const opts: \{ label: string; value: string \}\[\] = \[\];\s*const now = new Date\(\);\s*for \(let i = 0; i < 6; i\+\+\) \{/;
const replacement = `const monthOptions = () => {
  const opts: { label: string; value: string }[] = [];
  const now = new Date();
  // Include next month (i = -1) so owners can prepare bills in advance
  for (let i = -1; i < 6; i++) {`;

code = code.replace(regex, replacement);
fs.writeFileSync(filePath, code);
console.log("Updated monthOptions to include next month.");
