const fs = require('fs');

const appJsonPath = 'mobile/app.json';
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
appJson.expo.version = "2.8.3";
appJson.expo.android.versionCode = 29;
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));

const mobilePkgPath = 'mobile/package.json';
const mobilePkg = JSON.parse(fs.readFileSync(mobilePkgPath, 'utf8'));
mobilePkg.version = "2.8.3";
fs.writeFileSync(mobilePkgPath, JSON.stringify(mobilePkg, null, 2));

const backendPkgPath = 'backend/package.json';
const backendPkg = JSON.parse(fs.readFileSync(backendPkgPath, 'utf8'));
backendPkg.version = "1.0.2";
fs.writeFileSync(backendPkgPath, JSON.stringify(backendPkg, null, 2));

console.log("Bumped versions successfully.");
