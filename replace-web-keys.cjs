const fs = require('fs');
const path = require('path');

const projectDir = 'c:\\Users\\pv173\\Downloads\\book it web android app';

const newWebAPIKey = 'os_v2_app_rfa3jmdkv5asvel3wfcud2roxoetzkvb57bulxfhsz3762x2hykzimh6vmdtqvvnbybc5xgjdjan5r2wsoe4qxayenvetehsv3byzda';
const newWebAppID = '8941b4b0-6aaf-412a-917b-b14541ea2ebb';

const oldWebAppID = 'f2c5559b-9e99-4aa0-8924-237469824a88';
// We have to use regex to specifically replace ONESIGNAL_WEB_API_KEY since the value is the same as Native API key right now

function replaceInFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  // Replace old Web App ID
  content = content.split(oldWebAppID).join(newWebAppID);
  
  // Specifically replace ONESIGNAL_WEB_API_KEY value
  content = content.replace(
    /const ONESIGNAL_WEB_API_KEY\s*=\s*(?:Deno\.env\.get\("ONESIGNAL_WEB_API_KEY"\)\s*\|\|\s*)?["'][a-zA-Z0-9_]+["'];?/g,
    `const ONESIGNAL_WEB_API_KEY =\n  Deno.env.get("ONESIGNAL_WEB_API_KEY") ||\n  "${newWebAPIKey}";`
  );
  
  // For let apiKey = ONESIGNAL_WEB_API_KEY when assigned inline maybe? Not needed if we replace the constant definition
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated Web Keys in: ${filePath}`);
  }
}

function walkSync(dir, filelist = []) {
  if (!fs.existsSync(dir)) return filelist;
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      if (!dirFile.includes('node_modules') && !dirFile.includes('.git') && !dirFile.includes('dist')) {
        filelist = walkSync(dirFile, filelist);
      }
    } else {
      if (
        dirFile.endsWith('.ts') || 
        dirFile.endsWith('.tsx') || 
        dirFile.endsWith('.env') || 
        dirFile.endsWith('.env.local') || 
        dirFile.endsWith('.js')
      ) {
        filelist.push(dirFile);
      }
    }
  });
  return filelist;
}

const allFiles = walkSync(projectDir);
allFiles.forEach(file => {
  replaceInFile(file);
});

console.log('Web Replacement complete.');
