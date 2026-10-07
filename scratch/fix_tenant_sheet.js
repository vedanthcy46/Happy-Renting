const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'OwnerTenantsScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /onDeleteCoOccupant=\{openDeleteCoOccupant\}\s*t=\{t\}\s*\/>/;
const replacement = `onDeleteCoOccupant={openDeleteCoOccupant}
        onViewDocument={setLightboxUrl}
        t={t}
      />`;

if (code.includes("onDeleteCoOccupant={openDeleteCoOccupant}")) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(filePath, code);
  console.log("Fixed TenantDetailSheet instantiation");
} else {
  console.log("Could not find onDeleteCoOccupant={openDeleteCoOccupant}");
}
