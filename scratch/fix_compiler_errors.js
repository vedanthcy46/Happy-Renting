const fs = require('fs');
const path = require('path');

// 1. Fix owner.ts
const ownerPath = path.join(__dirname, '..', 'mobile', 'src', 'api', 'owner.ts');
let ownerCode = fs.readFileSync(ownerPath, 'utf8');
const ownerRegex = /idProof\?: string;/;
ownerCode = ownerCode.replace(ownerRegex, "idProof?: string;\n  govDocument?: { secureUrl: string; publicId: string };");
fs.writeFileSync(ownerPath, ownerCode);

// 2. Fix OwnerTenantsScreen
const tenantsPath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'OwnerTenantsScreen.tsx');
let tenantsCode = fs.readFileSync(tenantsPath, 'utf8');
tenantsCode = tenantsCode.replace(/onDeleteCoOccupant=\{handleDeleteCoOccupant\}\n\s*t=\{t\}\s*\/>/, 
  "onDeleteCoOccupant={handleDeleteCoOccupant}\n        onViewDocument={setLightboxUrl}\n        t={t}\n      />");
fs.writeFileSync(tenantsPath, tenantsCode);

// 3. Fix OwnerAddTenantScreen styles
const addTenantPath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'OwnerAddTenantScreen.tsx');
let addTenantCode = fs.readFileSync(addTenantPath, 'utf8');
const styleRegex = /newTenantCard: \{ padding: spacing\.md, borderRadius: radius\.md \},/;
const styleReplacement = `newTenantCard: { padding: spacing.md, borderRadius: radius.md },
  documentPickerRow: { flexDirection: 'row', gap: spacing.sm },
  documentPickerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.sm, borderWidth: 1, borderRadius: radius.sm, gap: spacing.xs },
  documentPickerText: { fontSize: 14, fontWeight: '500' },
  documentPreviewContainer: { position: 'relative', height: 120, width: 120, borderRadius: radius.sm, overflow: 'hidden', marginTop: spacing.xs },
  documentPreview: { width: '100%', height: '100%' },
  removeDocumentBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 12, padding: 2 },`;
addTenantCode = addTenantCode.replace(styleRegex, styleReplacement);
fs.writeFileSync(addTenantPath, addTenantCode);
