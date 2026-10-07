const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'BillingScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /const currentMonthKey = \(\) => \{\s*const now = new Date\(\);\s*const year = now\.getFullYear\(\);\s*const month = now\.getMonth\(\) \+ 1;[^\n]*\s*return `\$\{year\}-\$\{String\(month\)\.padStart\(2, '0'\)\}`;\s*\};/;
const replacement = `const currentMonthKey = () => {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-indexed, so it naturally represents the previous month
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  return \`\${year}-\${String(month).padStart(2, '0')}\`;
};`;

if (code.includes("now.getMonth() + 1")) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(filePath, code);
  console.log("Reverted currentMonthKey to previous month");
} else {
  console.log("Could not find currentMonthKey");
}
