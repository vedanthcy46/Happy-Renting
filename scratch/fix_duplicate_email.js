const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'controllers', 'monthlyBillController.js');
let code = fs.readFileSync(filePath, 'utf8');

const duplicateRegex = /if \(bill\.userId && bill\.userId\.email\) \{\s*emailService\.sendBillGeneratedEmail\(\{\s*user: bill\.userId,\s*role: 'tenant',\s*rentRecord: rentRecord,\s*property: bill\.tenantId\.propertyId,\s*room: bill\.tenantId\.roomId,\s*tenantUser: bill\.userId\s*\}\)\.catch\(err => console\.error\(`\[EMAIL ERROR\] Failed to send bill generated email: \$\{err\.message\}`\)\);\s*\}\s*if \(bill\.userId && bill\.userId\.email\)/;

const replacement = `if (bill.userId && bill.userId.email) {
        emailService.sendBillGeneratedEmail({
          user: bill.userId,
          role: 'tenant',
          rentRecord: rentRecord,
          property: bill.tenantId.propertyId,
          room: bill.tenantId.roomId,
          tenantUser: bill.userId
        }).catch(err => console.error(\`[EMAIL ERROR] Failed to send bill generated email: \${err.message}\`));
      }
      // REMOVED DUPLICATE
      if (false)`; // dummy to not break the replacement syntax entirely

code = code.replace(duplicateRegex, replacement);

fs.writeFileSync(filePath, code);
console.log("Removed duplicate email send.");
