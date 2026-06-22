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

// Use `npm ci` in CI to install frontend deps into frontend/node_modules
const install = spawnSync(npm, ['ci', '--no-audit', '--no-fund'], { cwd: frontendDir, stdio: 'inherit', env: { ...process.env, NPM_CONFIG_PRODUCTION: 'false' } });
if (install.status !== 0) {
  console.error('Frontend npm ci failed with code', install.status);
  process.exit(install.status || 1);
}

// Try running vite via node to avoid CI executable permission issues.
// If vite isn't present at the expected path, fall back to npx, then to npm run build.
const viteBin = path.join(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js');
let build;
if (fs.existsSync(viteBin)) {
  console.log('Building frontend using node', viteBin);
  build = spawnSync('node', [viteBin, 'build'], { cwd: frontendDir, stdio: 'inherit', env: { ...process.env, NPM_CONFIG_PRODUCTION: 'false' } });
  if (build.status === 0) return console.log('Frontend build completed successfully');
  console.warn('node <vite> build failed with code', build.status, '- falling back');
}

// Fallback: try using npx to run vite (will use local install if present or fetch temporarily)
console.log('Attempting frontend build via npx vite build');
build = spawnSync('npx', ['--yes', 'vite', 'build'], { cwd: frontendDir, stdio: 'inherit', env: { ...process.env, NPM_CONFIG_PRODUCTION: 'false' } });
if (build.status === 0) return console.log('Frontend build completed successfully via npx');
console.warn('npx vite build failed with code', build.status, '- falling back to npm run build');

// Final fallback: run npm run build (may fail in some CI due to executable permissions)
build = spawnSync(npm, ['run', 'build'], { cwd: frontendDir, stdio: 'inherit', env: { ...process.env, NPM_CONFIG_PRODUCTION: 'false' } });
if (build.status !== 0) {
  console.error('Frontend build failed with code', build.status);
  process.exit(build.status || 1);
}

console.log('Frontend build completed successfully');
