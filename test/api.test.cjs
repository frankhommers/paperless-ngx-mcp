const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  PaperlessAPI,
  parseJsonResponse,
} = require("../build/api/PaperlessAPI.js");

test("base URL normalization covers JSON requests, uploads and downloads", async (t) => {
  const requests = [];
  t.mock.method(global, "fetch", async (url, options) => {
    requests.push({ url, options });
    return Response.json({ id: 1 });
  });
  const api = new PaperlessAPI(
    " https://example.test/paperless/// ",
    "test-token",
  );
  await api.getDocument(1);
  await api.postDocument(
    new File(["pdf"], "test.pdf", { type: "application/pdf" }),
    {
      archive_serial_number: 0,
      tags: [1, 2],
      custom_fields: [3, 4],
      title: "",
    },
  );
  await api.downloadDocument(1, true);
  assert.deepEqual(
    requests.map((r) => r.url),
    [
      "https://example.test/paperless/api/documents/1/",
      "https://example.test/paperless/api/documents/post_document/",
      "https://example.test/paperless/api/documents/1/download/?original=true",
    ],
  );
  const { headers, body } = requests[1].options;
  assert.equal(headers.get("accept"), "application/json");
  assert.equal(headers.get("authorization"), "Token test-token");
  assert.equal(
    headers.has("content-type"),
    false,
    "fetch must supply multipart boundary",
  );
  assert.deepEqual(body.getAll("tags"), ["1", "2"]);
  assert.equal(body.get("archive_serial_number"), "0");
  assert.equal(body.get("title"), "");
  assert.equal(body.get("custom_fields"), "[3,4]");
  assert.equal(body.get("document").type, "application/pdf");
});

test("document reads work when Paperless rejects versioned Accept headers with 406", async (t) => {
  const requests = [];
  t.mock.method(global, "fetch", async (url, options) => {
    const accept = new Headers(options.headers).get("accept");
    requests.push({ url, accept });
    if (accept !== "application/json") {
      return Response.json(
        { detail: 'Invalid version in "Accept" header.' },
        { status: 406 },
      );
    }
    return Response.json(
      url.endsWith("/15976/")
        ? { id: 15976, content: "OCR" }
        : { count: 1, results: [{ id: 15976, content: "OCR" }] },
    );
  });
  const api = new PaperlessAPI("https://example.test", "test-token");
  assert.equal((await api.getDocument(15976)).content, "OCR");
  assert.equal((await api.getDocuments({ page_size: 1 })).results[0].id, 15976);
  assert.equal((await api.searchDocuments("invoice", 1, 1)).results[0].id, 15976);
  assert.equal(requests.length, 3, "no retries or duplicate requests");
});

test("response and transport errors never expose the API token", async (t) => {
  const { inspect } = require("node:util");
  const token = "secret-regression-token-0123456789";
  const api = new PaperlessAPI("https://example.test", token);
  const check = async (operation, pattern) => {
    await assert.rejects(operation, (error) => {
      assert.match(error.message, pattern);
      assert.ok(!inspect(error).includes(token));
      assert.ok(!inspect(error).includes(token.slice(0, 10)), "no truncated token");
      assert.equal(error.cause, undefined);
      return true;
    });
  };
  for (const [body, status, type, pattern] of [
    [`Authorization: Token ${token}`, 406, "application/json", /status: 406/],
    ["x".repeat(190) + token, 502, "text/plain", /status: 502/],
    [`<title>Token ${token}</title>`, 200, "text/html", /Non-JSON/],
    ["x".repeat(190) + token, 200, "application/json", /Invalid JSON/],
  ]) {
    const mock = t.mock.method(global, "fetch", async () =>
      new Response(body, { status, headers: { "content-type": type } }),
    );
    await check(() => api.getDocument(15976), pattern);
    mock.mock.restore();
  }
  t.mock.method(global, "fetch", async () => {
    throw new Error(`Network failure: ${token}`, {
      cause: { headers: { Authorization: `Token ${token}` } },
    });
  });
  await check(() => api.getDocument(15976), /Network failure/);
  await check(
    () => api.postDocument(new File(["pdf"], "test.pdf")),
    /Network failure/,
  );
  await check(() => api.downloadDocument(15976), /Network failure/);
});

test("empty DELETE and non-JSON responses have predictable results", async () => {
  assert.equal(
    await parseJsonResponse(new Response(null, { status: 204 }), "/tags/1/"),
    null,
  );
  assert.equal(await parseJsonResponse(new Response(""), "/empty"), null);
  await assert.rejects(
    parseJsonResponse(
      new Response("<title>Login</title>", {
        headers: { "content-type": "text/html" },
      }),
      "/api",
    ),
    /Non-JSON.*Login/,
  );
  await assert.rejects(
    parseJsonResponse(
      new Response("{broken", {
        headers: { "content-type": "application/json" },
      }),
      "/api",
    ),
    /Invalid JSON/,
  );
});

test("HTTP failures remain errors for API calls, uploads and binary downloads", async (t) => {
  t.mock.method(
    global,
    "fetch",
    async () => new Response("<h1>Bad gateway</h1>", { status: 502 }),
  );
  const api = new PaperlessAPI("https://example.test", "test-token");
  await assert.rejects(api.getTags(), /status: 502/);
  await assert.rejects(
    api.postDocument(new File(["x"], "x.pdf")),
    /status: 502/,
  );
  await assert.rejects(api.downloadDocument(1), /status: 502/);
});
