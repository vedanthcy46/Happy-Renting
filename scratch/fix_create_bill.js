const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'controllers', 'monthlyBillController.js');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /const monthlyRent = tenant\.roomId\?\.monthlyRent \|\| 0;\s*\/\/ Build items: start with rent\s*const items = \[\s*\{\s*type\s*: 'RENT',\s*description: 'Monthly Rent',\s*amount\s*: monthlyRent,\s*effectiveAmount: monthlyRent,\s*\},\s*\];/;

const replacement = `const { calculateOccupiedDays, calculateProratedRent } = require('../utils/billingCalculationService');
    const baseRent = tenant.roomId?.monthlyRent || 0;
    
    // Calculate prorated rent if this is the join month or exit month
    const joinDate = new Date(tenant.moveInDate || tenant.joinDate || Date.now());
    const exitDate = tenant.exitDate ? new Date(tenant.exitDate) : null;
    const { occupiedDays, totalDays, isProrated } = calculateOccupiedDays(month, joinDate, exitDate);
    const billedRent = isProrated ? calculateProratedRent(baseRent, occupiedDays, totalDays) : baseRent;

    // Build items: start with rent
    const items = [
      {
        type       : 'RENT',
        description: isProrated ? \`Monthly Rent (Prorated \${occupiedDays}/\${totalDays} days)\` : 'Monthly Rent',
        amount     : billedRent,
        effectiveAmount: billedRent,
      },
    ];`;

code = code.replace(regex, replacement);

fs.writeFileSync(filePath, code);
console.log("Updated createBill");
