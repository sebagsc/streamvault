import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useAuthStore } from '../store/authStore';
import { createHlsPlayer } from '../lib/hls';
import { ChannelWebSocket } from '../lib/websocket';
import { channels as channelsApi, streams as streamsApi } from '../lib/api';
import ChatPanel from './ChatPanel';
import type Hls from 'hls.js';

export default function PlayerModal() {
  const { channel, streamIndex, isOpen, quality, isTryingFallback, streamError, closePlayer, nextStream, setQuality, setStreamError, setIsTryingFallback } = usePlayerStore();
  const { user } = useAuthStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const wsRef = useRef<ChannelWebSocket | null>(null);

  const [chatOpen, setChatOpen] = useState(true);
  const [presence, setPresence] = useState<{ id: string; username: string }[]>([]);
  const [reportSent, setReportSent] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentStream = channel?.streams[streamIndex];

  // Initialize HLS player
  useEffect(() => {
    if (!channel || !currentStream || !videoRef.current) return;

    // Destroy previous instance
    hlsRef.current?.destroy();
    hlsRef.current = null;

    setIsTryingFallback(false);
    setStreamError(null);

    const hls = createHlsPlayer(videoRef.current, currentStream.url, {
      onError: (type, fatal) => {
        if (fatal) {
          setIsTryingFallback(true);
          setTimeout(() => nextStream(), 2000);
        }
      },
      onLevelLoaded: (q) => setQuality(q),
      referrer: currentStream.http_referrer,
      userAgent: currentStream.user_agent,
    });

    hlsRef.current = hls;

    // Track recently watched
    channelsApi.markWatched(channel.id).catch(() => {});

    return () => {
      hls?.destroy();
    };
  }, [channel?.id, streamIndex]);

  // WebSocket for presence + chat
  useEffect(() => {
    if (!channel || !user) return;

    wsRef.current?.disconnect();

    const username = user.display_name || user.email.split('@')[0];
    const ws = new ChannelWebSocket(
      channel.id,
      user.id,
      username,
      user.role === 'admin'
    );
    ws.connect();
    wsRef.current = ws;

    const unsub = ws.onMessage((msg) => {
      if (msg.type === 'presence') {
        setPresence(msg.users);
      }
    });

    return () => {
      unsub();
      ws.disconnect();
      wsRef.current = null;
    };
  }, [channel?.id]);

  // Fullscreen handler
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePlayer();
      if (e.key === 'f') toggleFullscreen();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const togglePip = async () => {
    if (!videoRef.current) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await videoRef.current.requestPictureInPicture().catch(() => {});
    }
  };

  const reportStream = async () => {
    if (!currentStream || !channel) return;
    await streamsApi.report(currentStream.url, channel.id).catch(() => {});
    setReportSent(true);
    setTimeout(() => setReportSent(false), 3000);
  };

  if (!isOpen || !channel) return null;

  const watchingWith = presence.filter((u) => u.id !== user?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        ref={containerRef}
        className="w-full h-full md:w-[90vw] md:h-[85vh] md:rounded-2xl overflow-hidden bg-black flex flex-col md:flex-row shadow-2xl"
        style={{ maxWidth: '1400px' }}
      >
        {/* Video area */}
        <div className="relative flex-1 bg-black flex flex-col min-h-0">
          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center gap-3">
            {channel.logo && (
              <img src={channel.logo} alt={channel.name} className="w-8 h-8 object-contain" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate">{channel.name}</p>
              {quality && (
                <span className="text-white/60 text-xs">{quality}</span>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1">
              <button onClick={togglePip} className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors" title="Picture in Picture">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
              </button>
              <button onClick={toggleFullscreen} className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors" title="Fullscreen">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isFullscreen
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0l5 0M4 4l0 5M15 9l5-5m0 0l-5 0m5 0l0 5M9 15l-5 5m0 0l5 0m-5 0l0-5M15 15l5 5m0 0l-5 0m5 0l0-5" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                  }
                </svg>
              </button>
              <button
                onClick={() => setChatOpen((v) => !v)}
                className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                title="Toggle chat"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </button>
              <button onClick={closePlayer} className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors" title="Close">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Video */}
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            autoPlay
            playsInline
            controls={false}
          />

          {/* Fallback / error overlay */}
          {isTryingFallback && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-white/80 text-sm">Trying backup stream...</p>
              </div>
            </div>
          )}
          {streamError && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
              <div className="text-center space-y-4 p-6">
                <svg className="w-12 h-12 text-text-muted mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <p className="text-white/80 text-sm">{streamError}</p>
                <p className="text-white/40 text-xs">This may be a CORS restriction from the stream origin</p>
              </div>
            </div>
          )}

          {/* Bottom bar */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center justify-between gap-3">
              {/* Presence */}
              {watchingWith.length > 0 && (
                <p className="text-white/60 text-xs truncate">
                  Watching with: {watchingWith.slice(0, 3).map((u) => `@${u.username}`).join(', ')}
                  {watchingWith.length > 3 && ` +${watchingWith.length - 3} more`}
                </p>
              )}
              <div className="flex-1" />

              {/* Report button */}
              <button
                onClick={reportStream}
                disabled={reportSent}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  reportSent
                    ? 'bg-status-online/20 text-status-online'
                    : 'bg-white/10 hover:bg-white/20 text-white/70'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                </svg>
                {reportSent ? 'Reported' : 'Report broken'}
              </button>
            </div>
          </div>
        </div>

        {/* Chat panel */}
        {chatOpen && (
          <div className="w-full md:w-72 shrink-0 h-48 md:h-full border-t md:border-t-0 border-surface-border">
            <ChatPanel ws={wsRef.current} className="h-full" />
          </div>
        )}
      </div>
    </div>
  );
}
