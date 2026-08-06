import { FormEvent, useRef, useEffect, useState } from 'react';
import Icon from './Icon';
import type { Message } from '../lib/types';

type ChatViewProps = {
  messages: Message[];
  sending: boolean;
  onSend: (message: string) => void;
  onExport: () => void;
  hasDocuments: boolean;
};

const samples = [
  'What is your refund policy?',
  'How do I reset my password?',
  'What are your support hours?',
];

export default function ChatView({ messages, sending, onSend, onExport, hasDocuments }: ChatViewProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    onSend(trimmed);
    setInput('');
  }

  return (
    <section className="chat-layout">
      <div className="chat-panel">
        <div className="conversation-meta">
          <div><span className="live-dot" /> Live assistant</div>
          <button className="export-btn" onClick={onExport} title="Export conversation">
            <Icon name="download" />Export
          </button>
        </div>
        <div className="messages" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="empty-chat">
              <Icon name="sparkles" />
              <h3>Start a conversation</h3>
              <p>{hasDocuments ? 'Ask a question and Atlas will search your knowledge base for the answer.' : 'Upload documents in the Knowledge base tab first, then ask questions about them here.'}</p>
            </div>
          )}
          {messages.map((msg) => (
            <div className={msg.role === 'user' ? 'message-row user-row' : 'message-row'} key={msg.id}>
              <div className={msg.role === 'assistant' ? 'bot-avatar' : 'user-avatar'}>
                {msg.role === 'assistant' ? 'A' : 'JD'}
              </div>
              <div className="message-content">
                <div className="message-author">
                  {msg.role === 'assistant' ? 'Atlas' : 'You'}
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="bubble">{msg.content}</div>
                {msg.citations.length > 0 && (
                  <div className="citations">
                    <span>Sources</span>
                    {msg.citations.map((citation) => (
                      <button key={citation} className="citation-pill" type="button">
                        <Icon name="link" />{citation}
                      </button>
                    ))}
                  </div>
                )}
                {msg.role === 'assistant' && !msg.grounded && (
                  <div className="fallback-badge">
                    <Icon name="alert" />Not grounded in knowledge base
                  </div>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="typing">
              <span /><span /><span /> Atlas is searching the knowledge base
            </div>
          )}
        </div>
        <div className="composer-wrap">
          {messages.length <= 1 && (
            <div className="suggestions">
              {samples.map((s) => (
                <button key={s} onClick={() => onSend(s)} disabled={sending} type="button">{s}</button>
              ))}
            </div>
          )}
          <form className="composer" onSubmit={submit}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your business..."
              disabled={sending}
            />
            <button type="submit" disabled={sending || !input.trim()}>
              <Icon name="send" />
            </button>
          </form>
          <p className="composer-note">Atlas only answers from verified sources in your knowledge base.</p>
        </div>
      </div>
      <aside className="insights">
        <div className="insight-heading">
          <div>
            <p className="eyebrow">OVERVIEW</p>
            <h2>Workspace health</h2>
          </div>
        </div>
        <div className="health-card">
          <div className="ring"><strong>{hasDocuments ? '98' : '—'}</strong><span>%</span></div>
          <div>
            <strong>Answer confidence</strong>
            <p>Based on recent conversations</p>
          </div>
        </div>
        <div className="insight-section">
          <div className="section-title"><strong>Recent activity</strong></div>
          <div className="activity">
            <div className="activity-icon green"><Icon name="chat" /></div>
            <div>
              <strong>Conversation active</strong>
              <span>Atlas is ready to help</span>
            </div>
            <time>Now</time>
          </div>
        </div>
      </aside>
    </section>
  );
}
