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

function fixAddTenantScreen() {
  const file = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'OwnerAddTenantScreen.tsx');
  let code = fs.readFileSync(file, 'utf8');
  
  const startTarget = '<Text style={[styles.fieldLabel, { color: colors.text.secondary, marginTop: spacing.md }]}>Gov Document Photo (Optional)</Text>';
  const startIndex = code.indexOf(startTarget);
  
  const endTarget = 'Gallery</Text>';
  const galleryIndex = code.indexOf(endTarget, startIndex);
  
  const closeTouchIndex = code.indexOf('</TouchableOpacity>', galleryIndex);
  const closeView1 = code.indexOf('</View>', closeTouchIndex);
  const closeView2 = code.indexOf(')}', closeView1);
  
  if (startIndex !== -1 && closeView2 !== -1) {
    code = code.substring(0, startIndex) + newUI + code.substring(closeView2 + 2); // skip )}
    fs.writeFileSync(file, code);
    console.log("Fixed OwnerAddTenantScreen");
  } else {
    console.log("Failed to find bounds in OwnerAddTenantScreen");
  }
}

fixAddTenantScreen();
