// Render / Node.js production entrypoint
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const target = path.join(__dirname, 'dist', 'server.js');

if (!fs.existsSync(target)) {
  console.log('⚠️ dist/server.js not found. Compiling TypeScript via tsc...');
  try {
    execSync('npx tsc', { cwd: __dirname, stdio: 'inherit' });
  } catch (err) {
    console.error('Failed to run tsc at startup:', err);
  }
}

require('./dist/server.js');

