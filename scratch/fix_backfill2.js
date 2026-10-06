const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'services', 'billingServiceV2.js');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /\/\/ Bulk pre-fetch existing records to avoid N\+1 queries in the loop[\s\S]*?for \(const r of allRecords\) \{\s*existingMap\.set\([^\)]+\);\s*\}/;

const replacement = `// Bulk pre-fetch existing records (both legacy and new) to avoid N+1 queries in the loop
    const allLegacyRecords = await MonthlyRentRecord.find({
      tenantId: { $in: tenancies.map(t => t._id) }
    }).select('tenantId month status').lean();

    const allNewBills = await MonthlyBill.find({
      tenantId: { $in: tenancies.map(t => t._id) }
    }).select('tenantId month status').lean();

    const existingMap = new Map();
    for (const r of allLegacyRecords) {
      existingMap.set(\`\${r.tenantId}_\${r.month}\`, r.status);
    }
    for (const r of allNewBills) {
      existingMap.set(\`\${r.tenantId}_\${r.month}\`, r.status);
    }`;

code = code.replace(regex, replacement);

fs.writeFileSync(filePath, code);
console.log("Regex replaced.");
