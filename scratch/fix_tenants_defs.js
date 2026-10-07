const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'OwnerTenantsScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// Add imports
if (!code.includes('ImageLightbox')) {
  code = code.replace(/import \{ KeyboardSafeModal \} from '\.\.\/\.\.\/components';/,
    `import { KeyboardSafeModal, ImageLightbox } from '../../components';`);
}

if (!code.includes("import * as ImagePicker")) {
  code = code.replace(/import \{ useRouter \} from 'expo-router';/,
    `import { useRouter } from 'expo-router';\nimport * as ImagePicker from 'expo-image-picker';`);
}

if (!code.includes("Image,")) {
  code = code.replace(/import \{\s*View,/, "import {\n  View,\n  Image,");
}

// Add styles
const styleRegex = /sheetDivider: \{ height: 1, marginVertical: spacing\.sm \},/;
const styleReplacement = `sheetDivider: { height: 1, marginVertical: spacing.sm },
  documentPickerRow: { flexDirection: 'row', gap: spacing.sm },
  documentPickerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.sm, borderWidth: 1, borderRadius: radius.sm, gap: spacing.xs },
  documentPickerText: { fontSize: 14, fontWeight: '500' },
  documentPreviewContainer: { position: 'relative', height: 120, width: 120, borderRadius: radius.sm, overflow: 'hidden', marginTop: spacing.xs },
  documentPreview: { width: '100%', height: '100%' },
  removeDocumentBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 12, padding: 2 },`;

if (!code.includes("documentPickerRow:")) {
  code = code.replace(styleRegex, styleReplacement);
}

fs.writeFileSync(filePath, code);
console.log("Fixed OwnerTenantsScreen missing definitions");
