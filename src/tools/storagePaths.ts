import { PaperlessAPI } from "../api/PaperlessAPI";
import { wrap } from "./utils";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { z } from "zod";

export function registerStoragePathTools(server: McpServer, api: PaperlessAPI) {
  server.registerTool(
    "list_storage_paths",
    {
      description:
        "Retrieve all available storage paths for organizing documents into folder hierarchies. Storage paths define where documents are stored and can use template variables like {{correspondent}}, {{document_type}}, {{created_year}}, etc.",
      inputSchema: {},
      annotations: {
        title: "List Storage Paths",
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (args, extra) => {
      if (!api) throw new Error("Please configure API connection first");
      return wrap(await api.getStoragePaths());
    },
  );

  server.registerTool(
    "create_storage_path",
    {
      description:
        "Create a new storage path for organizing documents into folder structures. Storage paths support template variables for dynamic organization based on document metadata.",
      inputSchema: {
        name: z
          .string()
          .describe(
            "Display name for the storage path (e.g., 'Invoices by Year', 'Contracts by Vendor'). This name appears in the document detail view.",
          ),
        path: z
          .string()
          .describe(
            "Folder path template using Paperless variables. Available variables: {{correspondent}}, {{document_type}}, {{created}}, {{created_year}}, {{created_month}}, {{created_day}}, {{added}}, {{added_year}}, {{added_month}}, {{added_day}}, {{asn}}, {{tags}}, {{tag_list}}, {{owner_username}}. Example: '{{created_year}}/{{correspondent}}/{{document_type}}'",
          ),
        match: z
          .string()
          .optional()
          .describe(
            "Text pattern to automatically assign this storage path to matching documents. Use keywords that appear in documents that should use this path.",
          ),
        matching_algorithm: z
          .number()
          .int()
          .min(0)
          .max(6)
          .optional()
          .describe(
            "How to match text patterns: 0=none, 1=any word, 2=all words, 3=exact phrase, 4=regular expression, 5=fuzzy, 6=automatic. Default is 1 (any word).",
          ),
      },
      annotations: {
        title: "Create Storage Path",
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (args, extra) => {
      if (!api) throw new Error("Please configure API connection first");
      return wrap(await api.createStoragePath(args));
    },
  );

  server.registerTool(
    "update_storage_path",
    {
      description:
        "Modify an existing storage path's name, path template, or matching rules. Changing a path template can rename or move files for documents using it.",
      inputSchema: {
        id: z
          .number()
          .describe(
            "ID of the storage path to update. Use list_storage_paths to find existing storage path IDs.",
          ),
        name: z
          .string()
          .optional()
          .describe(
            "New display name for the storage path. Leave empty to keep current name.",
          ),
        path: z
          .string()
          .optional()
          .describe(
            "New folder path template. Changes can rename or move files for documents using this path.",
          ),
        match: z
          .string()
          .optional()
          .describe(
            "Text pattern for automatic assignment. Empty string removes auto-matching.",
          ),
        matching_algorithm: z
          .number()
          .int()
          .min(0)
          .max(6)
          .optional()
          .describe(
            "Algorithm for pattern matching: 0=none, 1=any word, 2=all words, 3=exact phrase, 4=regular expression, 5=fuzzy, 6=automatic.",
          ),
      },
      annotations: {
        title: "Update Storage Path",
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async (args, extra) => {
      if (!api) throw new Error("Please configure API connection first");
      const { id, ...data } = args;
      return wrap(await api.updateStoragePath(id, data));
    },
  );

  server.registerTool(
    "delete_storage_path",
    {
      description:
        "Permanently delete a storage path from the system. Documents using this path will have their storage_path set to null and retain their document records. Paperless manages the corresponding file paths. Use with caution.",
      inputSchema: {
        id: z
          .number()
          .describe(
            "ID of the storage path to permanently delete. Documents using this path will lose their storage path assignment but files remain intact. Use list_storage_paths to find storage path IDs.",
          ),
      },
      annotations: {
        title: "Delete Storage Path",
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async (args, extra) => {
      if (!api) throw new Error("Please configure API connection first");
      return wrap(await api.deleteStoragePath(args.id));
    },
  );

  server.registerTool(
    "bulk_edit_storage_paths",
    {
      description:
        "Perform bulk operations on multiple storage paths: set permissions to control who can assign them to documents, or permanently delete multiple storage paths. Use with caution as deletion affects document organization.",
      inputSchema: {
        storage_path_ids: z
          .array(z.number())
          .describe(
            "Array of storage path IDs to perform bulk operations on. Use list_storage_paths to get valid IDs.",
          ),
        operation: z
          .enum(["set_permissions", "delete"])
          .describe(
            "Bulk operation: 'set_permissions' to control who can assign these storage paths, 'delete' to permanently remove them from the system.",
          ),
        owner: z
          .number()
          .optional()
          .describe(
            "User ID to set as owner when operation is 'set_permissions'. The owner has full control over these storage paths.",
          ),
        permissions: z
          .object({
            view: z
              .object({
                users: z
                  .array(z.number())
                  .optional()
                  .describe(
                    "User IDs who can see and assign these storage paths to documents",
                  ),
                groups: z
                  .array(z.number())
                  .optional()
                  .describe(
                    "Group IDs who can see and assign these storage paths to documents",
                  ),
              })
              .describe(
                "Users and groups with permission to view and use these storage paths",
              ),
            change: z
              .object({
                users: z
                  .array(z.number())
                  .optional()
                  .describe(
                    "User IDs who can modify storage path settings (name, path template, matching rules)",
                  ),
                groups: z
                  .array(z.number())
                  .optional()
                  .describe("Group IDs who can modify storage path settings"),
              })
              .describe(
                "Users and groups with permission to edit these storage path configurations",
              ),
          })
          .optional()
          .describe(
            "Permission settings when operation is 'set_permissions'. Defines who can view/assign and modify these storage paths.",
          ),
        merge: z
          .boolean()
          .optional()
          .describe(
            "Whether to merge with existing permissions (true) or replace them entirely (false). Default is false.",
          ),
      },
      annotations: {
        title: "Bulk Edit Storage Paths",
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async (args, extra) => {
      if (!api) throw new Error("Please configure API connection first");
      return wrap(
        await api.bulkEditObjects(
          args.storage_path_ids,
          "storage_paths",
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
}
