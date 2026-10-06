const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'BillingScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /const currentMonthKey = \(\) => \{\s*const now = new Date\(\);\s*\/\/ Default to previous month since billing is post-generation\s*now\.setMonth\(now\.getMonth\(\) - 1\);\s*return `\$\{now\.getFullYear\(\)\}-\$\{String\(now\.getMonth\(\) \+ 1\)\.padStart\(2, '0'\)\}`;\s*\};/;
const replacement = `const currentMonthKey = () => {
  const now = new Date();
  // Safe previous month calculation (prevents 31st day overflow)
  let year = now.getFullYear();
  let prevMonth = now.getMonth(); // getMonth is 0-indexed (0=Jan, 11=Dec). So current month index IS the previous month's 1-indexed number!
  if (prevMonth === 0) {
    prevMonth = 12;
    year -= 1;
  }
  return \`\${year}-\${String(prevMonth).padStart(2, '0')}\`;
};`;

code = code.replace(regex, replacement);
fs.writeFileSync(filePath, code);
console.log("Safe currentMonthKey implemented.");
