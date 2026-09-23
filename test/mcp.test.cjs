const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
  StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");
const {
  StreamableHTTPClientTransport,
} = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
const {
  SSEClientTransport,
} = require("@modelcontextprotocol/sdk/client/sse.js");

const taskId = "12345678-1234-4234-8234-123456789012";
const doc = {
  id: 1,
  title: "Invoice",
  content: "Full OCR text",
  download_url: "/download",
  thumbnail_url: "/thumb",
};
const read = (result) => {
  assert.ok(!result.isError, JSON.stringify(result));
  return JSON.parse(result.content[0].text);
};

async function paperless(t) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    requests.push({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body,
    });
    if (req.headers.authorization !== "Token test-token") {
      res.writeHead(401).end();
      return;
    }
    if (req.url.includes("/documents/999/")) {
      res.writeHead(404).end("Not found");
      return;
    }
    if (req.method === "DELETE") {
      res.writeHead(204).end();
      return;
    }
    if (req.url.includes("/download/")) {
      res.writeHead(200, {
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="invoice.pdf"',
      });
      res.end("%PDF-test");
      return;
    }
    let result = { id: 1, ...(body.startsWith("{") ? JSON.parse(body) : {}) };
    if (req.url === "/api/documents/post_document/") result = taskId;
    else if (/\/api\/documents\/1\/$/.test(req.url))
      result = { ...doc, ...result };
    else if (req.url.startsWith("/api/documents/?"))
      result = { count: 1, results: [doc] };
    else if (req.url.startsWith("/api/tasks/"))
      result = [{ task_id: taskId, status: "SUCCESS" }];
    else if (req.url.startsWith("/api/search/autocomplete/"))
      result = ["invoice"];
    else if (req.method === "GET")
      result = { count: 1, results: [{ id: 1, name: "Example" }] };
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(result));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  return { url: `http://127.0.0.1:${server.address().port}`, requests };
}

async function stdio(t, url) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["build/index.js", url + "/", "test-token"],
    stderr: "pipe",
  });
  const client = new Client({ name: "regression-test", version: "1" });
  t.after(() => client.close());
  await client.connect(transport);
  return client;
}

test(
  "all tools return valid MCP results over stdio and send correct API requests",
  { timeout: 30000 },
  async (t) => {
    const api = await paperless(t);
    const client = await stdio(t, api.url);
    const { tools } = await client.listTools();
    const exercised = new Set();
    async function call(name, args, method, path) {
      const result = read(await client.callTool({ name, arguments: args }));
      exercised.add(name);
      const request = api.requests.at(-1);
      assert.equal(request.method, method, name);
      assert.equal(request.url, path, name);
      return result;
    }
    for (const [singular, plural] of [
      ["tag", "tags"],
      ["correspondent", "correspondents"],
      ["document_type", "document_types"],
      ["custom_field", "custom_fields"],
      ["storage_path", "storage_paths"],
    ]) {
      await call(`list_${plural}`, {}, "GET", `/api/${plural}/`);
      const fields = {
        name: "New",
        ...(singular === "custom_field" ? { data_type: "string" } : {}),
        ...(singular === "storage_path"
          ? { path: "{{ created_year }}/{{ title }}" }
          : {}),
      };
      await call(`create_${singular}`, fields, "POST", `/api/${plural}/`);
      await call(
        `update_${singular}`,
        { id: 1, name: "Changed" },
        singular === "tag" ? "PUT" : "PATCH",
        `/api/${plural}/1/`,
      );
      assert.equal(
        await call(
          `delete_${singular}`,
          { id: 1 },
          "DELETE",
          `/api/${plural}/1/`,
        ),
        null,
      );
      if (singular !== "custom_field") {
        await call(
          `bulk_edit_${plural}`,
          { [`${singular}_ids`]: [1], operation: "delete" },
          "POST",
          "/api/bulk_edit_objects/",
        );
        assert.deepEqual(JSON.parse(api.requests.at(-1).body), {
          objects: [1],
          object_type: plural,
          operation: "delete",
        });
      }
    }
    const listed = await call(
      "list_documents",
      {
        page: 2,
        page_size: 10,
        tag: 3,
        correspondent: 4,
        document_type: 5,
        storage_path: 6,
        ordering: "-created",
      },
      "GET",
      "/api/documents/?page=2&page_size=10&correspondent__id=4&document_type__id=5&tags__id=3&storage_path__id=6&ordering=-created",
    );
    assert.equal(listed.results[0].content, undefined);
    const full = await call(
      "get_document",
      { id: 1 },
      "GET",
      "/api/documents/1/",
    );
    assert.equal(
      full.content,
      doc.content,
      "OCR must remain available after MCP wrapping",
    );
    const patch = {
      title: "Corrected",
      content: "Corrected OCR",
      correspondent: null,
      tags: [],
      archive_serial_number: 0,
      custom_fields: [{ field: 2, value: [3, 4] }],
    };
    await call(
      "update_document",
      { id: 1, ...patch },
      "PATCH",
      "/api/documents/1/",
    );
    assert.deepEqual(
      JSON.parse(api.requests.at(-1).body),
      patch,
      "PATCH must preserve nulls and omit id",
    );
    for (const [name, args, query] of [
      [
        "search_documents",
        { query: "invoice & tax", page: 2, page_size: 10 },
        "query=invoice+%26+tax&page=2&page_size=10",
      ],
      ["find_similar_documents", { document_id: 1 }, "more_like_id=1"],
    ]) {
      const result = await call(name, args, "GET", `/api/documents/?${query}`);
      assert.equal(result.results[0].content, undefined);
      assert.equal(result.results[0].download_url, undefined);
      assert.equal(result.results[0].id, 1);
    }
    await call(
      "search_autocomplete",
      { term: "inv", limit: 5 },
      "GET",
      "/api/search/autocomplete/?term=inv&limit=5",
    );
    await call(
      "get_task_status",
      { task_id: taskId },
      "GET",
      `/api/tasks/?task_id=${taskId}`,
    );
    await call(
      "bulk_edit_documents",
      { documents: [1], method: "add_tag", tag: 2 },
      "POST",
      "/api/documents/bulk_edit/",
    );
    assert.deepEqual(JSON.parse(api.requests.at(-1).body), {
      documents: [1],
      method: "add_tag",
      parameters: { tag: 2 },
    });
    const download = await call(
      "download_document",
      { id: 1, original: true },
      "GET",
      "/api/documents/1/download/?original=true",
    );
    assert.equal(download.filename, "invoice.pdf");
    assert.equal(Buffer.from(download.blob, "base64").toString(), "%PDF-test");
    for (const [filename, override, mime] of [
      ["test.PDF", undefined, "application/pdf"],
      ["test.unknown", undefined, "application/octet-stream"],
      ["test.bin", "image/png", "image/png"],
    ]) {
      assert.equal(
        await call(
          "post_document",
          {
            file: Buffer.from("file contents").toString("base64"),
            filename,
            mime_type: override,
          archive_serial_number: override ? "0" : 0,
            tags: [1],
            custom_fields: [2],
          },
          "POST",
          "/api/documents/post_document/",
        ),
        taskId,
      );
      assert.match(
        api.requests.at(-1).headers["content-type"],
        /^multipart\/form-data; boundary=/,
      );
      assert.ok(api.requests.at(-1).body.includes(`Content-Type: ${mime}`));
    }
    assert.equal(tools.length, 34);
    assert.deepEqual(new Set(tools.map((tool) => tool.name)), exercised);
    for (const tool of tools) {
      const readOnly = /^(list|get|search|find|download)_/.test(tool.name);
      assert.equal(tool.annotations.readOnlyHint, readOnly, tool.name);
      assert.equal(
        tool.annotations.destructiveHint,
        !readOnly && !/^(create|post)_/.test(tool.name),
        tool.name,
      );
    }
  },
);

test(
  "matching, custom-field schemas and errors survive SDK validation",
  { timeout: 15000 },
  async (t) => {
    const api = await paperless(t);
    const client = await stdio(t, api.url);
    for (const resource of ["correspondent", "document_type"]) {
      for (const [name, number] of [
        ["none", 0],
        ["any", 1],
        ["all", 2],
        ["exact", 3],
        ["regular expression", 4],
        ["fuzzy", 5],
        ["auto", 6],
      ]) {
        for (const action of ["create", "update"]) {
          read(
            await client.callTool({
              name: `${action}_${resource}`,
              arguments: { id: 1, name: "Test", matching_algorithm: name },
            }),
          );
          assert.equal(
            JSON.parse(api.requests.at(-1).body).matching_algorithm,
            number,
          );
        }
      }
    }
    const extra_data = {
      select_options: [{ id: "retained", label: "Renamed" }, { label: "New" }],
    };
    read(
      await client.callTool({
        name: "create_custom_field",
        arguments: { name: "Status", data_type: "select", extra_data },
      }),
    );
    assert.deepEqual(
      JSON.parse(api.requests.at(-1).body).extra_data,
      extra_data,
    );
    for (const [name, args] of [
      ["update_document", { id: 1 }],
      ["search_documents", { query: "x", page_size: 101 }],
      ["search_autocomplete", {}],
      ["get_task_status", { task_id: "x&other=y" }],
    ]) {
      const count = api.requests.length;
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, true, name);
      assert.equal(api.requests.length, count);
    }
    for (const name of ["get_document", "download_document"]) {
      const result = await client.callTool({ name, arguments: { id: 999 } });
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, /404/);
    }
  },
);

async function httpServer(t, apiUrl) {
  const child = spawn(
    process.execPath,
    ["build/index.js", "--http", "--port", "0"],
    {
      env: { ...process.env, PAPERLESS_URL: apiUrl, API_KEY: "test-token" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill();
      await once(child, "exit");
    }
  });
  let output = "";
  const port = await new Promise((resolve, reject) => {
    child.stdout.on("data", (data) => {
      output += data;
      const match = output.match(/listening on port (\d+)/);
      if (match) resolve(match[1]);
    });
    child.on("error", reject);
    child.once("exit", (code) =>
      reject(new Error(`Server exited ${code}: ${output}`)),
    );
    child.stderr.on("data", (data) => {
      output += data;
    });
  });
  return new URL(`http://127.0.0.1:${port}/mcp`);
}

test(
  "HTTP and SSE clients have isolated sessions; deleting one keeps others working",
  { timeout: 20000 },
  async (t) => {
    const api = await paperless(t);
    const url = await httpServer(t, api.url);
    const transports = [
      new StreamableHTTPClientTransport(url),
      new StreamableHTTPClientTransport(url),
    ];
    const clients = await Promise.all(
      transports.map(async (transport) => {
        const client = new Client({ name: "http-test", version: "1" });
        t.after(() => client.close());
        await client.connect(transport);
        return client;
      }),
    );
    assert.notEqual(transports[0].sessionId, transports[1].sessionId);
    const ids = transports.map((transport) => transport.sessionId);
    await Promise.all(
      clients.map(async (client) =>
        assert.equal((await client.listTools()).tools.length, 34),
      ),
    );
    const sseClients = await Promise.all(
      [1, 2].map(async () => {
        const client = new Client({ name: "sse-test", version: "1" });
        t.after(() => client.close());
        await client.connect(new SSEClientTransport(new URL("/sse", url)));
        return client;
      }),
    );
    await Promise.all(
      [...clients, ...sseClients].map(async (client) =>
        assert.equal(
          read(
            await client.callTool({
              name: "get_document",
              arguments: { id: 1 },
            }),
          ).content,
          doc.content,
        ),
      ),
    );
    await transports[0].terminateSession();
    const headers = {
      "mcp-session-id": ids[0],
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    };
    for (const method of ["GET", "POST", "DELETE"]) {
      const response = await fetch(url, {
        method,
        headers,
        ...(method === "POST"
          ? {
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 3,
                method: "tools/list",
              }),
            }
          : {}),
      });
      assert.equal(response.status, 404, method);
      await response.text();
    }
    assert.equal((await clients[1].listTools()).tools.length, 34);
    for (const id of [undefined, "toString", "__proto__"]) {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          accept: "text/event-stream",
          ...(id ? { "mcp-session-id": id } : {}),
        },
      });
      assert.equal(response.status, id ? 404 : 400);
      await response.text();
    }
    await transports[1].terminateSession();
  },
);
