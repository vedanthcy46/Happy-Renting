const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'OwnerTenantsScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /onDeleteCoOccupant=\{triggerDeleteCoOccupant\}\s*t=\{t\}\s*\/>/;
const replacement = `onDeleteCoOccupant={triggerDeleteCoOccupant}
        onViewDocument={setLightboxUrl}
        t={t}
      />`;

code = code.replace(regex, replacement);
fs.writeFileSync(filePath, code);
console.log("Fixed TenantDetailSheet instantiation properly");
