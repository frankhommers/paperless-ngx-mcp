const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { patchContract } = require('../../specs/patches.cjs');
const raw = YAML.parse(fs.readFileSync(path.join(__dirname, '../../specs/paperless-ngx.yaml'), 'utf8'));
const contract = patchContract(raw);
const toolOperations = require('../../specs/tools.json');

function makeValidator(coerceTypes) {
  const document = structuredClone(contract);
  // OpenAPI normally permits unspecified fields. Reject them in contract tests
  // when an object explicitly lists fields, to catch misspellings/read-only IDs.
  function strictObjects(schema) {
    if (!schema || typeof schema !== 'object') return;
    if (schema.nullable && !schema.type) {
      const nonNull = { ...schema };
      delete nonNull.nullable;
      for (const key of Object.keys(schema)) delete schema[key];
      schema.anyOf = [nonNull, { type: 'null' }];
    }
    if (schema.properties && schema.additionalProperties === undefined) schema.additionalProperties = false;
    for (const child of Object.values(schema)) strictObjects(child);
  }
  strictObjects(document);
  const ajv = new Ajv({ strict: false, allErrors: true, coerceTypes });
  addFormats(ajv);
  for (const format of ['binary', 'int64', 'int32', 'double', 'float']) ajv.addFormat(format, true);
  ajv.addSchema(document, 'paperless');
  const cache = new Map();
  return (schema, data) => {
    const key = JSON.stringify(schema);
    if (!cache.has(key)) {
      const refs = JSON.parse(key.replaceAll('#/components/', 'paperless#/components/'));
      cache.set(key, ajv.compile(refs));
    }
    const validate = cache.get(key);
    assert.ok(validate(data), ajv.errorsText(validate.errors, { separator: '; ' }));
  };
}
const validateJson = makeValidator(false);
const validateText = makeValidator(true);
function resolve(schema) {
  if (!schema.$ref) return schema;
  return schema.$ref.split('/').slice(1).reduce((node, key) => node[key], contract);
}
function locate(method, pathname) {
  for (const [template, methods] of Object.entries(contract.paths)) {
    const operation = methods[method.toLowerCase()];
    if (!operation) continue;
    const names = [];
    const pattern = template.split('/').map(part => {
      if (part.startsWith('{')) { names.push(part.slice(1, -1)); return '([^/]+)'; }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('/');
    const match = pathname.match(new RegExp(`^${pattern}$`));
    if (match) return { operation, params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(match[i + 1])])) };
  }
  assert.fail(`No contract for ${method} ${pathname}`);
}
async function validateRequest(request) {
  const url = new URL(request.url, 'https://contract.test');
  const { operation, params } = locate(request.method, url.pathname);
  for (const [location, values] of [['path', params], ['query', Object.fromEntries(url.searchParams)]]) {
    const parameters = (operation.parameters ?? []).filter(p => p.in === location);
    validateText({ type: 'object', properties: Object.fromEntries(parameters.map(p => [p.name, p.schema])), required: parameters.filter(p => p.required).map(p => p.name), additionalProperties: false }, values);
  }
  if (request.body) {
    assert.ok(operation.requestBody, 'Unexpected request body');
    const type = request.headers['content-type'].split(';')[0];
    const schema = operation.requestBody.content[type]?.schema;
    assert.ok(schema, `Unexpected request content type ${type}`);
    if (type === 'application/json') validateJson(schema, JSON.parse(request.body));
    else if (type === 'multipart/form-data') {
      const form = await new Request(url, { method: request.method, headers: request.headers, body: request.body }).formData();
      const properties = resolve(schema).properties;
      const body = {};
      for (const key of new Set(form.keys())) {
        assert.ok(properties[key], `Unknown multipart field ${key}`);
        const value = form.get(key);
        if (properties[key].format === 'binary') {
          assert.ok(value instanceof Blob, 'Upload must be a file');
          body[key] = value.name;
        } else if (key === 'custom_fields') body[key] = JSON.parse(value);
        else if (properties[key].type === 'array') body[key] = form.getAll(key);
        else body[key] = value;
      }
      validateText(schema, body);
    } else assert.fail(`Unsupported test encoding ${type}`);
  } else assert.ok(!operation.requestBody?.required, 'Missing required request body');
  return operation.operationId;
}
module.exports = { raw, contract, patchContract, validateRequest, validateJson, toolOperations };
