import { useEffect, useState } from 'react';
import NavBar from '../components/NavBar';
import { users as usersApi, invite as inviteApi, events as eventsApi, streams as streamsApi, channels as channelsApi, admin as adminApi } from '../lib/api';
import type { UserRow, InviteLink, EventWithSub, StreamReport, EventInput, Channel } from '../lib/api';

type Tab = 'users' | 'events' | 'streams' | 'settings';

export default function Admin() {
  const [tab, setTab] = useState<Tab>('users');
  const tabs: { id: Tab; label: string }[] = [
    { id: 'users', label: 'Users' },
    { id: 'events', label: 'Events' },
    { id: 'streams', label: 'Streams' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-bg-primary">
      <NavBar />
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-text-primary mb-6">Admin Panel</h1>

        <div className="flex gap-1 mb-6 bg-bg-secondary rounded-lg p-1 w-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === t.id ? 'bg-surface text-text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'users' && <UsersTab />}
        {tab === 'events' && <EventsTab />}
        {tab === 'streams' && <StreamsTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}

// ---- Users Tab ----
function UsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [invites, setInvites] = useState<InviteLink[]>([]);
  const [newInviteUrl, setNewInviteUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    const [u, i] = await Promise.all([usersApi.list(), inviteApi.list()]);
    setUsers(u);
    setInvites(i);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const generateInvite = async () => {
    const { url } = await inviteApi.generate();
    setNewInviteUrl(url);
    setInvites(await inviteApi.list());
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(newInviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="h-32 skeleton rounded-xl" />;

  return (
    <div className="space-y-6">
      {/* Generate invite */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">Invite Links</h3>
        <button onClick={generateInvite} className="btn-primary mb-4">Generate invite link</button>
        {newInviteUrl && (
          <div className="flex items-center gap-2 bg-surface rounded-lg p-3">
            <input readOnly value={newInviteUrl} className="flex-1 bg-transparent text-sm text-text-primary text-ellipsis overflow-hidden" />
            <button onClick={copyInvite} className="shrink-0 btn-ghost text-sm px-3 py-1.5">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
        <div className="mt-4 space-y-2">
          {invites.map((inv) => (
            <div key={inv.token} className="flex items-center justify-between py-2 border-b border-surface-border last:border-0">
              <div className="min-w-0">
                <code className="text-xs text-text-muted font-mono">{inv.token.slice(0, 16)}...</code>
                <div className="flex items-center gap-2 mt-0.5">
                  {inv.revoked ? <span className="badge bg-surface text-text-muted">Revoked</span>
                    : inv.used ? <span className="badge bg-surface text-status-online">Used by {inv.used_by_email ?? 'unknown'}</span>
                    : <span className="badge badge-accent">Active</span>}
                  <span className="text-text-muted text-xs">{new Date(inv.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              {!inv.revoked && !inv.used && (
                <button
                  onClick={() => inviteApi.revoke(inv.token).then(load)}
                  className="text-xs text-status-broken hover:underline"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Users table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-surface-border">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Users</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-bg-secondary">
                <th className="px-4 py-3 text-left text-text-secondary font-medium">Email</th>
                <th className="px-4 py-3 text-left text-text-secondary font-medium">Role</th>
                <th className="px-4 py-3 text-left text-text-secondary font-medium">Status</th>
                <th className="px-4 py-3 text-left text-text-secondary font-medium">TOTP</th>
                <th className="px-4 py-3 text-left text-text-secondary font-medium">Last seen</th>
                <th className="px-4 py-3 text-right text-text-secondary font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-surface-border/50 hover:bg-surface/50">
                  <td className="px-4 py-3 text-text-primary">{u.display_name || u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${u.role === 'admin' ? 'badge-accent' : 'badge-muted'}`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${u.active ? 'bg-status-online/15 text-status-online' : 'bg-surface text-text-muted'}`}>
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${u.totp_confirmed ? 'bg-status-online/15 text-status-online' : 'bg-status-broken/15 text-status-broken'}`}>
                      {u.totp_confirmed ? 'OK' : 'Not set'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted text-xs">
                    {u.last_seen ? new Date(u.last_seen).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {u.active ? (
                        <button onClick={() => usersApi.deactivate(u.id).then(load)} className="text-xs text-status-broken hover:underline">Deactivate</button>
                      ) : (
                        <button onClick={() => usersApi.activate(u.id).then(load)} className="text-xs text-status-online hover:underline">Activate</button>
                      )}
                      <button onClick={() => usersApi.resetTotp(u.id).then(load)} className="text-xs text-text-muted hover:text-text-primary hover:underline">Reset TOTP</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---- Events Tab ----
function EventsTab() {
  const [events, setEvents] = useState<EventWithSub[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [form, setForm] = useState<EventInput>({ channel_id: '', title: '', event_datetime: '' });
  const [editing, setEditing] = useState<string | null>(null);
  const [channelSearch, setChannelSearch] = useState('');

  const load = async () => {
    const [e, cRes] = await Promise.all([eventsApi.list(), channelsApi.list({ show_all: true, limit: 500 })]);
    setEvents(e);
    setChannels(cRes.channels);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      await eventsApi.update(editing, form);
    } else {
      await eventsApi.create(form);
    }
    setForm({ channel_id: '', title: '', event_datetime: '' });
    setEditing(null);
    setChannelSearch('');
    load();
  };

  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(channelSearch.toLowerCase())
  ).slice(0, 20);

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
          {editing ? 'Edit Event' : 'Create Event'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Channel</label>
            <input
              className="input mb-2"
              placeholder="Search channels..."
              value={channelSearch || (channels.find((c) => c.id === form.channel_id)?.name ?? '')}
              onChange={(e) => setChannelSearch(e.target.value)}
            />
            {channelSearch && (
              <div className="bg-bg-elevated border border-surface-border rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                {filteredChannels.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-surface text-sm text-text-primary"
                    onClick={() => { setForm((f) => ({ ...f, channel_id: c.id })); setChannelSearch(''); }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Title</label>
            <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Date & Time</label>
              <input type="datetime-local" className="input" value={form.event_datetime} onChange={(e) => setForm((f) => ({ ...f, event_datetime: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Image URL (optional)</label>
              <input className="input" value={form.image_url ?? ''} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Description (optional)</label>
            <textarea className="input" rows={2} value={form.description ?? ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              {editing ? 'Save changes' : 'Create event'}
            </button>
            {editing && (
              <button type="button" onClick={() => { setEditing(null); setForm({ channel_id: '', title: '', event_datetime: '' }); }} className="btn-ghost">
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="space-y-3">
        {events.map((ev) => (
          <div key={ev.id} className="card p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-text-primary font-medium">{ev.title}</p>
              <p className="text-text-secondary text-sm">{new Date(ev.event_datetime).toLocaleString()}</p>
              <p className="text-text-muted text-xs">{channels.find((c) => c.id === ev.channel_id)?.name ?? ev.channel_id}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setEditing(ev.id); setForm({ channel_id: ev.channel_id, title: ev.title, description: ev.description ?? '', image_url: ev.image_url ?? '', event_datetime: ev.event_datetime.slice(0, 16) }); }}
                className="btn-ghost text-sm px-3 py-1.5"
              >
                Edit
              </button>
              <button onClick={() => eventsApi.delete(ev.id).then(load)} className="btn-danger text-sm px-3 py-1.5">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Streams Tab ----
function StreamsTab() {
  const [reports, setReports] = useState<StreamReport[]>([]);
  const [customForm, setCustomForm] = useState({ title: '', url: '', quality: '', country: '', language: '', category: '', is_nsfw: false });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const data = await streamsApi.reports();
    setReports(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await streamsApi.addCustom({ ...customForm, is_nsfw: customForm.is_nsfw });
    setCustomForm({ title: '', url: '', quality: '', country: '', language: '', category: '', is_nsfw: false });
  };

  return (
    <div className="space-y-6">
      {/* Flagged streams */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-surface-border">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Flagged Streams</h3>
        </div>
        {loading ? (
          <div className="p-4"><div className="h-20 skeleton rounded" /></div>
        ) : reports.length === 0 ? (
          <p className="p-6 text-center text-text-muted text-sm">No flagged streams</p>
        ) : (
          <div className="divide-y divide-surface-border">
            {reports.map((r) => (
              <div key={r.id} className="p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-sm font-mono truncate">{r.stream_url}</p>
                  <p className="text-text-muted text-xs mt-1">Reported by {r.reporter_email}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => streamsApi.setHealth(r.id, 'working').then(load)}
                    className="text-xs bg-status-online/10 text-status-online hover:bg-status-online/20 px-3 py-1.5 rounded-lg"
                  >
                    Mark working
                  </button>
                  <button
                    onClick={() => streamsApi.setHealth(r.id, 'hidden').then(load)}
                    className="btn-danger text-xs px-3 py-1.5"
                  >
                    Hide stream
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add custom stream */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">Add Custom Stream</h3>
        <form onSubmit={handleCustomSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Title *</label>
              <input className="input" value={customForm.title} onChange={(e) => setCustomForm((f) => ({ ...f, title: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">URL *</label>
              <input className="input" value={customForm.url} onChange={(e) => setCustomForm((f) => ({ ...f, url: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Quality</label>
              <input className="input" value={customForm.quality} onChange={(e) => setCustomForm((f) => ({ ...f, quality: e.target.value }))} placeholder="720p" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Country</label>
              <input className="input" value={customForm.country} onChange={(e) => setCustomForm((f) => ({ ...f, country: e.target.value }))} placeholder="US" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={customForm.is_nsfw} onChange={(e) => setCustomForm((f) => ({ ...f, is_nsfw: e.target.checked }))} className="w-4 h-4 accent-accent" />
            <span className="text-sm text-text-secondary">Mark as NSFW</span>
          </label>
          <button type="submit" className="btn-primary">Add stream</button>
        </form>
      </div>
    </div>
  );
}

// ---- Settings Tab ----
function SettingsTab() {
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [refreshMsg, setRefreshMsg] = useState('');

  useEffect(() => {
    adminApi.refreshStatus().then((d) => setLastRefresh(d.last_refresh)).catch(() => {});
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshMsg('');
    try {
      await adminApi.refreshSources();
      setRefreshMsg('Refresh started! It may take a minute to complete. Check back shortly.');
    } catch (e: any) {
      setRefreshMsg(`Error: ${e.message || 'Failed to refresh'}`);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">Channel Sources</h3>
        <p className="text-text-secondary text-sm mb-4">
          Channels are fetched from Free-TV (curated) and iptv-org (comprehensive). Data refreshes automatically every 6 hours via cron. You can also trigger a manual refresh.
        </p>
        {lastRefresh && (
          <p className="text-text-muted text-xs mb-4">
            Last refresh: {new Date(lastRefresh).toLocaleString()}
          </p>
        )}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn-primary disabled:opacity-50"
        >
          {refreshing ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Refreshing sources...
            </span>
          ) : (
            'Refresh sources now'
          )}
        </button>
        {refreshMsg && (
          <p className={`mt-3 text-sm ${refreshMsg.startsWith('Error') ? 'text-status-broken' : 'text-status-online'}`}>
            {refreshMsg}
          </p>
        )}
      </div>
    </div>
  );
}
