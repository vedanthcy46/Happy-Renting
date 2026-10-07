const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'OwnerTenantsScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// Fix 1: TenantDetailSheet props
code = code.replace(/onDeleteCoOccupant: \(tenant: OwnerTenant, co: CoOccupant\) => void;\s*t: \(key: string\) => string;\s*\}/, 
  "onDeleteCoOccupant: (tenant: OwnerTenant, co: CoOccupant) => void;\n  onViewDocument: (url: string) => void;\n  t: (key: string) => string;\n}");

// Fix 2: TenantDetailSheet destructuring
code = code.replace(/onDeleteCoOccupant, t\s*\}\) => \{/, 
  "onDeleteCoOccupant, onViewDocument, t\n}) => {");

// Fix 3: The document row
code = code.replace(/<TouchableOpacity onPress=\{.*?setLightboxUrl\?\.\(tenant\.govDocument\.secureUrl\)\}>/, 
  "<TouchableOpacity onPress={() => onViewDocument(tenant.govDocument!.secureUrl)}>");

// Fix 4: The global trick removal
code = code.replace(/\(global as any\)\.setLightboxUrl = setLightboxUrl;/, "");

// Fix 5: Pass the callback down to TenantDetailSheet
code = code.replace(/onDeleteCoOccupant=\{handleDeleteCoOccupant\}/, 
  "onDeleteCoOccupant={handleDeleteCoOccupant}\n        onViewDocument={setLightboxUrl}");

// Fix 6: Remove Expo Image if it collides, use standard Image or verify Expo Image is imported correctly.
// Oh wait, standard Image from react-native is already there. Let's use it instead of Expo Image.
code = code.replace(/<Image source=\{\{ uri: tenant\.govDocument\.secureUrl \}\} style=\{\{ width: 80, height: 60, borderRadius: 4, backgroundColor: colors\.surface \}\} contentFit="cover" \/>/, 
  "<Image source={{ uri: tenant.govDocument.secureUrl }} style={{ width: 80, height: 60, borderRadius: 4, backgroundColor: colors.surface }} resizeMode=\"cover\" />");
code = code.replace(/import \{ Image \} from 'expo-image';\n?/, "");

// Just to make sure react-native Image is imported:
if (!code.includes("Image,")) {
  code = code.replace(/import \{\s*View,/, "import {\n  View,\n  Image,");
}

fs.writeFileSync(filePath, code);
console.log("Fixed OwnerTenantsScreen");
