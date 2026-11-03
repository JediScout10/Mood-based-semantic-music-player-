import React from 'react';
import { Play, Pause, Star, Home, Library } from 'lucide-react';
import { Song, ActiveTab } from '../types/music';

interface RecentlyPlayedProps {
  recentSongs: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  onPlaySong: (song: Song) => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const RecentlyPlayed: React.FC<RecentlyPlayedProps> = ({
  recentSongs,
  currentSong,
  isPlaying,
  onPlaySong,
  activeTab,
  setActiveTab,
}) => {
  return (
    <div className="flex flex-col h-full">
      <div className="text-[11px] font-extrabold tracking-wider text-zinc-500 uppercase mb-2">
        Recently Played Section
      </div>

      <div className="bg-white border-2 border-zinc-900 rounded-3xl p-5 shadow-[3px_4px_0px_0px_rgba(24,24,27,1)] flex flex-col justify-between h-full">
        
        {/* Track List */}
        <div className="space-y-3">
          {recentSongs.slice(0, 4).map((song, index) => {
            const isCurrent = currentSong?.id === song.id;
            const isThisPlaying = isCurrent && isPlaying;

            return (
              <div
                key={`${song.id}-${index}`}
                onClick={() => onPlaySong(song)}
                className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer group ${
                  isCurrent
                    ? 'bg-amber-50/80 border-zinc-900 shadow-sm'
                    : 'border-transparent hover:bg-zinc-50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Play Button Icon */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlaySong(song);
                    }}
                    className={`w-9 h-9 rounded-full border-2 border-zinc-900 flex items-center justify-center flex-shrink-0 transition-transform ${
                      isThisPlaying
                        ? 'bg-zinc-900 text-white'
                        : 'bg-lavender text-zinc-900 group-hover:scale-105'
                    }`}
                  >
                    {isThisPlaying ? (
                      <Pause className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-zinc-900 truncate">
                      {song.title}
                    </h4>
                    <p className="text-[11px] font-semibold text-zinc-500 truncate">
                      {song.artist}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Star className="w-3.5 h-3.5 fill-coral text-coral" />
                  <span className="text-[11px] font-black text-zinc-600 font-mono">
                    {song.duration}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Navigation matching reference */}
        <div className="border-t-2 border-zinc-200 pt-3 mt-4">
          <div className="flex items-center justify-around">
            <button
              onClick={() => setActiveTab('home')}
              className={`flex flex-col items-center gap-1 transition-colors ${
                activeTab === 'home'
                  ? 'text-zinc-950 font-black'
                  : 'text-zinc-400 hover:text-zinc-700'
              }`}
            >
              <Home className="w-4 h-4" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider">
                HOME
              </span>
            </button>

            <button
              onClick={() => setActiveTab('library')}
              className={`flex flex-col items-center gap-1 transition-colors ${
                activeTab === 'library'
                  ? 'text-zinc-950 font-black'
                  : 'text-zinc-400 hover:text-zinc-700'
              }`}
            >
              <Library className="w-4 h-4" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider">
                LIBRARY
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
