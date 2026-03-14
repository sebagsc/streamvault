import { useState, useEffect, useRef } from 'react';
import type { ChannelPolling, ChatMessage } from '../lib/polling';

interface Props {
  polling: ChannelPolling | null;
  className?: string;
}

interface DisplayMessage {
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

interface PresenceUser {
  id: string;
  username: string;
}

export default function ChatPanel({ polling, className = '' }: Props) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!polling) return;
    
    const unsubChat = polling.onChat((newMessages: ChatMessage[]) => {
      setMessages((prev) => {
        const converted = newMessages.map((m) => ({
          userId: m.user_id,
          username: m.username,
          message: m.message,
          timestamp: new Date(m.created_at).getTime(),
        }));
        const combined = [...prev, ...converted];
        // Eliminar duplicados por id (si viene de diferentes polls)
        const unique = combined.filter((msg, index, self) => 
          index === self.findIndex((m) => m.timestamp === msg.timestamp && m.userId === msg.userId && m.message === msg.message)
        );
        return unique.slice(-200); // keep last 200
      });
    });

    const unsubPresence = polling.onPresence((info) => {
      setPresence(info.users.map((u) => ({ id: u.user_id, username: u.username })));
    });

    return () => {
      unsubChat();
      unsubPresence();
    };
  }, [polling]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !polling) return;
    const success = await polling.sendChat(text);
    if (success) {
      setInput('');
      inputRef.current?.focus();
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex flex-col bg-bg-secondary border-l border-surface-border ${className}`}>
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-surface-border flex items-center justify-between">
        <div>
          <p className="text-text-primary text-sm font-semibold">Live Chat</p>
          {presence.length > 0 && (
            <p className="text-text-muted text-xs">{presence.length} watching</p>
          )}
        </div>
        {presence.length > 0 && (
          <div className="flex -space-x-1.5">
            {presence.slice(0, 3).map((u) => (
              <div
                key={u.id}
                title={u.username}
                className="w-5 h-5 rounded-full bg-accent/20 border border-bg-secondary flex items-center justify-center"
              >
                <span className="text-[8px] text-accent font-bold">{u.username[0].toUpperCase()}</span>
              </div>
            ))}
            {presence.length > 3 && (
              <div className="w-5 h-5 rounded-full bg-surface border border-bg-secondary flex items-center justify-center">
                <span className="text-[8px] text-text-muted">+{presence.length - 3}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2.5 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-text-muted text-xs">No messages yet. Say something!</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className="group">
            <div className="flex items-baseline gap-1.5">
              <span className="text-accent text-xs font-semibold shrink-0">{msg.username}</span>
              <span className="text-text-muted text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                {formatTime(msg.timestamp)}
              </span>
            </div>
            <p className="text-text-secondary text-sm leading-snug break-words">{msg.message}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-surface-border">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Say something..."
            maxLength={500}
            className="flex-1 bg-surface border border-surface-border text-text-primary placeholder-text-muted rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="px-3 py-1.5 bg-accent/15 hover:bg-accent/25 text-accent rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
