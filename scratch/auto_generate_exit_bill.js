const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'controllers', 'tenantController.js');
let code = fs.readFileSync(filePath, 'utf8');

// Ensure import
if (!code.includes("const billingServiceV2 = require('../services/billingServiceV2');")) {
  code = code.replace(/const emailService = require\('\.\.\/services\/emailService'\);/, 
    "const emailService = require('../services/emailService');\nconst billingServiceV2 = require('../services/billingServiceV2');");
}

const regex = /if \(populatedTenant\.ownerId\) \{\s*await emailService\.sendMoveOutInitiatedEmail\(\s*populatedTenant\.ownerId,\s*exitDate,\s*populatedTenant\.propertyId,\s*populatedTenant\.roomId\s*\)\.catch\(\(\) => null\);\s*\}/;

const replacement = `if (populatedTenant.ownerId) {
      await emailService.sendMoveOutInitiatedEmail(
        populatedTenant.ownerId, 
        exitDate, 
        populatedTenant.propertyId, 
        populatedTenant.roomId
      ).catch(() => null);
    }
    
    // Auto-generate the final DRAFT bill immediately for the exit month so the owner can settle it
    if (exitDate) {
      try {
        const exitMonthStr = new Date(exitDate).toISOString().slice(0, 7);
        await billingServiceV2.ensureMonthlyBillDraft(populatedTenant, exitMonthStr);
      } catch (err) {
        console.error(\`[MOVE OUT] Failed to auto-generate exit month draft: \${err.message}\`);
      }
    }`;

code = code.replace(regex, replacement);

fs.writeFileSync(filePath, code);
console.log("Updated moveOutTenant to auto-generate draft bill");
