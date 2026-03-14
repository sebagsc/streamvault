import { create } from 'zustand';
import type { Channel } from '../lib/api';

interface PlayerState {
  channel: Channel | null;
  streamIndex: number;
  isOpen: boolean;
  quality: string;
  streamError: string | null;
  isTryingFallback: boolean;

  openPlayer: (channel: Channel) => void;
  closePlayer: () => void;
  nextStream: () => void;
  setQuality: (q: string) => void;
  setStreamError: (err: string | null) => void;
  setIsTryingFallback: (v: boolean) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  channel: null,
  streamIndex: 0,
  isOpen: false,
  quality: '',
  streamError: null,
  isTryingFallback: false,

  openPlayer: (channel) => {
    // Persist last watched channel
    localStorage.setItem('lastChannel', channel.id);
    set({ channel, streamIndex: 0, isOpen: true, streamError: null, quality: '', isTryingFallback: false });
  },

  closePlayer: () => {
    set({ isOpen: false, channel: null, streamError: null });
  },

  nextStream: () => {
    const { channel, streamIndex } = get();
    if (!channel) return;
    const nextIdx = streamIndex + 1;
    if (nextIdx < channel.streams.length) {
      set({ streamIndex: nextIdx, isTryingFallback: true, streamError: null });
    } else {
      set({ streamError: 'All streams unavailable', isTryingFallback: false });
    }
  },

  setQuality: (quality) => set({ quality }),
  setStreamError: (streamError) => set({ streamError }),
  setIsTryingFallback: (isTryingFallback) => set({ isTryingFallback }),
}));
