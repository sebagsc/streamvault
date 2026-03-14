import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { users as usersApi, channels as channelsApi, meta } from '../lib/api';
import NavBar from '../components/NavBar';
import type { Channel } from '../lib/api';

export default function Profile() {
  const { user, setUser, refreshUser } = useAuthStore();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [countries, setCountries] = useState<{ code: string; name: string; flag: string }[]>([]);
  const [languages, setLanguages] = useState<{ code: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [recentChannels, setRecentChannels] = useState<{ channel_id: string; watched_at: string }[]>([]);
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [leadTime, setLeadTime] = useState(user?.notification_lead_time ?? 15);
  const [nsfw, setNsfw] = useState(user?.nsfw_enabled === 1);
  const [prefCountries, setPrefCountries] = useState<string[]>(user?.preferences_countries ?? []);
  const [prefLanguages, setPrefLanguages] = useState<string[]>(user?.preferences_languages ?? []);
  const [prefCategories, setPrefCategories] = useState<string[]>(user?.preferences_categories ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      meta.countries(),
      meta.languages(),
      meta.categories(),
      channelsApi.recentlyWatched(),
      channelsApi.list({ show_all: true }),
    ]).then(([c, l, cat, recent, ch]) => {
      setCountries(c);
      setLanguages(l);
      setCategories(cat);
      setRecentChannels(recent);
      setAllChannels(ch);
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await usersApi.updatePreferences(user.id, {
        display_name: displayName,
        preferences_countries: prefCountries,
        preferences_languages: prefLanguages,
        preferences_categories: prefCategories,
        notification_lead_time: leadTime,
      });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const toggleMulti = (
    value: string,
    current: string[],
    setter: (v: string[]) => void
  ) => {
    setter(current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  };

  const channelName = (id: string) =>
    allChannels.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="min-h-screen bg-bg-primary">
      <NavBar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-text-primary mb-8">Profile & Preferences</h1>

        <div className="space-y-6">
          {/* Display name */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">Account</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Display name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="input"
                  placeholder={user?.email}
                  maxLength={50}
                />
              </div>
              <p className="text-text-muted text-xs">Email: {user?.email}</p>
            </div>
          </div>

          {/* Country preferences */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">Country filter</h2>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
              {countries.map((c) => (
                <button
                  key={c.code}
                  onClick={() => toggleMulti(c.code, prefCountries, setPrefCountries)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    prefCountries.includes(c.code)
                      ? 'bg-accent text-bg-primary font-medium'
                      : 'bg-surface hover:bg-surface-hover text-text-secondary'
                  }`}
                >
                  {c.flag} {c.name}
                </button>
              ))}
            </div>
            {prefCountries.length > 0 && (
              <button onClick={() => setPrefCountries([])} className="text-xs text-text-muted hover:text-text-secondary mt-2">
                Clear selection
              </button>
            )}
          </div>

          {/* Language preferences */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">Language filter</h2>
            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
              {languages.slice(0, 50).map((l) => (
                <button
                  key={l.code}
                  onClick={() => toggleMulti(l.code, prefLanguages, setPrefLanguages)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    prefLanguages.includes(l.code)
                      ? 'bg-accent text-bg-primary font-medium'
                      : 'bg-surface hover:bg-surface-hover text-text-secondary'
                  }`}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>

          {/* Category preferences */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">Category filter</h2>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => toggleMulti(c.id, prefCategories, setPrefCategories)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    prefCategories.includes(c.id)
                      ? 'bg-accent text-bg-primary font-medium'
                      : 'bg-surface hover:bg-surface-hover text-text-secondary'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Notification settings */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">Notifications</h2>
            <div>
              <label className="block text-sm text-text-secondary mb-2">Notify me before events start</label>
              <div className="flex gap-2">
                {[5, 15, 30].map((t) => (
                  <button
                    key={t}
                    onClick={() => setLeadTime(t)}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                      leadTime === t
                        ? 'bg-accent text-bg-primary font-medium'
                        : 'bg-surface hover:bg-surface-hover text-text-secondary'
                    }`}
                  >
                    {t} min
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* NSFW toggle (only if enabled for this user) */}
          {user?.nsfw_enabled === 1 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">Content</h2>
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setNsfw((v) => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${nsfw ? 'bg-accent' : 'bg-surface'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${nsfw ? 'translate-x-6' : 'translate-x-1'}`} />
                </div>
                <span className="text-text-primary text-sm">Show adult content (NSFW)</span>
              </label>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full"
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save preferences'}
          </button>

          {/* Recently watched */}
          {recentChannels.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">Recently watched</h2>
              <div className="space-y-2">
                {recentChannels.map((r) => (
                  <div key={r.channel_id} className="flex items-center justify-between py-1.5">
                    <span className="text-text-primary text-sm">{channelName(r.channel_id)}</span>
                    <span className="text-text-muted text-xs">
                      {new Date(r.watched_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
