import { useEffect, useState, useRef } from 'react';
import { channels as channelsApi } from '../lib/api';
import type { Channel, EpgProgram } from '../lib/api';

interface Props {
  channels: Channel[];
  onChannelClick: (channel: Channel) => void;
}

const CELL_MINUTES = 30;
const CELL_WIDTH = 160;
const CHANNEL_COL_WIDTH = 160;
const ROW_HEIGHT = 56;
const VISIBLE_HOURS = 4;

function getTimeSlots(start: Date, hours: number): Date[] {
  const slots: Date[] = [];
  const current = new Date(start);
  current.setMinutes(Math.floor(current.getMinutes() / 30) * 30, 0, 0);
  for (let i = 0; i < hours * 2; i++) {
    slots.push(new Date(current));
    current.setMinutes(current.getMinutes() + CELL_MINUTES);
  }
  return slots;
}

function minutesSinceSlotStart(slotStart: Date): number {
  const now = new Date();
  return (now.getTime() - slotStart.getTime()) / 60000;
}

export default function TVGuide({ channels, onChannelClick }: Props) {
  const [epg, setEpg] = useState<Record<string, EpgProgram[]>>({});
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const nowRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const guideStart = new Date(now);
  guideStart.setHours(guideStart.getHours() - 1, 0, 0, 0);
  const slots = getTimeSlots(guideStart, VISIBLE_HOURS + 2);

  useEffect(() => {
    const channelSlice = channels.slice(0, 30);
    setLoading(true);
    Promise.allSettled(
      channelSlice.map((ch) =>
        channelsApi.epg(ch.id).then((data) => ({ id: ch.id, programs: data.programs }))
      )
    ).then((results) => {
      const map: Record<string, EpgProgram[]> = {};
      for (const r of results) {
        if (r.status === 'fulfilled') {
          map[r.value.id] = r.value.programs;
        }
      }
      setEpg(map);
    }).finally(() => setLoading(false));
  }, [channels]);

  // Scroll to now line on mount
  useEffect(() => {
    setTimeout(() => {
      nowRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, 300);
  }, []);

  const nowOffsetPx =
    CHANNEL_COL_WIDTH +
    ((now.getTime() - guideStart.getTime()) / 60000 / CELL_MINUTES) * CELL_WIDTH;

  const programsForSlot = (channelId: string, slotStart: Date, slotEnd: Date): EpgProgram[] => {
    const programs = epg[channelId] ?? [];
    return programs.filter((p) => {
      const ps = new Date(p.start).getTime();
      const pe = new Date(p.stop).getTime();
      return ps < slotEnd.getTime() && pe > slotStart.getTime();
    });
  };

  const progressPercent = (program: EpgProgram): number => {
    const start = new Date(program.start).getTime();
    const end = new Date(program.stop).getTime();
    const nowMs = Date.now();
    if (nowMs < start) return 0;
    if (nowMs > end) return 100;
    return Math.round(((nowMs - start) / (end - start)) * 100);
  };

  if (loading && Object.keys(epg).length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 skeleton rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-auto" ref={containerRef} style={{ maxHeight: 'calc(100vh - 220px)' }}>
      <div style={{ position: 'relative', minWidth: CHANNEL_COL_WIDTH + slots.length * CELL_WIDTH }}>
        {/* Time header */}
        <div
          className="sticky top-0 z-10 flex bg-bg-secondary border-b border-surface-border"
          style={{ height: 36 }}
        >
          <div style={{ width: CHANNEL_COL_WIDTH, minWidth: CHANNEL_COL_WIDTH }} className="shrink-0 border-r border-surface-border px-3 flex items-center">
            <span className="text-text-muted text-xs font-medium">Channel</span>
          </div>
          {slots.map((slot, i) => (
            <div
              key={i}
              style={{ width: CELL_WIDTH, minWidth: CELL_WIDTH }}
              className="shrink-0 px-2 flex items-center border-r border-surface-border/30"
            >
              <span className="text-text-secondary text-xs font-mono">
                {slot.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>

        {/* Now line */}
        <div
          ref={nowRef}
          className="absolute top-9 bottom-0 w-px bg-accent/60 z-20 pointer-events-none"
          style={{ left: nowOffsetPx }}
        >
          <div className="w-2 h-2 bg-accent rounded-full -translate-x-[3px] -translate-y-1" />
        </div>

        {/* Channel rows */}
        {channels.slice(0, 50).map((ch) => (
          <div
            key={ch.id}
            className="flex border-b border-surface-border/40 hover:bg-surface/30 transition-colors"
            style={{ height: ROW_HEIGHT }}
          >
            {/* Channel label */}
            <button
              onClick={() => onChannelClick(ch)}
              style={{ width: CHANNEL_COL_WIDTH, minWidth: CHANNEL_COL_WIDTH }}
              className="shrink-0 border-r border-surface-border flex items-center gap-2 px-3 hover:bg-surface transition-colors"
            >
              {ch.logo ? (
                <img src={ch.logo} alt={ch.name} className="w-8 h-8 object-contain" />
              ) : (
                <div className="w-8 h-8 bg-surface rounded flex items-center justify-center">
                  <span className="text-[10px] text-text-muted font-bold">{ch.name.slice(0, 2)}</span>
                </div>
              )}
              <span className="text-text-primary text-xs font-medium line-clamp-2 text-left leading-snug">{ch.name}</span>
            </button>

            {/* Program slots */}
            <div className="flex relative" style={{ flex: 1 }}>
              {slots.map((slot, i) => {
                const slotEnd = new Date(slot.getTime() + CELL_MINUTES * 60000);
                const programs = programsForSlot(ch.id, slot, slotEnd);

                return (
                  <div
                    key={i}
                    style={{ width: CELL_WIDTH, minWidth: CELL_WIDTH }}
                    className="shrink-0 relative border-r border-surface-border/20 px-1 py-1"
                  >
                    {programs.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <span className="text-text-muted text-[10px]">—</span>
                      </div>
                    ) : (
                      programs.map((prog, pi) => {
                        const progress = progressPercent(prog);
                        return (
                          <button
                            key={pi}
                            onClick={() => onChannelClick(ch)}
                            className="w-full h-full flex flex-col justify-center px-1.5 rounded bg-surface hover:bg-surface-hover transition-colors text-left relative overflow-hidden group"
                          >
                            {progress > 0 && (
                              <div
                                className="absolute inset-0 bg-accent/10 rounded"
                                style={{ width: `${progress}%` }}
                              />
                            )}
                            <span className="text-text-primary text-[10px] font-medium truncate relative z-10">{prog.title}</span>
                            <div className="w-full h-0.5 bg-surface-border rounded-full mt-1 relative z-10">
                              {progress > 0 && (
                                <div className="h-full bg-accent rounded-full" style={{ width: `${progress}%` }} />
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
