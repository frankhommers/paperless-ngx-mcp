# Paperless-NGX MCP Server

A community integration fork of [nloui/paperless-mcp](https://github.com/nloui/paperless-mcp). Connect MCP clients to Paperless-NGX to search, upload, download and edit documents, and manage tags, correspondents, document types, custom fields and storage paths.

This fork includes reviewed community fixes and features. See [the PR integration record](docs/pr-integration.md) for every upstream PR, attribution, decisions and adaptations.

## Protocol support

Version 1.1.2 uses MCP SDK 2.1.0 and supports **MCP 2026-07-28** over stdio and Streamable HTTP. Older clients can still use the 2025-era initialization handshake and existing HTTP sessions. Legacy SSE endpoints are retained for compatibility. Protocol selection is automatic; clients using the new SDK must opt into modern negotiation.

See [the protocol migration notes](docs/protocol-migration.md) for compatibility details and validation.

## Run directly from GitHub

With npm 12, explicitly permit this GitHub package and its build script. Pass the token through `API_KEY` because npm can log command-line arguments:

```bash
API_KEY=your-api-token npx -y --allow-git=all \
  --allow-scripts=github:frankhommers/paperless-ngx-mcp \
  github:frankhommers/paperless-ngx-mcp \
  http://your-paperless-instance:8000
```

Older npm versions that allow GitHub packages and their prepare scripts can use `API_KEY=your-api-token npx -y github:frankhommers/paperless-ngx-mcp <baseUrl>`. Add `#<commit>` to the GitHub package reference to pin a revision.

## Install from source

Requires Node.js 20 or later and a Paperless-NGX instance with an API token.

```bash
git clone https://github.com/frankhommers/paperless-ngx-mcp.git
cd paperless-ngx-mcp
npm ci
```

`npm ci` builds `build/index.js`. This fork has not been published to npm; upstream npm packages do not contain these changes.

Configure your MCP client using the absolute path to the compiled entry point:

```json
{
  "mcpServers": {
    "paperless": {
      "command": "node",
      "args": [
        "/absolute/path/paperless-ngx-mcp/build/index.js",
        "http://your-paperless-instance:8000"
      ],
      "env": {
        "API_KEY": "your-api-token"
      }
    }
  }
}
```

Generate an API token in your Paperless user profile. The base URL is the instance root, optionally including its deployment subpath, without `/api`. Trailing slashes are supported.

Paperless API requests use `Accept: application/json`, allowing the instance to select its supported default API version. No Paperless API version is forced; this is independent of the MCP protocol version. API errors redact the configured token before being returned to clients.

## Transports

### stdio

```bash
API_KEY=your-api-token node build/index.js http://localhost:8000
```

Stdio also accepts `PAPERLESS_URL`, so both connection settings can come from environment variables. Positional URL and token arguments remain supported and take precedence, but the environment is recommended to avoid exposing tokens in launcher logs.

### Streamable HTTP and legacy SSE

```bash
PAPERLESS_URL=http://localhost:8000 API_KEY=your-api-token \
  node build/index.js --http --port 3000
```

HTTP mode reads Paperless credentials from `PAPERLESS_URL` and `API_KEY`.

The same `/mcp` endpoint serves both protocol generations:

- **2026-07-28:** stateless requests with protocol metadata, starting with `server/discover`. No initialization handshake or `Mcp-Session-Id` is required.
- **Older clients:** `POST /mcp` initializes a session, then subsequent requests carry the returned `Mcp-Session-Id`. `GET /mcp` opens its notification stream; `DELETE /mcp` terminates it.
- **Legacy SSE:** `GET /sse` and `POST /messages?sessionId=...` remain available.

Modern HTTP requests get a fresh MCP server instance. Older clients retain separate in-memory sessions; deployments serving these clients need one process or sticky routing, and clients must reconnect after a restart. Clients should terminate sessions when finished. The HTTP listener uses the configured Paperless token for all clients and has no client authentication of its own; keep it on a trusted network or behind an authenticated proxy.

### Docker

```bash
docker build -t paperless-ngx-mcp .
docker run --rm -p 127.0.0.1:3000:3000 \
  -e PAPERLESS_URL=http://host.docker.internal:8000 \
  -e API_KEY=your-api-token \
  paperless-ngx-mcp
```

The container starts in HTTP mode on port 3000. Use a Paperless URL reachable from inside the container. The Docker build runs the regression suite.

## Tools

All 34 tools return MCP text content blocks containing JSON. Errors are returned as MCP tool errors. `get_document` preserves full OCR text; document lists, search and similarity results omit OCR and long download/thumbnail URLs to reduce response size. List endpoints return Paperless's paginated response.

### Documents and search

| Tool | Parameters and behavior |
| --- | --- |
| `list_documents` | Optional `page`, `page_size`, `search` (title), `correspondent`, `document_type`, `tag`, `storage_path`, `created__gte`, `created__lte`, `ordering`. |
| `get_document` | `id`; returns the complete document, including OCR text. |
| `search_documents` | `query`; optional `page`, `page_size`. Paperless full-text search syntax. |
| `find_similar_documents` | `document_id`; optional `page`, `page_size`. |
| `search_autocomplete` | Required nonempty `term`; optional positive `limit`. |
| `get_task_status` | `task_id` UUID returned by an upload. |
| `post_document` | Base64 `file`, `filename`; optional `mime_type`, title, date, correspondent/type/path IDs, tags, archive serial number and custom field IDs. Returns an asynchronous task ID. |
| `update_document` | `id` and at least one field: `title`, `content`, `created`, `correspondent`, `document_type`, `storage_path`, `tags`, `archive_serial_number`, `custom_fields`. |
| `download_document` | `id`; optional `original`. Returns `{ blob, filename }`, with base64 file bytes. |
| `bulk_edit_documents` | `documents` (IDs), `method`, and method-specific parameters described below. |

Pagination starts at 1; document `page_size` is limited to 100. Upload MIME types are inferred from the filename, with an optional explicit override and an octet-stream fallback.

Document updates use PATCH. Omitted fields stay unchanged. Use `null` to clear correspondent, document type, storage path or archive serial number. `tags` replaces the full tag list. Custom fields use `{ field: ID, value: ... }` entries; document-link values can be arrays of IDs. The archive serial number is an integer from 0 to 4294967295.

```js
update_document({
  id: 123,
  title: "September invoice",
  created: "2026-09-01",
  correspondent: null,
  tags: [2, 7],
  custom_fields: [{ field: 4, value: "INV-123" }]
})

list_documents({ tag: 7, ordering: "-created", page_size: 10 })
```

Bulk document methods: `set_correspondent`, `set_document_type`, `set_storage_path`, `add_tag`, `remove_tag`, `modify_tags`, `delete`, `reprocess`, `set_permissions`, `merge`, `split`, `rotate`, `delete_pages`. Use the corresponding ID field for assignments, `tag` for a single tag, or `add_tags`/`remove_tags` for tag changes. Merge accepts `metadata_document_id` and `delete_originals`; split accepts `delete_originals`; page operations accept `pages`; rotate accepts `degrees`. Permission settings use `permissions` with `owner`, `set_permissions` and `merge`.

Bulk `set_title` is not a Paperless API method. Use `update_document` for each document instead.

### Metadata management

| Resource | Tools |
| --- | --- |
| Tags | `list_tags`, `create_tag`, `update_tag`, `delete_tag`, `bulk_edit_tags` |
| Correspondents | `list_correspondents`, `create_correspondent`, `update_correspondent`, `delete_correspondent`, `bulk_edit_correspondents` |
| Document types | `list_document_types`, `create_document_type`, `update_document_type`, `delete_document_type`, `bulk_edit_document_types` |
| Storage paths | `list_storage_paths`, `create_storage_path`, `update_storage_path`, `delete_storage_path`, `bulk_edit_storage_paths` |
| Custom fields | `list_custom_fields`, `create_custom_field`, `update_custom_field`, `delete_custom_field` |

Create operations require `name`; updates and deletes require `id`. Tag updates also require `name`. Tags accept hex `color`. Correspondents, document types, tags and storage paths accept `match` and `matching_algorithm`. Storage path creation also requires a `path` template. Changing templates may move existing files.

Tags and storage paths use Paperless's numeric matching codes: **0 none, 1 any, 2 all, 3 exact, 4 regular expression, 5 fuzzy, 6 automatic**. Correspondents and document types accept the names `none`, `any`, `all`, `exact`, `regular expression`, `fuzzy`, `auto`, which are converted to those codes.

Bulk metadata operations take resource IDs (`tag_ids`, `correspondent_ids`, `document_type_ids` or `storage_path_ids`), `operation` (`delete` or `set_permissions`), and optional `owner`, `permissions` and `merge`.

Custom field creation requires `data_type`: `string`, `url`, `date`, `boolean`, `integer`, `float`, `monetary`, `documentlink` or `select`. `extra_data` can contain `default_currency` or `select_options`. Select options are objects with a `label` and optional `id`, not plain strings. Preserve IDs from `list_custom_fields` when editing existing options to retain document values. Deleting a custom field also deletes its associated values.

```js
create_custom_field({
  name: "Payment status",
  data_type: "select",
  extra_data: { select_options: [{ label: "Open" }, { label: "Paid" }] }
})
```

Tool schemas expose detailed parameter descriptions and read-only/destructive annotations through `tools/list`.

## Development and validation

```bash
npm ci
npm test
npm pack --dry-run
```

Tests use a local mock Paperless HTTP service and real MCP clients. They exercise every tool against both protocol generations over stdio and HTTP, plus legacy SSE compatibility, concurrent clients, protocol negotiation, request payloads, uploads, errors, OCR preservation and matching codes. No production Paperless instance or credentials are used.

Sources: [Paperless API](https://docs.paperless-ngx.com/api/), [TypeScript MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk).
