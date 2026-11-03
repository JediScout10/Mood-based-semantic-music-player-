import React from 'react';
import { Search, Sparkles, X } from 'lucide-react';
import { ActiveTab, MoodType } from '../types/music';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenMoodDetector: () => void;
  selectedMood: MoodType | null;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  setSearchQuery,
  activeTab,
  setActiveTab,
  onOpenMoodDetector,
  selectedMood,
}) => {
  return (
    <header className="w-full max-w-7xl mx-auto pt-6 pb-4 px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
      {/* Brand Logo with tilted BETA badge */}
      <div className="flex items-center gap-3">
        <div 
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div className="relative flex items-center">
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 group-hover:text-periwinkle-dark transition-colors">
              MUSIC APP
            </span>
            <span className="ml-1 -mt-4 bg-zinc-900 text-cream-50 text-[10px] font-extrabold px-2 py-0.5 rounded-full transform -rotate-12 border border-zinc-700 shadow-sm">
              BETA
            </span>
          </div>
        </div>

        {/* Navigation Pills */}
        <nav className="flex items-center bg-white/80 backdrop-blur-sm border-2 border-zinc-900 rounded-full p-1 ml-2 sm:ml-4 shadow-sm">
          {(['home', 'library', 'journal'] as ActiveTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs font-bold capitalize transition-all ${
                activeTab === tab
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Center Search Bar & Detector Button */}
      <div className="flex items-center gap-3 w-full md:w-auto justify-end">
        {/* Search Input matching reference */}
        <div className="relative flex-1 md:w-72 sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
            <Search className="w-4 h-4 text-zinc-800" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="SEARCH BAR"
            className="w-full pl-10 pr-9 py-2 bg-white border-2 border-zinc-900 rounded-full text-xs font-bold tracking-wider placeholder:text-zinc-400 placeholder:font-bold focus:outline-none focus:ring-2 focus:ring-periwinkle focus:border-zinc-900 transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Detect My Mood Quick Action */}
        <button
          onClick={onOpenMoodDetector}
          className="flex items-center gap-1.5 bg-sunny border-2 border-zinc-900 text-zinc-950 px-3.5 py-2 rounded-full font-bold text-xs hover:bg-sunny-dark hover:scale-105 active:scale-95 transition-all shadow-[2px_2px_0px_0px_rgba(24,24,27,1)]"
        >
          <Sparkles className="w-3.5 h-3.5 text-zinc-900" />
          <span className="hidden sm:inline">Detect Mood</span>
          {selectedMood && (
            <span className="w-2 h-2 rounded-full bg-coral animate-ping" />
          )}
        </button>

        {/* User Profile Avatar with ring */}
        <div className="relative group cursor-pointer">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-zinc-900 overflow-hidden bg-lavender p-0.5 shadow-[2px_2px_0px_0px_rgba(24,24,27,1)] transition-transform group-hover:scale-105">
            <img
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80"
              alt="User Profile"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-mint-dark border-2 border-white rounded-full"></span>
        </div>
      </div>
    </header>
  );
};
