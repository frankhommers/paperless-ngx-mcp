import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const wrap = (data: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data ?? null) }],
});
