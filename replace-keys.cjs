const fs = require('fs');
const path = require('path');

const projectDir = 'c:\\Users\\pv173\\Downloads\\book it web android app';

const replacements = {
  // Old Native App ID -> New Native App ID
  '1f14fad4-0d2f-465a-b3a8-e0e976b8729f': '71048c28-503e-49e5-89b1-0de00ccdca4b',
  
  // Old Native API Key -> New Native API Key
  'os_v2_app_d4kpvvanf5dfvm5i4duxnodst5kkr67zyxkuwj44vlvi2y6pjyotclk455gx4phg4ou4w7pf3qed6af3imveg4gj55nt4ohgc3kyd4a': 'os_v2_app_oeciykcqhze6lcnrbxqaztokjnzez2oi76me4sv3y3p6gy5eu4kvf5qxzpuuraw25tybywnd3vg443ug2ln3os34jkyqd42llsnfjty',
};

// Function to replace in a file
function replaceInFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  for (const [oldKey, newKey] of Object.entries(replacements)) {
    content = content.split(oldKey).join(newKey);
  }
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

// Function to recursively find files
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

console.log('Replacement complete.');
