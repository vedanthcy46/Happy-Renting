const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'OwnerTenantsScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Inject UI in edit profile tab
const regexUI = /<View style=\{styles\.formField\}>\s*<Text style=\{\[styles\.fieldLabel, \{ color: colors\.text\.secondary \}\]\}>\{t\('owner\.tenants\.editFieldIdNumber'\)\}<\/Text>\s*<TextInput\s*style=\{\[styles\.input, \{ color: colors\.text\.primary, borderColor: colors\.border, backgroundColor: colors\.background \}\]\}\s*value=\{idProof\}\s*onChangeText=\{setIdProof\}\s*placeholder=\{t\('owner\.tenants\.editPlaceholderId'\)\}\s*placeholderTextColor=\{colors\.text\.tertiary\}\s*\/>\s*<\/View>/;

const replacementUI = `<View style={styles.formField}>
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

code = code.replace(regexUI, replacementUI);

// 2. Inject Lightbox at the exact end of the main component (before styles)
const regexEnd = /<CoOccupantModal[\s\S]*?t=\{t\}\s*\/>\s*<\/View>\s*\);\s*\};/;
const replacementEnd = `<CoOccupantModal
        tenant={coTarget}
        coOccupant={coOccupant}
        visible={coVisible}
        onClose={() => { setCoVisible(false); setCoTarget(null); setCoOccupant(null); }}
        onSave={handleSaveCoOccupant}
        saving={addCoMutation.isPending || updateCoMutation.isPending}
        t={t}
      />

      <ImageLightbox
        visible={!!lightboxUrl}
        uri={lightboxUrl || ''}
        onClose={() => setLightboxUrl(null)}
      />
    </View>
  );
};`;

// WAIT, to be perfectly safe, I will split by `</View>\n  );\n};`
const parts = code.split(/<\/View>\s*\);\s*\};\s*const styles = StyleSheet\.create\(\{/);
if (parts.length === 2) {
  code = parts[0] + `\n      <ImageLightbox\n        visible={!!lightboxUrl}\n        uri={lightboxUrl || ''}\n        onClose={() => setLightboxUrl(null)}\n      />\n    </View>\n  );\n};\n\nconst styles = StyleSheet.create({` + parts[1];
  console.log("Injected ImageLightbox safely");
} else {
  console.log("Could not find the end of the component");
}

fs.writeFileSync(filePath, code);
