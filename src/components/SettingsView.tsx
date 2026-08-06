import { useState } from 'react';
import Icon from './Icon';

type SettingsViewProps = {
  docCount: number;
  conversationCount: number;
  onClearAll: () => Promise<void>;
};

export default function SettingsView({ docCount, conversationCount, onClearAll }: SettingsViewProps) {
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClear() {
    setClearing(true);
    try {
      await onClearAll();
      setMessage('All conversations cleared.');
      setConfirming(false);
    } catch {
      setMessage('Failed to clear conversations.');
    } finally {
      setClearing(false);
    }
  }

  return (
    <section className="settings-view">
      <div className="settings-card">
        <h2>Workspace settings</h2>
        <p>Manage your support AI workspace and data.</p>

        <div className="setting-row">
          <div className="setting-info">
            <strong>Indexed documents</strong>
            <p>Total sources in your knowledge base.</p>
          </div>
          <span className="setting-value">{docCount}</span>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <strong>Saved conversations</strong>
            <p>Total chat sessions stored locally.</p>
          </div>
          <span className="setting-value">{conversationCount}</span>
        </div>

        <div className="setting-row danger">
          <div className="setting-info">
            <strong>Clear all conversations</strong>
            <p>Permanently delete all chat history. Documents are not affected.</p>
          </div>
          {!confirming ? (
            <button className="danger-btn" type="button" onClick={() => setConfirming(true)}>Clear</button>
          ) : (
            <div className="confirm-group">
              <button className="danger-btn" type="button" onClick={() => void handleClear()} disabled={clearing}>
                {clearing ? 'Clearing...' : 'Confirm'}
              </button>
              <button className="cancel-btn" type="button" onClick={() => setConfirming(false)} disabled={clearing}>Cancel</button>
            </div>
          )}
        </div>

        {message && <div className="settings-message">{message}</div>}
      </div>

      <div className="settings-card">
        <h2>About Atlas</h2>
        <p>Atlas Support AI uses retrieval-augmented generation (RAG) to answer questions strictly from your uploaded knowledge base. When an answer cannot be found, Atlas responds with a safe fallback instead of hallucinating.</p>
        <div className="about-tags">
          <span className="tag"><Icon name="check" />RAG pipeline</span>
          <span className="tag"><Icon name="check" />Source citations</span>
          <span className="tag"><Icon name="check" />Guardrail fallback</span>
          <span className="tag"><Icon name="check" />IndexedDB persistence</span>
        </div>
      </div>
    </section>
  );
}
