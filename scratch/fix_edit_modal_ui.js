const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'OwnerTenantsScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /<View style=\{styles\.formField\}>\s*<Text style=\{\[styles\.fieldLabel, \{ color: colors\.text\.secondary \}\]\}>\{t\('owner\.tenants\.editFieldIdNumber'\)\}<\/Text>\s*<TextInput\s*style=\{\[styles\.input, \{ color: colors\.text\.primary, borderColor: colors\.border, backgroundColor: colors\.background \}\]\}\s*value=\{idProof\}\s*onChangeText=\{setIdProof\}\s*placeholder=\{t\('owner\.tenants\.editPlaceholderId'\)\}\s*placeholderTextColor=\{colors\.text\.tertiary\}\s*\/>\s*<\/View>/;

const replacement = `<View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('owner.tenants.editFieldIdNumber')}</Text>
                <TextInput
                  style={[styles.input, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={idProof}
                  onChangeText={setIdProof}
                  placeholder={t('owner.tenants.editPlaceholderId')}
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Gov Document Photo (Optional)</Text>
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

if (code.includes("owner.tenants.editPlaceholderId")) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(filePath, code);
  console.log("Injected gov document UI into EditTenantModal");
} else {
  console.log("Could not find editPlaceholderId target");
}
