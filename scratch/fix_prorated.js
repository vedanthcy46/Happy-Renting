const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'services', 'billingServiceV2.js');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /const ensureMonthlyBillDraft = async \(tenant, month\) => \{[\s\S]*?effectiveAmount: monthlyRent,\s*\}\];/;

const replacement = `const ensureMonthlyBillDraft = async (tenant, month) => {
  const { calculateDueDate, calculateOccupiedDays, calculateProratedRent } = require('../utils/billingCalculationService');
  const dueDate = calculateDueDate(month);
  const existing = await MonthlyBill.findOne({ tenantId: tenant._id, month });
  if (existing) return existing;

  const baseRent = tenant.roomId?.monthlyRent || 0;
  
  // Calculate prorated rent if this is the join month or exit month
  const joinDate = new Date(tenant.moveInDate || tenant.joinDate || Date.now());
  const exitDate = tenant.exitDate ? new Date(tenant.exitDate) : null;
  const { occupiedDays, totalDays, isProrated } = calculateOccupiedDays(month, joinDate, exitDate);
  const billedRent = isProrated ? calculateProratedRent(baseRent, occupiedDays, totalDays) : baseRent;

  const items = [{
    type: 'RENT',
    description: isProrated ? \`Monthly Rent (Prorated \${occupiedDays}/\${totalDays} days)\` : 'Monthly Rent',
    amount: billedRent,
    effectiveAmount: billedRent,
  }];`;

code = code.replace(regex, replacement);

fs.writeFileSync(filePath, code);
console.log("Prorated rent logic added.");
