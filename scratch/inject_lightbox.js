const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'OwnerTenantsScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /<CoOccupantModal[\s\S]*?t=\{t\}\s*\/>/;
const replacement = `<CoOccupantModal
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
      />`;

if (code.includes("<CoOccupantModal")) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(filePath, code);
  console.log("Injected ImageLightbox correctly");
} else {
  console.log("Could not find CoOccupantModal");
}
