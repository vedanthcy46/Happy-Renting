const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'OwnerTenantsScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// Import ImageLightbox
if (!code.includes("ImageLightbox")) {
  code = code.replace(/import \{ EmptyState \} from '\.\.\/\.\.\/components';/, 
    "import { EmptyState } from '../../components';\nimport { ImageLightbox } from '../../components';\nimport { Image } from 'expo-image';");
}

// Render govDocument
const govDocRegex = /\{tenant\.idProof && row\(t\('owner\.tenants\.detailIdNumber'\), tenant\.idProof\)\}/;
const govDocReplacement = `{tenant.idProof && row(t('owner.tenants.detailIdNumber'), tenant.idProof)}
            {tenant.govDocument?.secureUrl && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>Gov Document</Text>
                <TouchableOpacity onPress={() => (global as any).setLightboxUrl?.(tenant.govDocument.secureUrl)}>
                  <Image source={{ uri: tenant.govDocument.secureUrl }} style={{ width: 80, height: 60, borderRadius: 4, backgroundColor: colors.surface }} contentFit="cover" />
                </TouchableOpacity>
              </View>
            )}`;
code = code.replace(govDocRegex, govDocReplacement);

// Add global state for lightbox
const rootRegex = /export const OwnerTenantsScreen: React\.FC = \(\) => \{/;
const rootReplacement = `export const OwnerTenantsScreen: React.FC = () => {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  (global as any).setLightboxUrl = setLightboxUrl;`;
code = code.replace(rootRegex, rootReplacement);

// Render ImageLightbox at bottom
const endRegex = /<\/KeyboardAvoidingView>\s*<\/View>\s*\);\s*\};/;
const endReplacement = `  <ImageLightbox visible={!!lightboxUrl} imageUrl={lightboxUrl || ''} onClose={() => setLightboxUrl(null)} />
    </KeyboardAvoidingView>
  </View>
  );
};`;
code = code.replace(endRegex, endReplacement);

fs.writeFileSync(filePath, code);
console.log("Updated OwnerTenantsScreen.tsx");
