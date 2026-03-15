import { useEffect, useState } from 'react';
import NavBar from '../components/NavBar';
import { events as eventsApi, push as pushApi } from '../lib/api';
import type { EventWithSub } from '../lib/api';

function formatCountdown(datetime: string): string {
  const diff = new Date(datetime).getTime() - Date.now();
  if (diff <= 0) return 'LIVE NOW';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `Starts in ${h}h ${m}m`;
  return `Starts in ${m}m`;
}

export default function Notifications() {
  const [myEvents, setMyEvents] = useState<EventWithSub[]>([]);
  const [allEvents, setAllEvents] = useState<EventWithSub[]>([]);
  const [pushGranted, setPushGranted] = useState(Notification.permission === 'granted');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'subscribed' | 'all'>('subscribed');

  useEffect(() => {
    eventsApi.list().then((data) => {
      setAllEvents(data);
      setMyEvents(data.filter((e) => e.subscribed));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const requestPushPermission = async () => {
    const perm = await Notification.requestPermission();
    setPushGranted(perm === 'granted');
    if (perm === 'granted') {
      try {
        const { public_key } = await pushApi.vapidPublicKey();
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(public_key) as BufferSource,
        });
        const json = sub.toJSON();
        if (json.keys) {
          await pushApi.subscribe(json.endpoint!, {
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
          });
        }
      } catch (err) {
        console.error('Push subscription failed:', err);
      }
    }
  };

  const toggleSubscription = async (ev: EventWithSub) => {
    const newState = !ev.subscribed;
    setMyEvents((prev) =>
      newState ? [...prev, { ...ev, subscribed: 1 }] : prev.filter((e) => e.id !== ev.id)
    );
    setAllEvents((prev) =>
      prev.map((e) => e.id === ev.id ? { ...e, subscribed: newState ? 1 : 0 } : e)
    );
    try {
      if (newState) await eventsApi.subscribe(ev.id);
      else await eventsApi.unsubscribe(ev.id);
    } catch {
      // revert on error
      setMyEvents((prev) =>
        !newState ? [...prev, { ...ev, subscribed: 1 }] : prev.filter((e) => e.id !== ev.id)
      );
    }
  };

  const displayed = tab === 'subscribed' ? myEvents : allEvents;

  return (
    <div className="min-h-screen bg-bg-primary">
      <NavBar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-text-primary mb-6">Notifications</h1>

        {/* Push permission banner */}
        {!pushGranted && (
          <div className="card p-4 mb-6 border border-accent/30 bg-accent/5">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <div className="flex-1">
                <p className="text-text-primary text-sm font-medium">Enable push notifications</p>
                <p className="text-text-muted text-xs">Get notified before events start</p>
              </div>
              <button onClick={requestPushPermission} className="btn-primary text-sm px-3 py-1.5">
                Enable
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-bg-secondary rounded-lg p-1">
          {(['subscribed', 'all'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === t ? 'bg-surface text-text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {t === 'subscribed' ? `My events (${myEvents.length})` : 'All events'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 skeleton rounded-xl" />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-10 h-10 text-text-muted mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-text-muted">
              {tab === 'subscribed' ? 'No subscribed events' : 'No upcoming events'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((ev) => (
              <div key={ev.id} className="card p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary font-medium truncate">{ev.title}</p>
                  <p className="text-text-secondary text-sm">
                    {new Date(ev.event_datetime).toLocaleString()}
                  </p>
                  <span className={`text-xs font-medium ${
                    formatCountdown(ev.event_datetime) === 'LIVE NOW'
                      ? 'text-status-live'
                      : 'text-accent'
                  }`}>
                    {formatCountdown(ev.event_datetime)}
                  </span>
                </div>
                <button
                  onClick={() => toggleSubscription(ev)}
                  className={`shrink-0 p-2 rounded-lg transition-colors ${
                    ev.subscribed
                      ? 'bg-accent/15 text-accent hover:bg-accent/25'
                      : 'bg-surface hover:bg-surface-hover text-text-secondary'
                  }`}
                  title={ev.subscribed ? 'Unsubscribe' : 'Subscribe'}
                >
                  <svg className="w-5 h-5" fill={ev.subscribed ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
