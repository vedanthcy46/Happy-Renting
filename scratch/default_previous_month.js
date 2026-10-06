const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'BillingScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /const currentMonthKey = \(\) => \{\s*const now = new Date\(\);\s*return `\$\{now\.getFullYear\(\)\}-\$\{String\(now\.getMonth\(\) \+ 1\)\.padStart\(2, '0'\)\}`;\s*\};/;
const replacement = `const currentMonthKey = () => {
  const now = new Date();
  // Default to previous month since billing is post-generation
  now.setMonth(now.getMonth() - 1);
  return \`\${now.getFullYear()}-\${String(now.getMonth() + 1).padStart(2, '0')}\`;
};`;

code = code.replace(regex, replacement);
fs.writeFileSync(filePath, code);
console.log("Updated default month to previous month.");
