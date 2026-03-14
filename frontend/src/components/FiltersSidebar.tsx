import { useEffect, useState } from 'react';
import { useChannelStore } from '../store/channelStore';
import { useAuthStore } from '../store/authStore';
import { meta } from '../lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function FiltersSidebar({ isOpen, onClose }: Props) {
  const { filters, setFilter } = useChannelStore();
  const { user } = useAuthStore();
  const [countries, setCountries] = useState<{ code: string; name: string; flag: string }[]>([]);
  const [languages, setLanguages] = useState<{ code: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    Promise.all([meta.countries(), meta.languages(), meta.categories()])
      .then(([c, l, cat]) => {
        setCountries(c);
        setLanguages(l);
        setCategories(cat);
      })
      .catch(() => {});
  }, []);

  const FilterSection = ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) => (
    <div className="mb-5">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{label}</h3>
      {children}
    </div>
  );

  const sidebarContent = (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-surface-border">
        <h2 className="text-text-primary font-semibold">Filters</h2>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <FilterSection label="Country">
          <select
            value={filters.country}
            onChange={(e) => setFilter('country', e.target.value)}
            className="input text-sm"
          >
            <option value="">All countries</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        </FilterSection>

        <FilterSection label="Language">
          <select
            value={filters.language}
            onChange={(e) => setFilter('language', e.target.value)}
            className="input text-sm"
          >
            <option value="">All languages</option>
            {languages.slice(0, 100).map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </FilterSection>

        <FilterSection label="Category">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilter('category', '')}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                !filters.category
                  ? 'bg-accent text-bg-primary font-medium'
                  : 'bg-surface hover:bg-surface-hover text-text-secondary'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilter('category', filters.category === cat.id ? '' : cat.id)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                  filters.category === cat.id
                    ? 'bg-accent text-bg-primary font-medium'
                    : 'bg-surface hover:bg-surface-hover text-text-secondary'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </FilterSection>

        {user?.nsfw_enabled === 1 && (
          <FilterSection label="Content">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setFilter('nsfw', !filters.nsfw)}
                className={`relative w-9 h-5 rounded-full transition-colors ${filters.nsfw ? 'bg-accent' : 'bg-surface'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${filters.nsfw ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-text-secondary text-sm">Show NSFW</span>
            </label>
          </FilterSection>
        )}

        <FilterSection label="Options">
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => setFilter('show_all', !filters.show_all)}
              className={`relative w-9 h-5 rounded-full transition-colors ${filters.show_all ? 'bg-accent' : 'bg-surface'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${filters.show_all ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-text-secondary text-sm">Show all (ignore preferences)</span>
          </label>
        </FilterSection>
      </div>

      {/* Clear all */}
      {(filters.country || filters.language || filters.category || filters.nsfw) && (
        <div className="p-4 border-t border-surface-border">
          <button
            onClick={() => {
              setFilter('country', '');
              setFilter('language', '');
              setFilter('category', '');
              setFilter('nsfw', false);
            }}
            className="btn-ghost w-full text-sm"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`hidden lg:block w-56 shrink-0 border-r border-surface-border bg-bg-secondary min-h-[calc(100vh-3.5rem)] transition-all ${isOpen ? '' : ''}`}>
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <aside className="relative w-72 bg-bg-secondary border-r border-surface-border h-full overflow-hidden">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
