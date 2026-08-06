# Atlas Support AI

An **Intelligent Customer Support AI Assistant** single-page application that lets a team upload company documents (PDF, DOCX, TXT) into a knowledge base and then ask questions about them. Answers are grounded strictly in the uploaded content and cite their source documents. When an answer cannot be found in the knowledge base, Atlas responds with an explicit safe fallback instead of hallucinating.

## Features

### Knowledge Base (Document Management)
- Drag-and-drop or click-to-upload dropzone supporting **PDF, DOCX, and TXT** files.
- Uploaded files are listed with **"Ready" status badges**, file size, chunk count, and a working **delete** button.
- Files and their extracted text chunks are persisted in **IndexedDB**, so they survive page refreshes.
- A search bar filters the document list by name.

### Chat Interface & RAG Logic
- A chat window where users ask questions in natural language.
- **Client-side RAG**: when a message is sent, Atlas tokenizes the query and searches the text chunks of every uploaded document.
- If a matching context is found, Atlas returns a grounded answer and cites the source document(s).
- **Strict fallback**: if no matching context is found, Atlas responds exactly:
  > I don't know. That information is not available in the provided knowledge base.

### Workspace Navigation & History
- Sidebar navigation with three working tabs: **Ask Atlas** (chat), **Knowledge base** (files), and **Settings**.
- A **New chat** button creates a fresh conversation session and clears the active chat window.
- Conversation history is saved per session and persisted across refreshes.
- Conversations can be exported as a text file from the chat view.
- Settings page shows workspace stats and lets administrators clear all conversations.

## Tech Stack

| Layer | Technology |
| --- | --- |
| UI | React + TypeScript + Vite |
| Styling | Hand-written CSS (DM Sans / Space Grotesk) |
| Document parsing | `pdfjs-dist` (PDF), `mammoth` (DOCX), native (TXT) |
| Persistence | IndexedDB (documents, chunks, conversations) |
| Optional backend | FastAPI reference service + Supabase Edge Function |

## Project Structure

```text
.
├── src/
│   ├── components/        # ChatView, KnowledgeView, SettingsView, Sidebar, Icon
│   ├── lib/              # db (IndexedDB), documents (ingest), rag (search), types
│   ├── App.tsx           # Root component, state, and event handlers
│   ├── main.tsx          # React entry point
│   └── styles.css        # Application styles
├── backend/app/main.py    # FastAPI RAG reference service
├── supabase/functions/support-ai/index.ts  # Edge function AI proxy
├── supabase/migrations/   # Database schema migrations
├── docs/                  # API and architecture documentation
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── requirements.txt
```

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- (Optional) Python 3.10+ and pip — only if running the backend RAG service

### Install and run the interface

```bash
npm install
npm run dev
```

The app runs entirely in the browser. Upload a document in the **Knowledge base** tab, switch to **Ask Atlas**, and ask a question about the content.

### (Optional) Run the backend RAG service

The frontend works standalone with client-side RAG. A FastAPI reference service is included for production-grade ingestion and LLM-backed generation.

```bash
pip install -r requirements.txt
uvicorn backend.app.main:app --reload
```

Copy `.env.example` to `.env` and fill in the Supabase URL, Supabase service role key, and LLM provider key. Never expose provider keys in the browser.

## How RAG Works

1. **Ingestion** — Uploaded files are parsed (PDF via pdfjs, DOCX via mammoth, TXT natively), normalized, and split into overlapping text chunks (~900 chars, 120 overlap).
2. **Storage** — Documents and chunks are stored in IndexedDB under the `atlas-support-ai` database.
3. **Retrieval** — On each question, the query is tokenized and scored against every chunk using token-overlap similarity. The top matches are selected.
4. **Generation** — A grounded answer is composed from the top matching chunk and the source document is cited.
5. **Fallback** — If no chunk matches any query token, Atlas returns the strict "I don't know" fallback.

## Guardrails

- Retrieval is performed before any answer is composed.
- Answers only use content found in uploaded documents.
- A score threshold prevents weak matches from being treated as grounded.
- Conversation history is persisted for context but is never treated as a knowledge source.
- Provider secrets are kept server-side only.

## Deployment

This is a static SPA built with Vite. Build and deploy the `dist/` folder to any static host.

### Build for production

```bash
npm run build
npm run preview   # preview the production build locally
```

### Deploy to Vercel / Netlify / Cloudflare Pages
- Build command: `npm run build`
- Output directory: `dist`
- No server-side runtime is required for the standalone SPA.

### Deploy the backend (optional)
- The FastAPI service can be deployed to any Python-capable host (Render, Railway, Fly.io, etc.).
- The Supabase Edge Function is deployed via the Supabase MCP tooling or dashboard.

## Repository

This project is structured for immediate GitHub readiness:
- A `.gitignore` is included for Node, Python, and editor artifacts.
- Initialize a repository and push with:

```bash
git init
git add .
git commit -m "Initial commit: Atlas Support AI"
git branch -M main
git remote add origin <https://github.com/Pratyusha1102/AtlasAI>
git push -u origin main
```

## Documentation
- [API Reference](docs/API.md)
- [Architecture](docs/ARCHITECTURE.md)

## License

Provided as-is for evaluation and internal use.
