import { PaperlessAPI } from "../api/PaperlessAPI";
import { wrap } from "./utils";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { z } from "zod";

export function registerCustomFieldTools(server: McpServer, api: PaperlessAPI) {
  server.registerTool(
    "list_custom_fields",
    {
      description:
        "Retrieve all available custom fields for storing additional document metadata. Returns field definitions including name, data type, and configuration options. Custom fields enable storing structured data like invoice numbers, amounts, dates, or links to external systems.",
      inputSchema: {},
      annotations: {
        title: "List Custom Fields",
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (args, extra) => {
      if (!api) throw new Error("Please configure API connection first");
      return wrap(await api.getCustomFields());
    },
  );

  server.registerTool(
    "create_custom_field",
    {
      description:
        "Create a new custom field for storing additional document metadata. Custom fields can store various data types including text, numbers, dates, booleans, URLs, monetary values, document links, and selection lists. Useful for integrating with external systems or tracking domain-specific information.",
      inputSchema: {
        name: z
          .string()
          .describe(
            "Unique name for the custom field (e.g., 'Invoice Number', 'Amount Due', 'External ID'). This name appears in the document detail view.",
          ),
        data_type: z
          .enum([
            "string",
            "url",
            "date",
            "boolean",
            "integer",
            "float",
            "monetary",
            "documentlink",
            "select",
          ])
          .describe(
            "Data type for the field: 'string' (text), 'url' (web link), 'date' (ISO date), 'boolean' (true/false), 'integer' (whole number), 'float' (decimal number), 'monetary' (currency value with 2 decimals), 'documentlink' (reference to another document), 'select' (dropdown with predefined options).",
          ),
        extra_data: z
          .object({
            select_options: z
              .array(
                z.object({
                  id: z.string().optional(),
                  label: z.string().min(1),
                }),
              )
              .min(1)
              .optional()
              .describe(
                "Options for 'select' type fields. Each option needs a label; IDs are assigned by Paperless.",
              ),
            default_currency: z
              .string()
              .optional()
              .describe(
                "Default currency code for 'monetary' type fields (e.g., 'USD', 'EUR').",
              ),
          })
          .optional()
          .describe(
            "Additional configuration depending on data_type. Required for 'select' type (provide select_options). Optional for 'monetary' type (provide default_currency).",
          ),
      },
      annotations: {
        title: "Create Custom Field",
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (args, extra) => {
      if (!api) throw new Error("Please configure API connection first");
      return wrap(await api.createCustomField(args));
    },
  );

  server.registerTool(
    "update_custom_field",
    {
      description:
        "Modify an existing custom field's name or configuration. Preserve select option IDs when editing labels to keep existing document values.",
      inputSchema: {
        id: z
          .number()
          .describe(
            "ID of the custom field to update. Use list_custom_fields to find existing field IDs.",
          ),
        name: z
          .string()
          .optional()
          .describe(
            "New name for the custom field. Leave empty to keep current name.",
          ),
        extra_data: z
          .object({
            select_options: z
              .array(
                z.object({
                  id: z.string().optional(),
                  label: z.string().min(1),
                }),
              )
              .min(1)
              .optional()
              .describe(
                "Updated options for 'select' type fields. Replaces existing options; preserve IDs from list_custom_fields to keep assigned values.",
              ),
            default_currency: z
              .string()
              .optional()
              .describe("Updated default currency for 'monetary' type fields."),
          })
          .optional()
          .describe(
            "Updated configuration for the field. Only applicable fields will be modified.",
          ),
      },
      annotations: {
        title: "Update Custom Field",
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async (args, extra) => {
      if (!api) throw new Error("Please configure API connection first");
      const { id, ...data } = args;
      return wrap(await api.updateCustomField(id, data));
    },
  );

  server.registerTool(
    "delete_custom_field",
    {
      description:
        "Permanently delete a custom field from the system. This removes the field definition AND all values stored in this field across all documents. Use with extreme caution as this action cannot be undone.",
      inputSchema: {
        id: z
          .number()
          .describe(
            "ID of the custom field to permanently delete. WARNING: This will delete the field and ALL its values from every document. Use list_custom_fields to find field IDs.",
          ),
      },
      annotations: {
        title: "Delete Custom Field",
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async (args, extra) => {
      if (!api) throw new Error("Please configure API connection first");
      return wrap(await api.deleteCustomField(args.id));
    },
  );
}
