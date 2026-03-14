import { useState } from 'react';
import { useChannelStore } from '../store/channelStore';
import type { Channel } from '../lib/api';

interface Props {
  channel: Channel;
  onClick: () => void;
  viewerCount?: number;
}

export default function ChannelCard({ channel, onClick, viewerCount }: Props) {
  const { activeEvents } = useChannelStore();
  const isLive = !!activeEvents[channel.id];
  const [imgError, setImgError] = useState(false);

  const quality = channel.streams.find((s) => !s.is_broken)?.quality;
  const qualityLabel = quality && quality !== 'unknown' ? quality : null;

  return (
    <button
      onClick={onClick}
      className="card group hover:border-accent/40 transition-all duration-150 hover:scale-[1.02] hover:shadow-xl hover:shadow-accent/5 text-left flex flex-col"
    >
      {/* Logo area */}
      <div className="relative aspect-video bg-surface flex items-center justify-center p-3 overflow-hidden">
        {channel.logo && !imgError ? (
          <img
            src={channel.logo}
            alt={channel.name}
            className="max-w-full max-h-full object-contain transition-transform group-hover:scale-105"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-2xl font-bold text-text-muted">
              {channel.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* Badges overlay */}
        <div className="absolute top-1.5 left-1.5 flex gap-1">
          {isLive && (
            <span className="badge-live text-[10px] px-1.5 py-0.5 animate-pulse-live">LIVE</span>
          )}
          {qualityLabel && (
            <span className="badge bg-black/60 text-white/80 text-[10px] px-1.5 py-0.5 backdrop-blur-sm">
              {qualityLabel}
            </span>
          )}
        </div>

        {viewerCount != null && viewerCount > 0 && (
          <div className="absolute top-1.5 right-1.5">
            <span className="badge bg-black/60 text-white/80 text-[10px] px-1.5 py-0.5 backdrop-blur-sm">
              {viewerCount} watching
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 flex-1 flex flex-col justify-between gap-1.5">
        <p className="text-text-primary text-xs font-medium line-clamp-2 leading-snug">{channel.name}</p>
        <div className="flex items-center gap-1 flex-wrap">
          {channel.country && (
            <span className="badge-muted text-[10px] px-1.5">{channel.country}</span>
          )}
          {channel.categories[0] && (
            <span className="badge badge-accent text-[10px] px-1.5">{channel.categories[0]}</span>
          )}
        </div>
      </div>
    </button>
  );
}
