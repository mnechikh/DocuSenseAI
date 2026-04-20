import { NextResponse } from "next/server";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "Lumxia REST API",
    version: "1.0.0",
    description:
      "Query your AI-powered knowledge base and manage documents programmatically.\n\n" +
      "**Authentication:** All endpoints require an API key passed as a Bearer token.\n" +
      "Keys are managed from the [API Keys](/dashboard/api-keys) dashboard.",
  },
  servers: [{ url: "/api/v1", description: "Production" }],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: "Query", description: "Search and ask questions across indexed documents" },
    { name: "Documents", description: "List, ingest, inspect, and delete documents" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "lum_<32-hex>",
        description: "API key generated in the Lumxia dashboard. Format: `lum_<32 hex chars>`.",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string", example: "Invalid or missing API key." },
        },
      },
      Citation: {
        type: "object",
        properties: {
          documentName: { type: "string", example: "annual_report.pdf" },
          pageSection: { type: "string", example: "Section 3.2 — Revenue" },
        },
      },
      ExtractedMetadata: {
        type: "object",
        nullable: true,
        description: "AI-extracted structured metadata, populated after indexing.",
        properties: {
          documentType: { type: "string", example: "contract" },
          summary: { type: "string", example: "A service agreement between Acme Corp and Vendor Ltd." },
          keyEntities: {
            type: "object",
            properties: {
              dates: { type: "array", items: { type: "string" }, example: ["2024-01-01", "2025-12-31"] },
              amounts: { type: "array", items: { type: "string" }, example: ["$50,000", "€12,000"] },
              organizations: { type: "array", items: { type: "string" }, example: ["Acme Corp", "Vendor Ltd"] },
              people: { type: "array", items: { type: "string" }, example: ["Jane Doe", "John Smith"] },
              referenceNumbers: { type: "array", items: { type: "string" }, example: ["INV-2024-0042"] },
            },
          },
          topics: { type: "array", items: { type: "string" }, example: ["payment terms", "SLA", "indemnification"] },
          confidence: { type: "number", minimum: 0, maximum: 1, example: 0.92 },
        },
      },
      Document: {
        type: "object",
        properties: {
          id: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
          filename: { type: "string", example: "contract.pdf" },
          fileType: { type: "string", example: "application/pdf" },
          status: {
            type: "string",
            enum: ["uploaded", "processing", "indexed", "failed"],
            example: "indexed",
          },
          chunkCount: { type: "integer", nullable: true, example: 18 },
          processingMs: { type: "integer", nullable: true, example: 3420 },
          failureReason: { type: "string", nullable: true },
          timestamp: { type: "integer", description: "Unix epoch milliseconds", example: 1745000000000 },
          extractedMetadata: { $ref: "#/components/schemas/ExtractedMetadata" },
        },
      },
    },
  },
  paths: {
    "/query": {
      post: {
        tags: ["Query"],
        summary: "Query knowledge base",
        description:
          "Submit a natural-language question. Lumxia retrieves the most relevant chunks from your " +
          "indexed documents and generates a grounded answer with source citations.",
        operationId: "queryKnowledgeBase",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["query"],
                properties: {
                  query: {
                    type: "string",
                    maxLength: 2000,
                    description: "Natural-language question.",
                    example: "What are the payment terms in the service agreement?",
                  },
                  topK: {
                    type: "integer",
                    minimum: 1,
                    maximum: 20,
                    default: 10,
                    description: "Maximum number of document chunks to retrieve.",
                  },
                  chatHistory: {
                    type: "array",
                    description: "Prior conversation turns for multi-turn context.",
                    items: {
                      type: "object",
                      required: ["role", "content"],
                      properties: {
                        role: { type: "string", enum: ["user", "model"] },
                        content: { type: "string" },
                      },
                    },
                  },
                },
              },
              example: {
                query: "What is the termination clause?",
                topK: 5,
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Answer with citations",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    answer: { type: "string" },
                    citations: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Citation" },
                    },
                    hasContext: { type: "boolean" },
                  },
                },
                example: {
                  answer: "Either party may terminate with 30 days written notice.",
                  citations: [{ documentName: "contract.pdf", pageSection: "Section 12 — Termination" }],
                  hasContext: true,
                },
              },
            },
          },
          "400": {
            description: "Bad request — invalid body",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "401": {
            description: "Unauthorized — missing or invalid API key",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "500": {
            description: "Internal server error",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/documents": {
      get: {
        tags: ["Documents"],
        summary: "List documents",
        description: "Retrieve all documents for the authenticated tenant.",
        operationId: "listDocuments",
        responses: {
          "200": {
            description: "Document list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    documents: { type: "array", items: { $ref: "#/components/schemas/Document" } },
                    total: { type: "integer", example: 3 },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
      post: {
        tags: ["Documents"],
        summary: "Ingest a document",
        description:
          "Upload a document for AI indexing. Provide either a base64 `dataUri` or a remote `url`. " +
          "Indexing is asynchronous — poll `GET /documents/{id}` until `status` is `indexed`.",
        operationId: "ingestDocument",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["filename", "fileType"],
                properties: {
                  filename: { type: "string", example: "invoice_Q1.pdf" },
                  fileType: { type: "string", example: "application/pdf" },
                  dataUri: {
                    type: "string",
                    description: "Base64 data URI. Mutually exclusive with `url`.",
                    example: "data:application/pdf;base64,JVBERi0xLjQg...",
                  },
                  url: {
                    type: "string",
                    description: "HTTPS URL to fetch. Mutually exclusive with `dataUri`.",
                    example: "https://example.com/reports/q1.pdf",
                  },
                },
              },
            },
          },
        },
        responses: {
          "202": {
            description: "Document accepted for processing",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    documentId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                    status: { type: "string", example: "processing" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Bad request",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "401": {
            description: "Unauthorized",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/documents/{id}": {
      get: {
        tags: ["Documents"],
        summary: "Get document",
        description: "Retrieve a single document record by ID.",
        operationId: "getDocument",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Document ID",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Document record",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Document" } } },
          },
          "401": {
            description: "Unauthorized",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "404": {
            description: "Not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
      delete: {
        tags: ["Documents"],
        summary: "Delete document",
        description: "Permanently delete a document and all its indexed chunks.",
        operationId: "deleteDocument",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Document ID",
            schema: { type: "string" },
          },
        ],
        responses: {
          "204": { description: "Deleted successfully (no body)" },
          "401": {
            description: "Unauthorized",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "404": {
            description: "Not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
