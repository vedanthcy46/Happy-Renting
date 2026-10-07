const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'src', 'components', 'ImageLightbox.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const regex = /import \* as FileSystem from 'expo-file-system';/;
const replacement = `import * as FileSystem from 'expo-file-system/legacy';`;

if (code.match(regex)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(filePath, code);
  console.log("Updated expo-file-system import to legacy in ImageLightbox.tsx");
} else {
  console.log("Could not find expo-file-system import");
}
