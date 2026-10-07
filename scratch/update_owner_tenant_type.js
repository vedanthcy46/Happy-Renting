const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'api', 'owner.ts');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /idProof\?: string;/;
const replacement = `idProof?: string;\n  govDocument?: { secureUrl: string; publicId: string };`;

code = code.replace(regex, replacement);
fs.writeFileSync(filePath, code);
console.log("Updated OwnerTenant interface");
