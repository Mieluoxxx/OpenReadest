import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const foliatePackage = resolve(rootDir, 'packages/foliate-js/package.json');

if (existsSync(foliatePackage)) {
  console.log('Git submodules already initialized.');
  process.exit(0);
}

if (!existsSync(resolve(rootDir, '.git'))) {
  console.error('Unable to initialize Git submodules: this checkout has no .git metadata.');
  process.exit(1);
}

console.log('Initializing Git submodules...');
const result = spawnSync('git', ['-C', rootDir, 'submodule', 'update', '--init', '--recursive'], {
  stdio: 'inherit',
});

if (result.status !== 0) {
  console.error(
    'Failed to initialize Git submodules. Check your Git access and network connection.',
  );
  process.exit(result.status ?? 1);
}

if (!existsSync(foliatePackage)) {
  console.error(
    'Git submodules were initialized, but packages/foliate-js/package.json is still missing.',
  );
  process.exit(1);
}
