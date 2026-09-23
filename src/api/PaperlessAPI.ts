import { routes } from "./generated/routes";
import { operationPath } from "./contract";
import type {
  Models, DocumentQuery, OperationName, OperationInput, OperationResult,
} from "./contract";

/**
 * Normalize the Paperless base URL so that API paths can be appended safely.
 * Trailing slashes are removed: "https://host/" -> "https://host",
 * "https://host/paperless//" -> "https://host/paperless".
 * A base URL with a trailing slash would otherwise produce requests like
 * "https://host//api/documents/", which reverse proxies and auth layers
 * (e.g. Cloudflare Access) may route differently and answer with an HTML
 * page instead of JSON.
 */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

/**
 * Parse a fetch Response as JSON, but fail with a descriptive error when the
 * server did not answer with JSON (for example an HTML login page from a
 * reverse proxy). Without this check callers only see
 * "Unexpected token '<'" and cannot tell what went wrong.
 */
export async function parseJsonResponse(
  response: Response,
  url: string,
  redact: (text: string) => string = (text) => text,
) {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();

  // e.g. 204 No Content after DELETE
  if (response.status === 204 || text.trim() === "") {
    return null;
  }

  if (!contentType.toLowerCase().includes("json")) {
    const titleMatch = text.match(/<title>([^<]*)<\/title>/i);
    const hint = titleMatch ? ` (page title: "${titleMatch[1].trim()}")` : "";
    throw new Error(
      `Non-JSON response from ${url}: HTTP ${response.status}, ` +
        `content-type "${contentType || "unknown"}"${hint}. ` +
        "Check the Paperless base URL and that the request is not being " +
        "intercepted by a proxy or login page.",
    );
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      `Invalid JSON response from ${url}: HTTP ${response.status}: ${redact(text).slice(0, 200)}`,
    );
  }
}

export class PaperlessAPI {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.token = token;
  }

  private redact(text: string): string {
    return this.token ? text.split(this.token).join("[REDACTED]") : text;
  }

  private async withSafeErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      // Do not retain the original error/cause: fetch errors can contain
      // request headers, and proxies can echo credentials in response bodies.
      throw new Error(
        this.redact(error instanceof Error ? error.message : String(error)),
      );
    }
  }

  async request(path: string, options: RequestInit = {}) {
    return this.withSafeErrors(async () => {
      const url = `${this.baseUrl}/api${path}`;
      const headers = new Headers(options.headers);
      headers.set("Authorization", `Token ${this.token}`);
      // Let Paperless select its supported default API version.
      headers.set("Accept", "application/json");
      if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      const response = await fetch(url, { ...options, headers });
      if (!response.ok) {
        const body = this.redact(await response.text());
        throw new Error(
          `HTTP error! status: ${response.status} for ${url}: ${body.slice(0, 200)}`,
        );
      }

      return parseJsonResponse(response, url, (text) => this.redact(text));
    });
  }

  private call<N extends OperationName>(
    name: N, input: OperationInput<N>,
  ): Promise<OperationResult<N>> {
    return this.request(operationPath(name, input), {
      method: routes[name].method,
      ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
    });
  }

  // Document operations
  async bulkEditDocuments(
    documents: number[], method: Models["MethodEnum"],
    parameters: Models["BulkEditRequest"]["parameters"] = {},
  ) {
    return this.call("bulk_edit", { body: { documents, method, parameters } });
  }

  async postDocument(
    file: File,
    metadata: Omit<Models["PostDocumentRequest"], "document"> = {},
  ) {
    const formData = new FormData();
    formData.append("document", file);

    for (const [key, value] of Object.entries(metadata)) {
      if (value === undefined || value === null) continue;
      if (key === "custom_fields") {
        formData.append(key, JSON.stringify(value));
      } else if (Array.isArray(value)) {
        value.forEach((item) => formData.append(key, String(item)));
      } else {
        formData.append(key, String(value));
      }
    }
    return this.request(operationPath("documents_post_document_create", {}), {
      method: "POST",
      body: formData,
    });
  }

  async getDocuments(query: DocumentQuery = {}) {
    const response = await this.call("documents_list", { query });
    return {
      ...response,
      results: response.results?.map((doc: Models["Document"] & {
        download_url?: string; thumbnail_url?: string;
      }) => {
        const { content, download_url, thumbnail_url, ...metadata } = doc;
        return metadata;
      }),
    };
  }

  async getDocument(id: number) {
    return this.call("documents_retrieve", { path: { id } });
  }

  async searchDocuments(query: string, page?: number, pageSize?: number) {
    return this.getDocuments({ query, page, page_size: pageSize });
  }

  async downloadDocument(id: number, asOriginal = false) {
    return this.withSafeErrors(async () => {
      const path = operationPath("documents_download_retrieve", {
        path: { id }, query: asOriginal ? { original: true } : {},
      });
      const response = await fetch(
        `${this.baseUrl}/api${path}`,
        {
          headers: {
            Authorization: `Token ${this.token}`,
          },
        },
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response;
    });
  }

  // Tag operations
  async getTags() {
    return this.call("tags_list", {});
  }

  async createTag(data: Models["TagRequest"]) {
    return this.call("tags_create", { body: data });
  }

  async updateTag(id: number, data: Models["PatchedTagRequest"]) {
    return this.call("tags_partial_update", { path: { id }, body: data });
  }

  async deleteTag(id: number) {
    return this.call("tags_destroy", { path: { id } });
  }

  // Correspondent operations
  async getCorrespondents() {
    return this.call("correspondents_list", {});
  }

  async createCorrespondent(data: Models["CorrespondentRequest"]) {
    return this.call("correspondents_create", { body: data });
  }

  // Document type operations
  async getDocumentTypes() {
    return this.call("document_types_list", {});
  }

  async createDocumentType(data: Models["DocumentTypeRequest"]) {
    return this.call("document_types_create", { body: data });
  }

  // Bulk object operations
  async bulkEditObjects(
    objects: number[], objectType: Models["ObjectTypeEnum"],
    operation: Models["OperationEnum"],
    parameters: Pick<Models["BulkEditObjectsRequest"], "owner" | "permissions" | "merge"> = {},
  ) {
    return this.call("bulk_edit_objects", {
      body: { objects, object_type: objectType, operation, ...parameters },
    });
  }

  async updateDocument(id: number, data: Models["PatchedDocumentRequest"]) {
    return this.call("documents_partial_update", { path: { id }, body: data });
  }

  async getCustomFields() {
    return this.call("custom_fields_list", {});
  }

  async createCustomField(data: Models["CustomFieldRequest"]) {
    return this.call("custom_fields_create", { body: data });
  }

  async updateCustomField(id: number, data: Models["PatchedCustomFieldRequest"]) {
    return this.call("custom_fields_partial_update", { path: { id }, body: data });
  }

  async deleteCustomField(id: number) {
    return this.call("custom_fields_destroy", { path: { id } });
  }

  async getStoragePaths() {
    return this.call("storage_paths_list", {});
  }

  async createStoragePath(data: Models["StoragePathRequest"]) {
    return this.call("storage_paths_create", { body: data });
  }

  async updateStoragePath(id: number, data: Models["PatchedStoragePathRequest"]) {
    return this.call("storage_paths_partial_update", { path: { id }, body: data });
  }

  async deleteStoragePath(id: number) {
    return this.call("storage_paths_destroy", { path: { id } });
  }

  async findSimilarDocuments(documentId: number, page?: number, pageSize?: number) {
    return this.getDocuments({ more_like_id: documentId, page, page_size: pageSize });
  }

  async searchAutocomplete(term: string, limit?: number) {
    return this.call("search_autocomplete_list", { query: { term, limit } });
  }

  async getTaskStatus(taskId: string) {
    return this.call("tasks_list", { query: { task_id: taskId } });
  }

  async updateCorrespondent(id: number, data: Models["PatchedCorrespondentRequest"]) {
    return this.call("correspondents_partial_update", { path: { id }, body: data });
  }

  async deleteCorrespondent(id: number) {
    return this.call("correspondents_destroy", { path: { id } });
  }

  async updateDocumentType(id: number, data: Models["PatchedDocumentTypeRequest"]) {
    return this.call("document_types_partial_update", { path: { id }, body: data });
  }

  async deleteDocumentType(id: number) {
    return this.call("document_types_destroy", { path: { id } });
  }
}
