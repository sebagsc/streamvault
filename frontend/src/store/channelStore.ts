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
}

interface ChannelState {
  channels: Channel[];
  loading: boolean;
  error: string | null;
  filters: ChannelFilters;
  view: 'grid' | 'guide';
  activeEvents: Record<string, boolean>; // channelId -> isLive

  setFilter: (key: keyof ChannelFilters, value: string | boolean) => void;
  setFilters: (filters: Partial<ChannelFilters>) => void;
  setView: (view: 'grid' | 'guide') => void;
  fetchChannels: () => Promise<void>;
  setActiveEvents: (map: Record<string, boolean>) => void;
}

export const useChannelStore = create<ChannelState>((set, get) => ({
  channels: [],
  loading: false,
  error: null,
  filters: {
    country: '',
    language: '',
    category: '',
    nsfw: false,
    search: '',
    show_all: false,
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

  fetchChannels: async () => {
    const { filters } = get();
    set({ loading: true, error: null });
    try {
      const params: ChannelQueryParams = {};
      if (filters.country) params.country = filters.country;
      if (filters.language) params.language = filters.language;
      if (filters.category) params.category = filters.category;
      if (filters.nsfw) params.nsfw = true;
      if (filters.search) params.search = filters.search;
      if (filters.show_all) params.show_all = true;

      const data = await channelsApi.list(params);
      set({ channels: data });
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Failed to load channels' });
    } finally {
      set({ loading: false });
    }
  },

  setActiveEvents: (map) => set({ activeEvents: map }),
}));
