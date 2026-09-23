// Read-only smoke test. Set PAPERLESS_URL, API_KEY and PAPERLESS_TEST_DOCUMENT_ID.
const assert = require('node:assert/strict');
const { Client } = require('@modelcontextprotocol/client');
const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');
const token = process.env.API_KEY;
const id = Number(process.env.PAPERLESS_TEST_DOCUMENT_ID);
if (!process.env.PAPERLESS_URL || !token || !Number.isInteger(id) || id < 1) {
  console.error('Set PAPERLESS_URL, API_KEY and a positive PAPERLESS_TEST_DOCUMENT_ID.');
  process.exit(1);
}
const client = new Client({ name: 'paperless-live-contract-check', version: '1' }, {
  versionNegotiation: { mode: { pin: '2026-07-28' } },
});
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['build/index.js'],
  env: { ...process.env },
  stderr: 'pipe',
});
let stderr = '';
transport.stderr.on('data', data => { stderr += data; });
(async () => {
  await client.connect(transport);
  assert.equal((await client.listTools()).tools.length, 34);
  for (const [name, args] of [
    ['get_document', { id }],
    ['list_documents', { page_size: 1, created__gte: '2000-01-01' }],
    ['search_documents', { query: String(id), page_size: 1 }],
    ['find_similar_documents', { document_id: id, page_size: 1 }],
  ]) {
    const result = await client.callTool({ name, arguments: args });
    assert.ok(!result.isError, `${name} returned an MCP error`);
    const data = JSON.parse(result.content[0].text);
    if (name === 'get_document') assert.equal(data.id, id);
    else {
      assert.ok(Array.isArray(data.results), `${name} must return results`);
      assert.ok(data.results.every(doc => !('content' in doc)), 'OCR must be omitted from lists');
    }
    console.log(`${name}: OK`);
  }
  console.log(`Server ${client.getServerVersion()?.version}: 34 tools`);
  await client.close();
  assert.ok(!stderr.includes(token), 'Token detected in server stderr');
})().catch(error => {
  console.error(error.message.split(token).join('[REDACTED]'));
  process.exitCode = 1;
}).finally(() => client.close());
