const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'OwnerTenantsScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /<ImageLightbox visible=\{!!lightboxUrl\} imageUrl=\{lightboxUrl \|\| ''\} onClose=\{\(\) => setLightboxUrl\(null\)\} \/>/;
const replacement = `<ImageLightbox visible={!!lightboxUrl} uri={lightboxUrl || ''} onClose={() => setLightboxUrl(null)} />`;

if (code.includes("imageUrl={lightboxUrl")) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(filePath, code);
  console.log("Fixed ImageLightbox prop in OwnerTenantsScreen");
} else {
  console.log("Could not find ImageLightbox instantiation");
}
