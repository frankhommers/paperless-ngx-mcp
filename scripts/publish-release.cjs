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
  execFileSync('npm', ['publish', `./artifacts/${release.filename}`, '--access', 'public', '--provenance'], { stdio: 'inherit' });
  // npm may acknowledge a publish before the version is visible on registry edges.
  for (let attempt = 0; attempt < 30; attempt++) {
    const verified = await fetch(url, {
      signal: AbortSignal.timeout(30000),
      headers: { 'cache-control': 'no-cache' },
    });
    if (verified.ok) {
      if ((await verified.json()).dist?.integrity !== release.integrity) {
        throw new Error('Published archive integrity does not match the release.');
      }
      console.log(`Verified published archive: ${release.name}@${release.version}`);
      return;
    }
    if (![404, 502, 503, 504].includes(verified.status)) {
      throw new Error(`Registry verification failed: HTTP ${verified.status}`);
    }
    if (attempt < 29) {
      console.log('Waiting for the published version to become available in npm...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  throw new Error('Published archive did not become available within the verification window.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
