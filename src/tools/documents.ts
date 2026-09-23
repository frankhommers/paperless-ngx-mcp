import { PaperlessAPI } from "../api/PaperlessAPI";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { wrap } from "./utils.js";

const archiveSerialNumber = z.number().int().min(0).max(4294967295);

const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
  ".webp": "image/webp",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".html": "text/html",
  ".htm": "text/html",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".odp": "application/vnd.oasis.opendocument.presentation",
};

function getMimeType(filename: string): string {
  const ext = "." + filename.split(".").pop()?.toLowerCase();
  return MIME_MAP[ext] || "application/octet-stream";
}

export function registerDocumentTools(server: McpServer, api: PaperlessAPI) {
  server.registerTool(
    "list_documents",
    {
      description:
        "List documents with pagination and metadata filters. Returns metadata without OCR text; use get_document for full content.",
      inputSchema: {
        page: z.number().int().positive().optional(),
        page_size: z.number().int().min(1).max(100).optional(),
        search: z.string().optional().describe("Search document titles."),
        correspondent: z.number().int().positive().optional(),
        document_type: z.number().int().positive().optional(),
        tag: z.number().int().positive().optional(),
        storage_path: z.number().int().positive().optional(),
        created__gte: z
          .string()
          .optional()
          .describe("Earliest creation date, YYYY-MM-DD."),
        created__lte: z
          .string()
          .optional()
          .describe("Latest creation date, YYYY-MM-DD."),
        ordering: z
          .string()
          .optional()
          .describe("Sort field, e.g. -created for newest first."),
      },
      annotations: {
        title: "List Documents",
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (args) => {
      const aliases: Record<string, string> = {
        correspondent: "correspondent__id",
        document_type: "document_type__id",
        tag: "tags__id",
        storage_path: "storage_path__id",
      };
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(args)) {
        if (value !== undefined) query.set(aliases[key] ?? key, String(value));
      }
      return wrap(await api.getDocuments(query.size ? `?${query}` : ""));
    },
  );

  server.registerTool(
    "bulk_edit_documents",
    {
      description:
        "Perform bulk operations on multiple documents simultaneously: set correspondent/type/tags, delete, reprocess, merge, split, rotate, or manage permissions. Efficient for managing large document collections.",
      inputSchema: {
        documents: z
          .array(z.number())
          .describe(
            "Array of document IDs to perform bulk operations on. Get document IDs from search_documents first.",
          ),
        method: z
          .enum([
            "set_correspondent",
            "set_document_type",
            "set_storage_path",
            "add_tag",
            "remove_tag",
            "modify_tags",
            "delete",
            "reprocess",
            "set_permissions",
            "merge",
            "split",
            "rotate",
            "delete_pages",
          ])
          .describe(
            "The bulk operation to perform: set_correspondent (assign sender/receiver), set_document_type (categorize documents), set_storage_path (organize file location), add_tag/remove_tag/modify_tags (manage labels), delete (permanently remove), reprocess (re-run OCR/indexing), set_permissions (control access), merge (combine documents), split (separate into multiple), rotate (adjust orientation), delete_pages (remove specific pages)",
          ),
        correspondent: z
          .number()
          .optional()
          .describe(
            "ID of correspondent to assign when method is 'set_correspondent'. Use list_correspondents to get valid IDs.",
          ),
        document_type: z
          .number()
          .optional()
          .describe(
            "ID of document type to assign when method is 'set_document_type'. Use list_document_types to get valid IDs.",
          ),
        storage_path: z
          .number()
          .optional()
          .describe(
            "ID of storage path to assign when method is 'set_storage_path'. Storage paths organize documents in folder hierarchies.",
          ),
        tag: z
          .number()
          .optional()
          .describe(
            "Single tag ID to add or remove when method is 'add_tag' or 'remove_tag'. Use list_tags to get valid IDs.",
          ),
        add_tags: z
          .array(z.number())
          .optional()
          .describe(
            "Array of tag IDs to add when method is 'modify_tags'. Use list_tags to get valid IDs.",
          ),
        remove_tags: z
          .array(z.number())
          .optional()
          .describe(
            "Array of tag IDs to remove when method is 'modify_tags'. Use list_tags to get valid IDs.",
          ),
        permissions: z
          .object({
            owner: z
              .number()
              .nullable()
              .optional()
              .describe(
                "User ID to set as document owner, or null to remove ownership",
              ),
            set_permissions: z
              .object({
                view: z
                  .object({
                    users: z
                      .array(z.number())
                      .describe("User IDs granted view permission"),
                    groups: z
                      .array(z.number())
                      .describe("Group IDs granted view permission"),
                  })
                  .describe("Users and groups who can view these documents"),
                change: z
                  .object({
                    users: z
                      .array(z.number())
                      .describe("User IDs granted edit permission"),
                    groups: z
                      .array(z.number())
                      .describe("Group IDs granted edit permission"),
                  })
                  .describe("Users and groups who can edit these documents"),
              })
              .optional()
              .describe("Specific permission settings for users and groups"),
            merge: z
              .boolean()
              .optional()
              .describe(
                "Whether to merge with existing permissions (true) or replace them (false)",
              ),
          })
          .optional()
          .describe(
            "Permission settings when method is 'set_permissions'. Controls who can view and edit the documents.",
          ),
        metadata_document_id: z
          .number()
          .optional()
          .describe(
            "Source document ID when merging documents. The metadata from this document will be preserved.",
          ),
        delete_originals: z
          .boolean()
          .optional()
          .describe(
            "Whether to delete original documents after merge/split operations. Use with caution.",
          ),
        pages: z
          .string()
          .optional()
          .describe(
            "Page specification for delete_pages method. Format: '1,3,5-7' to delete pages 1, 3, and 5 through 7.",
          ),
        degrees: z
          .number()
          .optional()
          .describe(
            "Rotation angle in degrees when method is 'rotate'. Use 90, 180, or 270 for standard rotations.",
          ),
      },
      annotations: {
        title: "Bulk Edit Documents",
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async (args, extra) => {
      if (!api) throw new Error("Please configure API connection first");
      const { documents, method, ...parameters } = args;
      return wrap(await api.bulkEditDocuments(documents, method, parameters));
    },
  );

  server.registerTool(
    "post_document",
    {
      description:
        "Upload a new document to Paperless-NGX with metadata. Supports PDF, images (PNG/JPG/TIFF), and text files. Automatically processes for OCR and indexing.",
      inputSchema: {
        file: z
          .string()
          .describe(
            "Base64 encoded file content. Convert your file to base64 before uploading. Supports PDF, images (PNG, JPG, TIFF), and text files.",
          ),
        filename: z
          .string()
          .describe(
            "Original filename with extension (e.g., 'invoice.pdf', 'receipt.png'). This helps Paperless determine file type and initial document title.",
          ),
        mime_type: z
          .string()
          .optional()
          .describe("MIME type; inferred from filename when omitted."),
        title: z
          .string()
          .optional()
          .describe(
            "Custom document title. If not provided, Paperless will extract title from filename or document content.",
          ),
        created: z
          .string()
          .optional()
          .describe(
            "Document creation date in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss). If not provided, uses current date.",
          ),
        correspondent: z
          .number()
          .optional()
          .describe(
            "ID of the correspondent (sender/receiver) for this document. Use list_correspondents to find or create_correspondent to add new ones.",
          ),
        document_type: z
          .number()
          .optional()
          .describe(
            "ID of document type for categorization (e.g., Invoice, Receipt, Letter). Use list_document_types to find or create_document_type to add new ones.",
          ),
        storage_path: z
          .number()
          .optional()
          .describe(
            "ID of storage path to organize document location in folder hierarchy. Leave empty for default storage.",
          ),
        tags: z
          .array(z.number())
          .optional()
          .describe(
            "Array of tag IDs to label this document. Use list_tags to find existing tags or create_tag to add new ones.",
          ),
        archive_serial_number: z
          .union([
            archiveSerialNumber,
            z
              .string()
              .regex(/^\d+$/)
              .transform(Number)
              .pipe(archiveSerialNumber),
          ])
          .optional()
          .describe(
            "Integer archive serial number (0–4294967295). Numeric strings are also accepted for compatibility.",
          ),
        custom_fields: z
          .array(z.number())
          .optional()
          .describe(
            "Array of custom field IDs to associate with this document. Custom fields store additional metadata.",
          ),
      },
      annotations: {
        title: "Post Document",
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (args, extra) => {
      if (!api) throw new Error("Please configure API connection first");
      const binaryData = Buffer.from(args.file, "base64");
      const mimeType = args.mime_type || getMimeType(args.filename);
      const file = new File([binaryData], args.filename, { type: mimeType });
      const { file: _, filename: __, mime_type: ___, ...metadata } = args;
      return wrap(await api.postDocument(file, metadata));
    },
  );

  server.registerTool(
    "get_document",
    {
      description:
        "Get complete details for a specific document including full metadata, content preview, tags, correspondent, and document type information.",
      inputSchema: {
        id: z
          .number()
          .describe(
            "Unique document ID. Get this from search_documents results. Returns full document metadata, content preview, and associated tags/correspondent/type.",
          ),
      },
      annotations: {
        title: "Get Document",
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (args, extra) => {
      if (!api) throw new Error("Please configure API connection first");
      return wrap(await api.getDocument(args.id));
    },
  );

  server.registerTool(
    "search_documents",
    {
      description:
        "Search through documents using full-text search across content, titles, tags, and metadata. Returns document metadata WITHOUT the full OCR content field to prevent token overflow. Use get_document to retrieve full details for specific documents of interest. Supports Paperless-NGX advanced query syntax.",
      inputSchema: {
        query: z
          .string()
          .describe(
            "Search query using Paperless-NGX syntax. By default, matches documents containing ALL words. Advanced syntax: Field searches: 'tag:unpaid', 'type:invoice', 'correspondent:university'. Logical operators: 'term1 AND (term2 OR term3)'. Date ranges: 'created:[2020 to 2024]', 'added:yesterday', 'modified:today'. Wildcards: 'prod*name'. Combine multiple criteria as needed. Search looks through document content, title, correspondent, type, and tags.",
          ),
        page: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            "Page number for pagination (starts at 1). Use to browse through large result sets without hitting token limits.",
          ),
        page_size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe(
            "Number of documents per page (default 25, max 100). Smaller page sizes help avoid token limits when many documents match.",
          ),
      },
      annotations: {
        title: "Search Documents",
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (args, extra) => {
      if (!api) throw new Error("Please configure API connection first");
      return wrap(
        await api.searchDocuments(args.query, args.page, args.page_size),
      );
    },
  );

  server.registerTool(
    "download_document",
    {
      description:
        "Download a document file as base64-encoded data. Choose between original uploaded file or processed/archived version with OCR improvements.",
      inputSchema: {
        id: z
          .number()
          .describe(
            "Document ID to download. Get this from search_documents or get_document results.",
          ),
        original: z
          .boolean()
          .optional()
          .describe(
            "Whether to download the original uploaded file (true) or the processed/archived version (false, default). Original files preserve exact formatting but may not include OCR improvements.",
          ),
      },
      annotations: {
        title: "Download Document",
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (args, extra) => {
      if (!api) throw new Error("Please configure API connection first");
      const response = await api.downloadDocument(args.id, args.original);
      return wrap({
        blob: Buffer.from(await response.arrayBuffer()).toString("base64"),
        filename:
          response.headers
            .get("content-disposition")
            ?.split("filename=")[1]
            ?.replace(/"/g, "") || `document-${args.id}`,
      });
    },
  );

  server.registerTool(
    "update_document",
    {
      description:
        "Update an existing document's metadata including title, correspondent, document type, tags, storage path, and custom fields. Use this to correct or enhance document organization after upload or OCR processing.",
      inputSchema: {
        id: z
          .number()
          .describe(
            "ID of the document to update. Get this from search_documents or get_document results.",
          ),
        content: z
          .string()
          .optional()
          .describe("Replacement OCR text. Omit to preserve existing content."),
        title: z
          .string()
          .optional()
          .describe("New document title. Leave empty to keep current title."),
        correspondent: z
          .number()
          .nullable()
          .optional()
          .describe(
            "ID of correspondent to assign, or null to remove current correspondent. Use list_correspondents to find valid IDs.",
          ),
        document_type: z
          .number()
          .nullable()
          .optional()
          .describe(
            "ID of document type to assign, or null to remove current type. Use list_document_types to find valid IDs.",
          ),
        storage_path: z
          .number()
          .nullable()
          .optional()
          .describe(
            "ID of storage path to assign, or null to remove current path. Controls where the document is stored in folder hierarchy.",
          ),
        tags: z
          .array(z.number())
          .optional()
          .describe(
            "Array of tag IDs to assign. This REPLACES all existing tags. Use list_tags to find valid IDs. To add/remove individual tags, use bulk_edit_documents instead.",
          ),
        archive_serial_number: archiveSerialNumber
          .nullable()
          .optional()
          .describe(
            "Archive serial number for document organization and reference. Set to null to remove.",
          ),
        created: z
          .string()
          .optional()
          .describe(
            "Document creation date in ISO format (YYYY-MM-DD). Use to correct dates extracted incorrectly by OCR.",
          ),
        custom_fields: z
          .array(
            z.object({
              field: z.number().describe("Custom field ID"),
              value: z
                .union([
                  z.string(),
                  z.number(),
                  z.boolean(),
                  z.array(z.number().int().positive()),
                  z.null(),
                ])
                .describe(
                  "Value for the custom field. Type depends on field definition.",
                ),
            }),
          )
          .optional()
          .describe(
            "Array of custom field values to set. Each object needs 'field' (ID) and 'value'. Use list_custom_fields to see available fields.",
          ),
      },
      annotations: {
        title: "Update Document",
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async (args, extra) => {
      if (!api) throw new Error("Please configure API connection first");
      const { id, ...data } = args;
      if (Object.keys(data).length === 0)
        throw new Error("At least one field must be provided to update.");
      return wrap(await api.updateDocument(id, data));
    },
  );

  server.registerTool(
    "find_similar_documents",
    {
      description:
        "Find documents similar to a given document using content-based similarity matching. Useful for detecting duplicates, finding related documents, or discovering documents on similar topics. Returns documents ranked by similarity score.",
      inputSchema: {
        document_id: z
          .number()
          .describe(
            "ID of the reference document to find similar documents for. Get this from search_documents or get_document results.",
          ),
        page: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            "Page number for pagination (starts at 1). Use to browse through large result sets.",
          ),
        page_size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe(
            "Number of similar documents per page (default 25, max 100).",
          ),
      },
      annotations: {
        title: "Find Similar Documents",
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (args, extra) => {
      if (!api) throw new Error("Please configure API connection first");
      return wrap(
        await api.findSimilarDocuments(
          args.document_id,
          args.page,
          args.page_size,
        ),
      );
    },
  );

  server.registerTool(
    "search_autocomplete",
    {
      description:
        "Get search term suggestions based on document content. Useful for building search queries and discovering terms that appear in the document corpus. Returns matching search term suggestions.",
      inputSchema: {
        term: z.string().min(1).describe("Partial search term to complete."),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum number of suggestions to return (default 10)."),
      },
      annotations: {
        title: "Search Autocomplete",
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (args, extra) => {
      if (!api) throw new Error("Please configure API connection first");
      return wrap(await api.searchAutocomplete(args.term, args.limit));
    },
  );

  server.registerTool(
    "get_task_status",
    {
      description:
        "Check the status of an asynchronous task, such as document upload processing. Use this to poll for completion after uploading documents via post_document.",
      inputSchema: {
        task_id: z
          .string()
          .uuid()
          .describe(
            "UUID of the task to check. This is returned by post_document and other asynchronous operations.",
          ),
      },
      annotations: {
        title: "Get Task Status",
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (args, extra) => {
      if (!api) throw new Error("Please configure API connection first");
      return wrap(await api.getTaskStatus(args.task_id));
    },
  );
}
