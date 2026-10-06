const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'BillingScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /  searchInput: \{ flex: 1, fontSize: 15, paddingVertical: 0 \},/;
const replacement = `  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  bulkActionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, marginTop: 12 },
  bulkActionText: { fontSize: 14, fontWeight: '700' },
  bulkBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  bulkBtnText: { fontSize: 13, fontWeight: '700' },`;

code = code.replace(regex, replacement);
fs.writeFileSync(filePath, code);
console.log("Styles fixed.");
