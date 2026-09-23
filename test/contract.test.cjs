const { test } = require('node:test');
const assert = require('node:assert/strict');
const { raw, contract, patchContract, validateRequest, validateJson } = require('./helpers/contract.cjs');
const request = (method, url, body) => ({
  method, url, headers: { 'content-type': 'application/json' },
  body: body === undefined ? '' : JSON.stringify(body),
});

test('contract rejects bad requests independently of the MCP implementation', async () => {
  assert.equal(await validateRequest(request('PATCH', '/api/tags/1/', { color: '#123456' })), 'tags_partial_update');
  for (const bad of [
    request('PATCH', '/api/tags/1/', { name: 'Tag', id: 1 }),
    request('POST', '/api/tags/', { name: '' }),
    request('POST', '/api/tags/', { name: 'Tag', matching_algorithm: 7 }),
    request('PATCH', '/api/documents/1/', { tags: ['wrong type'] }),
    request('GET', '/api/documents/?correspondant__id=1'),
    request('GET', '/api/documents/not-an-integer/'),
    request('GET', '/api/documentz/'),
    request('POST', '/api/tags/'),
  ]) await assert.rejects(validateRequest(bad));
});

test('patches are idempotent and preserve the upstream snapshot', () => {
  assert.deepEqual(patchContract(contract), contract);
  assert.equal(raw.components.schemas.PostDocumentRequest.properties.custom_fields.type, undefined);
  assert.ok(raw.paths['/api/documents/{id}/download/'].get.responses['200'].content['application/json']);
  assert.ok(contract.paths['/api/documents/{id}/download/'].get.responses['200'].content['application/octet-stream']);
  validateJson(contract.components.schemas.Document.properties.root_document, null);
  for (const value of [null, false, true, 0, 1.25, 'EUR12.50', [1, 2]]) {
    validateJson({ $ref: '#/components/schemas/CustomFieldInstanceRequest' }, { field: 1, value });
  }
  assert.throws(() => validateJson({ $ref: '#/components/schemas/CustomFieldInstanceRequest' }, { field: 1, value: ['invalid document id'] }));
});

test('contract covers multipart fields and rejects invalid uploads', async () => {
  async function upload(fields, file = true) {
    const form = new FormData();
    if (file) form.append('document', new File(['pdf'], 'test.pdf'));
    for (const [key, value] of fields) form.append(key, value);
    const wire = new Request('https://contract.test/api/documents/post_document/', { method: 'POST', body: form });
    return validateRequest({ method: 'POST', url: wire.url, headers: Object.fromEntries(wire.headers), body: Buffer.from(await wire.arrayBuffer()) });
  }
  assert.equal(await upload([['tags', '1'], ['tags', '2'], ['custom_fields', '[3]'], ['archive_serial_number', '0']]), 'documents_post_document_create');
  await assert.rejects(upload([['tags', 'not-an-id']]));
  await assert.rejects(upload([['custom_fields', '["not-an-id"]']]));
  await assert.rejects(upload([['misspelled_field', '1']]));
  await assert.rejects(upload([], false));
});
