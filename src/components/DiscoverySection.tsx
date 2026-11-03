import React from 'react';
import { Home, Download, Plus, Settings, ArrowRight } from 'lucide-react';
import { Song } from '../types/music';

interface DiscoverySectionProps {
  onPlaySong: (song: Song) => void;
  newReleases: Song[];
}

export const DiscoverySection: React.FC<DiscoverySectionProps> = ({
  onPlaySong,
  newReleases,
}) => {
  const latestSong = newReleases[0];

  return (
    <div className="flex flex-col h-full">
      <div className="text-[11px] font-extrabold tracking-wider text-zinc-500 uppercase mb-2">
        Small Notification Card
      </div>

      <div className="flex flex-col justify-between h-full space-y-4">
        
        {/* Yellow "NEW RELEASE ALERT" Card with overlapping "NEW" sticker */}
        <div className="relative">
          {/* Overlapping top-right NEW sticker */}
          <div className="absolute -top-3 -right-2 z-20">
            <span className="badge-sticker bg-lavender text-zinc-900 px-3 py-1 text-xs transform rotate-12 shadow-[2px_2px_0px_0px_rgba(24,24,27,1)]">
              NEW
            </span>
          </div>

          <div 
            onClick={() => latestSong && onPlaySong(latestSong)}
            className="bg-sunny border-2 border-zinc-900 rounded-3xl p-6 shadow-[3px_4px_0px_0px_rgba(24,24,27,1)] cursor-pointer hover:scale-101 active:scale-99 transition-all text-center flex flex-col items-center justify-center min-h-[110px]"
          >
            <h3 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight uppercase">
              NEW RELEASE ALERT
            </h3>
            {latestSong && (
              <p className="text-xs font-bold text-zinc-800 mt-1 flex items-center gap-1">
                <span>{latestSong.title}</span>
                <span>•</span>
                <span className="opacity-80">{latestSong.artist}</span>
              </p>
            )}
          </div>
        </div>

        {/* Scattered playful stickers section matching reference image */}
        <div className="relative py-4 px-2 min-h-[100px] flex items-center justify-center">
          {/* Floating Sticker: NEW (mint) */}
          <span className="badge-sticker bg-mint text-zinc-900 px-3 py-1 text-[11px] transform -rotate-12 absolute left-4 top-2 shadow-[2px_2px_0px_0px_rgba(24,24,27,1)]">
            NEW
          </span>

          {/* Floating Sticker: TRENDING (coral) */}
          <span className="badge-sticker bg-coral text-white px-3.5 py-1 text-[11px] transform rotate-6 absolute right-4 top-4 shadow-[2px_2px_0px_0px_rgba(24,24,27,1)]">
            TRENDING
          </span>

          {/* Floating Sticker: PLAYING (periwinkle) */}
          <span className="badge-sticker bg-periwinkle-light text-zinc-900 px-3 py-1 text-[10px] transform -rotate-6 absolute left-8 bottom-3 shadow-[2px_2px_0px_0px_rgba(24,24,27,1)]">
            PLAYING
          </span>

          {/* Floating Heart Sticker */}
          <div className="w-8 h-8 rounded-full bg-rose-200 border-2 border-zinc-900 flex items-center justify-center text-coral shadow-[2px_2px_0px_0px_rgba(24,24,27,1)] transform rotate-12 absolute left-1/2 -translate-x-12 bottom-2">
            ❤️
          </div>

          {/* Floating Sticker: FAV (coral rectangle) */}
          <span className="badge-sticker bg-coral-light text-rose-950 px-3 py-1 text-[11px] font-black rounded-lg transform rotate-3 absolute right-12 bottom-2 shadow-[2px_2px_0px_0px_rgba(24,24,27,1)]">
            FAV
          </span>
        </div>

        {/* Bottom Floating Navigation / Action Bar matching reference image */}
        <div className="bg-white border-2 border-zinc-900 rounded-3xl p-3 shadow-[3px_4px_0px_0px_rgba(24,24,27,1)]">
          <div className="flex items-center justify-around text-zinc-800">
            <button className="p-2 hover:bg-zinc-100 rounded-2xl transition-colors" title="Home">
              <Home className="w-5 h-5 fill-zinc-900" />
            </button>
            <button className="p-2 hover:bg-zinc-100 rounded-2xl transition-colors" title="Downloads / Offline">
              <Download className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-sm" title="Add Track or Playlist">
              <Plus className="w-5 h-5 stroke-[3]" />
            </button>
            <button className="p-2 hover:bg-zinc-100 rounded-2xl transition-colors" title="Settings">
              <Settings className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-zinc-100 rounded-2xl transition-colors" title="Next Discovery">
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
