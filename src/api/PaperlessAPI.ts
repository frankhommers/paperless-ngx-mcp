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

  // Document operations
  async bulkEditDocuments(documents, method, parameters = {}) {
    return this.request("/documents/bulk_edit/", {
      method: "POST",
      body: JSON.stringify({
        documents,
        method,
        parameters,
      }),
    });
  }

  async postDocument(
    file: File,
    metadata: Record<string, string | number | number[] | undefined> = {},
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
    return this.request("/documents/post_document/", {
      method: "POST",
      body: formData,
    });
  }

  async getDocuments(query = "") {
    const response: any = await this.request(`/documents/${query}`);
    if (Array.isArray(response?.results)) {
      response.results = response.results.map(
        ({ content, download_url, thumbnail_url, ...metadata }) => metadata,
      );
    }
    return response;
  }

  async getDocument(id) {
    return this.request(`/documents/${id}/`);
  }

  async searchDocuments(query, page?, pageSize?) {
    const params = new URLSearchParams();
    params.set("query", query);
    if (page) params.set("page", page.toString());
    if (pageSize) params.set("page_size", pageSize.toString());

    const response: any = await this.request(
      `/documents/?${params.toString()}`,
    );

    // Filter out content field and long URLs to reduce token usage
    if (response.results) {
      response.results = response.results.map((doc: any) => {
        const { content, download_url, thumbnail_url, ...rest } = doc;
        return {
          ...rest,
          // Include only document ID for constructing URLs if needed
          id: doc.id,
        };
      });
    }

    return response;
  }

  async downloadDocument(id, asOriginal = false) {
    return this.withSafeErrors(async () => {
      const query = asOriginal ? "?original=true" : "";
      const response = await fetch(
        `${this.baseUrl}/api/documents/${id}/download/${query}`,
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
    return this.request("/tags/");
  }

  async createTag(data) {
    return this.request("/tags/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTag(id, data) {
    return this.request(`/tags/${id}/`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteTag(id) {
    return this.request(`/tags/${id}/`, {
      method: "DELETE",
    });
  }

  // Correspondent operations
  async getCorrespondents() {
    return this.request("/correspondents/");
  }

  async createCorrespondent(data) {
    return this.request("/correspondents/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Document type operations
  async getDocumentTypes() {
    return this.request("/document_types/");
  }

  async createDocumentType(data) {
    return this.request("/document_types/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Bulk object operations
  async bulkEditObjects(objects, objectType, operation, parameters = {}) {
    return this.request("/bulk_edit_objects/", {
      method: "POST",
      body: JSON.stringify({
        objects,
        object_type: objectType,
        operation,
        ...parameters,
      }),
    });
  }

  async updateDocument(id, data) {
    return this.request(`/documents/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async getCustomFields() {
    return this.request("/custom_fields/");
  }

  async createCustomField(data) {
    return this.request("/custom_fields/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateCustomField(id, data) {
    return this.request(`/custom_fields/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteCustomField(id) {
    return this.request(`/custom_fields/${id}/`, {
      method: "DELETE",
    });
  }

  async getStoragePaths() {
    return this.request("/storage_paths/");
  }

  async createStoragePath(data) {
    return this.request("/storage_paths/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateStoragePath(id, data) {
    return this.request(`/storage_paths/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteStoragePath(id) {
    return this.request(`/storage_paths/${id}/`, {
      method: "DELETE",
    });
  }

  async findSimilarDocuments(documentId, page?, pageSize?) {
    const params = new URLSearchParams();
    params.set("more_like_id", documentId.toString());
    if (page) params.set("page", page.toString());
    if (pageSize) params.set("page_size", pageSize.toString());

    const response: any = await this.request(
      `/documents/?${params.toString()}`,
    );

    // Filter out content field to reduce token usage
    if (response.results) {
      response.results = response.results.map((doc: any) => {
        const { content, download_url, thumbnail_url, ...rest } = doc;
        return { ...rest, id: doc.id };
      });
    }

    return response;
  }

  async searchAutocomplete(term, limit?) {
    const params = new URLSearchParams();
    if (term) params.set("term", term);
    if (limit) params.set("limit", limit.toString());
    return this.request(`/search/autocomplete/?${params.toString()}`);
  }

  async getTaskStatus(taskId) {
    return this.request(`/tasks/?${new URLSearchParams({ task_id: taskId })}`);
  }

  async updateCorrespondent(id, data) {
    return this.request(`/correspondents/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteCorrespondent(id) {
    return this.request(`/correspondents/${id}/`, {
      method: "DELETE",
    });
  }

  async updateDocumentType(id, data) {
    return this.request(`/document_types/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteDocumentType(id) {
    return this.request(`/document_types/${id}/`, {
      method: "DELETE",
    });
  }
}
