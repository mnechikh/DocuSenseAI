// Pure client-side OpenAPI 3.0/3.1 spec parser.
// No external dependencies — uses native JS only.
// Returns ImportEntry[] compatible with importIntegrations() server action.

import type { ImportEntry } from '@/lib/integration-actions';

export interface ParsedSecurityScheme {
  name: string;            // key from securitySchemes (e.g. "AutomationKey")
  headerKey: string;       // resolved header name (e.g. "Authorization")
  headerValueHint: string; // e.g. "Bearer {{api_key}}"
}

export interface ParsedEndpoint {
  operationKey: string;    // "METHOD /path" — unique selection key
  name: string;
  description: string;
  endpoint: string;        // full URL = first server + path
  method: string;
  paramCount: number;
  securitySchemeNames: string[];  // which schemes this operation uses
  importEntry: ImportEntry;
}

export interface ParseOpenApiResult {
  title: string;
  baseUrl: string;
  endpoints: ParsedEndpoint[];
  securitySchemes: ParsedSecurityScheme[];
}

// ─── OpenAPI type helpers (minimal, no zod/ajv) ────────────────────────────────

interface OASpec {
  info?: { title?: string };
  servers?: { url?: string }[];
  components?: {
    securitySchemes?: Record<string, OASecurityScheme>;
    schemas?: Record<string, OASchema>;
  };
  paths?: Record<string, OAPathItem>;
}

interface OASecurityScheme {
  type?: string;
  scheme?: string;
  name?: string;       // for apiKey in: header
  in?: string;
  description?: string;
}

interface OAPathItem {
  get?: OAOperation;
  post?: OAOperation;
  put?: OAOperation;
  patch?: OAOperation;
  delete?: OAOperation;
}

interface OAOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  security?: Record<string, string[]>[];
  parameters?: OAParameter[];
  requestBody?: {
    content?: {
      'application/json'?: { schema?: OASchema };
      [mime: string]: { schema?: OASchema } | undefined;
    };
  };
}

interface OAParameter {
  name?: string;
  in?: string;         // "path" | "query" | "header" | "cookie"
  description?: string;
  required?: boolean;
  schema?: { type?: string };
}

interface OASchema {
  type?: string;
  properties?: Record<string, { type?: string; description?: string; example?: unknown }>;
  required?: string[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

/** Prefer the human-readable `summary`; fall back to cleaned operationId; then the raw key. */
function cleanOperationName(operationId: string | undefined, summary: string | undefined, fallback: string): string {
  // 1. Summary is written for humans — always prefer it
  if (summary?.trim()) {
    const s = summary.trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  // 2. operationId — strip leading version prefix (v1, v2, V1, v1_, v1- …) then split camelCase
  if (operationId) {
    const stripped = operationId.replace(/^[vV]\d+[-_]?/, '');
    return stripped
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (c) => c.toUpperCase())
      .trim();
  }
  return fallback;
}

function firstServerUrl(spec: OASpec): string {
  const url = spec.servers?.[0]?.url?.replace(/\/$/, '') ?? '';
  // Strip localhost entries, prefer https
  const all = (spec.servers ?? []).map((s) => s.url?.replace(/\/$/, '') ?? '');
  return all.find((u) => u.startsWith('https://')) ?? url;
}

function resolveScheme(schemeName: string, scheme: OASecurityScheme): ParsedSecurityScheme {
  if (scheme.type === 'http' && scheme.scheme?.toLowerCase() === 'bearer') {
    return { name: schemeName, headerKey: 'Authorization', headerValueHint: `Bearer {{${toParamName(schemeName)}}}` };
  }
  if (scheme.type === 'apiKey' && scheme.in === 'header' && scheme.name) {
    return { name: schemeName, headerKey: scheme.name, headerValueHint: `{{${toParamName(schemeName)}}}` };
  }
  // oauth2, openIdConnect — treat as bearer
  if (scheme.type === 'oauth2' || scheme.type === 'openIdConnect') {
    return { name: schemeName, headerKey: 'Authorization', headerValueHint: `Bearer {{${toParamName(schemeName)}}}` };
  }
  return { name: schemeName, headerKey: 'Authorization', headerValueHint: `Bearer {{${toParamName(schemeName)}}}` };
}

function toParamName(s: string): string {
  // "AutomationKey" → "automation_key", "FirebaseToken" → "firebase_token"
  return s.replace(/([A-Z])/g, (m, c, i) => (i === 0 ? c.toLowerCase() : '_' + c.toLowerCase()));
}

function oaTypeToParam(type?: string): 'string' | 'number' | 'boolean' {
  if (type === 'integer' || type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  return 'string';
}

function buildBodyTemplate(schema?: OASchema): string {
  if (!schema?.properties) return '';
  const obj: Record<string, string> = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    obj[key] = `{{${key}}}`;
    void prop;
  }
  return JSON.stringify(obj, null, 2);
}

function operationSecuritySchemeNames(
  operation: OAOperation,
  globalSchemes: string[]
): string[] {
  if (operation.security) {
    return operation.security.flatMap((s) => Object.keys(s));
  }
  // If no operation-level security, inherit global (none in this simplified model)
  return globalSchemes;
}

// ─── Main export ───────────────────────────────────────────────────────────────

export function parseOpenApiSpec(raw: unknown): ParseOpenApiResult {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid spec: expected a JSON object.');

  const spec = raw as OASpec;
  const title = spec.info?.title ?? 'Imported API';
  const baseUrl = firstServerUrl(spec);

  if (!spec.paths || typeof spec.paths !== 'object') {
    throw new Error('No paths found in spec.');
  }

  // Parse security schemes
  const schemeMap = spec.components?.securitySchemes ?? {};
  const securitySchemes: ParsedSecurityScheme[] = Object.entries(schemeMap).map(
    ([name, scheme]) => resolveScheme(name, scheme)
  );

  const endpoints: ParsedEndpoint[] = [];

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;

    for (const method of HTTP_METHODS) {
      const operation = (pathItem as OAPathItem)[method];
      if (!operation) continue;

      const operationKey = `${method.toUpperCase()} ${path}`;
      const name = cleanOperationName(operation.operationId, operation.summary, operationKey);

      // Use the richer `description` field when available; summary is the short title
      const description = (operation.description ?? operation.summary ?? '').trim();

      // Build endpoint URL — replace {paramName} with {{paramName}} for Lumxia placeholders
      const endpointPath = path.replace(/\{(\w+)\}/g, '{{$1}}');
      const endpoint = baseUrl + endpointPath;

      // Path + query params → IntegrationParameter[]
      const pathQueryParams = (operation.parameters ?? [])
        .filter((p) => p.in === 'path' || p.in === 'query')
        .map((p) => ({
          name: p.name ?? '',
          type: oaTypeToParam(p.schema?.type),
          description: p.description ?? '',
          required: p.required ?? p.in === 'path',
          testValue: '',
        }))
        .filter((p) => p.name);

      // Body params from requestBody schema
      const bodySchema =
        operation.requestBody?.content?.['application/json']?.schema ??
        (Object.values(operation.requestBody?.content ?? {})[0] as { schema?: OASchema } | undefined)?.schema;

      const bodyParams = bodySchema?.properties
        ? Object.entries(bodySchema.properties).map(([key, prop]) => ({
            name: key,
            type: oaTypeToParam(prop?.type),
            description: prop?.description ?? '',
            required: (bodySchema.required ?? []).includes(key),
            testValue: prop?.example != null ? String(prop.example) : '',
          }))
        : [];

      const parameters = [...pathQueryParams, ...bodyParams];
      const bodyTemplate = method !== 'get' && method !== 'delete' ? buildBodyTemplate(bodySchema) : '';

      const schemeNames = operationSecuritySchemeNames(operation, []);

      endpoints.push({
        operationKey,
        name,
        description,
        endpoint,
        method: method.toUpperCase(),
        paramCount: parameters.length,
        securitySchemeNames: schemeNames,
        importEntry: {
          name,
          description,
          endpoint,
          method: method.toUpperCase(),
          headers: [],  // populated later from connection
          bodyTemplate,
          parameters,
          enabled: true,
        },
      });
    }
  }

  if (endpoints.length === 0) {
    throw new Error('No endpoints found in spec.');
  }

  return { title, baseUrl, endpoints, securitySchemes };
}
