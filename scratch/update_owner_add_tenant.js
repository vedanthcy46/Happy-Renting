const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'OwnerAddTenantScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Import * as ImagePicker from 'expo-image-picker';
if (!code.includes("expo-image-picker")) {
  code = code.replace(/import \{ useRouter, useLocalSearchParams \} from 'expo-router';/, 
    "import { useRouter, useLocalSearchParams } from 'expo-router';\nimport * as ImagePicker from 'expo-image-picker';\nimport { Image } from 'expo-image';");
}

// 2. Add govDocument state
const stateRegex = /const \[idProof, setIdProof\] = useState\(''\);/;
const stateReplacement = `const [idProof, setIdProof] = useState('');
  const [govDocumentUri, setGovDocumentUri] = useState<string | null>(null);

  const pickGovDocument = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to make this work!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        setGovDocumentUri(result.assets[0].uri);
      }
    } catch (e) {
      console.warn(e);
    }
  };
  
  const takeGovDocumentPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Sorry, we need camera permissions to make this work!');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        setGovDocumentUri(result.assets[0].uri);
      }
    } catch (e) {
      console.warn(e);
    }
  };`;
code = code.replace(stateRegex, stateReplacement);

// 3. Update payload
const payloadRegex = /const payload = \{[\s\S]*?tempPassword: newTenantPassword,\s*\};/;
const payloadReplacement = `const payload = new FormData();
    payload.append('userId', (selectedUser as any)?._id);
    payload.append('roomId', (selectedRoom as any)?._id);
    payload.append('propertyId', propertyId);
    payload.append('joinDate', \`\${joinDate}T12:00:00.000Z\`);
    
    if (advancePaid) payload.append('advancePaid', parseFloat(advancePaid).toString());
    if (securityDeposit) payload.append('securityDeposit', parseFloat(securityDeposit).toString());
    if (notes.trim()) payload.append('notes', notes.trim());
    payload.append('phone', phone.trim());
    if (idProof.trim()) payload.append('idProof', idProof.trim());
    if (selectedBedId) payload.append('bedId', selectedBedId);
    if (isMigrated) payload.append('isMigratedTenant', 'true');
    payload.append('tempPassword', newTenantPassword);

    if (govDocumentUri) {
      const filename = govDocumentUri.split('/').pop() || 'document.jpg';
      const match = /\\.([a-zA-Z]+)$/.exec(filename);
      const type = match ? \`image/\${match[1]}\` : \`image/jpeg\`;
      payload.append('govDocument', {
        uri: govDocumentUri,
        name: filename,
        type,
      } as any);
    }`;
code = code.replace(payloadRegex, payloadReplacement);

// 4. Update UI
const uiRegex = /<TextInput style=\{\[styles\.input, \{ backgroundColor: colors\.background, borderColor: colors\.border, color: colors\.text\.primary \}\]\} value=\{idProof\} onChangeText=\{setIdProof\}\s*placeholder=\{t\('owner\.addTenant\.placeholderIdNumber'\)\} placeholderTextColor=\{colors\.text\.tertiary\} \/>/;
const uiReplacement = `<TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text.primary }]} value={idProof} onChangeText={setIdProof}                  placeholder={t('owner.addTenant.placeholderIdNumber')} placeholderTextColor={colors.text.tertiary} />
                  
                  <Text style={[styles.fieldLabel, { color: colors.text.secondary, marginTop: spacing.md }]}>Gov Document Photo (Optional)</Text>
                  {govDocumentUri ? (
                    <View style={styles.documentPreviewContainer}>
                      <Image source={{ uri: govDocumentUri }} style={styles.documentPreview} contentFit="cover" />
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
                  )}`;
code = code.replace(uiRegex, uiReplacement);

// 5. Add styles
const styleRegex = /newTenantCard: \{ padding: spacing\.md, borderRadius: radius\.md \},/;
const styleReplacement = `newTenantCard: { padding: spacing.md, borderRadius: radius.md },
  documentPickerRow: { flexDirection: 'row', gap: spacing.sm },
  documentPickerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.sm, borderWidth: 1, borderRadius: radius.sm, gap: spacing.xs },
  documentPickerText: { fontSize: 14, fontWeight: '500' },
  documentPreviewContainer: { position: 'relative', height: 120, width: 120, borderRadius: radius.sm, overflow: 'hidden' },
  documentPreview: { width: '100%', height: '100%' },
  removeDocumentBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 12, padding: 2 },`;
code = code.replace(styleRegex, styleReplacement);

fs.writeFileSync(filePath, code);
console.log("Updated OwnerAddTenantScreen.tsx");
