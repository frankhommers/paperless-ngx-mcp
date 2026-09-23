const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const release = JSON.parse(fs.readFileSync('artifacts/release.json', 'utf8'));
(async () => {
  const url = `https://registry.npmjs.org/${encodeURIComponent(release.name)}/${release.version}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (response.ok) {
    const published = await response.json();
    if (published.dist?.integrity !== release.integrity) {
      throw new Error('This version already exists with a different archive. Bump the version before releasing.');
    }
    console.log(`${release.name}@${release.version} is already published with the same integrity; no duplicate publish.`);
    return;
  }
  if (response.status !== 404) throw new Error(`Registry lookup failed: HTTP ${response.status}`);
  execFileSync('npm', ['publish', `artifacts/${release.filename}`, '--access', 'public', '--provenance'], { stdio: 'inherit' });
  const verified = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!verified.ok || (await verified.json()).dist?.integrity !== release.integrity) {
    throw new Error('Published archive could not be verified in the registry.');
  }
  console.log(`Verified published archive: ${release.name}@${release.version}`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
