const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'OwnerApprovalsScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /qc\.invalidateQueries\(\{ queryKey: \['ownerRentRecords'\] \}\);/g;
const replacement = `qc.invalidateQueries({ queryKey: ['ownerRentRecords'] });
      qc.invalidateQueries({ queryKey: ['ownerBills'] });`;

if (code.match(regex)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(filePath, code);
  console.log("Added ownerBills invalidation to OwnerApprovalsScreen");
} else {
  console.log("Could not find ownerRentRecords invalidation in OwnerApprovalsScreen");
}
