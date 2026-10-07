const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'screens', 'owner', 'OwnerTenantsScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Props type
code = code.replace(/onSave: \(payload: \{\s*advancePaid: number;\s*securityDeposit: number;\s*name: string;\s*email: string;\s*phone: string;\s*idProof: string;\s*\}\) => void;/,
`onSave: (payload: {
      advancePaid: number;
      securityDeposit: number;
      name: string;
      email: string;
      phone: string;
      idProof: string;
      govDocumentUri: string | null;
    }) => void;`);

// 2. State & Handlers
const stateRegex = /const \[idProof, setIdProof\] = useState\(''\);\s*const \[error, setError\] = useState\(''\);/;
const stateReplacement = `const [idProof, setIdProof] = useState('');
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
if (!code.includes("const [govDocumentUri, setGovDocumentUri]")) {
  code = code.replace(stateRegex, stateReplacement);
}

// 3. Init
const initRegex = /setIdProof\(tenant\.idProof \|\| ''\);\s*setError\(''\);\s*\}\s*\}\, \[tenant, visible\]\);/;
const initReplacement = `setIdProof(tenant.idProof || '');
        setGovDocumentUri(tenant.govDocument?.secureUrl || null);
        setError('');
      }
    }, [tenant, visible]);`;
if (!code.includes("setGovDocumentUri(tenant.govDocument?.secureUrl")) {
  code = code.replace(initRegex, initReplacement);
}

// 4. Save Payload
const saveRegex = /onSave\(\{\s*advancePaid: advanceNum,\s*securityDeposit: depositNum,\s*name: name\.trim\(\),\s*email: email\.trim\(\),\s*phone: phone\.trim\(\),\s*idProof: idProof\.trim\(\),\s*\}\);/;
const saveReplacement = `onSave({
        advancePaid: advanceNum,
        securityDeposit: depositNum,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        idProof: idProof.trim(),
        govDocumentUri: govDocumentUri?.startsWith('http') ? null : govDocumentUri,
      });`;
if (!code.includes("govDocumentUri: govDocumentUri")) {
  code = code.replace(saveRegex, saveReplacement);
}

// 5. handleEditSave logic
const handleSaveRegex = /const handleEditSave = \(payload: Parameters<typeof updateTenant>\[1\]\) => \{\s*if \(!editTarget\) return;\s*editMutation\.mutate\(\{ id: editTarget\._id, payload \}\);\s*\};/;
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
    
    editMutation.mutate({ id: editTarget._id, payload });
  };`;
if (code.includes("editMutation.mutate({ id: editTarget._id, payload });")) {
  code = code.replace(handleSaveRegex, handleSaveReplacement);
}

fs.writeFileSync(filePath, code);
console.log("Restored EditTenantModal logic");
