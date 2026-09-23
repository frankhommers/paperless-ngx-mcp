import type { CallToolResult } from "@modelcontextprotocol/server";

export const wrap = (data: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data ?? null) }],
});
