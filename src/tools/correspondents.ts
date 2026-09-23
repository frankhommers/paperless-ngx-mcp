import { PaperlessAPI } from "../api/PaperlessAPI";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { z } from "zod";
import { matchingAlgorithm } from "./matching";
import { wrap } from "./utils.js";

export function registerCorrespondentTools(
  server: McpServer,
  api: PaperlessAPI,
) {
  server.registerTool(
    "list_correspondents",
    {
      description:
        "Retrieve all available correspondents (people, companies, organizations that send/receive documents). Returns names and automatic matching patterns for document assignment.",
      inputSchema: {},
      annotations: {
        title: "List Correspondents",
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (args, extra) => {
      if (!api) throw new Error("Please configure API connection first");
      return wrap(await api.getCorrespondents());
    },
  );

  server.registerTool(
    "create_correspondent",
    {
      description:
        "Create a new correspondent (person, company, or organization) for tracking document senders and receivers. Can include automatic matching patterns for smart assignment to incoming documents.",
      inputSchema: {
        name: z
          .string()
          .describe(
            "Name of the correspondent (person, company, or organization that sends/receives documents). Examples: 'Bank of America', 'John Smith', 'Electric Company'.",
          ),
        match: z
          .string()
          .optional()
          .describe(
            "Text pattern to automatically assign this correspondent to matching documents. Use names, email addresses, or keywords that appear in documents from this correspondent.",
          ),
        matching_algorithm: matchingAlgorithm
          .optional()
          .describe(
            "How to match text patterns: 'any'=any word matches, 'all'=all words must match, 'exact'=exact phrase match, 'regular expression'=use regex patterns, 'fuzzy'=approximate matching with typos. Default is 'any'.",
          ),
      },
      annotations: {
        title: "Create Correspondent",
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (args, extra) => {
      if (!api) throw new Error("Please configure API connection first");
      return wrap(await api.createCorrespondent(args));
    },
  );

  server.registerTool(
    "bulk_edit_correspondents",
    {
      description:
        "Perform bulk operations on multiple correspondents: set permissions to control who can assign them to documents, or permanently delete multiple correspondents. Use with caution as deletion affects all associated documents.",
      inputSchema: {
        correspondent_ids: z
          .array(z.number())
          .describe(
            "Array of correspondent IDs to perform bulk operations on. Use list_correspondents to get valid correspondent IDs.",
          ),
        operation: z
          .enum(["set_permissions", "delete"])
          .describe(
            "Bulk operation: 'set_permissions' to control who can assign these correspondents to documents, 'delete' to permanently remove correspondents from the system. Warning: Deleting correspondents will remove them from all associated documents.",
          ),
        owner: z
          .number()
          .optional()
          .describe(
            "User ID to set as owner when operation is 'set_permissions'. The owner has full control over these correspondents.",
          ),
        permissions: z
          .object({
            view: z
              .object({
                users: z
                  .array(z.number())
                  .optional()
                  .describe(
                    "User IDs who can see and assign these correspondents to documents",
                  ),
                groups: z
                  .array(z.number())
                  .optional()
                  .describe(
                    "Group IDs who can see and assign these correspondents to documents",
                  ),
              })
              .describe(
                "Users and groups with permission to view and use these correspondents",
              ),
            change: z
              .object({
                users: z
                  .array(z.number())
                  .optional()
                  .describe(
                    "User IDs who can modify correspondent details (name, matching rules)",
                  ),
                groups: z
                  .array(z.number())
                  .optional()
                  .describe("Group IDs who can modify correspondent details"),
              })
              .describe(
                "Users and groups with permission to edit these correspondent settings",
              ),
          })
          .optional()
          .describe(
            "Permission settings when operation is 'set_permissions'. Defines who can view/assign and modify these correspondents.",
          ),
        merge: z
          .boolean()
          .optional()
          .describe(
            "Whether to merge with existing permissions (true) or replace them entirely (false). Default is false.",
          ),
      },
      annotations: {
        title: "Bulk Edit Correspondents",
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async (args, extra) => {
      if (!api) throw new Error("Please configure API connection first");
      return wrap(
        await api.bulkEditObjects(
          args.correspondent_ids,
          "correspondents",
          args.operation,
          args.operation === "set_permissions"
            ? {
                owner: args.owner,
                permissions: args.permissions,
                merge: args.merge,
              }
            : {},
        ),
      );
    },
  );

  server.registerTool(
    "update_correspondent",
    {
      description:
        "Modify an existing correspondent's name or automatic matching rules. Useful for correcting names, improving automatic document assignment, or reorganizing correspondent categories.",
      inputSchema: {
        id: z
          .number()
          .describe(
            "ID of the correspondent to update. Use list_correspondents to find existing correspondent IDs.",
          ),
        name: z
          .string()
          .optional()
          .describe(
            "New name for the correspondent. Leave empty to keep current name.",
          ),
        match: z
          .string()
          .optional()
          .describe(
            "Text pattern for automatic assignment. Empty string removes auto-matching. Use names, email addresses, or keywords.",
          ),
        matching_algorithm: matchingAlgorithm
          .optional()
          .describe(
            "Algorithm for pattern matching: 'any'=any word, 'all'=all words, 'exact'=exact phrase, 'regular expression'=regex, 'fuzzy'=approximate.",
          ),
      },
      annotations: {
        title: "Update Correspondent",
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async (args, extra) => {
      if (!api) throw new Error("Please configure API connection first");
      const { id, ...data } = args;
      return wrap(await api.updateCorrespondent(id, data));
    },
  );

  server.registerTool(
    "delete_correspondent",
    {
      description:
        "Permanently delete a correspondent from the system. Documents using this correspondent will have their correspondent field set to null. Use with caution as this action cannot be undone.",
      inputSchema: {
        id: z
          .number()
          .describe(
            "ID of the correspondent to permanently delete. Documents using this correspondent will lose their correspondent assignment. Use list_correspondents to find correspondent IDs.",
          ),
      },
      annotations: {
        title: "Delete Correspondent",
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async (args, extra) => {
      if (!api) throw new Error("Please configure API connection first");
      return wrap(await api.deleteCorrespondent(args.id));
    },
  );
}
