import React, { useState, useEffect, useMemo } from 'react';
import {
  Trash2,
  BookOpen,
  Camera,
  Upload,
  Sliders,
  Sun,
  CloudRain,
  Leaf,
  Zap,
  Flame,
  Coffee,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { MoodType } from '../types/music';
import { MOODS } from '../data/mockData';
import { loadJournal, clearJournal, MoodJournalEntry, JournalSource } from '../services/moodJournal';

const MOOD_ICONS: Record<MoodType, React.ElementType> = {
  happy: Sun,
  sad: CloudRain,
  calm: Leaf,
  energetic: Zap,
  angry: Flame,
  neutral: Coffee,
};

const MOOD_BAR_COLORS: Record<MoodType, string> = {
  happy: 'bg-sunny',
  sad: 'bg-periwinkle',
  calm: 'bg-mint',
  energetic: 'bg-coral',
  angry: 'bg-red-400',
  neutral: 'bg-lavender',
};

const MOOD_DOT_COLORS: Record<MoodType, string> = {
  happy: 'bg-amber-400',
  sad: 'bg-indigo-400',
  calm: 'bg-emerald-400',
  energetic: 'bg-rose-400',
  angry: 'bg-red-500',
  neutral: 'bg-purple-300',
};

interface DayColumn {
  dayName: string;
  dateStr: string;
  isToday: boolean;
  entries: MoodJournalEntry[];
}

interface MoodJournalProps {
  onOpenMoodDetector?: () => void;
}

export const MoodJournal: React.FC<MoodJournalProps> = ({ onOpenMoodDetector }) => {
  const [entries, setEntries] = useState<MoodJournalEntry[]>([]);

  // Reload data every time the tab opens / component mounts
  useEffect(() => {
    setEntries(loadJournal());
  }, []);

  const handleClear = () => {
    clearJournal();
    setEntries([]);
  };

  // Compute insight line (e.g. "Mostly Happy so far")
  const insightLine = useMemo(() => {
    if (entries.length === 0) return '';

    const counts: Record<MoodType, number> = {
      happy: 0,
      sad: 0,
      calm: 0,
      energetic: 0,
      angry: 0,
      neutral: 0,
    };

    for (const entry of entries) {
      if (counts[entry.mood] !== undefined) {
        counts[entry.mood]++;
      }
    }

    let topMood: MoodType = 'happy';
    let maxCount = -1;

    (Object.keys(counts) as MoodType[]).forEach((m) => {
      if (counts[m] > maxCount) {
        maxCount = counts[m];
        topMood = m;
      }
    });

    const moodLabel = topMood.charAt(0).toUpperCase() + topMood.slice(1);
    return `Mostly ${moodLabel} so far`;
  }, [entries]);

  // Compute mood counts & percentage for progress bars
  const moodBreakdown = useMemo(() => {
    const counts: Record<MoodType, number> = {
      happy: 0,
      sad: 0,
      calm: 0,
      energetic: 0,
      angry: 0,
      neutral: 0,
    };

    for (const entry of entries) {
      if (counts[entry.mood] !== undefined) {
        counts[entry.mood]++;
      }
    }

    const total = entries.length;

    return MOODS.map((m) => {
      const count = counts[m.id];
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        id: m.id,
        label: m.label,
        count,
        percent: pct,
        accentColor: m.accentColor,
        barColor: MOOD_BAR_COLORS[m.id],
        icon: MOOD_ICONS[m.id],
      };
    });
  }, [entries]);

  // Compute "Last 7 days" strip columns
  const last7Days = useMemo<DayColumn[]>(() => {
    const days: DayColumn[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const startOfDay = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate(),
        0,
        0,
        0,
        0
      ).getTime();
      const endOfDay = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate(),
        23,
        59,
        59,
        999
      ).getTime();

      const dayEntries = entries.filter((e) => e.time >= startOfDay && e.time <= endOfDay);

      days.push({
        dayName: targetDate.toLocaleDateString(undefined, { weekday: 'short' }),
        dateStr: targetDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        isToday: i === 0,
        entries: dayEntries,
      });
    }

    return days;
  }, [entries]);

  // Latest 8 entries for Recent list
  const recentEntries = useMemo(() => {
    return entries.slice(0, 8);
  }, [entries]);

  const renderSourceBadge = (source: JournalSource) => {
    switch (source) {
      case 'camera':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
            <Camera className="w-3 h-3" /> Camera
          </span>
        );
      case 'upload':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-300">
            <Upload className="w-3 h-3" /> Upload
          </span>
        );
      case 'manual':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
            <Sliders className="w-3 h-3" /> Manual
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge-sticker bg-lavender text-zinc-900 px-2.5 py-0.5 text-[10px]">
              EMOTION LOG
            </span>
          </div>
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight mt-1">
            Mood Journal ({entries.length})
          </h1>
          {entries.length > 0 && (
            <p className="text-xs text-zinc-600 font-bold mt-1">
              {insightLine}
            </p>
          )}
        </div>

        {entries.length > 0 && (
          <button
            onClick={handleClear}
            className="self-start sm:self-auto text-xs font-bold text-zinc-500 hover:text-rose-600 border-2 border-zinc-900 hover:border-rose-600 bg-white px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition-all shadow-[2px_2px_0px_0px_rgba(24,24,27,1)] active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear Journal
          </button>
        )}
      </div>

      {/* Empty State */}
      {entries.length === 0 ? (
        <div className="bg-white border-2 border-zinc-900 rounded-3xl p-12 text-center shadow-[3px_4px_0px_0px_rgba(24,24,27,1)] max-w-2xl mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-lavender-light border-2 border-zinc-900 flex items-center justify-center mx-auto text-zinc-800">
            <BookOpen className="w-8 h-8 text-zinc-800" />
          </div>
          <h3 className="text-lg font-black text-zinc-900">Your Journal is Empty</h3>
          <p className="text-xs font-semibold text-zinc-500 max-w-md mx-auto">
            No moods yet. Use Detect Mood to start your journal.
          </p>
          {onOpenMoodDetector && (
            <button
              onClick={onOpenMoodDetector}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-sunny border-2 border-zinc-900 rounded-full text-xs font-black text-zinc-950 shadow-[2px_2px_0px_0px_rgba(24,24,27,1)] hover:bg-sunny-dark transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" /> Detect Mood Now
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Main Card: Summary, Mood Breakdown & 7-Day Strip */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* 1. Mood Breakdown Card */}
            <div className="bg-white border-2 border-zinc-900 rounded-3xl p-6 shadow-[3px_4px_0px_0px_rgba(24,24,27,1)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-zinc-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-100 border border-zinc-900 flex items-center justify-center text-amber-900">
                      <Sun className="w-4 h-4" />
                    </div>
                    <h2 className="text-lg font-black text-zinc-900">
                      Mood Distribution
                    </h2>
                  </div>
                  <span className="text-[11px] font-bold text-zinc-500">
                    {entries.length} total {entries.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>

                {/* Coloured bar per mood */}
                <div className="space-y-3.5">
                  {moodBreakdown.map((m) => {
                    const IconComponent = m.icon;
                    return (
                      <div key={m.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-zinc-800">
                          <div className="flex items-center gap-2">
                            <IconComponent className="w-3.5 h-3.5 text-zinc-700" />
                            <span className="capitalize">{m.label}</span>
                          </div>
                          <span className="font-mono text-zinc-600">
                            {m.count} ({m.percent}%)
                          </span>
                        </div>
                        <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${m.barColor}`}
                            style={{
                              width: m.count > 0 ? `${Math.max(4, m.percent)}%` : '0%',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 2. Last 7 Days Strip Card */}
            <div className="bg-white border-2 border-zinc-900 rounded-3xl p-6 shadow-[3px_4px_0px_0px_rgba(24,24,27,1)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-zinc-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 border border-zinc-900 flex items-center justify-center text-emerald-900">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <h2 className="text-lg font-black text-zinc-900">
                      Last 7 Days
                    </h2>
                  </div>
                  <span className="text-[11px] font-bold text-zinc-400">
                    Daily Activity
                  </span>
                </div>

                <div className="grid grid-cols-7 gap-2 pt-2">
                  {last7Days.map((day, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col items-center p-2 rounded-2xl border-2 transition-all min-h-[140px] ${
                        day.isToday
                          ? 'border-zinc-900 bg-sunny/20 shadow-xs'
                          : 'border-zinc-200 bg-zinc-50'
                      }`}
                    >
                      <span className="text-[10px] font-black uppercase text-zinc-500">
                        {day.dayName}
                      </span>
                      <span className="text-xs font-black text-zinc-900 mb-2">
                        {day.dateStr.split(' ')[1]}
                      </span>

                      {/* One dot per entry */}
                      <div className="flex flex-wrap gap-1.5 justify-center items-center flex-1 content-start py-1">
                        {day.entries.length === 0 ? (
                          <span className="text-zinc-300 text-xs font-black mt-2">—</span>
                        ) : (
                          day.entries.map((entry) => (
                            <div
                              key={entry.id}
                              title={`${entry.mood.toUpperCase()} (${entry.source}) at ${new Date(
                                entry.time
                              ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                              className={`w-3 h-3 rounded-full border border-zinc-900 shadow-xs cursor-pointer hover:scale-125 transition-transform ${
                                MOOD_DOT_COLORS[entry.mood] || 'bg-zinc-400'
                              }`}
                            />
                          ))
                        )}
                      </div>

                      <span className="text-[9px] font-bold text-zinc-400 mt-auto">
                        {day.entries.length > 0 ? `${day.entries.length}` : '0'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dot legend */}
              <div className="mt-4 pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-center gap-3 text-[10px] font-bold text-zinc-600">
                {MOODS.map((m) => (
                  <div key={m.id} className="flex items-center gap-1">
                    <span
                      className={`w-2.5 h-2.5 rounded-full border border-zinc-900 ${
                        MOOD_DOT_COLORS[m.id]
                      }`}
                    />
                    <span className="capitalize">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* 3. Recent Entries List Card (Latest 8) */}
          <div className="bg-white border-2 border-zinc-900 rounded-3xl p-6 shadow-[3px_4px_0px_0px_rgba(24,24,27,1)]">
            <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-periwinkle-light border border-zinc-900 flex items-center justify-center text-indigo-900">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-black text-zinc-900">
                  Recent Entries
                </h2>
              </div>
              <span className="text-[11px] font-bold text-zinc-500">
                Showing latest {recentEntries.length} of {entries.length}
              </span>
            </div>

            <div className="space-y-2.5">
              {recentEntries.map((entry) => {
                const IconComponent = MOOD_ICONS[entry.mood] || Sun;
                const moodConfig = MOODS.find((m) => m.id === entry.mood);
                const dateObj = new Date(entry.time);
                const formattedTime = dateObj.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-200 hover:border-zinc-900 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl border border-zinc-900 flex items-center justify-center shadow-xs ${
                          moodConfig?.accentColor || 'bg-zinc-100'
                        }`}
                      >
                        <IconComponent className="w-4 h-4 text-zinc-900" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-zinc-900 capitalize">
                            {entry.mood}
                          </h4>
                          {renderSourceBadge(entry.source)}
                        </div>
                        <p className="text-[10px] font-bold text-zinc-500">
                          {moodConfig?.tagline || 'Emotional State'}
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] font-bold font-mono text-zinc-500">
                      {formattedTime}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
