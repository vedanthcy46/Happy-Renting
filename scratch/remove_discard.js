const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'CreateBillScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// Replace handleDiscardDraft on the back button
const regex = /<TouchableOpacity onPress=\{handleDiscardDraft\} style=\{styles\.backBtn\}>/;
const replacement = `<TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>`;

if (code.match(regex)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(filePath, code);
  console.log("Updated back button to router.back()");
} else {
  console.log("Could not find back button with handleDiscardDraft");
}
