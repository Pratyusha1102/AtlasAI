# API Reference

Atlas Support AI has two layers:

1. **Client-side RAG (default)** — runs entirely in the browser against IndexedDB. No network calls.
2. **Optional backend services** — a FastAPI reference service and a Supabase Edge Function for production-grade ingestion and LLM-backed generation.

---

## Client-side RAG (default)

These functions live in `src/lib/` and power the in-browser experience.

### Document ingestion (`src/lib/documents.ts`)

#### `ingestDocument(file: File, onProgress?: (doc: KnowledgeDoc) => void): Promise<KnowledgeDoc>`
Parses a PDF, DOCX, or TXT file, splits the extracted text into overlapping chunks, and persists the document and chunks to IndexedDB. Calls `onProgress` with status updates (`processing` → `ready` | `error`).

| Param | Type | Description |
| --- | --- | --- |
| `file` | `File` | The uploaded file. Must be `.pdf`, `.docx`, or `.txt`. |
| `onProgress` | `(doc) => void` | Optional callback for status updates. |

**Returns:** the final `KnowledgeDoc` record with `status` and `chunkCount`.

#### `removeDocument(id: string): Promise<void>`
Deletes a document and all of its associated chunks from IndexedDB.

### Retrieval (`src/lib/rag.ts`)

#### `searchKnowledge(query: string, maxResults?: number): Promise<SearchResult[]>`
Tokenizes the query and scores every stored chunk by token-overlap similarity.

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| `query` | `string` | — | The user's question. |
| `maxResults` | `number` | `3` | Maximum number of chunks to return. |

**Returns:** an array of `SearchResult` (`{ chunk, docName, score }`) sorted by descending score.

#### `ragQuery(query: string): Promise<{ answer: string; citations: string[]; grounded: boolean }>`
The main RAG entry point. Searches the knowledge base and either returns a grounded answer with citations or the strict fallback.

**Fallback response (exact):**
```
I don't know. That information is not available in the provided knowledge base.
```

### Persistence (`src/lib/db.ts`)

| Function | Description |
| --- | --- |
| `saveDoc(doc)` | Insert/update a document record. |
| `getDocs()` | List all documents. |
| `deleteDoc(id)` | Delete a document and its chunks. |
| `saveChunks(chunks)` | Store text chunks. |
| `getAllChunks()` | Retrieve every chunk (used by retrieval). |
| `saveConversation(conv)` | Insert/update a conversation. |
| `getConversations()` | List conversations, newest first. |
| `deleteConversation(id)` | Delete a conversation. |

---

## Optional FastAPI backend (`backend/app/main.py`)

Base URL: `http://localhost:8000`

### `POST /ingest`
Upload a document for server-side ingestion.

**Request:** `multipart/form-data` with a `file` field.
Accepts `.pdf`, `.docx`, and `.txt`.

**Response (200):**
```json
{
  "id": "uuid",
  "name": "policy.pdf",
  "file_type": "PDF",
  "file_size": 102400,
  "status": "ready",
  "chunk_count": 12
}
```

**Errors:**
- `400` — unsupported file type
- `422` — document contains no readable text

### `POST /chat`
Ask a question against the server-side knowledge base.

**Request:**
```json
{
  "conversation_id": "uuid",
  "message": "What is your refund policy?"
}
```

**Response:**
```json
{
  "answer": "Based on the knowledge base...",
  "citations": ["policy.pdf"],
  "grounded": true
}
```

When no relevant chunks are found:
```json
{
  "answer": "I don't know based on the current knowledge base.",
  "citations": [],
  "grounded": false
}
```

### `GET /docs`
Interactive Swagger UI for the FastAPI service.

### `GET /openapi.json`
Machine-readable OpenAPI spec.

---

## Optional Supabase Edge Function (`support-ai`)

**Endpoint:** `POST https://<project>.functions.supabase.co/support-ai`

**Request body:**
```json
{
  "message": "What is your refund policy?",
  "conversation_id": "uuid"
}
```

**Response (200):**
```json
{
  "answer": "Based on your knowledge base...",
  "citations": ["policy.pdf"],
  "grounded": true
}
```

The function runs full-text search against the `knowledge_chunks` table via the `search_knowledge_chunks` RPC, falls back to a safe "I don't know" message when no results are found, and persists the assistant message to `support_messages`.

---

## Data Model

| Table / Store | Purpose |
| --- | --- |
| `documents` (IndexedDB) | Document metadata: id, name, type, size, status, chunk count. |
| `chunks` (IndexedDB) | Text chunks tied to a document id. |
| `conversations` (IndexedDB) | Conversation sessions with full message history. |
| `knowledge_documents` (Supabase) | Server-side document records. |
| `knowledge_chunks` (Supabase) | Server-side chunks with full-text search. |
| `support_conversations` (Supabase) | Server-side conversation sessions. |
| `support_messages` (Supabase) | Server-side persisted messages. |
