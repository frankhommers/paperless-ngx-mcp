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
