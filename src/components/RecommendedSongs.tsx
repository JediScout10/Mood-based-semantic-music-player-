import React from 'react';
import { Play, Pause, Heart, Music2 } from 'lucide-react';
import { Song, MoodType } from '../types/music';

interface RecommendedSongsProps {
  songs: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  onPlaySong: (song: Song) => void;
  favorites: string[];
  onToggleFavorite: (songId: string) => void;
  selectedMood: MoodType | null;
  searchQuery: string;
  onResetFilters: () => void;
}

export const RecommendedSongs: React.FC<RecommendedSongsProps> = ({
  songs,
  currentSong,
  isPlaying,
  onPlaySong,
  favorites,
  onToggleFavorite,
  selectedMood,
  searchQuery,
  onResetFilters,
}) => {
  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold tracking-wider text-zinc-500 uppercase">
              Curated Queue
            </span>
            {selectedMood && (
              <span className="badge-sticker bg-sunny text-zinc-900 px-2 py-0.5 text-[10px]">
                MOOD: {selectedMood.toUpperCase()}
              </span>
            )}
            {searchQuery && (
              <span className="badge-sticker bg-periwinkle-light text-zinc-900 px-2 py-0.5 text-[10px]">
                SEARCH: "{searchQuery}"
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">
            Recommended Songs
          </h2>
        </div>

        <span className="text-xs font-bold text-zinc-500">
          Showing {songs.length} {songs.length === 1 ? 'song' : 'songs'}
        </span>
      </div>

      {/* Empty state */}
      {songs.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-zinc-300 rounded-3xl p-10 text-center flex flex-col items-center justify-center my-4">
          <div className="w-16 h-16 rounded-2xl bg-zinc-100 border-2 border-zinc-900 flex items-center justify-center mb-4 text-zinc-400">
            <Music2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-zinc-900 mb-1">No matching tracks found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mb-4">
            We couldn't find any songs matching "{searchQuery || selectedMood}". Try clearing the filters or choosing another mood.
          </p>
          <button
            onClick={onResetFilters}
            className="px-4 py-2 bg-zinc-900 text-white rounded-full text-xs font-bold hover:bg-zinc-800 transition-colors shadow-sm"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {songs.map((song) => {
            const isCurrent = currentSong?.id === song.id;
            const isThisPlaying = isCurrent && isPlaying;
            const isFav = favorites.includes(song.id);
            // A track is "ready to play" if it has a YouTube ID, a direct audio URL,
            // or hasAudio === true. CSV-only tracks will resolve on click.
            const isPlayable = Boolean(song.youtubeId || song.audioUrl || song.hasAudio);

            return (
              <div
                key={song.id}
                onClick={() => onPlaySong(song)}
                className={`group bg-white border-2 border-zinc-900 rounded-2xl p-3.5 transition-all cursor-pointer flex flex-col justify-between ${
                  isCurrent
                    ? 'shadow-[4px_5px_0px_0px_rgba(24,24,27,1)] ring-2 ring-zinc-900 bg-amber-50/40'
                    : 'shadow-[2px_2px_0px_0px_rgba(24,24,27,1)] hover:shadow-[4px_5px_0px_0px_rgba(24,24,27,1)] hover:-translate-y-1'
                }`}
              >
                <div>
                  {/* Artwork + badges */}
                  <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-zinc-900 mb-3 bg-zinc-100">
                    <img
                      src={song.artwork}
                      alt={song.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Sticker badge */}
                    {song.badge && (
                      <div className="absolute top-2 left-2">
                        <span className={`badge-sticker px-2 py-0.5 text-[9px] ${
                          song.badge === 'NEW'
                            ? 'bg-sunny text-zinc-900'
                            : song.badge === 'TRENDING'
                            ? 'bg-lavender text-zinc-900'
                            : 'bg-mint text-zinc-900'
                        }`}>
                          {song.badge}
                        </span>
                      </div>
                    )}

                    {/* Source availability badge */}
                    <div className="absolute top-2 right-2">
                      {song.youtubeId ? (
                        <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          YT
                        </span>
                      ) : song.hasAudio || song.audioUrl ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          AUDIO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                          RESOLVE
                        </span>
                      )}
                    </div>

                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div
                        className="w-12 h-12 rounded-full bg-white border-2 border-zinc-900 flex items-center justify-center text-zinc-900 shadow-md"
                        title={isThisPlaying ? 'Pause' : isPlayable ? 'Play' : 'Resolve & Play'}
                      >
                        {isThisPlaying ? (
                          <Pause className="w-5 h-5 fill-current" />
                        ) : (
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Track info */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-zinc-900 truncate leading-tight group-hover:text-periwinkle-dark transition-colors">
                        {song.title}
                      </h4>
                      <p className="text-xs font-semibold text-zinc-500 truncate mt-0.5">
                        {song.artist}
                      </p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(song.id);
                      }}
                      className="p-1 text-zinc-400 hover:text-coral transition-colors flex-shrink-0"
                    >
                      <Heart className={`w-4 h-4 ${isFav ? 'fill-coral text-coral' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Card footer */}
                <div className="flex items-center justify-between pt-3 mt-2 border-t border-zinc-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 capitalize text-zinc-700">
                      {song.mood}
                    </span>
                    {isPlayable ? (
                      <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        Playable
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        On-Demand
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-zinc-500 font-mono text-xs font-bold">
                    <span>{song.duration}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
