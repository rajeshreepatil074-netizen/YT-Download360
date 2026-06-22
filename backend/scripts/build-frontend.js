const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const frontendDir = path.join(__dirname, '..', '..', 'frontend');

if (!fs.existsSync(frontendDir)) {
  console.log('No frontend directory found at', frontendDir);
  process.exit(0);
}

const pkgPath = path.join(frontendDir, 'package.json');
if (!fs.existsSync(pkgPath)) {
  console.log('No package.json in frontend, skipping build');
  process.exit(0);
}

let pkg;
try { pkg = require(pkgPath); } catch (e) { console.log('Unable to read frontend package.json, skipping'); process.exit(0); }
if (!pkg.scripts || !pkg.scripts.build) {
  console.log('No build script in frontend/package.json, skipping frontend build');
  process.exit(0);
}

console.log('Building frontend in', frontendDir);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const install = spawnSync(npm, ['install', '--no-audit', '--no-fund'], { cwd: frontendDir, stdio: 'inherit' });
if (install.status !== 0) {
  console.error('Frontend npm install failed with code', install.status);
  process.exit(install.status || 1);
}

const build = spawnSync(npm, ['run', 'build'], { cwd: frontendDir, stdio: 'inherit' });
if (build.status !== 0) {
  console.error('Frontend build failed with code', build.status);
  process.exit(build.status || 1);
}

console.log('Frontend build completed successfully');
