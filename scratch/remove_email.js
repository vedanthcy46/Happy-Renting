const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'services', 'billingServiceV2.js');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /\/\/ ── Email newly created bills ──[\s\S]*?(?=\/\/ Mark backfill completed if it was a migrated tenant)/;
code = code.replace(regex, `// ── Email newly created bills ──
        // DRAFT bills are not emailed to tenants automatically. 
        // Owners must finalize and send them.
        
        `);

fs.writeFileSync(filePath, code);
console.log("Email logic removed successfully!");
