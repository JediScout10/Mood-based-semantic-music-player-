import React from 'react';
import { Heart, Clock, Play, Trash2 } from 'lucide-react';
import { Song } from '../types/music';

interface LibraryViewProps {
  favorites: string[];
  recentSongs: Song[];
  sampleSongs: Song[];
  onPlaySong: (song: Song) => void;
  onToggleFavorite: (songId: string) => void;
  onClearHistory: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  favorites,
  recentSongs,
  sampleSongs,
  onPlaySong,
  onToggleFavorite,
  onClearHistory,
}) => {
  const favoriteSongs = sampleSongs.filter((song) => favorites.includes(song.id));

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="badge-sticker bg-lavender text-zinc-900 px-2.5 py-0.5 text-[10px]">
            PERSONAL VAULT
          </span>
        </div>
        <h1 className="text-3xl font-black text-zinc-900 tracking-tight mt-1">
          Your Music Library
        </h1>
        <p className="text-xs text-zinc-500 font-medium">
          Saved favorites and listening history stored locally on your device.
        </p>
      </div>

      {/* Grid: Favorites & Recently Played */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Favorites Section */}
        <div className="bg-white border-2 border-zinc-900 rounded-3xl p-6 shadow-[3px_4px_0px_0px_rgba(24,24,27,1)]">
          <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-zinc-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-rose-100 border border-zinc-900 flex items-center justify-center text-coral">
                <Heart className="w-4 h-4 fill-coral" />
              </div>
              <h2 className="text-lg font-black text-zinc-900">
                Favorite Tracks ({favoriteSongs.length})
              </h2>
            </div>
          </div>

          {favoriteSongs.length === 0 ? (
            <div className="p-8 text-center text-zinc-400">
              <p className="text-xs font-semibold">No favorites added yet.</p>
              <p className="text-[11px] mt-1 text-zinc-400">
                Click the heart icon on any song card to save it here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {favoriteSongs.map((song) => (
                <div
                  key={song.id}
                  onClick={() => onPlaySong(song)}
                  className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-zinc-50 border border-zinc-100 hover:border-zinc-900 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={song.artwork}
                      alt={song.title}
                      className="w-10 h-10 rounded-xl object-cover border border-zinc-900"
                    />
                    <div>
                      <h4 className="text-xs font-black text-zinc-900 leading-tight group-hover:text-periwinkle-dark">
                        {song.title}
                      </h4>
                      <p className="text-[11px] font-semibold text-zinc-500">
                        {song.artist} • <span className="capitalize">{song.mood}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(song.id);
                      }}
                      className="p-1.5 text-coral hover:bg-rose-50 rounded-full transition-colors"
                      title="Remove from favorites"
                    >
                      <Heart className="w-4 h-4 fill-coral" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlaySong(song);
                      }}
                      className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center"
                    >
                      <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Listening History */}
        <div className="bg-white border-2 border-zinc-900 rounded-3xl p-6 shadow-[3px_4px_0px_0px_rgba(24,24,27,1)]">
          <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-zinc-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-100 border border-zinc-900 flex items-center justify-center text-amber-700">
                <Clock className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-black text-zinc-900">
                Listening History ({recentSongs.length})
              </h2>
            </div>

            {recentSongs.length > 0 && (
              <button
                onClick={onClearHistory}
                className="text-xs font-bold text-zinc-400 hover:text-rose-600 flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>

          <div className="space-y-3">
            {recentSongs.map((song, i) => (
              <div
                key={`${song.id}-${i}`}
                onClick={() => onPlaySong(song)}
                className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-zinc-50 border border-zinc-100 hover:border-zinc-900 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={song.artwork}
                    alt={song.title}
                    className="w-10 h-10 rounded-xl object-cover border border-zinc-900"
                  />
                  <div>
                    <h4 className="text-xs font-black text-zinc-900 leading-tight group-hover:text-periwinkle-dark">
                      {song.title}
                    </h4>
                    <p className="text-[11px] font-semibold text-zinc-500">
                      {song.artist} • <span className="capitalize">{song.mood}</span>
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-black font-mono text-zinc-400">
                  {song.duration}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
