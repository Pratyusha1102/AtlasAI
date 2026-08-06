export type View = 'chat' | 'knowledge' | 'settings';

export type DocStatus = 'processing' | 'ready' | 'error';

export interface KnowledgeDoc {
  id: string;
  name: string;
  fileType: string;
  fileSize: number;
  status: DocStatus;
  chunkCount: number;
  uploadedAt: number;
}

export interface Chunk {
  id: string;
  docId: string;
  content: string;
  index: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: string[];
  grounded: boolean;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}
