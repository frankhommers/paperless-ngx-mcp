# Upstream PR integration

Reviewed on 2026-09-23 against `nloui/paperless-mcp` main at `4ba74570e6161b955fd1f3071ce9472c5b689295`.

All 25 upstream PRs were inventoried: 10 open, 9 closed without merge, and 6 already merged. Functional changes are combined and adapted; this is not a blind merge of PR branches. The original authors retain credit below. Upstream PRs were not modified or closed.

| PR / author | Decision | Integration notes |
| --- | --- | --- |
| [#1: Add Smithery to README](https://github.com/nloui/paperless-mcp/pull/1) — [@calclavia](https://github.com/calclavia) | Already in upstream main | Inherited unchanged from upstream history. |
| [#2: Deployment: Dockerfile and Smithery config](https://github.com/nloui/paperless-mcp/pull/2) — [@calclavia](https://github.com/calclavia) | Already in upstream main | Inherited unchanged from upstream history. |
| [#3: add MCP server badge](https://github.com/nloui/paperless-mcp/pull/3) — [@punkpeye](https://github.com/punkpeye) | Skipped | Promotional directory badge and unrelated example change; no functional improvement. |
| [#4: Add HTTP Transport Mode, Docker Support, and Migrate to Official MCP SDK](https://github.com/nloui/paperless-mcp/pull/4) — [@baruchiro](https://github.com/baruchiro) | Already in upstream main | Inherited unchanged from upstream history. |
| [#5: Add MseeP.ai badge](https://github.com/nloui/paperless-mcp/pull/5) — [@lwsinclair](https://github.com/lwsinclair) | Skipped: duplicate | Badge already merged through #7; no functional change. |
| [#6: Fix docker latest tag](https://github.com/nloui/paperless-mcp/pull/6) — [@baruchiro](https://github.com/baruchiro) | Integrated selectively | Restore filtered list_documents with compact results, correct build entry points/shebang, package build lifecycle and Docker latest/SHA tags/image path. Keep native fetch, current positional CLI and upstream author. Exclude unrelated release automation, sponsorship/identity changes and name-enrichment requests that change API shapes and only see first metadata pages. |
| [#7: Add MseeP.ai badge](https://github.com/nloui/paperless-mcp/pull/7) — [@lwsinclair](https://github.com/lwsinclair) | Already in upstream main | Inherited unchanged from upstream history. |
| [#8: docs: Auto-translate README and Wiki](https://github.com/nloui/paperless-mcp/pull/8) — [@openaitx-system](https://github.com/openaitx-system) | Skipped | External automatic-translation badges point to upstream, add no runtime capability and include malformed markup. |
| [#9: Add tool descriptions to everything](https://github.com/nloui/paperless-mcp/pull/9) — [@anaisbetts](https://github.com/anaisbetts) | Already in upstream main | Inherited unchanged from upstream history. |
| [#13: Improve search context efficiency to prevent token overflow](https://github.com/nloui/paperless-mcp/pull/13) — [@codegen-sh[bot]](https://github.com/codegen-sh[bot]) | Already in upstream main | Inherited unchanged from upstream history. |
| [#14: Add document title editing functionality](https://github.com/nloui/paperless-mcp/pull/14) — [@KennReloaded](https://github.com/KennReloaded) | Integrated selectively | Include single-document title/content editing. Reject proposed bulk set_title: Paperless does not expose that bulk method. Fix ASN and custom-field types via #16. |
| [#15: feat: Add tool annotations for improved LLM tool understanding](https://github.com/nloui/paperless-mcp/pull/15) — [@bryankthompson](https://github.com/bryankthompson) | Integrated, refined | Human-readable titles and read-only/destructive hints on all tools. Create/upload operations are additive; update/delete/bulk operations remain destructive. |
| [#16: feat: add update_document tool](https://github.com/nloui/paperless-mcp/pull/16) — [@pum-kin-byte](https://github.com/pum-kin-byte) | Integrated, extended | Base for update_document, including nullable relations and custom-field values. Include document-link arrays, empty-update validation and OCR editing from related PRs. |
| [#17: feat: add custom fields support](https://github.com/nloui/paperless-mcp/pull/17) — [@pum-kin-byte](https://github.com/pum-kin-byte) | Integrated, corrected | Custom-field CRUD. Select options use {id?, label} objects; retain existing option IDs on updates. Add MCP envelopes and annotations. |
| [#18: feat: add storage paths support](https://github.com/nloui/paperless-mcp/pull/18) — [@pum-kin-byte](https://github.com/pum-kin-byte) | Integrated, corrected | Storage-path CRUD and bulk operations. Correct matching codes 0–6 and descriptions about path changes potentially moving files. Add MCP envelopes and annotations. |
| [#19: feat: add enhanced search features](https://github.com/nloui/paperless-mcp/pull/19) — [@pum-kin-byte](https://github.com/pum-kin-byte) | Integrated, corrected | Similarity search, autocomplete and task status. Require autocomplete term, validate pagination/task UUIDs, encode query parameters and omit OCR from similarity results. |
| [#20: feat: add update and delete for correspondents and document types](https://github.com/nloui/paperless-mcp/pull/20) — [@pum-kin-byte](https://github.com/pum-kin-byte) | Integrated, corrected | Update/delete correspondents and document types. Convert matching names for both create and update; DELETE handles 204 correctly. |
| [#21: Fix tool handlers to return proper MCP content format](https://github.com/nloui/paperless-mcp/pull/21) — [@moonraker46](https://github.com/moonraker46) | Covered by #25 | Equivalent result-wrapping fix; consolidate to avoid duplicate helpers. |
| [#22: feat: add update_document tool for editing existing document metadata](https://github.com/nloui/paperless-mcp/pull/22) — [@hannahswain](https://github.com/hannahswain) | Combined with #16 and #14 | One update_document tool with PATCH, empty-update rejection, null clearing, numeric archive serial numbers, custom-field values and optional OCR editing. Do not strip OCR from document responses. |
| [#23: fix: return proper MCP ContentBlock format and fix matching_algorithm type](https://github.com/nloui/paperless-mcp/pull/23) — [@hannahswain](https://github.com/hannahswain) | Integrated selectively | Convert string matching algorithms to correct Paperless integers, also for updates. Keep OCR in get_document; dropping OCR is unnecessary after wrapping. Correct tag/storage-path codes too. |
| [#25: fix: wrap all tool responses in MCP content format](https://github.com/nloui/paperless-mcp/pull/25) — [@samperk1](https://github.com/samperk1) | Integrated, extended | Use one shared result helper for every tool, including the new tools. Serialize null for empty responses and preserve document OCR inside JSON text. |
| [#27: fix: return MCP-compliant content[] from tool handlers (clients show "no output")](https://github.com/nloui/paperless-mcp/pull/27) — [@ChrisbyChA](https://github.com/ChrisbyChA) | Covered by #25 | Same response-format fix. Use explicit typed result wrapping rather than monkey-patching server.tool. |
| [#28: Make HTTP transport stateful, update README](https://github.com/nloui/paperless-mcp/pull/28) — [@ataliba](https://github.com/ataliba) | Integrated, adapted | Separate MCP server per HTTP/SSE session; stateful POST/GET/DELETE. Adopt SDK 1.29, TypeScript 5.9 and Zod 4. Return 404 for expired sessions and use prototype-free session maps. Test concurrent clients and termination. |
| [#29: fix: add MIME type detection for document uploads](https://github.com/nloui/paperless-mcp/pull/29) — [@chris576](https://github.com/chris576) | Integrated selectively | MIME inference and optional override. Fix compiled package entry point and source shebang; omit the contributor package identity and nonportable sed build command. |
| [#30: fix: normalize base URL (trailing slash) and fail clearly on non-JSON responses](https://github.com/nloui/paperless-mcp/pull/30) — [@Janez76](https://github.com/Janez76) | Integrated, hardened | Normalize URLs for all requests; report non-JSON/invalid JSON responses and handle empty DELETE bodies. Share handling with uploads; avoid logging complete request bodies. |

## Reviewed revisions

PR head hashes make the reviewed changes reproducible even when contributors update their branches.

| PR | Head commit |
| --- | --- |
| #1 | `f1504fc9bd653423e02c2e4b707e4ce185d98569` |
| #2 | `f75e6797eaf734fc546823ab1beb0497aa401486` |
| #3 | `4bc1483367ca964f0ba5fc3470ec182d0a795169` |
| #4 | `1a322414ed2f3354df46eb47860280ab91882acc` |
| #5 | `9625db64e3cf0807f89a63842b36c34ede501927` |
| #6 | `141423a60e4b6c5a012a3c7dbec1666190170742` |
| #7 | `c534351e18d2f0a75de26d04bb82956ecfe8d2f2` |
| #8 | `7a4b19f524a8ced204e184951e48b0fcc35535ab` |
| #9 | `0dbe4b28d5eb064e8677c9f08cfa2512c7a8e100` |
| #13 | `b0ae5e0fdfb44d7d26438756ee42304af240c8a5` |
| #14 | `fa05a8f97f58be8eeeb761fc4b588bdbdbe5878c` |
| #15 | `73c635c263b6fc5c3a76116af79ddca6387372f7` |
| #16 | `3cbba9cec872f61c0036b2e14e7a812dc1f8190b` |
| #17 | `7dccf8a18f2a9436df747f8ba993351f90041906` |
| #18 | `ea4131e723766c6e9e1938b7d88c837389a9db9c` |
| #19 | `9c8ff650398ca777fe69e723694ff885d98689df` |
| #20 | `1afd00c962643748fb2ab03c2e51ef290e8a7142` |
| #21 | `1cf165ffc722b3a1668ad08d9429839f9c867dc4` |
| #22 | `0fb8aa01d0bd5c8775758ef3db2cb5681257087f` |
| #23 | `d10b56238ccf4e3e9d3d4fde22539292e7dbac67` |
| #25 | `4f6ba80959554816f8ca63a7ec96bc0cbb74e7a0` |
| #27 | `c75b4ae683a8be8560e918305fadea5f34732648` |
| #28 | `6aa8046972255cd61f4805dc2d12bab438fdd976` |
| #29 | `63fd7ff09740ef47ef5d1552a267ad0adbc2b6fe` |
| #30 | `c22ce91394a098e784147b39536aedfd0aa37a26` |

## Additional integration work

- Use typed SDK `registerTool` registrations and a typed result helper; avoid the legacy overloads and duplicate wrappers.
- Share upload response/error handling with the JSON API client, preserve multipart boundaries, encode upload custom-field IDs as JSON, and preserve zero/empty metadata values.
- Reject failed binary downloads instead of returning an error page as a document.
- Add tests for all 34 tools over real MCP transports against a mock Paperless HTTP API. Cover matching, uploads, PATCH/null payloads, compact searches, errors and session isolation.
- Fix source/package/Smithery entry points and make the Docker build run the tests. Correct the GHCR image path and explicit latest/SHA tags.
- Add Node 20/22/24 CI and refresh affected lockfile dependencies. Keep original author metadata; set repository/package identity to this fork.

## API checks used during review

- [Paperless matching codes and numeric archive serial number](https://github.com/paperless-ngx/paperless-ngx/blob/main/src/documents/models.py).
- [Paperless serializers: custom-field options, upload metadata and bulk methods](https://github.com/paperless-ngx/paperless-ngx/blob/main/src/documents/serialisers.py).
- [Paperless search/autocomplete behavior](https://github.com/paperless-ngx/paperless-ngx/blob/main/src/documents/views.py).
- [MCP transport and session behavior](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).

Validation uses a simulated Paperless API, not a live Paperless deployment. Actual OCR processing, storage moves and custom-field persistence still depend on the deployed Paperless version and permissions.
