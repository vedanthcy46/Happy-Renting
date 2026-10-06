const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'services', 'billingServiceV2.js');
let code = fs.readFileSync(filePath, 'utf8');

// 1. In `ensureMonthlyBillDraft`:
// Remove `rentRecord` from params, and calculate dueDate.
code = code.replace(
  `const ensureMonthlyBillDraft = async (tenant, month, rentRecord) => {`,
  `const ensureMonthlyBillDraft = async (tenant, month) => {
  const { calculateDueDate } = require('../utils/billingCalculationService');
  const dueDate = calculateDueDate(month);`
);
code = code.replace(
  `dueDate   : rentRecord.dueDate,`,
  `dueDate   : dueDate,`
);

// 2. In `generateMonthlyBills`:
// Query `MonthlyBill` instead of `MonthlyRentRecord`.
code = code.replace(
  `const allRecords = await MonthlyRentRecord.find({`,
  `const allRecords = await MonthlyBill.find({`
);

// 3. Remove `ensureMonthlyRentRecord` calls.
code = code.replace(
  /if \(\(isFinalMonth \|\| isCurrentMonth\) && existingStatus !== 'paid'\) \{\s+await paymentServiceV2\.ensureMonthlyRentRecord\([\s\S]*?\);\s+\}/g,
  `// Legacy MonthlyRentRecord logic removed.`
);

// 4. Modify the 'else' block inside `while(circuitBreaker < 120)`
const newElseBlock = `} else {
            // Auto-create a DRAFT MonthlyBill (single source of truth)
            const bill = await ensureMonthlyBillDraft(tenant, iterMonthStr).catch(err =>
              logger.error(\`[MONTHLY BILL] Failed to create draft bill for tenant \${tenant._id} month=\${iterMonthStr}: \${err.message}\`)
            );

            if (bill) {
              billingResults.created++;
              logger.info(\`[CRON-V2] Created MonthlyBill for tenant \${tenant._id}\`);

              if (!tenant.isMigratedTenant || tenant.migrationBackfillCompleted) {
                createdRecords.push(bill);

                if (tenant.ownerId) {
                  const ownerIdKey = String(tenant.ownerId._id || tenant.ownerId);
                  const currentData = ownerSummaryMap.get(ownerIdKey) || { owner: tenant.ownerId, count: 0 };
                  currentData.count++;
                  ownerSummaryMap.set(ownerIdKey, currentData);
                }
              }
            }
          }`;

const elseBlockRegex = /\} else \{\s*\/\/\s*Generate using payment service[\s\S]*?(?=\/\/ Increment month)/;
code = code.replace(elseBlockRegex, newElseBlock + '\n\n          ');

// 5. Fix email payload
code = code.replace(
  `const totalAmount = createdRecords.reduce((sum, rec) => sum + (rec.totalRent || 0), 0);`,
  `const totalAmount = createdRecords.reduce((sum, rec) => sum + (rec.totalAmount || 0), 0);`
);

// change rentRecord prop to bill prop in email service calls
code = code.replace(
  `rentRecord: createdRecord,`,
  `bill: createdRecord,`
);
code = code.replace(
  `rentRecord: createdRecord,`,
  `bill: createdRecord,`
);


fs.writeFileSync(filePath, code);
console.log("Refactoring complete!");
