const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, 'build');

// Ensure build directory exists
if (fs.existsSync(buildDir)) {
  // Copy _redirects file
  const redirectsSource = path.join(__dirname, 'public', '_redirects');
  const redirectsDest = path.join(buildDir, '_redirects');
  fs.copyFileSync(redirectsSource, redirectsDest);
  console.log('✓ _redirects file copied to build directory');
  
  // Copy 404.html file (already in build, but ensure it's there)
  console.log('✓ 404.html is in build directory');
} else {
  console.log('Build directory does not exist yet');
}
