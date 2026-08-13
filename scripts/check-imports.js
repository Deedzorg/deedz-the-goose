import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(full); else if (entry.name.endsWith('.js')) files.push(full);
  }
}
await walk(root);
let failures = 0;
for (const file of files) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const resolved = path.resolve(path.dirname(file), match[1]);
    try { await readFile(resolved); } catch { console.error(`Missing import in ${path.relative(root, file)}: ${match[1]}`); failures += 1; }
  }
}
if (failures) process.exit(1);
console.log(`Checked ${files.length} JavaScript files: local imports resolved.`);
