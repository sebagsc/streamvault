import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useChannelStore } from '../store/channelStore';
import { events as eventsApi } from '../lib/api';

interface NavBarProps {
  onFiltersToggle?: () => void;
}

export default function NavBar({ onFiltersToggle }: NavBarProps) {
  const { user, logout } = useAuthStore();
  const { view, setView, setFilter, filters } = useChannelStore();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [siteTotal, setSiteTotal] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    eventsApi.list().then((data) => {
      setUnread(data.filter((e) => e.subscribed).length);
    }).catch(() => {});

    // Fetch site total
    fetch('/api/presence').then((r) => r.json()).then((d: { total: number }) => {
      setSiteTotal(d.total);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 bg-bg-secondary/90 backdrop-blur-sm border-b border-surface-border">
      <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center gap-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-bg-primary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
            </svg>
          </div>
          <span className="font-bold text-text-primary text-sm hidden sm:block">StreamVault</span>
        </Link>

        {/* View switcher */}
        <div className="flex items-center gap-0.5 bg-surface rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => setView('grid')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              view === 'grid' ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => setView('guide')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              view === 'guide' ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            TV Guide
          </button>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              placeholder="Search channels..."
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              className="input pl-9 pr-3 h-9 text-sm"
            />
          </div>
        </div>

        {/* Filters toggle (mobile/desktop) */}
        {onFiltersToggle && (
          <button onClick={onFiltersToggle} className="btn-ghost p-2 rounded-lg">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
        )}

        {/* Site total */}
        {siteTotal > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 text-text-muted text-xs shrink-0">
            <span className="w-1.5 h-1.5 bg-status-online rounded-full" />
            <span>{siteTotal} online</span>
          </div>
        )}

        {/* Notifications bell */}
        <Link to="/notifications" className="relative p-2 rounded-lg hover:bg-surface transition-colors">
          <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-status-live text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>

        {/* User menu */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface transition-colors"
          >
            <div className="w-7 h-7 bg-accent/20 rounded-full flex items-center justify-center">
              <span className="text-accent text-xs font-bold">
                {(user?.display_name || user?.email || '?')[0].toUpperCase()}
              </span>
            </div>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-bg-elevated border border-surface-border rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in">
              <div className="px-3 py-2.5 border-b border-surface-border">
                <p className="text-text-primary text-sm font-medium truncate">{user?.display_name || user?.email}</p>
                <p className="text-text-muted text-xs capitalize">{user?.role}</p>
              </div>
              <Link to="/profile" className="flex items-center gap-2 px-3 py-2.5 hover:bg-surface text-text-secondary hover:text-text-primary text-sm transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                Profile
              </Link>
              {user?.role === 'admin' && (
                <Link to="/admin" className="flex items-center gap-2 px-3 py-2.5 hover:bg-surface text-text-secondary hover:text-text-primary text-sm transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Admin Panel
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2.5 hover:bg-surface text-status-broken text-sm w-full transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
