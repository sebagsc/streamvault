import { useEffect, useState } from 'react';
import NavBar from '../components/NavBar';
import FiltersSidebar from '../components/FiltersSidebar';
import ChannelCard from '../components/ChannelCard';
import TVGuide from '../components/TVGuide';
import EventCard from '../components/EventCard';
import PlayerModal from '../components/PlayerModal';
import { useChannelStore } from '../store/channelStore';
import { usePlayerStore } from '../store/playerStore';
import { useAuthStore } from '../store/authStore';
import { events as eventsApi } from '../lib/api';
import type { EventWithSub } from '../lib/api';

export default function Home() {
  const { channels, total, page, pages, loading, error, view, filters, fetchChannels, setActiveEvents } = useChannelStore();
  const { openPlayer, isOpen } = usePlayerStore();
  const { user } = useAuthStore();
  const [upcomingEvents, setUpcomingEvents] = useState<EventWithSub[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    fetchChannels();
  }, [filters]);

  useEffect(() => {
    eventsApi.list().then((data) => {
      setUpcomingEvents(data);
      // Build active events map (events happening now)
      const now = Date.now();
      const map: Record<string, boolean> = {};
      for (const ev of data) {
        const evTime = new Date(ev.event_datetime).getTime();
        // Consider "live" if started within last 3 hours
        if (evTime <= now && evTime >= now - 3 * 3600 * 1000) {
          map[ev.channel_id] = true;
        }
      }
      setActiveEvents(map);
    }).catch(() => {});
  }, []);

  const filteredChannels = channels;

  return (
    <div className="min-h-screen bg-bg-primary">
      <NavBar onFiltersToggle={() => setFiltersOpen((v) => !v)} />

      {/* Featured Events Banner */}
      {upcomingEvents.length > 0 && (
        <div className="border-b border-surface-border bg-bg-secondary">
          <div className="max-w-screen-2xl mx-auto px-4 py-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="badge-live animate-pulse-live">EVENTS</span>
              <span className="text-text-secondary text-sm font-medium">Upcoming &amp; Live</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {upcomingEvents.map((ev) => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  onOpen={() => {
                    const ch = channels.find((c) => c.id === ev.channel_id);
                    if (ch) openPlayer(ch);
                  }}
                  onSubscribeToggle={(subscribed) => {
                    setUpcomingEvents((prev) =>
                      prev.map((e) => e.id === ev.id ? { ...e, subscribed: subscribed ? 1 : 0 } : e)
                    );
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-screen-2xl mx-auto flex">
        {/* Filters sidebar */}
        <FiltersSidebar isOpen={filtersOpen} onClose={() => setFiltersOpen(false)} />

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4">
          {loading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="aspect-video skeleton rounded-xl" />
              ))}
            </div>
          )}

          {error && (
            <div className="text-center py-20">
              <p className="text-status-broken mb-3">{error}</p>
              <button onClick={() => fetchChannels()} className="btn-primary">Retry</button>
            </div>
          )}

          {!loading && !error && view === 'grid' && (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-text-secondary text-sm">
                  <span className="text-text-primary font-medium">{total}</span> channels
                  {pages > 1 && <span className="ml-2 text-text-muted">(page {page}/{pages})</span>}
                </p>
              </div>
              {filteredChannels.length === 0 ? (
                <div className="text-center py-20">
                  <svg className="w-12 h-12 text-text-muted mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-text-muted">No channels match your filters</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {filteredChannels.map((ch) => (
                      <ChannelCard key={ch.id} channel={ch} onClick={() => openPlayer(ch)} />
                    ))}
                  </div>
                  {pages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6 pb-4">
                      <button
                        onClick={() => fetchChannels(page - 1)}
                        disabled={page <= 1}
                        className="btn-ghost disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                      >
                        Previous
                      </button>
                      <span className="text-text-secondary text-sm px-3">
                        {page} / {pages}
                      </span>
                      <button
                        onClick={() => fetchChannels(page + 1)}
                        disabled={page >= pages}
                        className="btn-ghost disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {!loading && !error && view === 'guide' && (
            <TVGuide channels={filteredChannels} onChannelClick={(ch) => openPlayer(ch)} />
          )}
        </main>
      </div>

      {isOpen && <PlayerModal />}
    </div>
  );
}
