/*
# Create support AI data model

1. New Tables
- `knowledge_documents`: uploaded source files and ingestion status.
- `knowledge_chunks`: searchable text chunks with vector embeddings and source metadata.
- `support_conversations`: customer support threads.
- `support_messages`: user and assistant turns inside a conversation.

2. Security
- Row Level Security is enabled on every table.
- This is a single-tenant workspace without sign-in, so anon and authenticated roles may use the shared workspace.
- Four explicit CRUD policies are provided per table.

3. Important Notes
- Embeddings use 1536 dimensions for compatibility with common OpenAI embedding models.
- Foreign keys cascade child records when a source document or conversation is removed.
*/

create extension if not exists vector;

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  file_type text not null,
  file_size bigint not null default 0,
  status text not null default 'ready',
  chunk_count integer not null default 0,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  content text not null,
  chunk_index integer not null,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'New support conversation',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_chunks_document_id_idx on public.knowledge_chunks(document_id);
create index if not exists support_messages_conversation_id_idx on public.support_messages(conversation_id, created_at);

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "Shared workspace can read documents" on public.knowledge_documents;
create policy "Shared workspace can read documents" on public.knowledge_documents for select to anon, authenticated using (true);
drop policy if exists "Shared workspace can insert documents" on public.knowledge_documents;
create policy "Shared workspace can insert documents" on public.knowledge_documents for insert to anon, authenticated with check (true);
drop policy if exists "Shared workspace can update documents" on public.knowledge_documents;
create policy "Shared workspace can update documents" on public.knowledge_documents for update to anon, authenticated using (true) with check (true);
drop policy if exists "Shared workspace can delete documents" on public.knowledge_documents;
create policy "Shared workspace can delete documents" on public.knowledge_documents for delete to anon, authenticated using (true);

drop policy if exists "Shared workspace can read chunks" on public.knowledge_chunks;
create policy "Shared workspace can read chunks" on public.knowledge_chunks for select to anon, authenticated using (true);
drop policy if exists "Shared workspace can insert chunks" on public.knowledge_chunks;
create policy "Shared workspace can insert chunks" on public.knowledge_chunks for insert to anon, authenticated with check (true);
drop policy if exists "Shared workspace can update chunks" on public.knowledge_chunks;
create policy "Shared workspace can update chunks" on public.knowledge_chunks for update to anon, authenticated using (true) with check (true);
drop policy if exists "Shared workspace can delete chunks" on public.knowledge_chunks;
create policy "Shared workspace can delete chunks" on public.knowledge_chunks for delete to anon, authenticated using (true);

drop policy if exists "Shared workspace can read conversations" on public.support_conversations;
create policy "Shared workspace can read conversations" on public.support_conversations for select to anon, authenticated using (true);
drop policy if exists "Shared workspace can insert conversations" on public.support_conversations;
create policy "Shared workspace can insert conversations" on public.support_conversations for insert to anon, authenticated with check (true);
drop policy if exists "Shared workspace can update conversations" on public.support_conversations;
create policy "Shared workspace can update conversations" on public.support_conversations for update to anon, authenticated using (true) with check (true);
drop policy if exists "Shared workspace can delete conversations" on public.support_conversations;
create policy "Shared workspace can delete conversations" on public.support_conversations for delete to anon, authenticated using (true);

drop policy if exists "Shared workspace can read messages" on public.support_messages;
create policy "Shared workspace can read messages" on public.support_messages for select to anon, authenticated using (true);
drop policy if exists "Shared workspace can insert messages" on public.support_messages;
create policy "Shared workspace can insert messages" on public.support_messages for insert to anon, authenticated with check (true);
drop policy if exists "Shared workspace can update messages" on public.support_messages;
create policy "Shared workspace can update messages" on public.support_messages for update to anon, authenticated using (true) with check (true);
drop policy if exists "Shared workspace can delete messages" on public.support_messages;
create policy "Shared workspace can delete messages" on public.support_messages for delete to anon, authenticated using (true);