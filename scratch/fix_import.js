const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'controllers', 'tenantController.js');
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(/const emailService\s*=\s*require\('\.\.\/services\/emailService'\);/, 
  "const emailService  = require('../services/emailService');\nconst billingServiceV2 = require('../services/billingServiceV2');");

fs.writeFileSync(filePath, code);
console.log("Fixed import in tenantController");
