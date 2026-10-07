const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'components', 'ImageLightbox.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// Imports
if (!code.includes('expo-file-system')) {
  code = code.replace(/import \{ Ionicons \} from '@expo\/vector-icons';/, 
    `import { Ionicons } from '@expo/vector-icons';\nimport * as FileSystem from 'expo-file-system';\nimport * as Sharing from 'expo-sharing';\nimport { ActivityIndicator, Alert } from 'react-native';`);
}

// Add state and download handler
const componentStartRegex = /const \{ colors \} = useTheme\(\);/;
const componentStartReplacement = `const { colors } = useTheme();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!uri) return;
    try {
      setDownloading(true);
      const filename = uri.split('/').pop() || 'document.jpg';
      const fileUri = \`\${FileSystem.cacheDirectory}\${filename}\`;
      const { uri: localUri } = await FileSystem.downloadAsync(uri, fileUri);
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(localUri);
      } else {
        Alert.alert('Sharing not available', 'Unable to share or save the file on this device.');
      }
    } catch (e) {
      console.warn(e);
      Alert.alert('Error', 'Failed to download the document.');
    } finally {
      setDownloading(false);
    }
  };`;
code = code.replace(componentStartRegex, componentStartReplacement);

// Add download button UI
const uiRegex = /<\/Modal>/;
const uiReplacement = `  <TouchableOpacity style={styles.downloadBtn} onPress={handleDownload} activeOpacity={0.8} disabled={downloading}>
        {downloading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="download" size={24} color="#FFFFFF" />}
      </TouchableOpacity>
    </Modal>`;
code = code.replace(uiRegex, uiReplacement);

// Add styles
const styleRegex = /closeBtn: \{/;
const styleReplacement = `downloadBtn: {
    position: 'absolute',
    bottom: 48,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {`;
code = code.replace(styleRegex, styleReplacement);

fs.writeFileSync(filePath, code);
console.log("Updated ImageLightbox.tsx");
