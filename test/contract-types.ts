import type { OperationInput, Models } from '../src/api/contract';

const request: OperationInput<'documents_retrieve'> = { path: { id: 1 } };
const upload: OperationInput<'documents_post_document_create'> = { body: { document: new Blob([]) } };
const patch: Models['PatchedDocumentRequest'] = { correspondent: null, tags: [], custom_fields: [{ field: 1, value: [2, 3] }] };
// @ts-expect-error Required path parameters cannot disappear.
const missingPath: OperationInput<'documents_retrieve'> = {};
// @ts-expect-error Uploads require their multipart body.
const missingUpload: OperationInput<'documents_post_document_create'> = {};
// @ts-expect-error HTTP APIs require integer IDs, not strings.
const wrongId: OperationInput<'documents_retrieve'> = { path: { id: 'wrong' } };
// @ts-expect-error Read-only identity fields are not PATCH input.
const tag: Models['PatchedTagRequest'] = { id: 1 };
// @ts-expect-error Unknown query fields must fail before runtime.
const query: OperationInput<'documents_list'> = { query: { wrong_filter: 1 } };
// @ts-expect-error Matching enums are numeric codes in the HTTP request.
const matching: Models['TagRequest'] = { name: 'tag', matching_algorithm: 'fuzzy' };
void [request, upload, patch, missingPath, missingUpload, wrongId, tag, query, matching];
