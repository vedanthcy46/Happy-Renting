const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'frontend', 'myapp', 'src', 'api', 'axios.js');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /const BACKUP_URL\s*=\s*process\.env\.REACT_APP_BACKUP_API_URL;/;
const replacement = `let BACKUP_URL  = process.env.REACT_APP_BACKUP_API_URL;
// Ensure backup URL correctly ends with /api to prevent 404 Route Not Found errors on failover
if (BACKUP_URL && !BACKUP_URL.endsWith('/api')) {
  BACKUP_URL = BACKUP_URL.replace(/\\/$/, '') + '/api';
}`;

code = code.replace(regex, replacement);
fs.writeFileSync(filePath, code);
console.log("Fixed BACKUP_URL robust check in axios.js");
