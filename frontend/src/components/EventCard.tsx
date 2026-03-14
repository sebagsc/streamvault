import { useState, useEffect } from 'react';
import { events as eventsApi } from '../lib/api';
import type { EventWithSub } from '../lib/api';

interface Props {
  event: EventWithSub;
  onOpen: () => void;
  onSubscribeToggle?: (subscribed: boolean) => void;
}

function useCountdown(datetime: string): string {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(datetime).getTime() - Date.now();
      if (diff <= 0) {
        setLabel('LIVE NOW');
      } else {
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        setLabel(h > 0 ? `Starts in ${h}h ${m}m` : `Starts in ${m}m`);
      }
    };
    update();
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, [datetime]);

  return label;
}

export default function EventCard({ event, onOpen, onSubscribeToggle }: Props) {
  const countdown = useCountdown(event.event_datetime);
  const isLive = countdown === 'LIVE NOW';
  const [subscribed, setSubscribed] = useState(event.subscribed === 1);
  const [toggling, setToggling] = useState(false);

  const handleBell = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setToggling(true);
    const next = !subscribed;
    setSubscribed(next);
    onSubscribeToggle?.(next);
    try {
      if (next) await eventsApi.subscribe(event.id);
      else await eventsApi.unsubscribe(event.id);
    } catch {
      setSubscribed(!next);
    } finally {
      setToggling(false);
    }
  };

  return (
    <div
      onClick={onOpen}
      className="shrink-0 w-52 card hover:border-accent/50 cursor-pointer transition-all duration-150 hover:scale-[1.02] group"
    >
      {/* Image */}
      <div className="relative h-24 bg-surface overflow-hidden">
        {event.image_url ? (
          <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {isLive && (
          <div className="absolute top-2 left-2">
            <span className="badge-live animate-pulse-live text-xs px-2 py-0.5">LIVE</span>
          </div>
        )}
        <button
          onClick={handleBell}
          disabled={toggling}
          className={`absolute top-2 right-2 p-1.5 rounded-lg backdrop-blur-sm transition-colors ${
            subscribed ? 'bg-accent/20 text-accent' : 'bg-black/40 text-white/70 hover:text-white'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill={subscribed ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-text-primary text-sm font-medium line-clamp-1">{event.title}</p>
        <p className="text-text-muted text-xs mt-0.5">
          {new Date(event.event_datetime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
        <p className={`text-xs font-medium mt-1 ${isLive ? 'text-status-live' : 'text-accent'}`}>
          {countdown}
        </p>
      </div>
    </div>
  );
}
