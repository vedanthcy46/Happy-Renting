const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'services', 'paymentServiceV2.js');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /if \(tenant\.userId\) \{\s*notificationService\.sendPushNotification\(\{\s*userId: tenant\.userId,\s*title: 'New Rent Bill Generated dY",',\s*message: `Your rent bill for \$\{month\} has been generated\.`,\s*type: 'bill_generated',\s*data: \{ rentRecordId: rentRecord\._id, month \}\s*\}\)\.catch\(err => logger\.error\(`\[Push\] Failed to send bill generation push: \$\{err\.message\}`\)\);\s*\}/;

const replacement = `if (tenant.userId && !options.suppressNotifications) {
        notificationService.sendPushNotification({
          userId: tenant.userId,
          title: 'New Rent Bill Generated dY",',
          message: \`Your rent bill for \${month} has been generated.\`,
          type: 'bill_generated',
          data: { rentRecordId: rentRecord._id, month }
        }).catch(err => logger.error(\`[Push] Failed to send bill generation push: \${err.message}\`));
      }`;

code = code.replace(regex, replacement);
fs.writeFileSync(filePath, code);
console.log("Updated paymentServiceV2 to support suppressNotifications");
