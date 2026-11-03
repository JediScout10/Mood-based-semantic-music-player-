export type MoodType = 'happy' | 'sad' | 'calm' | 'energetic' | 'angry' | 'neutral';

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  durationSeconds: number;
  mood: MoodType;
  artwork: string;
  badge?: 'PLAYING' | 'TRENDING' | 'NEW' | 'FAV';
  energy: number; // 1-100
  year?: number;
  genre: string;
  rating?: number; // 1-5
  hasAudio: boolean; // Indicates if audio is playable or sample metadata
  audioUrl?: string; // Direct audio URL from Jamendo when available
  audioNote?: string;
  youtubeId?: string; // YouTube video ID for IFrame playback (mainstream tracks)
}

export interface MoodConfig {
  id: MoodType;
  label: string;
  tagline: string;
  emoji: string;
  accentColor: string; // Tailwind bg color class
  borderColor: string;
  textColor: string;
  badgeColor: string;
}

export type ActiveTab = 'home' | 'library' | 'journal';
