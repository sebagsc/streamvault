import { create } from 'zustand';
import { channels as channelsApi } from '../lib/api';
import type { Channel, ChannelQueryParams } from '../lib/api';

interface ChannelFilters {
  country: string;
  language: string;
  category: string;
  nsfw: boolean;
  search: string;
  show_all: boolean;
  source: string; // '' | 'freetv' | 'iptv-org'
}

interface ChannelState {
  channels: Channel[];
  total: number;
  page: number;
  pages: number;
  loading: boolean;
  error: string | null;
  filters: ChannelFilters;
  view: 'grid' | 'guide';
  activeEvents: Record<string, boolean>; // channelId -> isLive

  setFilter: (key: keyof ChannelFilters, value: string | boolean) => void;
  setFilters: (filters: Partial<ChannelFilters>) => void;
  setView: (view: 'grid' | 'guide') => void;
  fetchChannels: (page?: number) => Promise<void>;
  setActiveEvents: (map: Record<string, boolean>) => void;
}

export const useChannelStore = create<ChannelState>((set, get) => ({
  channels: [],
  total: 0,
  page: 1,
  pages: 0,
  loading: false,
  error: null,
  filters: {
    country: '',
    language: '',
    category: '',
    nsfw: false,
    search: '',
    show_all: false,
    source: '',
  },
  view: 'grid',
  activeEvents: {},

  setFilter: (key, value) => {
    set((state) => ({ filters: { ...state.filters, [key]: value } }));
  },

  setFilters: (filters) => {
    set((state) => ({ filters: { ...state.filters, ...filters } }));
  },

  setView: (view) => set({ view }),

  fetchChannels: async (page = 1) => {
    const { filters } = get();
    set({ loading: true, error: null });
    try {
      const params: ChannelQueryParams & { page?: number; limit?: number } = { page, limit: 100 };
      if (filters.country) params.country = filters.country;
      if (filters.language) params.language = filters.language;
      if (filters.category) params.category = filters.category;
      if (filters.nsfw) params.nsfw = true;
      if (filters.search) params.search = filters.search;
      if (filters.show_all) params.show_all = true;
      if (filters.source) params.source = filters.source;

      const data = await channelsApi.list(params);
      set({
        channels: data.channels,
        total: data.total,
        page: data.page,
        pages: data.pages,
      });
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Failed to load channels' });
    } finally {
      set({ loading: false });
    }
  },

  setActiveEvents: (map) => set({ activeEvents: map }),
}));
