const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'services', 'tenantService.js');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /idProof,\s*advancePaid: advancePaid \|\| 0,/;
const replacement = `idProof,
          govDocument,
          advancePaid: advancePaid || 0,`;

if (code.includes("idProof,")) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(filePath, code);
  console.log("Added govDocument to Tenant.create in tenantService.js");
} else {
  console.log("Could not find idProof in tenantService.js");
}
