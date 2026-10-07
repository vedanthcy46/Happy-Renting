const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'api', 'owner.ts');
let code = fs.readFileSync(filePath, 'utf8');

// Remove the wrong one from CoOccupant
code = code.replace(/export interface CoOccupant \{\s*_id: string;\s*name: string;\s*phone\?: string;\s*idProof\?: string;\s*govDocument\?: \{ secureUrl: string; publicId: string \};\s*status\?: string;\s*\}/, 
`export interface CoOccupant {
  _id: string;
  name: string;
  phone?: string;
  idProof?: string;
  status?: string;
}`);

// Add to OwnerTenant properly
const ownerRegex = /export interface OwnerTenant \{\s*_id: string;\s*status: 'active' \| 'vacated' \| 'pending_deletion';\s*joinDate: string;\s*moveInDate\?: string;\s*exitDate\?: string;\s*phone\?: string;\s*idProof\?: string;/;
const ownerReplacement = `export interface OwnerTenant {
  _id: string;
  status: 'active' | 'vacated' | 'pending_deletion';
  joinDate: string;
  moveInDate?: string;
  exitDate?: string;
  phone?: string;
  idProof?: string;
  govDocument?: { secureUrl: string; publicId: string };`;

code = code.replace(ownerRegex, ownerReplacement);
fs.writeFileSync(filePath, code);
console.log("Fixed owner.ts interface properly");
