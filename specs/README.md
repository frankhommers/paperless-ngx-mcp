# Paperless API contract

The untouched `paperless-ngx.yaml` snapshot is copied from
[apigen-dotnet/paperless-ngx commit 5438705](https://github.com/apigen-dotnet/paperless-ngx/tree/54387050f29eaa48bf75792624356db4e5bc4cfa/specs).
It was exported on 2026-09-09 from the official Paperless **3.1.3** container,
image digest `sha256:aa810a36942c63d4ee70d00eda7236cd3d6acfb7eb3f7987fb568ed14df8817a`,
using `spectacular --api-version 10 --fail-on-warn` against an empty migrated
database. See the source repository's `specs/README.md` for the export command.
Application version 3.1.3, schema info version `6.0.0 (10)` and MCP protocol
2026-07-28 describe different things. The client still sends unversioned
`Accept: application/json`; this snapshot does not force API version 10.

## Corrections

`patches.cjs` applies idempotent corrections in memory. Never hand-edit the YAML
or generated TypeScript. The first three corrections adapt Apigen's MIT patches:

- `PostDocumentRequest.custom_fields`: the untyped field accepts an array of IDs.
  This is the subset currently exposed by our upload tool; Paperless also accepts
  ID-to-value dictionaries, which the tool does not yet expose.
- `Document.root_document`: allow null for documents without a parent version.
- Download, preview and thumbnail responses contain binary data, not JSON.

Additional corrections verified against official Paperless v3.1.3 source:

- Custom-field values accept boolean and document-ID arrays. Replace overlapping
  integer/number `oneOf` alternatives with `anyOf`, retaining null and object
  support. See [CustomFieldInstanceSerializer](https://github.com/paperless-ngx/paperless-ngx/blob/v3.1.3/src/documents/serialisers.py#L882).
- `GET /api/documents/` accepts `more_like_id`, omitted from the generated schema.
  See [document search](https://github.com/paperless-ngx/paperless-ngx/blob/v3.1.3/src/documents/views.py#L285).

C# naming, enum naming and duplicate-model patches are not needed by this
TypeScript client. Nullable/blank enum choices remain intact.

## Generation and checks

`tools.json` maps every public MCP tool to its OpenAPI operation. The 34 tools
use 29 distinct operations. Generation selects those operations and their 44
reachable models from the complete 163-operation snapshot.

```sh
npm run contract:generate
npm run contract:check
npm test
# Optional: with PAPERLESS_URL, API_KEY and PAPERLESS_TEST_DOCUMENT_ID set:
npm run test:live
```

Generation uses pinned development tools and only local files. Generated routes
and types are committed, so GitHub installs and production builds need no schema
fetch or runtime validator. The API methods use these generated request models,
query parameters and operation routes. Handwritten MCP descriptions, permissions,
input convenience conversions and compact result presentation remain separate.

All 34 tools make actual HTTP requests against the test server under both MCP
protocol generations and both transports. The contract validator independently
checks each tool's operation, method, path parameters, query, JSON and multipart
body. It rejects unknown object fields where the schema declares properties,
without closing explicitly free-form dictionaries. Negative tests prove it
rejects misspelled fields, invalid enums/IDs, invalid uploads and missing bodies.
Regeneration drift fails `npm test` and therefore CI and Docker builds.

The schema leaves bulk-edit `parameters` free-form. A separate regression checks
that document `set_permissions`, `owner` and `merge` are placed directly inside
`parameters`, following `BulkEditSerializer._validate_parameters_set_permissions`
in the same upstream `serialisers.py`.

These are request contract tests, not a claim that every real server response
matches this snapshot. Existing mock responses are intentionally small fixtures.
Runtime responses remain permissive for older Paperless versions; no response
validator rejects extra fields or older task response shapes. The default API
version may return a different shape from the v10 TypeScript reference models.
Live smoke tests should cover read-only operations; mutation tests use fixtures,
never personal production documents.

To update: export a fresh upstream snapshot, record its release/digest/source,
review whether each patch is still needed, regenerate, inspect the diff and run
the suite plus read-only live checks. New administrative endpoints do not become
MCP tools automatically.
