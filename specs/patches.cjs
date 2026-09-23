// Adapted from apigen-dotnet/paperless-ngx (MIT; see LICENSE.apigen).
// Keep the upstream YAML unchanged. Every correction needs a source in README.md.
function patchContract(input) {
  const spec = structuredClone(input);
  const schemas = spec.components.schemas;
  const fields = schemas.PostDocumentRequest.properties.custom_fields;
  if (!fields.type) Object.assign(fields, { type: 'array', items: { type: 'integer' } });
  schemas.Document.properties.root_document.nullable = true;
  for (const suffix of ['download', 'preview', 'thumb']) {
    const response = spec.paths[`/api/documents/{id}/${suffix}/`].get.responses['200'];
    response.content = { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } };
  }
  // The upstream return annotation omits boolean/document-link values and uses
  // overlapping integer/number oneOf branches. The serializer accepts both.
  for (const name of ['CustomFieldInstance', 'CustomFieldInstanceRequest']) {
    schemas[name].properties.value = {
      anyOf: [
        { type: 'string' }, { type: 'number' }, { type: 'boolean' },
        { type: 'array', items: { type: 'integer' } },
        { type: 'object', additionalProperties: true }, { type: 'null' },
      ],
    };
  }
  const parameters = spec.paths['/api/documents/'].get.parameters;
  if (!parameters.some(p => p.name === 'more_like_id')) {
    parameters.push({ in: 'query', name: 'more_like_id', schema: { type: 'integer', minimum: 1 } });
  }
  return spec;
}
module.exports = { patchContract };
