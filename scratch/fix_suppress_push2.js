const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'services', 'paymentServiceV2.js');
let code = fs.readFileSync(filePath, 'utf8');

const replacement = "if (tenant.userId && !options.suppressNotifications) {\n        notificationService.sendPushNotification";
code = code.replace(/if \(tenant\.userId\) \{\s*notificationService\.sendPushNotification/, replacement);

fs.writeFileSync(filePath, code);
console.log("Updated paymentServiceV2");
