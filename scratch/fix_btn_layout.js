const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'BillingScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const targetRegex = /<Text style=\{\[styles\.bulkActionText, \{ color: colors\.text\.primary \}\]\}>\s*\{draftBills\.length\} Draft\{draftBills\.length > 1 \? 's' : ''\} Ready\s*<\/Text>/;
const replacement = `<View style={{ flex: 1 }}>
                      <Text style={[styles.bulkActionText, { color: colors.text.primary }]} numberOfLines={1}>
                        {draftBills.length} Draft{draftBills.length > 1 ? 's' : ''} Ready
                      </Text>
                    </View>`;

code = code.replace(targetRegex, replacement);

const btnRegex = /bulkBtn: \{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, justifyContent: 'center', alignItems: 'center' \},/;
const btnReplacement = `bulkBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },`;
code = code.replace(btnRegex, btnReplacement);

fs.writeFileSync(filePath, code);
console.log("Adjusted bulk action bar layout for 3 buttons");
