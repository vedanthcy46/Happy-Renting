const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'routes', 'monthlyBillRoutes.js');
let code = fs.readFileSync(filePath, 'utf8');

const importRegex = /deleteRecurringCharge,/;
code = code.replace(importRegex, 'deleteRecurringCharge,\n  bulkPublishBills,\n  bulkDeleteBills,');

const routerRegex = /router\.post\('\/',\s*authorize\('superadmin', 'owner'\), createBill\);/;
code = code.replace(routerRegex, `router.post('/',       authorize('superadmin', 'owner'), createBill);\nrouter.post('/bulk-publish', authorize('superadmin', 'owner'), bulkPublishBills);\nrouter.post('/bulk-delete', authorize('superadmin', 'owner'), bulkDeleteBills);`);

fs.writeFileSync(filePath, code);
console.log("Bulk routes added.");
