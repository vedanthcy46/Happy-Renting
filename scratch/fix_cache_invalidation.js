const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'OwnerTransactionDetailScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// Replace qc.invalidateQueries({ queryKey: ['ownerRentRecords'] }); with it and ownerBills
const regex = /qc\.invalidateQueries\(\{ queryKey: \['ownerRentRecords'\] \}\);/g;
const replacement = `qc.invalidateQueries({ queryKey: ['ownerRentRecords'] });
      qc.invalidateQueries({ queryKey: ['ownerBills'] });`;

if (code.match(regex)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(filePath, code);
  console.log("Added ownerBills invalidation to OwnerTransactionDetailScreen");
} else {
  console.log("Could not find ownerRentRecords invalidation");
}
