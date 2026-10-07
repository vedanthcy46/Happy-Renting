const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'CreateBillScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /const \[selectedMonth, setSelectedMonth\] = useState\(monthOptions\(\)\[0\]\.value\);/;
const replacement = `const [selectedMonth, setSelectedMonth] = useState(monthOptions()[1].value);`; // Default to previous month (index 1)

if (code.includes("useState(monthOptions()[0].value)")) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(filePath, code);
  console.log("Reverted selectedMonth to monthOptions()[1].value");
} else {
  console.log("Could not find selectedMonth in CreateBillScreen");
}
