import type { Chunk } from './types';
import { getAllChunks, getDocs } from './db';

export interface SearchResult {
  chunk: Chunk;
  docName: string;
  score: number;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'this', 'that',
  'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which',
  'who', 'whom', 'whose', 'when', 'where', 'why', 'how', 'all', 'any', 'each',
  'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
  'own', 'same', 'so', 'than', 'too', 'very', 'just', 'of', 'in', 'on', 'at',
  'to', 'for', 'with', 'about', 'as', 'by', 'from', 'up', 'down', 'out', 'if',
  'then', 'there', 'here', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
  'me', 'him', 'us', 'them', 'am', 'get', 'got', 'put', 'use', 'using', 'used',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  return tf;
}

export async function searchKnowledge(
  query: string,
  maxResults = 3,
  minScore = 0.12,
): Promise<SearchResult[]> {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const allChunks = await getAllChunks();
  if (allChunks.length === 0) return [];

  const docs = await getDocs();
  const docMap = new Map(docs.map((d) => [d.id, d.name]));

  // Build document frequency (df) across all chunks for IDF weighting
  const df = new Map<string, number>();
  for (const chunk of allChunks) {
    const seen = new Set(tokenize(chunk.content));
    for (const t of seen) df.set(t, (df.get(t) || 0) + 1);
  }
  const N = allChunks.length;

  // Compute query TF-IDF vector
  const queryTf = termFrequency(queryTokens);
  const queryVec = new Map<string, number>();
  for (const [term, freq] of queryTf) {
    const idf = Math.log((N + 1) / ((df.get(term) || 0) + 1)) + 1;
    queryVec.set(term, freq * idf);
  }
  const queryNorm = Math.sqrt([...queryVec.values()].reduce((s, v) => s + v * v, 0)) || 1;

  const scored: SearchResult[] = [];
  for (const chunk of allChunks) {
    const chunkTokens = tokenize(chunk.content);
    const chunkTf = termFrequency(chunkTokens);
    const chunkVec = new Map<string, number>();
    for (const [term, freq] of chunkTf) {
      const idf = Math.log((N + 1) / ((df.get(term) || 0) + 1)) + 1;
      chunkVec.set(term, freq * idf);
    }
    const chunkNorm = Math.sqrt([...chunkVec.values()].reduce((s, v) => s + v * v, 0)) || 1;

    // Cosine similarity
    let dot = 0;
    for (const [term, qv] of queryVec) {
      const cv = chunkVec.get(term);
      if (cv) dot += qv * cv;
    }
    const score = dot / (queryNorm * chunkNorm);
    if (score >= minScore) {
      scored.push({ chunk, docName: docMap.get(chunk.docId) || 'Unknown', score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults);
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);
}

function scoreSentence(sentence: string, queryTokens: string[]): number {
  const sentTokens = new Set(tokenize(sentence));
  let matches = 0;
  for (const qt of queryTokens) {
    if (sentTokens.has(qt)) matches++;
  }
  return matches / Math.max(queryTokens.length, 1);
}

export async function ragQuery(
  query: string,
): Promise<{ answer: string; citations: string[]; grounded: boolean }> {
  const results = await searchKnowledge(query, 3, 0.12);

  if (results.length === 0) {
    return {
      answer: "I don't know. That information is not available in the provided knowledge base.",
      citations: [],
      grounded: false,
    };
  }

  const queryTokens = tokenize(query);
  const citations = [...new Set(results.map((r) => r.docName))];

  // Extract the most relevant sentences from the top chunks
  const candidateSentences: { text: string; score: number; docName: string }[] = [];
  for (const r of results) {
    const sentences = splitSentences(r.chunk.content);
    for (const s of sentences) {
      const sScore = scoreSentence(s, queryTokens);
      if (sScore > 0) {
        candidateSentences.push({ text: s, score: sScore * r.score, docName: r.docName });
      }
    }
  }

  candidateSentences.sort((a, b) => b.score - a.score);

  const topSentences = candidateSentences.slice(0, 3);

  let answer: string;
  if (topSentences.length > 0) {
    const body = topSentences.map((s) => s.text).join(' ');
    const trimmed = body.length > 600 ? body.slice(0, 600).trim() + '...' : body;
    answer = trimmed;
  } else {
    // Fallback to top chunk content if no sentence-level match
    const context = results[0].chunk.content;
    const snippet = context.length > 500 ? context.slice(0, 500) + '...' : context;
    answer = snippet;
  }

  return { answer, citations, grounded: true };
}
