const fs = require('fs');
const path = require('path');

const newUI = `<View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', marginBottom: 8, color: '#6b7280' }}>Gov Document Photo (Optional)</Text>
                {govDocumentUri ? (
                  <View style={{ position: 'relative', height: 180, width: '100%', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <Image source={{ uri: govDocumentUri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                    <TouchableOpacity style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20, padding: 2, elevation: 2 }} onPress={() => setGovDocumentUri(null)}>
                      <Ionicons name="close-circle" size={32} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, borderWidth: 1, borderRadius: 8, borderStyle: 'dashed', borderColor: '#d1d5db', backgroundColor: '#f9fafb' }} onPress={takeGovDocumentPhoto}>
                      <View style={{ width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 8, backgroundColor: 'rgba(99, 102, 241, 0.1)' }}>
                        <Ionicons name="camera" size={26} color="#6366f1" />
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>Take Photo</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, borderWidth: 1, borderRadius: 8, borderStyle: 'dashed', borderColor: '#d1d5db', backgroundColor: '#f9fafb' }} onPress={pickGovDocument}>
                      <View style={{ width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 8, backgroundColor: 'rgba(99, 102, 241, 0.1)' }}>
                        <Ionicons name="image" size={26} color="#6366f1" />
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>Gallery</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>`;

function replaceUI(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  
  // Find start and end
  let startIdx = code.indexOf("<Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Gov Document Photo (Optional)</Text>");
  if (startIdx === -1) {
    startIdx = code.indexOf("<Text style={[styles.fieldLabel, { color: colors.text.secondary, marginTop: spacing.md }]}>Gov Document Photo (Optional)</Text>");
  }
  if (startIdx === -1) {
      console.log("Start not found in " + filePath);
      return;
  }
  
  // Actually, let's just find <View style={styles.formField}> before it.
  const blockStart = code.lastIndexOf("<View", startIdx);
  
  const endIdx = code.indexOf("</View>", startIdx);
  // wait, the block has nested Views. Let's find the closing tag for the formField View.
  // We can just use regex for the whole block since it's predictable
  const regex = /<View style=\{styles\.formField\}>\s*<Text style=\{\[styles\.fieldLabel, \{ color: colors\.text\.secondary(?:, marginTop: spacing\.md)? \}\]\}>Gov Document Photo \(Optional\)<\/Text>[\s\S]*?<\/View>\s*<\/View>/;
  
  // Try regex replace first
  if (regex.test(code)) {
    code = code.replace(regex, newUI);
    console.log("Successfully replaced via regex in " + path.basename(filePath));
  } else {
      console.log("Regex failed in " + path.basename(filePath));
  }

  fs.writeFileSync(filePath, code);
}

replaceUI(path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'OwnerTenantsScreen.tsx'));
replaceUI(path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'OwnerAddTenantScreen.tsx'));
