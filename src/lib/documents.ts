import type { Chunk, KnowledgeDoc } from './types';
import { saveChunks, saveDoc, deleteDoc as deleteDocDB } from './db';

function chunkText(text: string, size = 900, overlap = 120): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const result: string[] = [];
  for (let i = 0; i < normalized.length; i += size - overlap) {
    const chunk = normalized.slice(i, i + size);
    if (chunk.trim()) result.push(chunk);
    if (i + size >= normalized.length) break;
  }
  return result;
}

async function parsePdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mrl', import.meta.url);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.href;
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item: unknown) => {
      const ti = item as { str?: string };
      return ti.str || '';
    }).join(' ') + '\n';
  }
  return text;
}

async function parseDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth/mammoth.browser');
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value as string;
}

function parseTxt(file: File): Promise<string> {
  return file.text();
}

export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export async function ingestDocument(
  file: File,
  onProgress?: (doc: KnowledgeDoc) => void,
): Promise<KnowledgeDoc> {
  const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
  const doc: KnowledgeDoc = {
    id: genId(),
    name: file.name,
    fileType: ext,
    fileSize: file.size,
    status: 'processing',
    chunkCount: 0,
    uploadedAt: Date.now(),
  };
  await saveDoc(doc);
  onProgress?.(doc);

  let text = '';
  try {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.pdf')) text = await parsePdf(file);
    else if (lower.endsWith('.docx')) text = await parseDocx(file);
    else text = await parseTxt(file);
  } catch {
    const errorDoc: KnowledgeDoc = { ...doc, status: 'error' };
    await saveDoc(errorDoc);
    onProgress?.(errorDoc);
    throw new Error('Failed to parse file content');
  }

  const parts = chunkText(text);
  if (parts.length === 0) {
    const errorDoc: KnowledgeDoc = { ...doc, status: 'error' };
    await saveDoc(errorDoc);
    onProgress?.(errorDoc);
    throw new Error('Document contains no readable text');
  }

  const chunks: Chunk[] = parts.map((content, index) => ({
    id: genId(),
    docId: doc.id,
    content,
    index,
  }));
  await saveChunks(chunks);

  const readyDoc: KnowledgeDoc = { ...doc, status: 'ready', chunkCount: parts.length };
  await saveDoc(readyDoc);
  onProgress?.(readyDoc);
  return readyDoc;
}

export async function removeDocument(id: string): Promise<void> {
  await deleteDocDB(id);
}
