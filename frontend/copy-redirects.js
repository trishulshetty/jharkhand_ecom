const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, 'public', '_redirects');
const destination = path.join(__dirname, 'build', '_redirects');

// Ensure build directory exists
if (fs.existsSync(path.join(__dirname, 'build'))) {
  fs.copyFileSync(source, destination);
  console.log('_redirects file copied to build directory');
} else {
  console.log('Build directory does not exist yet');
}
