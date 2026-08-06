import { ChangeEvent, useRef, useState } from 'react';
import Icon from './Icon';
import type { KnowledgeDoc } from '../lib/types';

type KnowledgeViewProps = {
  documents: KnowledgeDoc[];
  onUpload: (file: File) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function KnowledgeView({ documents, onUpload, onDelete }: KnowledgeViewProps) {
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = documents.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()));

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
  }

  async function processFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      await onUpload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void processFile(file);
  }

  async function handleDelete(id: string) {
    setMenuOpenId(null);
    try {
      await onDelete(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <section className="knowledge-view">
      <div className="knowledge-toolbar">
        <div className="search">
          <Icon name="search" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents..." />
        </div>
        <label className="upload-button">
          <Icon name="upload" /> {uploading ? 'Processing...' : 'Add documents'}
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
      {error && (
        <div className="error-banner">
          <Icon name="alert" />{error}
          <button onClick={() => setError(null)} type="button"><Icon name="close" /></button>
        </div>
      )}
      <div
        className={dragOver ? 'dropzone active' : 'dropzone'}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Icon name="upload" />
        <p><strong>Drop files here or click to upload</strong></p>
        <span>Supports PDF, DOCX, and TXT files</span>
      </div>
      <div className="knowledge-card">
        <div className="table-heading">
          <div>
            <h2>All documents</h2>
            <p>Manage the sources Atlas uses to answer questions.</p>
          </div>
          <span>{filtered.length} sources</span>
        </div>
        {filtered.length > 0 ? (
          <div className="document-list">
            {filtered.map((doc) => (
              <div className="document-row" key={doc.id}>
                <div className="file-icon">{doc.fileType}</div>
                <div className="document-name">
                  <strong>{doc.name}</strong>
                  <span>{formatSize(doc.fileSize)} · {doc.chunkCount || '—'} chunks</span>
                </div>
                <span className={doc.status === 'ready' ? 'ready-status' : doc.status === 'error' ? 'error-status' : 'processing-status'}>
                  <i />{doc.status}
                </span>
                <span className="document-date">{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                <div className="row-menu">
                  <button className="more" type="button" onClick={() => setMenuOpenId(menuOpenId === doc.id ? null : doc.id)}>•••</button>
                  {menuOpenId === doc.id && (
                    <div className="menu-dropdown">
                      <button type="button" onClick={() => void handleDelete(doc.id)}><Icon name="trash" />Delete</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Icon name="book" />
            <h3>{query ? 'No matching documents' : 'Your knowledge base is empty'}</h3>
            <p>{query ? 'Try a different search term.' : 'Upload PDFs, DOCX, or TXT files to give Atlas trusted answers.'}</p>
          </div>
        )}
      </div>
    </section>
  );
}
