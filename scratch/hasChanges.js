const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'OwnerTenantsScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add setGovDocumentUri to useEffect
const effectRegex = /setIdProof\(tenant\.idProof \|\| ''\);\s*setError\(''\);/;
const effectReplacement = `setIdProof(tenant.idProof || '');
      setGovDocumentUri(tenant.govDocument?.secureUrl || null);
      setError('');`;
if(code.match(effectRegex)) {
  code = code.replace(effectRegex, effectReplacement);
}

// 2. Calculate hasChanges before return
const hasChangesLogic = `  const hasChanges = 
    deposit !== String(tenant?.securityDeposit ?? '') ||
    advance !== String(tenant?.advancePaid ?? '') ||
    name !== (tenant?.userId.name || '') ||
    email !== (tenant?.userId.email || '') ||
    phone !== (tenant?.phone || '') ||
    idProof !== (tenant?.idProof || '') ||
    (govDocumentUri && !govDocumentUri.startsWith('http'));

  return (`;

const returnRegex = /  return \(\s*<KeyboardSafeModal/;
if(code.match(returnRegex)) {
  code = code.replace(returnRegex, hasChangesLogic + '\n    <KeyboardSafeModal');
}

// 3. Disable Save button if !hasChanges
const saveBtnRegex = /<TouchableOpacity\s*style=\{\[styles\.modalBtn, \{ backgroundColor: colors\.primary \}\]\}\s*onPress=\{handleSave\}\s*activeOpacity=\{0\.8\}\s*disabled=\{saving\}/;
const saveBtnReplacement = `<TouchableOpacity
            style={[styles.modalBtn, { backgroundColor: (!hasChanges || saving) ? colors.border : colors.primary }]}
            onPress={handleSave}
            activeOpacity={0.8}
            disabled={!hasChanges || saving}`;
if(code.match(saveBtnRegex)) {
  code = code.replace(saveBtnRegex, saveBtnReplacement);
}

fs.writeFileSync(filePath, code);
console.log("Updated OwnerTenantsScreen with hasChanges logic");
