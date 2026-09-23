# MCP 2026-07-28 support

Application version **1.1.0** migrates the runtime from `@modelcontextprotocol/sdk` 1.29.0 to the split **2.1.0** packages. Application versions and MCP protocol revision dates are independent.

## Runtime changes

- `@modelcontextprotocol/server` provides the server, tool registration and protocol types.
- `@modelcontextprotocol/node` adapts modern requests to Node/Express and provides the legacy stateful Streamable HTTP transport.
- `@modelcontextprotocol/server-legacy/sse` retains the existing `/sse` and `/messages` endpoints. This SDK package is a frozen compatibility bridge; new integrations should use Streamable HTTP.
- Tool input schemas use `z.object(...)`, the current registration API. All 34 tool names, arguments and JSON text results remain compatible.
- The v1 SDK is a development dependency only, to prove compatibility with real v1 clients. Production does not load it.

## Transport behavior

| Transport | MCP 2026-07-28 | Older protocols |
| --- | --- | --- |
| stdio | `serveStdio` selects the modern protocol from the opening message. | The same entry point accepts an `initialize` handshake. |
| `/mcp` | `createMcpHandler` serves each request independently, including `server/discover`, with no session ID. | Existing stateful POST/GET/DELETE routes retain one server per session. |
| `/sse`, `/messages` | Use `/mcp` for modern HTTP. | Existing SSE clients remain supported. |

The SDK's `isLegacyRequest` classifier selects the HTTP path; application code does not guess based on the presence of a session ID. Invalid modern metadata and unsupported versions stay on the modern path and receive protocol errors instead of silently falling back.

Clients decide which protocol to use. SDK v2 clients keep the older handshake by default; configure `versionNegotiation: { mode: 'auto' }` to discover the new protocol with fallback, or `{ mode: { pin: '2026-07-28' } }` to require it. Installing SDK v2 alone does not enable modern protocol traffic.

## Validation

`npm test` uses a mock Paperless HTTP API and real SDK clients to exercise:

- All 34 tools through v1 and modern v2 clients over both stdio and HTTP.
- Matching conversions, metadata updates, uploads, downloads, schema validation and API errors on each of those four paths.
- Exact modern protocol negotiation, including automatic detection over both transports.
- Stateless modern exchanges without `initialize` or session headers, plus rejection of unsupported versions, malformed metadata and header/body mismatches.
- Simultaneous modern HTTP, older stateful HTTP and legacy SSE clients, including independent session termination.

CI runs on Node 20, 22 and 24. The Docker build runs the suite before removing development dependencies. No live Paperless documents are changed by these tests.

## References

- [Official v1 to v2 migration guide](https://ts.sdk.modelcontextprotocol.io/v2/migration/upgrade-to-v2)
- [Serving the 2026-07-28 revision](https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28)
- [Protocol negotiation](https://ts.sdk.modelcontextprotocol.io/v2/protocol-versions)
