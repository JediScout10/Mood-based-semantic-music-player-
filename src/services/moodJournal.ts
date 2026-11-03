import { MoodType } from '../types/music';

export type JournalSource = 'camera' | 'upload' | 'manual';

export interface MoodJournalEntry {
  id: string;
  mood: MoodType;
  source: JournalSource;
  time: number;
}

const STORAGE_KEY = 'moodJournal';
const MAX_ENTRIES = 500;
const VALID_MOODS = new Set<string>(['happy', 'sad', 'calm', 'energetic', 'angry', 'neutral']);
const VALID_SOURCES = new Set<string>(['camera', 'upload', 'manual']);

/**
 * Loads all mood journal entries from localStorage.
 * If the stored data is missing, corrupted, or invalid JSON, returns an empty list without crashing.
 */
export function loadJournal(): MoodJournalEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const validEntries: MoodJournalEntry[] = [];

    for (const item of parsed) {
      if (
        item &&
        typeof item === 'object' &&
        'id' in item &&
        typeof (item as { id: unknown }).id === 'string' &&
        'mood' in item &&
        typeof (item as { mood: unknown }).mood === 'string' &&
        VALID_MOODS.has((item as { mood: string }).mood) &&
        'source' in item &&
        typeof (item as { source: unknown }).source === 'string' &&
        VALID_SOURCES.has((item as { source: string }).source) &&
        'time' in item &&
        (typeof (item as { time: unknown }).time === 'number' ||
          typeof (item as { time: unknown }).time === 'string')
      ) {
        const rawTime = (item as { time: number | string }).time;
        const timeNum = typeof rawTime === 'string' ? new Date(rawTime).getTime() : rawTime;

        if (!isNaN(timeNum)) {
          validEntries.push({
            id: (item as { id: string }).id,
            mood: (item as { mood: MoodType }).mood,
            source: (item as { source: JournalSource }).source,
            time: timeNum,
          });
        }
      }
    }

    return validEntries;
  } catch (err) {
    console.warn('MoodJournal: Failed to parse stored journal entries, returning empty list:', err);
    return [];
  }
}

/**
 * Adds a new entry to the journal.
 * Prepends the new entry and retains at most 500 entries.
 * Stores only mood, source, and time — never image data.
 */
export function addJournalEntry(mood: MoodType, source: JournalSource): MoodJournalEntry {
  const newEntry: MoodJournalEntry = {
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    mood,
    source,
    time: Date.now(),
  };

  try {
    const existing = loadJournal();
    const updated = [newEntry, ...existing].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('MoodJournal: Failed to save entry to localStorage:', err);
  }

  return newEntry;
}

/**
 * Clears all journal entries from localStorage.
 */
export function clearJournal(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('MoodJournal: Failed to clear journal:', err);
  }
}
