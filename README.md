# DocuSense AI - Multi-Tenant Knowledge Platform

DocuSense AI is a secure, multi-tenant workspace where organizations can upload their proprietary documents and interact with them using Retrieval-Augmented Generation (RAG).

## Features

- **Secure Multi-Tenancy**: Data is strictly isolated by `tenantId`.
- **Document Indexing**: Upload PDF, TXT, CSV, or DOCX files for AI analysis.
- **AI Chat**: Grounded answers with real-time citations from your uploaded documents.
- **Admin Dashboard**: Manage your tenant's knowledge base and user roles.

## Getting Started

1. **Login**: Enter a `Tenant ID` (e.g., `tenant-123`) and your email.
2. **Upload**: Go to **Documents** (as Admin) and upload your business files.
3. **Chat**: Go to **AI Chat** and ask questions like "What are our company policies?" or "Summarize the uploaded reports."

## How to push to GitHub

If you are seeing "nothing to commit", ensure you stage your files first:

```bash
# 1. Stage all changes (REQUIRED before committing)
git add .

# 2. Commit the changes
git commit -m "Complete DocuSense AI prototype"

# 3. Push to your repository
git push origin main
```

## Tech Stack

- **Framework**: Next.js (App Router)
- **AI Engine**: Genkit with Google Gemini 1.5 Flash
- **Styling**: Tailwind CSS & ShadCN UI
- **State**: Zustand with Persistence
