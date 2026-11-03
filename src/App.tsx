import { useState, useEffect, useMemo, useCallback } from 'react';
import { SAMPLE_SONGS } from './data/mockData';
import { Song, MoodType, ActiveTab } from './types/music';
import { Header } from './components/Header';
import { MoodSelector } from './components/MoodSelector';
import { MainPlayer } from './components/MainPlayer';
import { RecommendedSongs } from './components/RecommendedSongs';
import { RecentlyPlayed } from './components/RecentlyPlayed';
import { DiscoverySection } from './components/DiscoverySection';
import { DetectMoodModal } from './components/DetectMoodModal';
import { LibraryView } from './components/LibraryView';
import { MoodJournal } from './components/MoodJournal';
import { fetchRecommendations, checkBackendHealth } from './services/api';
import { addJournalEntry } from './services/moodJournal';

export function App() {
  // Navigation & Filter States
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMoodDetectorOpen, setIsMoodDetectorOpen] = useState(false);

  // Backend Connection & Dynamic Song Catalog
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [recommendedTracks, setRecommendedTracks] = useState<Song[]>(SAMPLE_SONGS);

  // Playback State
  const [currentSong, setCurrentSong] = useState<Song>(SAMPLE_SONGS[0]);
  const [isPlaying, setIsPlaying] = useState(false);

  // Persistence in LocalStorage
  // CATALOGUE_VERSION bumped whenever SAMPLE_SONGS changes structure/IDs.
  // Old recents that don't match current IDs are discarded on load.
  const CATALOGUE_VERSION = 'v5-expanded-132-tracks';

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('moodmusic_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [recentlyPlayed, setRecentlyPlayed] = useState<Song[]>(() => {
    try {
      const storedVersion = localStorage.getItem('moodmusic_catalogue_version');
      if (storedVersion !== CATALOGUE_VERSION) {
        // Catalogue changed — discard stale recents (may contain Jamendo tracks)
        localStorage.setItem('moodmusic_catalogue_version', CATALOGUE_VERSION);
        localStorage.removeItem('moodmusic_recents');
        return [SAMPLE_SONGS[0], SAMPLE_SONGS[1], SAMPLE_SONGS[6], SAMPLE_SONGS[18]];
      }
      const saved = localStorage.getItem('moodmusic_recents');
      if (saved) {
        const parsed: Song[] = JSON.parse(saved);
        // Keep only recents that are in the current SAMPLE_SONGS catalogue
        const validIds = new Set(SAMPLE_SONGS.map((s) => s.id));
        const valid = parsed.filter((s) => validIds.has(s.id));
        return valid.length > 0
          ? valid
          : [SAMPLE_SONGS[0], SAMPLE_SONGS[1], SAMPLE_SONGS[6], SAMPLE_SONGS[18]];
      }
      return [SAMPLE_SONGS[0], SAMPLE_SONGS[1], SAMPLE_SONGS[6], SAMPLE_SONGS[18]];
    } catch {
      return [SAMPLE_SONGS[0], SAMPLE_SONGS[1], SAMPLE_SONGS[6], SAMPLE_SONGS[18]];
    }
  });

  // Check backend health
  useEffect(() => {
    let mounted = true;
    async function initBackend() {
      const online = await checkBackendHealth();
      if (!mounted) return;
      setIsBackendConnected(online);
    }

    initBackend();
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch recommendations whenever selectedMood or searchQuery changes
  const loadRecommendations = useCallback(async () => {
    try {
      const res = await fetchRecommendations(selectedMood, searchQuery, 50);
      setRecommendedTracks(res.tracks);
      setIsBackendConnected(res.isBackendConnected);

      // If the current song is not in the new list, switch to the first track.
      // This keeps Next/Prev navigation coherent when the list changes.
      if (res.tracks.length > 0) {
        setCurrentSong((prev) => {
          const stillPresent = res.tracks.some((s) => s.id === prev.id);
          return stillPresent ? prev : res.tracks[0];
        });
      }
    } catch (e) {
      console.warn('Error loading recommendations:', e);
    }
  }, [selectedMood, searchQuery]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  // Save favorites to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('moodmusic_favorites', JSON.stringify(favorites));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }, [favorites]);

  // Save recently played to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('moodmusic_recents', JSON.stringify(recentlyPlayed));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }, [recentlyPlayed]);

  // Toggle favorite
  const handleToggleFavorite = (songId: string) => {
    setFavorites((prev) =>
      prev.includes(songId)
        ? prev.filter((id) => id !== songId)
        : [...prev, songId]
    );
  };

  // Play a song & register in recently played
  const handlePlaySong = (song: Song) => {
    setCurrentSong(song);
    setIsPlaying(true);

    // Update recently played queue
    setRecentlyPlayed((prev) => {
      const filtered = prev.filter((s) => s.id !== song.id);
      return [song, ...filtered].slice(0, 10);
    });
  };

  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  // Next / Previous song
  const handleNext = () => {
    const list = recommendedTracks.length > 0 ? recommendedTracks : SAMPLE_SONGS;
    if (list.length === 0) return;
    const currentIndex = list.findIndex((s) => s.id === currentSong.id);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % list.length;
    handlePlaySong(list[nextIndex]);
  };

  const handlePrev = () => {
    const list = recommendedTracks.length > 0 ? recommendedTracks : SAMPLE_SONGS;
    if (list.length === 0) return;
    const currentIndex = list.findIndex((s) => s.id === currentSong.id);
    const prevIndex = currentIndex === -1 ? 0 : (currentIndex - 1 + list.length) % list.length;
    handlePlaySong(list[prevIndex]);
  };

  // New releases
  const newReleases = useMemo(() => {
    const fromApi = recommendedTracks.filter((s) => s.badge === 'NEW');
    return fromApi.length > 0 ? fromApi : SAMPLE_SONGS.filter((s) => s.badge === 'NEW');
  }, [recommendedTracks]);

  return (
    <div className="min-h-screen bg-[#FAF7F0] relative overflow-hidden flex flex-col justify-between selection:bg-sunny selection:text-zinc-950">
      
      {/* Background Pastel Geometric Accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-40">
        <div className="absolute -top-16 -right-16 w-80 h-80 bg-coral/15 rounded-full blur-3xl transform rotate-45"></div>
        <div className="absolute top-1/3 -left-20 w-96 h-96 bg-periwinkle/15 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-16 -left-16 w-80 h-80 bg-mint/20 rounded-full blur-2xl"></div>
        <div className="absolute bottom-1/4 -right-12 w-72 h-72 bg-sunny/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 flex flex-col flex-1">
        {/* Backend Status Bar */}
        <div className="w-full bg-zinc-900 text-white text-[11px] font-bold py-1 px-4 flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isBackendConnected ? 'bg-mint animate-pulse' : 'bg-amber-400'}`} />
            <span>
              {isBackendConnected
                ? 'YouTube Playback Active — Curated Mainstream Catalogue'
                : 'Offline Mode — Curated Mainstream Catalogue (YouTube Playback)'}
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 hidden sm:inline">
            YouTube IFrame API • Mood-Based Recommendations
          </span>
        </div>

        {/* 1. Header */}
        <Header
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenMoodDetector={() => setIsMoodDetectorOpen(true)}
          selectedMood={selectedMood}
        />

        {/* Dynamic Tab Views */}
        {activeTab === 'home' && (
          <main className="flex-1 pb-16 space-y-2">
            
            {/* 1. Manual Mood Selector (Primary Focus) */}
            <MoodSelector
              selectedMood={selectedMood}
              onSelectMood={(mood) => {
                setSelectedMood(mood);
                if (mood) {
                  addJournalEntry(mood, 'manual');
                }
              }}
            />

            {/* 2. Main Music Player Card */}
            <MainPlayer
              currentSong={currentSong}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onNext={handleNext}
              onPrev={handlePrev}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
            />

            {/* 3. Recommended Songs Grid with active filters */}
            <RecommendedSongs
              songs={recommendedTracks}
              currentSong={currentSong}
              isPlaying={isPlaying}
              onPlaySong={handlePlaySong}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              selectedMood={selectedMood}
              searchQuery={searchQuery}
              onResetFilters={() => {
                setSelectedMood(null);
                setSearchQuery('');
              }}
            />

            {/* 4. Lower Dashboard Section */}
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                <RecentlyPlayed
                  recentSongs={recentlyPlayed}
                  currentSong={currentSong}
                  isPlaying={isPlaying}
                  onPlaySong={handlePlaySong}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                />

                <DiscoverySection
                  onPlaySong={handlePlaySong}
                  newReleases={newReleases}
                />
              </div>
            </div>

          </main>
        )}

        {/* Tab: Library */}
        {activeTab === 'library' && (
          <LibraryView
            favorites={favorites}
            recentSongs={recentlyPlayed}
            sampleSongs={recommendedTracks.length > 0 ? recommendedTracks : SAMPLE_SONGS}
            onPlaySong={handlePlaySong}
            onToggleFavorite={handleToggleFavorite}
            onClearHistory={() => setRecentlyPlayed([])}
          />
        )}

        {/* Tab: Journal */}
        {activeTab === 'journal' && (
          <MoodJournal onOpenMoodDetector={() => setIsMoodDetectorOpen(true)} />
        )}

        {/* Interactive Mood Detector Modal */}
        <DetectMoodModal
          isOpen={isMoodDetectorOpen}
          onClose={() => setIsMoodDetectorOpen(false)}
          onApplyMood={(mood) => {
            setSelectedMood(mood);
            setActiveTab('home');
          }}
        />

        {/* Minimal Footer */}
        <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-bold text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="text-zinc-900 font-black">MoodMusicPlayer</span>
            <span>•</span>
            <span>Vite + React Frontend</span>
            <span>•</span>
            <span>Python Flask Backend</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[11px] text-zinc-400">
              {isBackendConnected ? 'Connected to Flask (Port 5000)' : 'Flask Server Offline'}
            </span>
          </div>
        </footer>

      </div>
    </div>
  );
}

export default App;
