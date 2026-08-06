import Icon from './Icon';
import type { View, Conversation } from '../lib/types';

type SidebarProps = {
  view: View;
  setView: (view: View) => void;
  conversations: Conversation[];
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  docCount: number;
};

export default function Sidebar({
  view, setView, conversations, activeConversationId, onSelectConversation, onNewChat, docCount,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">A</div>
        <div>
          <strong>atlas</strong>
          <span>support intelligence</span>
        </div>
      </div>

      <div className="workspace-label">WORKSPACE</div>
      <button className={view === 'chat' ? 'nav-item active' : 'nav-item'} onClick={() => setView('chat')}>
        <Icon name="chat" />Ask Atlas
      </button>
      <button className={view === 'knowledge' ? 'nav-item active' : 'nav-item'} onClick={() => setView('knowledge')}>
        <Icon name="book" />Knowledge base
        <span className="nav-count">{docCount}</span>
      </button>
      <button className={view === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => setView('settings')}>
        <Icon name="settings" />Settings
      </button>

      <div className="workspace-label" style={{ marginTop: 24 }}>CONVERSATIONS</div>
      <button className="new-chat-btn" onClick={onNewChat}>
        <Icon name="plus" />New chat
      </button>
      <div className="conversation-list">
        {conversations.length === 0 && <p className="empty-note">No conversations yet</p>}
        {conversations.map((conv) => (
          <button
            key={conv.id}
            className={activeConversationId === conv.id ? 'conv-item active' : 'conv-item'}
            onClick={() => onSelectConversation(conv.id)}
            title={conv.title}
          >
            <Icon name="chat" />
            <span>{conv.title}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-bottom">
        <div className="profile">
          <div className="avatar">JD</div>
          <div>
            <strong>Jordan Davis</strong>
            <span>Administrator</span>
          </div>
          <span className="dots">•••</span>
        </div>
      </div>
    </aside>
  );
}
