"""
Mood-based Music Recommender for MoodMusicPlayer.
Loads the cleaned audio features dataset and provides mood-based recommendation.
Jamendo tracks are NOT served here — playback is now handled via YouTube IFrame.
"""

import os
import json
import pandas as pd
import numpy as np

DATASET_PATH = os.path.join(os.path.dirname(__file__), "data", "music_dataset.csv")

# Ideal feature centroids for mood ranking (Russell's circumplex model)
MOOD_TARGET_PROFILES = {
    "happy":    {"valence": 0.85, "energy": 0.75, "danceability": 0.75},
    "sad":      {"valence": 0.20, "energy": 0.25, "danceability": 0.35},
    "calm":     {"valence": 0.50, "energy": 0.25, "danceability": 0.45},
    "energetic":{"valence": 0.65, "energy": 0.90, "danceability": 0.80},
    "angry":    {"valence": 0.25, "energy": 0.85, "danceability": 0.50},
    "neutral":  {"valence": 0.50, "energy": 0.50, "danceability": 0.55},
}


class MusicRecommender:
    def __init__(self, data_path=DATASET_PATH):
        self.data_path = data_path
        self.df = None
        self.load_dataset()

    def load_dataset(self):
        if not os.path.exists(self.data_path):
            raise FileNotFoundError(
                f"Dataset not found at {self.data_path}. Run prepare_data.py first."
            )
        self.df = pd.read_csv(self.data_path)
        for col in ("title", "artist", "album", "genre", "mood"):
            self.df[col] = self.df[col].astype(str)
        print(f"[MusicRecommender] Loaded {len(self.df)} tracks from CSV.")

    def get_stats(self):
        """Return dataset statistics"""
        return {
            "total_tracks": len(self.df),
            "mood_counts": self.df["mood"].value_counts().to_dict(),
            "genre_counts": self.df["genre"].value_counts().to_dict(),
            "avg_features": {
                "valence":      round(float(self.df["valence"].mean()), 3),
                "energy":       round(float(self.df["energy"].mean()), 3),
                "danceability": round(float(self.df["danceability"].mean()), 3),
                "acousticness": round(float(self.df["acousticness"].mean()), 3),
                "tempo":        round(float(self.df["tempo"].mean()), 1),
            },
        }

    def recommend(self, mood=None, search=None, genre=None,
                  limit=20, offset=0, sort_by="popularity"):
        """
        Return CSV-dataset tracks for the given mood/search/genre.
        Jamendo tracks are no longer included — playback uses YouTube.
        """
        subset = self.df.copy()

        if mood and mood.lower() in MOOD_TARGET_PROFILES:
            mood_clean = mood.lower()
            subset = subset[subset["mood"] == mood_clean]
            target = MOOD_TARGET_PROFILES[mood_clean]
            dist = np.sqrt(
                (subset["valence"] - target["valence"]) ** 2
                + (subset["energy"] - target["energy"]) ** 2
                + (subset["danceability"] - target["danceability"]) ** 2
            )
            subset["mood_score"] = 1.0 - (dist / np.sqrt(3))

        if search and search.strip():
            query = search.strip().lower()
            mask = (
                subset["title"].str.lower().str.contains(query, na=False)
                | subset["artist"].str.lower().str.contains(query, na=False)
                | subset["album"].str.lower().str.contains(query, na=False)
                | subset["genre"].str.lower().str.contains(query, na=False)
            )
            subset = subset[mask]

        if genre and genre.strip():
            subset = subset[subset["genre"].str.lower() == genre.strip().lower()]

        if "mood_score" in subset.columns and sort_by == "similarity":
            subset = subset.sort_values(
                by=["mood_score", "popularity"], ascending=[False, False]
            )
        elif sort_by == "popularity":
            subset = subset.sort_values(by="popularity", ascending=False)
        elif sort_by == "shuffle":
            subset = subset.sample(frac=1.0)

        total_matched = len(subset)
        sliced = subset.iloc[offset: offset + limit]

        results = []
        for _, row in sliced.iterrows():
            results.append({
                "id":           str(row["id"]),
                "title":        str(row["title"]),
                "artist":       str(row["artist"]),
                "album":        str(row["album"]),
                "genre":        str(row["genre"]),
                "duration":     str(row["duration"]),
                "durationSeconds": int(row["durationSeconds"]),
                "mood":         str(row["mood"]),
                "valence":      round(float(row["valence"]), 3),
                "energy":       round(float(row["energy"]), 3),
                "danceability": round(float(row["danceability"]), 3),
                "acousticness": round(float(row["acousticness"]), 3),
                "tempo":        round(float(row["tempo"]), 1),
                "popularity":   int(row["popularity"]),
                "artwork":      str(row["artwork"]),
                "badge":        str(row["badge"]) if pd.notna(row["badge"]) else None,
                "hasAudio":     False,
                "audioUrl":     None,
                "youtubeId":    None,
                "audioNote":    "Audio resolved via YouTube when selected",
            })

        return {
            "mood":   mood,
            "search": search,
            "genre":  genre,
            "total":  total_matched,
            "limit":  limit,
            "offset": offset,
            "tracks": results,
        }


recommender = MusicRecommender()
