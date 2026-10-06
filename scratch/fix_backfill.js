const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'services', 'billingServiceV2.js');
let code = fs.readFileSync(filePath, 'utf8');

const target = `    // Bulk pre-fetch existing records to avoid N+1 queries in the loop
    const allRecords = await MonthlyBill.find({
      tenantId: { $in: tenancies.map(t => t._id) }
    }).select('tenantId month status').lean();

    const existingMap = new Map();
    for (const r of allRecords) {
      existingMap.set(\`\${r.tenantId}_\${r.month}\`, r.status);
    }`;

const replacement = `    // Bulk pre-fetch existing records (both legacy and new) to avoid N+1 queries in the loop
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

code = code.replace(target, replacement);

fs.writeFileSync(filePath, code);
console.log("Successfully fixed backfill logic.");
