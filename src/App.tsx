import { useEffect, useState, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import KnowledgeView from './components/KnowledgeView';
import SettingsView from './components/SettingsView';
import { getDocs, getConversations, saveConversation, deleteConversation } from './lib/db';
import { ingestDocument, removeDocument, genId } from './lib/documents';
import { ragQuery } from './lib/rag';
import type { KnowledgeDoc, Conversation, Message, View } from './lib/types';

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  content: "Hello, I'm Atlas. Ask me anything about your company knowledge base and I'll cite the source I used.",
  citations: [],
  grounded: true,
  timestamp: Date.now(),
};

export default function App() {
  const [view, setView] = useState<View>('chat');
  const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);

  const loadDocuments = useCallback(async () => {
    try {
      setDocuments(await getDocs());
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const convs = await getConversations();
      setConversations(convs);
      if (convs.length > 0) {
        setActiveConversationId(convs[0].id);
        setMessages(convs[0].messages);
      } else {
        handleNewChat();
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      handleNewChat();
    }
  }, []);

  const persistConversation = useCallback(async (conv: Conversation) => {
    await saveConversation(conv);
    setConversations((prev) => {
      const exists = prev.find((c) => c.id === conv.id);
      if (exists) return prev.map((c) => (c.id === conv.id ? conv : c)).sort((a, b) => b.updatedAt - a.updatedAt);
      return [conv, ...prev].sort((a, b) => b.updatedAt - a.updatedAt);
    });
  }, []);

  const handleNewChat = useCallback(async () => {
    const conv: Conversation = {
      id: genId(),
      title: 'New support conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [WELCOME],
    };
    await saveConversation(conv);
    setConversations((prev) => [conv, ...prev]);
    setActiveConversationId(conv.id);
    setMessages([WELCOME]);
  }, []);

  const selectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    const conv = conversations.find((c) => c.id === id);
    if (conv) setMessages(conv.messages);
  }, [conversations]);

  useEffect(() => {
    void loadDocuments();
    void loadConversations();
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      if (!activeConversationId || sending) return;
      const userMsg: Message = {
        id: genId(),
        role: 'user',
        content: text,
        citations: [],
        grounded: true,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setSending(true);

      try {
        const result = await ragQuery(text);
        const assistantMsg: Message = {
          id: genId(),
          role: 'assistant',
          content: result.answer,
          citations: result.citations,
          grounded: result.grounded,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);

        const conv = conversations.find((c) => c.id === activeConversationId);
        if (conv) {
          const updatedConv: Conversation = {
            ...conv,
            title: conv.messages.length <= 1 ? text.slice(0, 40) : conv.title,
            messages: [...conv.messages, userMsg, assistantMsg],
            updatedAt: Date.now(),
          };
          await persistConversation(updatedConv);
        }
      } catch (err) {
        const errorMsg: Message = {
          id: genId(),
          role: 'assistant',
          content: 'Something went wrong while processing your request. Please try again.',
          citations: [],
          grounded: false,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setSending(false);
      }
    },
    [activeConversationId, sending, conversations, persistConversation],
  );

  const handleUpload = useCallback(
    async (file: File) => {
      await ingestDocument(file, (updatedDoc) => {
        setDocuments((prev) => {
          const exists = prev.find((d) => d.id === updatedDoc.id);
          if (exists) return prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d));
          return [updatedDoc, ...prev];
        });
      });
      await loadDocuments();
    },
    [loadDocuments],
  );

  const handleDeleteDoc = useCallback(
    async (id: string) => {
      await removeDocument(id);
      await loadDocuments();
    },
    [loadDocuments],
  );

  const handleExport = useCallback(() => {
    const lines = messages.map((m) => `[${m.role.toUpperCase()}] ${m.content}`);
    const blob = new Blob([lines.join('\n\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${activeConversationId || 'export'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, activeConversationId]);

  const handleClearAll = useCallback(async () => {
    for (const conv of conversations) {
      await deleteConversation(conv.id);
    }
    setConversations([]);
    await handleNewChat();
  }, [conversations, handleNewChat]);

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        setView={setView}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={selectConversation}
        onNewChat={handleNewChat}
        docCount={documents.length}
      />
      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              {view === 'chat' ? 'AI SUPPORT AGENT' : view === 'knowledge' ? 'CONTENT MANAGEMENT' : 'WORKSPACE'}
            </p>
            <h1>{view === 'chat' ? 'Ask Atlas' : view === 'knowledge' ? 'Knowledge base' : 'Settings'}</h1>
          </div>
          <div className="top-actions">
            <span className="status-pill">
              <i />
              System operational
            </span>
          </div>
        </header>
        {view === 'chat' && (
          <ChatView
            messages={messages}
            sending={sending}
            onSend={handleSend}
            onExport={handleExport}
            hasDocuments={documents.some((d) => d.status === 'ready')}
          />
        )}
        {view === 'knowledge' && (
          <KnowledgeView documents={documents} onUpload={handleUpload} onDelete={handleDeleteDoc} />
        )}
        {view === 'settings' && (
          <SettingsView
            docCount={documents.length}
            conversationCount={conversations.length}
            onClearAll={handleClearAll}
          />
        )}
      </main>
    </div>
  );
}
