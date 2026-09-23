const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
fs.mkdirSync('artifacts', { recursive: true });
const output = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--pack-destination', 'artifacts', '--json'], { encoding: 'utf8' }));
const pack = Array.isArray(output) ? output[0] : Object.values(output)[0];
for (const required of ['build/index.js', 'build/api/generated/routes.js', 'THIRD_PARTY_NOTICES.md', 'specs/LICENSE.apigen', 'specs/LICENSE.paperless-ngx']) {
  assert.ok(pack.files.some(file => file.path === required), `Missing ${required}`);
}
for (const file of pack.files) {
  assert.ok(!/(^|\/)(\.env(?:\..*)?|\.npmrc|node_modules|test|src|artifacts)(\/|$)/.test(file.path), `Unexpected package file: ${file.path}`);
}
fs.writeFileSync(path.join('artifacts', 'release.json'), JSON.stringify({ name: pack.name, version: pack.version, filename: pack.filename, integrity: pack.integrity }, null, 2) + '\n');
console.log(`Release archive: ${pack.filename}, ${pack.files.length} files, ${pack.size} bytes.`);
