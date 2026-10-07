const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'api', 'owner.ts');
let code = fs.readFileSync(filePath, 'utf8');

// Revert the wrong one
code = code.replace(/idProof\?: string;\s*govDocument\?: \{ secureUrl: string; publicId: string \};/, 'idProof?: string;');

// Add to OwnerTenant specifically
const regex = /export interface OwnerTenant \{[\s\S]*?idProof\?: string;/;
const replacement = `export interface OwnerTenant {
  _id: string;
  status: 'active' | 'vacated' | 'pending_deletion';
  joinDate: string;
  moveInDate?: string;
  exitDate?: string;
  phone?: string;
  idProof?: string;
  govDocument?: { secureUrl: string; publicId: string };`;

// wait, safer way:
code = code.replace("phone?: string;\n  idProof?: string;", "phone?: string;\n  idProof?: string;\n  govDocument?: { secureUrl: string; publicId: string };");

fs.writeFileSync(filePath, code);
console.log("Fixed owner.ts interface");
