import { Song, MoodType } from '../types/music';
import { SAMPLE_SONGS } from '../data/mockData';

const API_BASE_URL = 'http://127.0.0.1:5000/api';

export interface ApiResponse {
  tracks: Song[];
  total: number;
  isBackendConnected: boolean;
  error?: string;
}

export interface EmotionPredictionResult {
  face_detected: boolean;
  raw_expression?: string;
  confidence?: number;
  confidence_percent?: number;
  mapped_mood?: MoodType;
  all_probabilities?: Record<string, number>;
  error?: string;
  disclaimer?: string;
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === 'online';
  } catch {
    return false;
  }
}

/**
 * Build the filtered mainstream list from SAMPLE_SONGS.
 * This is ALWAYS the primary catalogue — mainstream artists with YouTube IDs.
 */
function buildMainstreamTracks(mood: MoodType | null, searchQuery: string): Song[] {
  let tracks = [...SAMPLE_SONGS];

  if (mood) {
    tracks = tracks.filter((s) => s.mood === mood);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    tracks = tracks.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.album.toLowerCase().includes(q) ||
        s.genre.toLowerCase().includes(q)
    );
  }

  return tracks;
}

export async function fetchRecommendations(
  mood: MoodType | null,
  searchQuery: string,
  limit = 50
): Promise<ApiResponse> {
  // Step 1: Always start with the mainstream catalogue (YouTube-backed songs).
  // These are the curated SAMPLE_SONGS with known youtubeId values.
  const mainstreamTracks = buildMainstreamTracks(mood, searchQuery);

  // Step 2: Only query supplemental CSV tracks if user is actively searching
  // and mainstream tracks haven't saturated the limit. When browsing by mood,
  // we strictly display the curated mainstream catalogue (132 verified hit songs).
  let backendConnected = false;
  let csvTracks: Song[] = [];

  try {
    const isOnline = await checkBackendHealth();
    backendConnected = isOnline;

    if (isOnline && searchQuery.trim()) {
      const params = new URLSearchParams();
      if (mood) params.append('mood', mood);
      params.append('search', searchQuery.trim());
      const csvLimit = Math.max(0, limit - mainstreamTracks.length);
      params.append('limit', String(csvLimit));

      if (csvLimit > 0) {
        const res = await fetch(`${API_BASE_URL}/recommendations?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const mainstreamTitles = new Set(
            mainstreamTracks.map((s) => s.title.toLowerCase())
          );
          csvTracks = (data.tracks || []).filter(
            (t: Song) => !mainstreamTitles.has(t.title.toLowerCase())
          );
        }
      }
    }
  } catch {
    backendConnected = false;
  }

  const combined = [...mainstreamTracks, ...csvTracks];

  return {
    tracks: combined.slice(0, limit),
    total: combined.length,
    isBackendConnected: backendConnected,
  };
}

export async function predictEmotion(imageBase64: string): Promise<EmotionPredictionResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/predict-emotion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64 }),
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => null);
      throw new Error(errorJson?.error || `Server responded with status ${res.status}`);
    }

    const data: EmotionPredictionResult = await res.json();
    return data;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to reach emotion recognition server';
    return { face_detected: false, error: message };
  }
}
