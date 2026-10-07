const fs = require('fs');
const path = require('path');

const newUIAddTenant = `<View style={{ marginTop: spacing.md }}>
                <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Gov Document Photo (Optional)</Text>
                {govDocumentUri ? (
                  <View style={[styles.documentPreviewContainer, { borderColor: colors.border }]}>
                    <Image source={{ uri: govDocumentUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    <TouchableOpacity style={styles.removeDocumentBtn} onPress={() => setGovDocumentUri(null)}>
                      <Ionicons name="close-circle" size={32} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.uploadActionsRow}>
                    <TouchableOpacity style={[styles.uploadActionBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={takeGovDocumentPhoto}>
                      <View style={[styles.uploadIconCircle, { backgroundColor: colors.primary + '15' }]}>
                        <Ionicons name="camera" size={26} color={colors.primary} />
                      </View>
                      <Text style={[styles.uploadActionText, { color: colors.text.primary }]}>Take Photo</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={[styles.uploadActionBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={pickGovDocument}>
                      <View style={[styles.uploadIconCircle, { backgroundColor: colors.primary + '15' }]}>
                        <Ionicons name="image" size={26} color={colors.primary} />
                      </View>
                      <Text style={[styles.uploadActionText, { color: colors.text.primary }]}>Gallery</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>`;

const newUIEditTenant = `<View style={{ marginTop: spacing.md }}>
                <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Gov Document Photo (Optional)</Text>
                {govDocumentUri ? (
                  <View style={[styles.documentPreviewContainer, { borderColor: colors.border }]}>
                    <Image source={{ uri: govDocumentUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    <TouchableOpacity style={styles.removeDocumentBtn} onPress={() => setGovDocumentUri(null)}>
                      <Ionicons name="close-circle" size={32} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.uploadActionsRow}>
                    <TouchableOpacity style={[styles.uploadActionBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={takeGovDocumentPhoto}>
                      <View style={[styles.uploadIconCircle, { backgroundColor: colors.primary + '15' }]}>
                        <Ionicons name="camera" size={26} color={colors.primary} />
                      </View>
                      <Text style={[styles.uploadActionText, { color: colors.text.primary }]}>Take Photo</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={[styles.uploadActionBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={pickGovDocument}>
                      <View style={[styles.uploadIconCircle, { backgroundColor: colors.primary + '15' }]}>
                        <Ionicons name="image" size={26} color={colors.primary} />
                      </View>
                      <Text style={[styles.uploadActionText, { color: colors.text.primary }]}>Gallery</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>`;

const newStyles = `uploadActionsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  uploadActionBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, borderWidth: 1, borderRadius: radius.md, borderStyle: 'dashed' },
  uploadIconCircle: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  uploadActionText: { fontSize: 14, fontWeight: '600' },
  documentPreviewContainer: { position: 'relative', height: 180, width: '100%', borderRadius: radius.md, overflow: 'hidden', marginTop: spacing.sm, borderWidth: 1 },
  removeDocumentBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20, padding: 2, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },`;

function updateFile(filePath, isEdit) {
  let code = fs.readFileSync(filePath, 'utf8');
  
  // Replace UI
  const oldUIRegex = /<Text style=\{\[styles\.fieldLabel, \{ color: colors\.text\.secondary, marginTop: spacing\.md \}\]\}>Gov Document Photo \(Optional\)<\/Text>[\s\S]*?<\/View>\s*\}[\s\S]*?<\/View>/;
  if (oldUIRegex.test(code)) {
    code = code.replace(oldUIRegex, isEdit ? newUIEditTenant : newUIAddTenant);
  } else {
    console.log("Could not find old UI in " + filePath);
  }

  // Replace Styles
  const oldStylesRegex = /documentPickerRow: \{ flexDirection: 'row', gap: spacing\.sm \},\s*documentPickerBtn: \{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing\.sm, borderWidth: 1, borderRadius: radius\.sm, gap: spacing\.xs \},\s*documentPickerText: \{ fontSize: 14, fontWeight: '500' \},\s*documentPreviewContainer: \{ position: 'relative', height: 120, width: 120, borderRadius: radius\.sm, overflow: 'hidden', marginTop: spacing\.xs \},\s*documentPreview: \{ width: '100%', height: '100%' \},\s*removeDocumentBtn: \{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba\(255,255,255,0\.8\)', borderRadius: 12, padding: 2 \},/;
  if (oldStylesRegex.test(code)) {
    code = code.replace(oldStylesRegex, newStyles);
  } else {
    console.log("Could not find old styles in " + filePath);
  }

  fs.writeFileSync(filePath, code);
  console.log("Updated " + path.basename(filePath));
}

updateFile(path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'OwnerAddTenantScreen.tsx'), false);
updateFile(path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'OwnerTenantsScreen.tsx'), true);
