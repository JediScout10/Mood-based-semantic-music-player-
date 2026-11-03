import React from 'react';
import { MOODS } from '../data/mockData';
import { MoodType } from '../types/music';
import { Check, Sun, CloudRain, Leaf, Zap, Flame, Coffee } from 'lucide-react';

interface MoodSelectorProps {
  selectedMood: MoodType | null;
  onSelectMood: (mood: MoodType | null) => void;
}

// Maps the emoji key stored in MOODS to a Lucide icon component
const MOOD_ICONS: Record<string, React.ElementType> = {
  sun: Sun,
  'cloud-rain': CloudRain,
  leaf: Leaf,
  zap: Zap,
  flame: Flame,
  coffee: Coffee,
};

export const MoodSelector: React.FC<MoodSelectorProps> = ({
  selectedMood,
  onSelectMood,
}) => {
  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold tracking-wider text-zinc-500 uppercase">
              Choose Your Vibe
            </span>
            <span className="badge-sticker bg-mint-light text-zinc-900 px-2 py-0.2 text-[10px]">
              6 MOOD STATES
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">
            Select Your Mood
          </h2>
        </div>

        {/* Clear filter button */}
        {selectedMood && (
          <button
            onClick={() => onSelectMood(null)}
            className="self-start sm:self-auto text-xs font-bold text-zinc-600 hover:text-zinc-900 underline decoration-zinc-400 underline-offset-4 flex items-center gap-1.5"
          >
            Show All Moods (Clear Filter)
          </button>
        )}
      </div>

      {/* 6 Mood Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {MOODS.map((mood) => {
          const isSelected = selectedMood === mood.id;
          const IconComponent = MOOD_ICONS[mood.emoji] ?? Sun;

          return (
            <button
              key={mood.id}
              onClick={() => onSelectMood(isSelected ? null : mood.id)}
              className={`relative rounded-2xl p-4 text-left transition-all border-2 border-zinc-900 flex flex-col justify-between h-32 group ${
                mood.accentColor
              } ${
                isSelected
                  ? 'scale-105 shadow-[4px_5px_0px_0px_rgba(24,24,27,1)] ring-2 ring-zinc-900'
                  : 'shadow-[2px_2px_0px_0px_rgba(24,24,27,1)] hover:scale-102 hover:shadow-[3px_4px_0px_0px_rgba(24,24,27,1)]'
              }`}
            >
              {/* Selected Badge Checkmark */}
              {isSelected && (
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-zinc-900 text-white flex items-center justify-center border-2 border-white shadow-sm z-10 animate-bounce">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}

              {/* Icon */}
              <div className="flex items-center justify-between">
                <IconComponent
                  className="w-8 h-8 sm:w-9 sm:h-9 group-hover:scale-110 transition-transform drop-shadow-sm"
                  strokeWidth={1.75}
                />
              </div>

              {/* Label & Description */}
              <div>
                <h3 className="text-sm font-black text-zinc-900 tracking-tight leading-tight">
                  {mood.label}
                </h3>
                <p className="text-[10px] font-bold text-zinc-700/80 leading-tight line-clamp-1 mt-0.5">
                  {mood.tagline}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
