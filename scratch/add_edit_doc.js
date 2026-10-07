const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'OwnerTenantsScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add ImagePicker import if missing
if (!code.includes("expo-image-picker")) {
  code = code.replace(/import \{ useRouter \} from 'expo-router';/, 
    "import { useRouter } from 'expo-router';\nimport * as ImagePicker from 'expo-image-picker';");
}

// 2. Update EditTenantModalProps onSave type
const editPropsRegex = /onSave: \(payload: \{\s*advancePaid: number;\s*securityDeposit: number;\s*name: string;\s*email: string;\s*phone: string;\s*idProof: string;\s*\}\) => void;/;
const editPropsReplacement = `onSave: (payload: {
    advancePaid: number;
    securityDeposit: number;
    name: string;
    email: string;
    phone: string;
    idProof: string;
    govDocumentUri: string | null;
  }) => void;`;
code = code.replace(editPropsRegex, editPropsReplacement);

// 3. Add govDocumentUri state to EditTenantModal
const editStateRegex = /const \[idProof, setIdProof\] = useState\(''\);\s*const \[error, setError\] = useState\(''\);/;
const editStateReplacement = `const [idProof, setIdProof] = useState('');
  const [govDocumentUri, setGovDocumentUri] = useState<string | null>(null);
  const [error, setError] = useState('');

  const pickGovDocument = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permission needed', 'Sorry, we need camera roll permissions!');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
      if (!result.canceled) setGovDocumentUri(result.assets[0].uri);
    } catch (e) { console.warn(e); }
  };
  
  const takeGovDocumentPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permission needed', 'Sorry, we need camera permissions!');
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
      if (!result.canceled) setGovDocumentUri(result.assets[0].uri);
    } catch (e) { console.warn(e); }
  };`;
code = code.replace(editStateRegex, editStateReplacement);

// 4. Initialize govDocumentUri
const initRegex = /setIdProof\(tenant\.idProof \|\| ''\);\s*setError\(''\);\s*\}\s*\}\, \[tenant, visible\]\);/;
const initReplacement = `setIdProof(tenant.idProof || '');
      setGovDocumentUri(tenant.govDocument?.secureUrl || null);
      setError('');
    }
  }, [tenant, visible]);`;
code = code.replace(initRegex, initReplacement);

// 5. Update onSave payload
const saveRegex = /onSave\(\{\s*advancePaid: advanceNum,\s*securityDeposit: depositNum,\s*name: name\.trim\(\),\s*email: email\.trim\(\),\s*phone: phone\.trim\(\),\s*idProof: idProof\.trim\(\),\s*\}\);/;
const saveReplacement = `onSave({
      advancePaid: advanceNum,
      securityDeposit: depositNum,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      idProof: idProof.trim(),
      govDocumentUri: govDocumentUri?.startsWith('http') ? null : govDocumentUri, // Only pass if it's a new local file
    });`;
code = code.replace(saveRegex, saveReplacement);

// 6. Update UI in EditTenantModal profile tab
const profileUiRegex = /<TextInput style=\{\[styles\.input, \{ backgroundColor: colors\.background, borderColor: colors\.border, color: colors\.text\.primary \}\]\} value=\{idProof\} onChangeText=\{setIdProof\}\s*placeholder=\{t\('owner\.tenants\.placeholderIdNumber'\)\} placeholderTextColor=\{colors\.text\.tertiary\} \/>\s*<\/View>/;
const profileUiReplacement = `<TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text.primary }]} value={idProof} onChangeText={setIdProof} placeholder={t('owner.tenants.placeholderIdNumber')} placeholderTextColor={colors.text.tertiary} />
              
              <Text style={[styles.fieldLabel, { color: colors.text.secondary, marginTop: spacing.md }]}>Gov Document Photo (Optional)</Text>
              {govDocumentUri ? (
                <View style={styles.documentPreviewContainer}>
                  <Image source={{ uri: govDocumentUri }} style={styles.documentPreview as any} resizeMode="cover" />
                  <TouchableOpacity style={styles.removeDocumentBtn} onPress={() => setGovDocumentUri(null)}>
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.documentPickerRow}>
                  <TouchableOpacity style={[styles.documentPickerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={takeGovDocumentPhoto}>
                    <Ionicons name="camera-outline" size={20} color={colors.primary} />
                    <Text style={[styles.documentPickerText, { color: colors.text.primary }]}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.documentPickerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={pickGovDocument}>
                    <Ionicons name="image-outline" size={20} color={colors.primary} />
                    <Text style={[styles.documentPickerText, { color: colors.text.primary }]}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>`;
code = code.replace(profileUiRegex, profileUiReplacement);

// 7. Add styles to OwnerTenantsScreen
const styleRegex = /sheetDivider: \{ height: 1, marginVertical: spacing\.sm \},/;
const styleReplacement = `sheetDivider: { height: 1, marginVertical: spacing.sm },
  documentPickerRow: { flexDirection: 'row', gap: spacing.sm },
  documentPickerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.sm, borderWidth: 1, borderRadius: radius.sm, gap: spacing.xs },
  documentPickerText: { fontSize: 14, fontWeight: '500' },
  documentPreviewContainer: { position: 'relative', height: 120, width: 120, borderRadius: radius.sm, overflow: 'hidden', marginTop: spacing.xs },
  documentPreview: { width: '100%', height: '100%' },
  removeDocumentBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 12, padding: 2 },`;
code = code.replace(styleRegex, styleReplacement);

// 8. Update handleEditSave
const handleSaveRegex = /const handleEditSave = \(payload: Parameters<typeof updateTenant>\[1\]\) => \{/;
const handleSaveReplacement = `const handleEditSave = (rawPayload: any) => {
    if (!editTarget) return;
    
    let payload = rawPayload;
    if (rawPayload.govDocumentUri) {
      payload = new FormData();
      Object.entries(rawPayload).forEach(([key, value]) => {
        if (key !== 'govDocumentUri' && value !== undefined && value !== null) {
          payload.append(key, String(value));
        }
      });
      const uri = rawPayload.govDocumentUri;
      const filename = uri.split('/').pop() || 'document.jpg';
      const match = /\\.([a-zA-Z]+)$/.exec(filename);
      const type = match ? \`image/\${match[1]}\` : 'image/jpeg';
      payload.append('govDocument', { uri, name: filename, type } as any);
    }
    
    editMutation.mutate({ id: editTarget._id, payload });`;
code = code.replace(handleSaveRegex, handleSaveReplacement);
code = code.replace(/editMutation\.mutate\(\{ id: editTarget\._id, payload \}\);/, ""); // Clean up original mutate line because we moved it inside replacement

fs.writeFileSync(filePath, code);
console.log("Updated OwnerTenantsScreen with edit document upload");
