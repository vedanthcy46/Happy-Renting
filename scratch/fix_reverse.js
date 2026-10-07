const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'services', 'paymentServiceV2.js');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /      await rented\.save\(\);\s*\}\s*\}/;
const replacement = `      await rented.save();

      // Sync reversed payment status back to the MonthlyBill invoice layer
      const { syncRentRecordToBill } = require('../controllers/monthlyBillController');
      await syncRentRecordToBill(rented._id).catch(err => logger.error(\`[BILL SYNC] \${err.message}\`));
    }
  }`;

if (code.match(regex)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(filePath, code);
  console.log("Added syncRentRecordToBill to reverseTransaction");
} else {
  console.log("Could not find rented.save() block in reverseTransaction");
}
