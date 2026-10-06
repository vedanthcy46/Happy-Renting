const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'frontend', 'myapp', '.env');
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(/REACT_APP_BACKUP_API_URL=https:\/\/happy-renting-izbf\.onrender\.com/, 'REACT_APP_BACKUP_API_URL=https://happy-renting-izbf.onrender.com/api');

fs.writeFileSync(filePath, code);
console.log("Fixed .env");
