import type { components, operations } from './generated/paperless';
import { routes } from './generated/routes';

export type Models = components['schemas'];
export type DocumentQuery = NonNullable<operations['documents_list']['parameters']['query']>;
export type OperationName = keyof typeof routes;
export type Body<N extends OperationName> = NonNullable<operations[N]["requestBody"]> extends { content: infer C } ? C[keyof C] : never;
type OperationParameters<N extends OperationName> = Pick<operations[N]['parameters'], 'path' | 'query'>;
export type OperationInput<N extends OperationName> = OperationParameters<N> & (
  operations[N] extends { requestBody: unknown }
    ? { body: Body<N> }
    : { body?: Body<N> }
);
export type OperationResult<N extends OperationName> = operations[N] extends {
  responses: infer R;
} ? R[Extract<keyof R, 200 | 201 | 202>] extends { content: infer C }
  ? C[keyof C] : null : never;

export function operationPath<N extends OperationName>(name: N, input: OperationParameters<N>): string {
  let path: string = routes[name].path;
  for (const [key, value] of Object.entries(input.path ?? {})) {
    path = path.replace(`{${key}}`, encodeURIComponent(String(value)));
  }
  if (/\{[^}]+\}/.test(path)) throw new Error('Missing API path parameter');
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(input.query ?? {})) {
    if (value !== undefined) query.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  return path.slice('/api'.length) + (query.size ? `?${query}` : '');
}
