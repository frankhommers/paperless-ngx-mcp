# npm releases

Package: `@frankhommers/paperless-ngx-mcp` (public).
Workflow: `.github/workflows/npm-publish.yml`, triggered by a published stable
GitHub release. Draft and prerelease releases do not publish.

## One-time bootstrap

npm requires the package to exist before a trusted publisher can be configured.
The first version is published locally from the same inspected archive:

```sh
npm login
npm ci
npm test
npm run release:pack
npm publish artifacts/frankhommers-paperless-ngx-mcp-1.2.0.tgz --access public
npm trust github @frankhommers/paperless-ngx-mcp \
  --repo frankhommers/paperless-ngx-mcp \
  --file npm-publish.yml --allow-publish --yes
npm trust list @frankhommers/paperless-ngx-mcp
```

These account operations require npm login/2FA. Do not put npm tokens into the
repository or permanent GitHub secrets. Trusted publishing uses short-lived OIDC
credentials for the exact repository and workflow. See the official
[trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/).

Create the first GitHub release after the bootstrap. Its workflow verifies that
the already published archive has the same integrity rather than publishing a
duplicate. That first local publication has no GitHub provenance; subsequent
versions published by the workflow include provenance.

## Subsequent releases

1. Update package/package-lock versions, the server version in `src/index.ts`,
   and version references in the README.
2. Run `npm test` and `npm run release:pack`. Inspect the archive and smoke-test
   the packed executable with production dependencies only.
3. Commit and push; wait for the Test workflow to pass on that commit.
4. Create a tag `v<package version>` at that commit and publish its GitHub release.
5. Wait for `Publish npm`, verify `npm view <package>@<version> dist.integrity`,
   and smoke-test `npx -y <package>@<version>` from a fresh cache.

The workflow checks the release tag against package.json, uses Node 24 and npm
12.1.0 without a release cache, tests the code, inspects the archive, and publishes
with `--access public --provenance`. A matching existing version is idempotent;
a different archive at the same version fails instead of being silently skipped.
The archive and manifest are local build output under ignored `artifacts/`.

The package contains compiled JavaScript and attribution files. TypeScript,
OpenAPI generation, contract validators and test clients are development-only.
Existing GitHub installations remain supported through the prepare build.
