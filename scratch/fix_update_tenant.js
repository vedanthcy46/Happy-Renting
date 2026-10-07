const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'controllers', 'tenantController.js');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /if \(idProof\s*!== undefined\) tenant\.idProof\s*= idProof;/;
const replacement = `if (idProof        !== undefined) tenant.idProof      = idProof;
    if (req.file) {
      tenant.govDocument = {
        secureUrl: req.file.path,
        publicId: req.file.filename,
      };
    }`;

if (code.includes("if (idProof")) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(filePath, code);
  console.log("Added govDocument support to updateTenant");
} else {
  console.log("Could not find idProof in updateTenant");
}
