# DocuSense AI - Multi-Tenant Knowledge Platform

DocuSense AI is a secure, multi-tenant workspace where organizations can upload their proprietary documents and interact with them using Retrieval-Augmented Generation (RAG).

## How to push to GitHub

If you are seeing "nothing to commit", it means you haven't staged your changes yet. Follow these exact steps in your terminal:

1. **Stage all changes (CRITICAL STEP)**:
   ```bash
   git add .
   ```

2. **Commit the changes**:
   ```bash
   git commit -m "Complete DocuSense AI prototype"
   ```

3. **Push to your repository**:
   ```bash
   git push origin main
   ```

## Features

- **Secure Multi-Tenancy**: Data is strictly isolated by `tenantId`.
- **Document Indexing**: Upload PDF, TXT, CSV, or DOCX files for AI analysis.
- **AI Chat**: Grounded answers with real-time citations from your uploaded documents.
- **Admin Dashboard**: Manage your tenant's knowledge base and user roles.

## Tech Stack

- **Framework**: Next.js (App Router)
- **AI Engine**: Genkit with Google Gemini 1.5 Flash
- **Styling**: Tailwind CSS & ShadCN UI
- **State**: Zustand with Persistence
