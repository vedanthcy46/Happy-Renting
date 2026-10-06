const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'services', 'billingServiceV2.js');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /\/\/ Move-Out \/ Vacated \/ Exit Date Settlement Exception:[\s\S]*?if \(!isNaN\(vacYear\) && !isNaN\(vacMonth\)\) \{\s*endYear = vacYear;\s*endMonthIndex = vacMonth;\s*\}\s*\}\s*\}/;

const replacement = `// Move-Out / Vacated / Exit Date Settlement Exception:
        // Cap billing strictly to the month of exitDate. Do not generate bills for months after exitDate.
        if (tenant.status === 'vacated' || tenant.exitDate) {
          if (tenant.exitDate) {
            const exitDate = new Date(tenant.exitDate);
            const exitYear = exitDate.getFullYear();
            const exitMonth = exitDate.getMonth();
            
            if (!isNaN(exitYear) && !isNaN(exitMonth)) {
              endYear = exitYear;
              endMonthIndex = exitMonth;
            }
          } else if (tenant.status === 'vacated') {
            logger.info(\`[BILLING SKIPPED] Tenant \${tenant._id} is vacated but has no exitDate. Skipping to prevent over-billing.\`);
            continue;
          }
        }`;

code = code.replace(regex, replacement);

fs.writeFileSync(filePath, code);
console.log("Fixed vacated fallback.");
