/*
# Add full-text search to knowledge chunks

1. Changes
- Add `search_vector` generated tsvector column to `knowledge_chunks`, automatically computed from the `content` column.
- Add a GIN index on `search_vector` for fast full-text retrieval.
- Add `search_knowledge_chunks` RPC function that accepts a query string and returns ranked matching chunks with their source document names.

2. Security
- The RPC function uses SECURITY INVOKER, so it respects the RLS policies already configured on both tables.
- The anon and authenticated roles already have SELECT access to knowledge_chunks and knowledge_documents.
- Explicit GRANT EXECUTE is added for anon and authenticated roles.

3. Important Notes
- The `search_vector` column is STORED and GENERATED ALWAYS, so it is automatically maintained by PostgreSQL whenever `content` changes.
- The RPC function uses `websearch_to_tsquery` which supports natural-language search queries.
- Results are ranked by `ts_rank` and limited to the requested match count.
*/

ALTER TABLE public.knowledge_chunks
ADD COLUMN IF NOT EXISTS search_vector tsvector
GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX IF NOT EXISTS knowledge_chunks_search_idx
ON public.knowledge_chunks USING GIN (search_vector);

CREATE OR REPLACE FUNCTION public.search_knowledge_chunks(query_text text, match_count int DEFAULT 5)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  chunk_index int,
  metadata jsonb,
  rank real,
  document_name text
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    kc.id,
    kc.document_id,
    kc.content,
    kc.chunk_index,
    kc.metadata,
    ts_rank(kc.search_vector, websearch_to_tsquery('english', query_text))::real AS rank,
    kd.name
  FROM public.knowledge_chunks kc
  JOIN public.knowledge_documents kd ON kd.id = kc.document_id
  WHERE kc.search_vector @@ websearch_to_tsquery('english', query_text)
  ORDER BY rank DESC
  LIMIT GREATEST(match_count, 1);
$$;

GRANT EXECUTE ON FUNCTION public.search_knowledge_chunks(text, int) TO anon, authenticated;