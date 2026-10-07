const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'OwnerAddTenantScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /newTenantCard: \{ padding: spacing\.md, borderRadius: radius\.md \},/;
const replacement = `newTenantCard: { padding: spacing.md, borderRadius: radius.md },
  documentPickerRow: { flexDirection: 'row', gap: spacing.sm },
  documentPickerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.sm, borderWidth: 1, borderRadius: radius.sm, gap: spacing.xs },
  documentPickerText: { fontSize: 14, fontWeight: '500' },
  documentPreviewContainer: { position: 'relative', height: 120, width: 120, borderRadius: radius.sm, overflow: 'hidden' },
  documentPreview: { width: '100%', height: '100%' },
  removeDocumentBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 12, padding: 2 },`;

code = code.replace(regex, replacement);

// Fix Image import in AddTenantScreen too
code = code.replace(/import \{ Image \} from 'expo-image';\n?/, "");
if (!code.includes("Image,")) {
  code = code.replace(/import \{\s*View,/, "import {\n  View,\n  Image,");
}
code = code.replace(/<Image source=\{\{ uri: govDocumentUri \}\} style=\{styles\.documentPreview\} contentFit="cover" \/>/, 
  "<Image source={{ uri: govDocumentUri }} style={styles.documentPreview as any} resizeMode=\"cover\" />");

fs.writeFileSync(filePath, code);
console.log("Fixed OwnerAddTenantScreen");
