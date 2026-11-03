import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Heart, AlertCircle, Loader2,
} from 'lucide-react';
import { Song } from '../types/music';

// ── YouTube IFrame API Types ─────────────────────────────────────────────────
declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string | HTMLElement,
        options: {
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  mute(): void;
  unMute(): void;
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
  getPlayerState(): number;
}

// ── YouTube IFrame API Singleton Loader ──────────────────────────────────────
let ytApiLoaded = false;
let ytApiCallbacks: Array<() => void> = [];

function ensureYTApiLoaded(cb: () => void) {
  if (typeof window !== 'undefined' && window.YT && typeof window.YT.Player !== 'undefined') {
    cb();
    return;
  }
  ytApiCallbacks.push(cb);
  if (!ytApiLoaded) {
    ytApiLoaded = true;
    window.onYouTubeIframeAPIReady = () => {
      ytApiCallbacks.forEach((fn) => fn());
      ytApiCallbacks = [];
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  }
}

// ── MainPlayer Component ─────────────────────────────────────────────────────
interface MainPlayerProps {
  currentSong: Song | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  favorites: string[];
  onToggleFavorite: (songId: string) => void;
}

export const MainPlayer: React.FC<MainPlayerProps> = ({
  currentSong,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  favorites,
  onToggleFavorite,
}) => {
  const [progressSeconds, setProgressSeconds] = useState(0);
  const [volume, setVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);

  // Resolution state
  const [resolvedYoutubeId, setResolvedYoutubeId] = useState<string | null>(null);
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Playback confirmation state (only true when audio engine confirms playback)
  const [isConfirmedPlaying, setIsConfirmedPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [ytPlayerReady, setYtPlayerReady] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });

  const usingYoutube = Boolean(resolvedYoutubeId);
  const usingDirectAudio = Boolean(resolvedAudioUrl) && !usingYoutube;
  const canPlay = !audioError && !isLoadingAudio && ((usingYoutube && ytPlayerReady) || usingDirectAudio);

  // ── Helper: Stop progress ticker ───────────────────────────────────────────
  function stopProgressTimer() {
    if (progressTimerRef.current !== null) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }

  // ── Helper: Destroy YT Player ──────────────────────────────────────────────
  function destroyYTPlayer() {
    stopProgressTimer();
    try {
      ytPlayerRef.current?.destroy();
    } catch {
      /* ignore */
    }
    ytPlayerRef.current = null;
    setYtPlayerReady(false);
    setIsConfirmedPlaying(false);
    setIsBuffering(false);
  }

  // ── Load YT API once on mount ──────────────────────────────────────────────
  useEffect(() => {
    ensureYTApiLoaded(() => {
      /* API loaded */
    });
  }, []);

  // ── When currentSong changes: immediately reset & resolve source ───────────
  useEffect(() => {
    // Invalidate previous song's resolution in-flight
    abortRef.current.aborted = true;
    abortRef.current = { aborted: false };
    const abort = abortRef.current;

    // Immediately reset playback state so UI updates to new song cleanly
    setProgressSeconds(0);
    setAudioError(null);
    setIsConfirmedPlaying(false);
    setIsBuffering(false);
    setResolvedYoutubeId(null);
    setResolvedAudioUrl(null);
    destroyYTPlayer();

    if (!currentSong) return;

    // Case 1: Song already has verified YouTube ID
    if (currentSong.youtubeId) {
      setIsLoadingAudio(false);
      setResolvedYoutubeId(currentSong.youtubeId);
      return;
    }

    // Case 2: Song already has direct audio URL
    if (currentSong.audioUrl) {
      setIsLoadingAudio(false);
      setResolvedAudioUrl(currentSong.audioUrl);
      return;
    }

    // Case 3: Need to resolve YouTube video ID via backend resolver
    setIsLoadingAudio(true);

    const params = new URLSearchParams({
      title: currentSong.title,
      artist: currentSong.artist,
    });

    const isStale = () => abort.aborted;

    const resolveAudio = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:5000/api/youtube-id?${params.toString()}`);
        if (isStale()) return;

        if (res.ok) {
          const data = await res.json();
          if (isStale()) return;
          if (data.videoId) {
            currentSong.youtubeId = data.videoId;
            currentSong.hasAudio = true;
            setResolvedYoutubeId(data.videoId);
            setIsLoadingAudio(false);
            return;
          }
        }

        const errData = await res.json().catch(() => ({}));
        if (isStale()) return;
        setAudioError(errData.error || `No YouTube recording found for "${currentSong.title}" by ${currentSong.artist}.`);
        setIsLoadingAudio(false);
      } catch {
        if (isStale()) return;
        setAudioError('Backend offline: unable to resolve YouTube video for this track.');
        setIsLoadingAudio(false);
      }
    };

    resolveAudio();

    return () => {
      abort.aborted = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.id]);

  // ── Create YouTube IFrame Player when videoId is available ─────────────────
  useEffect(() => {
    if (!resolvedYoutubeId) return;

    ensureYTApiLoaded(() => {
      if (!ytContainerRef.current) return;
      destroyYTPlayer();

      const playerDiv = document.createElement('div');
      ytContainerRef.current!.innerHTML = '';
      ytContainerRef.current!.appendChild(playerDiv);

      const player = new window.YT.Player(playerDiv, {
        videoId: resolvedYoutubeId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          fs: 0,
        },
        events: {
          onReady: (event) => {
            ytPlayerRef.current = event.target;
            event.target.setVolume(isMuted ? 0 : volume);
            setYtPlayerReady(true);
            if (isPlaying) {
              event.target.playVideo();
            }
          },
          onStateChange: (event) => {
            // YT.PlayerState: -1 = UNSTARTED, 0 = ENDED, 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING
            if (event.data === 1) {
              setIsConfirmedPlaying(true);
              setIsBuffering(false);
            } else if (event.data === 2) {
              setIsConfirmedPlaying(false);
              setIsBuffering(false);
            } else if (event.data === 3) {
              setIsBuffering(true);
            } else if (event.data === 0) {
              setIsConfirmedPlaying(false);
              setIsBuffering(false);
              onNext();
            }
          },
          onError: (event) => {
            const code = event?.data;
            let msg = 'YouTube playback failed.';
            if (code === 2) msg = 'Invalid YouTube video ID parameter.';
            else if (code === 5) msg = 'HTML5 player error on YouTube.';
            else if (code === 100) msg = 'Video not found or removed from YouTube.';
            else if (code === 101 || code === 150) {
              msg = 'Embedded playback is disabled by the content owner for this video.';
            }
            setAudioError(msg);
            setIsConfirmedPlaying(false);
            setIsBuffering(false);
            setResolvedYoutubeId(null);
            setYtPlayerReady(false);
          },
        },
      });

      ytPlayerRef.current = player;
    });

    return () => {
      destroyYTPlayer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedYoutubeId]);

  // ── YouTube Progress Ticker ────────────────────────────────────────────────
  useEffect(() => {
    stopProgressTimer();
    if (usingYoutube && isConfirmedPlaying && ytPlayerReady) {
      progressTimerRef.current = setInterval(() => {
        const time = ytPlayerRef.current?.getCurrentTime();
        if (time !== undefined && !isNaN(time)) {
          setProgressSeconds(Math.floor(time));
        }
      }, 500);
    }
    return stopProgressTimer;
  }, [usingYoutube, isConfirmedPlaying, ytPlayerReady]);

  // ── Synchronize Play / Pause with YouTube ──────────────────────────────────
  useEffect(() => {
    if (!ytPlayerRef.current || !ytPlayerReady) return;
    if (isPlaying) {
      ytPlayerRef.current.playVideo();
    } else {
      ytPlayerRef.current.pauseVideo();
      setIsConfirmedPlaying(false);
    }
  }, [isPlaying, ytPlayerReady]);

  // ── Synchronize Play / Pause with HTML5 Audio ──────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || usingYoutube) return;
    if (isPlaying && resolvedAudioUrl) {
      audio.play().catch(() => {
        setIsConfirmedPlaying(false);
      });
    } else {
      audio.pause();
      setIsConfirmedPlaying(false);
    }
  }, [isPlaying, resolvedAudioUrl, usingYoutube]);

  // ── Volume & Mute Sync ─────────────────────────────────────────────────────
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
    if (ytPlayerRef.current && ytPlayerReady) {
      if (isMuted) {
        ytPlayerRef.current.mute();
      } else {
        ytPlayerRef.current.unMute();
        ytPlayerRef.current.setVolume(volume);
      }
    }
  }, [volume, isMuted, ytPlayerReady]);

  // ── Seek Handler ───────────────────────────────────────────────────────────
  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const newSec = Math.floor(pct * (currentSong?.durationSeconds ?? 180));
      setProgressSeconds(newSec);
      if (usingYoutube && ytPlayerRef.current) {
        ytPlayerRef.current.seekTo(newSec, true);
      } else if (audioRef.current) {
        audioRef.current.currentTime = newSec;
      }
    },
    [usingYoutube, currentSong?.durationSeconds]
  );

  // ── Render Guards ──────────────────────────────────────────────────────────
  if (!currentSong) return null;

  const isFavorite = favorites.includes(currentSong.id);
  const durationTotal = currentSong.durationSeconds || 180;
  const progressPercent = Math.min(100, (progressSeconds / durationTotal) * 100);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Status label: ONLY says "NOW PLAYING" when playback is confirmed by the engine
  const statusLabel = audioError
    ? 'PLAYBACK ERROR'
    : isLoadingAudio
    ? 'RESOLVING AUDIO…'
    : isBuffering
    ? 'BUFFERING AUDIO…'
    : isConfirmedPlaying
    ? 'NOW PLAYING'
    : isPlaying
    ? 'STARTING PLAYBACK…'
    : 'PAUSED / READY';

  const sourceBadge = usingYoutube ? 'YouTube' : usingDirectAudio ? 'Jamendo' : null;

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4">

      {/* Hidden HTML5 audio element for direct audio streams */}
      {usingDirectAudio && (
        <audio
          ref={audioRef}
          src={resolvedAudioUrl || undefined}
          onPlaying={() => {
            setIsConfirmedPlaying(true);
            setIsBuffering(false);
          }}
          onPause={() => setIsConfirmedPlaying(false)}
          onWaiting={() => setIsBuffering(true)}
          onTimeUpdate={() => {
            if (audioRef.current) setProgressSeconds(Math.floor(audioRef.current.currentTime));
          }}
          onEnded={onNext}
          onError={() => {
            if (resolvedAudioUrl) {
              setAudioError('Direct audio stream failed. Try the next track.');
              setResolvedAudioUrl(null);
              setIsConfirmedPlaying(false);
            }
          }}
          preload="auto"
        />
      )}

      {/* Hidden YouTube IFrame container */}
      <div
        ref={ytContainerRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* ── Player Header Bar ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-extrabold tracking-wider text-zinc-500 uppercase">
          Music Player Card
        </span>

        {isConfirmedPlaying ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            {sourceBadge ? `Playing via ${sourceBadge}` : 'Audio Active'}
          </span>
        ) : isBuffering || isLoadingAudio ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-400">
            <Loader2 className="w-3 h-3 text-amber-700 animate-spin" />
            {isLoadingAudio ? 'Resolving Video…' : 'Buffering…'}
          </span>
        ) : audioError ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300">
            <AlertCircle className="w-3 h-3 text-rose-700" />
            Playback Error
          </span>
        ) : canPlay ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-800 border border-zinc-300">
            Ready to Play
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
            <AlertCircle className="w-3 h-3 text-amber-700" />
            No Audio Source
          </span>
        )}
      </div>

      {/* ── Player Card ──────────────────────────────────────────────────── */}
      <div className="relative bg-white border-2 border-zinc-900 rounded-3xl p-5 sm:p-7 shadow-[4px_5px_0px_0px_rgba(24,24,27,1)] overflow-hidden">

        {/* Sticker: Status */}
        <div className="absolute top-4 left-36 sm:left-44 z-20 pointer-events-none">
          <span
            className={`badge-sticker px-3 py-1 text-[10px] transform -rotate-12 shadow-[2px_2px_0px_0px_rgba(24,24,27,1)] ${
              audioError
                ? 'bg-rose-200 text-rose-950'
                : isLoadingAudio
                ? 'bg-amber-100 text-amber-900'
                : isBuffering
                ? 'bg-amber-200 text-amber-950'
                : isConfirmedPlaying
                ? 'bg-sunny text-zinc-900'
                : 'bg-zinc-100 text-zinc-800'
            }`}
          >
            {audioError
              ? 'UNAVAILABLE'
              : isLoadingAudio
              ? 'RESOLVING'
              : isBuffering
              ? 'BUFFERING'
              : isConfirmedPlaying
              ? 'NOW PLAYING'
              : 'PAUSED'}
          </span>
        </div>

        {/* Sticker: Source */}
        <div className="absolute top-4 right-14 sm:right-24 z-20 pointer-events-none">
          <span
            className={`badge-sticker px-3.5 py-1 text-[10px] transform rotate-6 shadow-[2px_2px_0px_0px_rgba(24,24,27,1)] ${
              audioError
                ? 'bg-zinc-200 text-zinc-600'
                : usingYoutube
                ? isConfirmedPlaying
                  ? 'bg-red-500 text-white'
                  : 'bg-red-100 text-red-900'
                : usingDirectAudio
                ? 'bg-mint text-zinc-900'
                : 'bg-zinc-200 text-zinc-600'
            }`}
          >
            {audioError ? 'ERROR' : usingYoutube ? 'YOUTUBE' : usingDirectAudio ? 'DIRECT' : 'METADATA'}
          </span>
        </div>

        {/* Avatar Pill */}
        <div className="absolute top-5 right-5 hidden sm:block">
          <div className="w-7 h-7 rounded-full border border-zinc-900 overflow-hidden bg-lavender shadow-sm">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
              alt="Listener"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* ── Content Grid ─────────────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row items-center gap-6">

          {/* Artwork Box */}
          <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden border-2 border-zinc-900 shadow-[3px_3px_0px_0px_rgba(24,24,27,1)] flex-shrink-0 group">
            <img
              src={currentSong.artwork}
              alt={currentSong.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {/* Active Playback Pulse Badge */}
            {isConfirmedPlaying && (
              <div className="absolute bottom-2 left-2 bg-zinc-950/80 backdrop-blur-sm text-white px-2 py-0.5 rounded-md text-[9px] font-bold flex items-center gap-1 border border-white/20">
                <span className="w-1.5 h-1.5 bg-mint rounded-full animate-pulse" />
                PLAYING
              </div>
            )}
          </div>

          {/* Track Details & Player Controls */}
          <div className="flex-1 w-full space-y-4">

            {/* Title, Artist, Mood, and Favorite */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400 block mb-0.5">
                  {statusLabel}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight leading-tight">
                  {currentSong.title}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm sm:text-base font-bold text-zinc-600">{currentSong.artist}</p>
                  <span className="text-zinc-300">•</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-300 capitalize text-zinc-700">
                    {currentSong.mood}
                  </span>
                  {currentSong.youtubeId && (
                    <span className="text-[10px] font-mono text-zinc-400">
                      ID: {currentSong.youtubeId}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => onToggleFavorite(currentSong.id)}
                className="p-2.5 rounded-full border-2 border-zinc-900 bg-white hover:bg-rose-50 transition-all shadow-[2px_2px_0px_0px_rgba(24,24,27,1)] hover:scale-105 active:scale-95"
                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart
                  className={`w-5 h-5 transition-colors ${
                    isFavorite ? 'fill-coral text-coral' : 'text-zinc-700 hover:text-coral'
                  }`}
                />
              </button>
            </div>

            {/* Transport Controls + Volume + Equalizer */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">

              <div className="flex items-center gap-3">
                <button
                  onClick={onPrev}
                  className="p-2 rounded-full border-2 border-zinc-900 bg-white hover:bg-zinc-100 transition-all shadow-[2px_2px_0px_0px_rgba(24,24,27,1)] active:translate-y-0.5"
                  title="Previous Track"
                >
                  <SkipBack className="w-5 h-5 fill-zinc-900 text-zinc-900" />
                </button>

                <button
                  onClick={onTogglePlay}
                  disabled={isLoadingAudio || (!canPlay && !audioError)}
                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-zinc-900 flex items-center justify-center transition-all ${
                    isLoadingAudio
                      ? 'bg-amber-200 text-zinc-600 cursor-wait border-amber-400 animate-pulse'
                      : audioError
                      ? 'bg-rose-100 text-rose-500 cursor-not-allowed border-rose-300'
                      : !canPlay
                      ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed border-zinc-400'
                      : 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-[3px_3px_0px_0px_rgba(24,24,27,1)] hover:scale-105 active:scale-95'
                  }`}
                  title={
                    isLoadingAudio
                      ? 'Resolving audio…'
                      : audioError
                      ? audioError
                      : isPlaying
                      ? 'Pause'
                      : 'Play'
                  }
                >
                  {isLoadingAudio ? (
                    <Loader2 className="w-6 h-6 animate-spin text-zinc-700" />
                  ) : isPlaying ? (
                    <Pause className="w-6 h-6 fill-white" />
                  ) : (
                    <Play className="w-6 h-6 fill-white ml-1" />
                  )}
                </button>

                <button
                  onClick={onNext}
                  className="p-2 rounded-full border-2 border-zinc-900 bg-white hover:bg-zinc-100 transition-all shadow-[2px_2px_0px_0px_rgba(24,24,27,1)] active:translate-y-0.5"
                  title="Next Track"
                >
                  <SkipForward className="w-5 h-5 fill-zinc-900 text-zinc-900" />
                </button>
              </div>

              {/* Volume + Equalizer */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="text-zinc-700 hover:text-zinc-900"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-zinc-500" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-zinc-900" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      setVolume(Number(e.target.value));
                      setIsMuted(false);
                    }}
                    className="w-16 sm:w-20 h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900"
                  />
                </div>

                {/* Animated Equalizer bars — only animate when playback is confirmed */}
                <div className="flex items-center gap-2 pl-2 border-l-2 border-zinc-200">
                  <div className="flex items-end gap-1 h-5 w-12">
                    <span
                      className={`w-1 rounded-full bg-periwinkle-dark ${
                        isConfirmedPlaying ? 'animate-bar-1' : 'h-1'
                      }`}
                    />
                    <span
                      className={`w-1 rounded-full bg-coral ${
                        isConfirmedPlaying ? 'animate-bar-2' : 'h-2'
                      }`}
                    />
                    <span
                      className={`w-1 rounded-full bg-mint-dark ${
                        isConfirmedPlaying ? 'animate-bar-3' : 'h-3'
                      }`}
                    />
                    <span
                      className={`w-1 rounded-full bg-sunny-dark ${
                        isConfirmedPlaying ? 'animate-bar-4' : 'h-1.5'
                      }`}
                    />
                    <span
                      className={`w-1 rounded-full bg-indigo-600 ${
                        isConfirmedPlaying ? 'animate-bar-5' : 'h-2'
                      }`}
                    />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 hidden sm:inline">
                    EQUALIZER
                  </span>
                </div>
              </div>
            </div>

            {/* Seek Bar */}
            <div className="pt-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-zinc-700 font-mono w-10">
                  {formatTime(progressSeconds)}
                </span>
                <div
                  className="relative flex-1 h-2.5 bg-zinc-100 rounded-full border border-zinc-900 overflow-hidden cursor-pointer group"
                  onClick={handleSeek}
                  title="Click to seek"
                >
                  <div
                    className="h-full bg-gradient-to-r from-periwinkle to-coral transition-all duration-300 pointer-events-none"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-xs font-black text-zinc-400 font-mono w-10 text-right">
                  {currentSong.duration}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Unavailable Alert Banner */}
        {audioError && (
          <div className="mt-4 p-3 bg-rose-50 border-2 border-dashed border-rose-300 rounded-2xl flex items-center justify-between text-xs text-rose-900">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-700 flex-shrink-0" />
              <span>
                <strong>Track Unavailable:</strong> {audioError}
              </span>
            </div>
            <button
              onClick={onNext}
              className="text-xs font-black text-rose-950 underline decoration-rose-500 hover:text-black ml-4"
            >
              Skip → Next Track
            </button>
          </div>
        )}

      </div>
    </section>
  );
};
