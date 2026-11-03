"""
Flask REST API for MoodMusicPlayer.
Serves mood-based song recommendations from the Spotify audio features dataset
and real facial emotion prediction via OpenCV YuNet and MobileFaceNet.
"""

import os
import re
import json
import base64
import cv2
import numpy as np
import urllib.request
import urllib.error
from urllib.parse import quote, quote_plus
from flask import Flask, request, jsonify
from flask_cors import CORS
from recommender import recommender
from emotion_detector import emotion_detector

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint"""
    stats = recommender.get_stats()
    return jsonify({
        "status": "online",
        "service": "MoodMusicPlayer Recommendation & Emotion API",
        "total_tracks": stats["total_tracks"],
        "models_loaded": {
            "recommender": True,
            "face_detector_yunet": True,
            "emotion_classifier_mobilefacenet": True
        },
        "version": "1.1.0"
    })

@app.route("/api/stats", methods=["GET"])
def stats():
    """Return dataset statistics"""
    return jsonify(recommender.get_stats())

@app.route("/api/moods", methods=["GET"])
def get_moods():
    """Return available moods with counts and metadata"""
    stats = recommender.get_stats()
    mood_counts = stats["mood_counts"]
    
    mood_configs = [
        {"id": "happy", "label": "Happy", "tagline": "Upbeat & Joyful", "count": mood_counts.get("happy", 0)},
        {"id": "sad", "label": "Sad", "tagline": "Melancholy & Deep", "count": mood_counts.get("sad", 0)},
        {"id": "calm", "label": "Calm", "tagline": "Peaceful & Ambient", "count": mood_counts.get("calm", 0)},
        {"id": "energetic", "label": "Energetic", "tagline": "High Tempo & Hype", "count": mood_counts.get("energetic", 0)},
        {"id": "angry", "label": "Angry", "tagline": "Intense & Heavy", "count": mood_counts.get("angry", 0)},
        {"id": "neutral", "label": "Neutral", "tagline": "Balanced & Focus", "count": mood_counts.get("neutral", 0)},
    ]
    return jsonify({"moods": mood_configs})

@app.route("/api/recommendations", methods=["GET"])
def get_recommendations():
    """
    Get recommendations based on mood, search query, or genre.
    """
    mood = request.args.get("mood")
    search = request.args.get("search")
    genre = request.args.get("genre")
    
    try:
        limit = int(request.args.get("limit", 24))
    except ValueError:
        limit = 24

    try:
        offset = int(request.args.get("offset", 0))
    except ValueError:
        offset = 0

    sort_by = request.args.get("sort", "similarity" if mood else "popularity")

    data = recommender.recommend(
        mood=mood,
        search=search,
        genre=genre,
        limit=limit,
        offset=offset,
        sort_by=sort_by
    )
    return jsonify(data)

@app.route("/api/songs", methods=["GET"])
def get_songs():
    """Alias for recommendations endpoint"""
    return get_recommendations()

@app.route("/api/predict-emotion", methods=["POST"])
def predict_emotion():
    """
    Real facial expression recognition endpoint.
    Accepts:
    - JSON with base64 image: {"image": "data:image/jpeg;base64,..."}
    - Or Multipart form data: request.files['image']
    """
    image_bytes = None

    # 1. Check for JSON base64 image
    if request.is_json:
        payload = request.get_json()
        b64_str = payload.get("image", "")
        if "," in b64_str:
            b64_str = b64_str.split(",", 1)[1]
        try:
            image_bytes = base64.b64decode(b64_str)
        except Exception as e:
            return jsonify({"face_detected": False, "error": f"Base64 decode failed: {str(e)}"}), 400

    # 2. Check for multipart file upload
    elif "image" in request.files:
        file = request.files["image"]
        image_bytes = file.read()

    if not image_bytes:
        return jsonify({
            "face_detected": False,
            "error": "No image data received. Provide a base64 string or multipart image file."
        }), 400

    # 3. Decode image with OpenCV
    np_arr = np.frombuffer(image_bytes, np.uint8)
    image_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if image_bgr is None:
        return jsonify({
            "face_detected": False,
            "error": "Failed to decode image. Ensure image format is valid (JPEG/PNG/WebP)."
        }), 400

    # 4. Run real Face Detection & Emotion Classification
    result = emotion_detector.predict(image_bgr)
    return jsonify(result)

def get_jamendo_client_id():
    cid = os.environ.get("JAMENDO_CLIENT_ID")
    if cid and cid.strip():
        return cid.strip()
    # Check .env in current directory and project root
    for env_path in [os.path.join(os.path.dirname(__file__), ".env"), os.path.join(os.path.dirname(__file__), "..", ".env")]:
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("JAMENDO_CLIENT_ID="):
                            val = line.split("=", 1)[1].strip().strip('"').strip("'")
                            if val:
                                return val
            except Exception:
                pass
    return None

def normalize_music_string(text: str) -> str:
    """Normalize for strict matching: lowercase, strip punctuation and extra whitespace."""
    if not text:
        return ""
    # Replace dots, dashes, underscores, slashes with spaces
    t = re.sub(r'[\.\-–—_/\\]', ' ', text.lower())
    # Remove remaining non-alphanumeric characters except whitespace
    t = re.sub(r'[^\w\s]', '', t)
    return ' '.join(t.split())

# In-memory track lookup cache: (title, artist) -> track dict or None (negative cache)
jamendo_track_cache = {}

@app.route("/api/jamendo-track", methods=["GET"])
def get_jamendo_track():
    """
    Look up real audio stream from Jamendo catalog for a specific track.
    Requires exact title and artist match. Uses in-memory cache to prevent redundant API queries.
    """
    title = request.args.get("title", "").strip()
    artist = request.args.get("artist", "").strip()

    if not title or not artist:
        return jsonify({"error": "Both title and artist parameters are required."}), 400

    client_id = get_jamendo_client_id()
    if not client_id:
        return jsonify({
            "error": "Jamendo client ID not configured. Add JAMENDO_CLIENT_ID to your backend .env file.",
            "configured": False
        }), 401

    norm_target_title = normalize_music_string(title)
    norm_target_artist = normalize_music_string(artist)
    cache_key = (norm_target_title, norm_target_artist)

    # 1. Check in-memory cache
    if cache_key in jamendo_track_cache:
        cached = jamendo_track_cache[cache_key]
        if cached is None:
            app.logger.info(f"[Jamendo Cache HIT - Negative] '{title}' by '{artist}' is unavailable.")
            return jsonify({
                "error": "Original track unavailable",
                "note": f"Exact recording '{title}' by '{artist}' was not found on Jamendo."
            }), 404
        else:
            app.logger.info(f"[Jamendo Cache HIT - Positive] '{title}' by '{artist}' returning cached audio stream.")
            return jsonify(cached)

    app.logger.info(f"[Jamendo] Track lookup requested: title='{title}', artist='{artist}' (normalized: '{norm_target_title}' / '{norm_target_artist}')")

    # Multi-strategy search queries in order of precision:
    # 1. 'namesearch' on track name (direct title search in Jamendo catalog)
    # 2. 'search' on track title
    # 3. 'search' on normalized artist name (retrieves artist's catalog if title was too generic)
    # 4. 'search' on combined title + artist
    search_queries = [
        ("namesearch", f"namesearch={quote(title)}"),
        ("title search", f"search={quote(title)}"),
        ("artist search", f"search={quote(norm_target_artist)}"),
        ("combined search", f"search={quote(f'{norm_target_title} {norm_target_artist}')}"),
    ]

    matched_track = None

    for label, param in search_queries:
        # NOTE: Do NOT add 'include=musicinfo,licenses' or 'audioformat=mp31' as Jamendo rejects/filters them
        api_url = f"https://api.jamendo.com/v3.0/tracks/?client_id={client_id}&format=jsonpretty&limit=30&{param}"
        try:
            req = urllib.request.Request(api_url, headers={"User-Agent": "MoodMusicPlayer/1.0"})
            with urllib.request.urlopen(req, timeout=8) as response:
                data = json.loads(response.read().decode("utf-8"))

            results = data.get("results", [])
            app.logger.info(f"[Jamendo] Strategy '{label}' returned {len(results)} candidate tracks")

            for t in results:
                t_name = t.get("name", "")
                t_artist = t.get("artist_name", "")
                c_name = normalize_music_string(t_name)
                c_artist = normalize_music_string(t_artist)

                # Strict matching: Normalized title must match and normalized artist must match
                if c_name == norm_target_title and c_artist == norm_target_artist:
                    if t.get("audio"):
                        matched_track = t
                        app.logger.info(f"[Jamendo] Match confirmed: ID {t.get('id')} - '{t_name}' by '{t_artist}'")
                        break

            if matched_track:
                break

        except urllib.error.HTTPError as http_err:
            if http_err.code in (401, 403):
                app.logger.warning(f"[Jamendo] Authentication failed: HTTP {http_err.code}")
                return jsonify({
                    "error": "Invalid Jamendo client ID. Please verify JAMENDO_CLIENT_ID in your .env file."
                }), 401
            app.logger.warning(f"[Jamendo] HTTP Error during strategy '{label}': {http_err.code} {http_err.reason}")
        except Exception as e:
            app.logger.warning(f"[Jamendo] Strategy '{label}' failed: {str(e)}")

    if not matched_track:
        app.logger.info(f"[Jamendo] No matching track found for '{title}' by '{artist}'")
        jamendo_track_cache[cache_key] = None  # Cache negative result
        return jsonify({
            "error": "Original track unavailable",
            "note": f"Exact recording '{title}' by '{artist}' was not found on Jamendo."
        }), 404

    audio_url = matched_track.get("audio")
    attribution = f"{matched_track.get('artist_name')} - {matched_track.get('name')} (Music provided by Jamendo)"
    license_info = matched_track.get("license_ccurl") or matched_track.get("license_url") or "CC BY-SA / Jamendo License"

    result_data = {
        "audioUrl": audio_url,
        "title": matched_track.get("name"),
        "artist": matched_track.get("artist_name"),
        "duration": matched_track.get("duration"),
        "attribution": attribution,
        "license": license_info,
        "artwork": matched_track.get("image"),
        "trackId": matched_track.get("id")
    }
    jamendo_track_cache[cache_key] = result_data  # Cache positive result
    return jsonify(result_data)

# ---------------------------------------------------------------------------
# YouTube Video ID Resolver
# ---------------------------------------------------------------------------
VERIFIED_YOUTUBE_TRACKS = {
    ("happy", "pharrell williams"): "ZbZSe6N_BXs",
    ("uptown funk", "mark ronson ft bruno mars"): "OPf0YbXqDm0",
    ("uptown funk", "mark ronson"): "OPf0YbXqDm0",
    ("uptown funk", "bruno mars"): "OPf0YbXqDm0",
    ("shake it off", "taylor swift"): "nfWlot6h_JM",
    ("cant stop the feeling", "justin timberlake"): "ru0K8uYEZWw",
    ("levitating", "dua lipa"): "TUVcZfQe-Kw",
    ("dont stop the music", "rihanna"): "yd8jh9QYfR4",
    ("someone like you", "adele"): "hLQl3WQQoQ0",
    ("fix you", "coldplay"): "k4V3Mo61fJM",
    ("stay", "rihanna ft mikky ekko"): "JF8BRvqGCNs",
    ("stay", "rihanna"): "JF8BRvqGCNs",
    ("all too well", "taylor swift"): "tollGa3S0o8",
    ("drivers license", "olivia rodrigo"): "ZmDBbnmKpqQ",
    ("when the partys over", "billie eilish"): "pbMwTqkKSps",
    ("the scientist", "coldplay"): "RB-RcX5DS5A",
    ("cardigan", "taylor swift"): "K-a8s8OLBSE",
    ("ocean eyes", "billie eilish"): "viimfQi_pUw",
    ("creep", "radiohead"): "XFkzRNyygfk",
    ("slow dancing in the dark", "joji"): "K3Qzzggn--s",
    ("weightless", "marconi union"): "UfcAVejslrU",
    ("blinding lights", "the weeknd"): "4NRXx6U8ABQ",
    ("lose yourself", "eminem"): "_Yhyp-_hX2s",
    ("diamonds", "rihanna"): "lWA2pjMjpBs",
    ("24k magic", "bruno mars"): "UqyT8IEBkvY",
    ("thunderstruck", "acdc"): "v2AC41dglnM",
    ("titanium", "david guetta ft sia"): "JRfuAukYTKg",
    ("titanium", "david guetta"): "JRfuAukYTKg",
    ("in the end", "linkin park"): "eVTXPUF4Oz4",
    ("numb", "linkin park"): "kXYiU_JCYtU",
    ("rap god", "eminem"): "XbGs_qK2PQA",
    ("bad blood", "taylor swift ft kendrick lamar"): "QcIy9NiNbmo",
    ("bad blood", "taylor swift"): "QcIy9NiNbmo",
    ("bitch better have my money", "rihanna"): "B3eAMGXFw1o",
    ("sicko mode", "travis scott"): "6ONRf7h3Mdk",
    ("shape of you", "ed sheeran"): "JGwWNGJdvx8",
    ("save your tears", "the weeknd"): "XXYlFuWEuKI",
    ("yellow", "coldplay"): "yKNxeF4KMsY",
    ("stressed out", "twenty one pilots"): "pXRviuL6vMY",
    ("counting stars", "onerepublic"): "hT_nvWreIhg",
    ("radioactive", "imagine dragons"): "ktvTqknDobU",
    ("umbrella", "rihanna"): "CvBfHwUxHIk",
    ("what makes you beautiful", "one direction"): "QJO3ROT-A4E",
    ("hollaback girl", "gwen stefani"): "Kgjkth6BRRY",
    ("like a prayer", "madonna"): "79fzeNUqQbQ",
    ("paradise", "coldplay"): "1G4isv_Fylg",
    ("cruel summer", "taylor swift"): "GrKQvyXpNgc",
    ("cant feel my face", "the weeknd"): "KEI4qSrkPAs",
    ("whenever wherever", "shakira"): "weRHyjj34ZE",
    ("oops i did it again", "britney spears"): "CduA0TULnow",
    ("kiss me more", "doja cat"): "0EVVKs6DQLo",
    ("cheap thrills", "sia"): "31crA53Dgu0",
    ("thats what i like", "bruno mars"): "PMivT7MJ41M",
    ("without me", "halsey"): "ZAfAud_M_mg",
    ("treat you better", "shawn mendes"): "lY2yjAdbvdQ",
    ("lose you to love me", "selena gomez"): "zlJDTxahav0",
    ("memories", "maroon 5"): "SlPhMPnQ58k",
    ("demons", "imagine dragons"): "mWRsgZuwf_8",
    ("wrecking ball", "miley cyrus"): "My2FRPA3Gf8",
    ("traitor", "olivia rodrigo"): "CRrf3h9vhp8",
    ("teardrops on my guitar", "taylor swift"): "xKCek6_dB0M",
    ("easy on me", "adele"): "U3ASj1L6_sY",
    ("stay with me", "sam smith"): "pB-5XG-DbAA",
    ("i love you", "billie eilish"): "mjen6N9o5nI",
    ("someone you loved", "lewis capaldi"): "zABLecsR5UE",
    ("highest in the room", "travis scott"): "tfSS1e3kYeo",
    ("perfect", "ed sheeran"): "2Vv-BfVoq4g",
    ("sparks", "coldplay"): "6LaSmFP56hs",
    ("lover", "taylor swift"): "-BjZmE2gtdo",
    ("everything i wanted", "billie eilish"): "EgBJmlPo8Xw",
    ("deja vu", "olivia rodrigo"): "cii6ruuycQA",
    ("love yourself", "justin bieber"): "oyEuk8j8imI",
    ("if i aint got you", "alicia keys"): "Ju8Hr50Ckwk",
    ("count on me", "bruno mars"): "6k8cpUkKK4c",
    ("make you feel my love", "adele"): "0put0_a--Ng",
    ("falling", "harry styles"): "olGSAVOkkTI",
    ("liability", "lorde"): "BtvJaNeELic",
    ("stronger", "kanye west"): "PsO6ZnUZI0g",
    ("super bass", "nicki minaj"): "4JipHEz53sU",
    ("in da club", "50 cent"): "5qm8PH4xAss",
    ("lollipop", "lil wayne"): "2IH8tNQAzSs",
    ("empire state of mind", "jay z"): "vk6014HuxcE",
    ("smooth criminal", "michael jackson"): "h_D3VFfhvs4",
    ("crazy in love", "beyonce"): "ViwtNLUqkMY",
    ("viva la vida", "coldplay"): "dvgZkm1xWPE",
    ("bad guy", "billie eilish"): "DyDfgMOUjCI",
    ("new rules", "dua lipa"): "k2qgadSvNyU",
    ("roar", "katy perry"): "CevxZvSJLk8",
    ("the nights", "avicii"): "UtF6Jej8yb4",
    ("green light", "lorde"): "dMK_npDG12Q",
    ("we found love", "rihanna"): "tg00YEETFzg",
    ("kill bill", "sza"): "MSRcC626prw",
    ("paint it black", "the rolling stones"): "flSmiIne-4k",
    ("the real slim shady", "eminem"): "eJO5HU_7_1w",
    ("rolling in the deep", "adele"): "rYEDA3JcQqw",
    ("look what you made me do", "taylor swift"): "3tmd-ClpJxA",
    ("the hills", "the weeknd"): "yzTuBuRdAyA",
    ("good 4 u", "olivia rodrigo"): "gNi_6U5Pm_o",
    ("heathens", "twenty one pilots"): "UprcpdwuwCg",
    ("faint", "linkin park"): "LYU-8IFcDPw",
    ("you should see me in a crown", "billie eilish"): "Ah0Ys50CqO8",
    ("power", "kanye west"): "L53gjP-TtGE",
    ("till i collapse", "eminem"): "3m_QN8P93IA",
    ("do i wanna know", "arctic monkeys"): "bpOSxM0rNPM",
    ("drop it like its hot", "snoop dogg"): "GtUVQei3nX4",
    ("hold on were going home", "drake"): "GxgqpCdOKak",
    ("heartless", "kanye west"): "Co0tTeuUVhU",
    ("in your eyes", "the weeknd"): "dqRZDebPIGs",
    ("anti hero", "taylor swift"): "b1kbLwvqugk",
    ("bury a friend", "billie eilish"): "HUHC9tYz8ik",
    ("clocks", "coldplay"): "d020hcWA_Wg",
    ("circles", "post malone"): "wXhTHyIgQ_U",
    ("break my heart", "dua lipa"): "Nj2U6rhnucI",
    ("as it was", "harry styles"): "H5v3kku4y6Q",
    ("heat waves", "glass animals"): "mRD0-GxqHVo",
    ("boom boom pow", "the black eyed peas"): "4m48GqaOz90",
    ("work bitch", "britney spears"): "pt8VYOfr8To",
    ("baby", "justin bieber"): "kffacxfA7G4",
    ("california gurls", "katy perry"): "F57P9C4SAW4",
    ("moves like jagger", "maroon 5"): "iEPTlhBmwRg",
    ("love on top", "beyonce"): "Ob7vObnFUJc",
    ("everglow", "coldplay"): "xn_1hFdE-5g",
    ("lovely", "billie eilish"): "V1Pl8CzNzCw",
    ("set fire to the rain", "adele"): "1twUUM0KxDg",
    ("sign of the times", "harry styles"): "qN4ooNx77u0",
    ("snooze", "sza"): "LDY_XyxBu8A",
    ("video games", "lana del rey"): "cE6wxDqdOV0",
    ("thinkin bout you", "frank ocean"): "V4VA4XAskn4",
    ("fly on", "coldplay"): "Ap-HeMIKi-c",
    ("needed me", "rihanna"): "wfN4PVaOU5Q",
    ("natural", "imagine dragons"): "0I647GU3Jsc",
    ("antidote", "travis scott"): "KnZ8h3MRuYg",
    ("r u mine", "arctic monkeys"): "VQH8ZTgna3Q",
    ("passionfruit", "drake"): "OVNZ5-e0HeQ",
    ("die for you", "the weeknd"): "uPD0QOGTmMI",
    ("thinking out loud", "ed sheeran"): "lp-EO5I60KA",
    ("location", "khalid"): "by3yRdlQvzs",
}

youtube_id_cache: dict = dict(VERIFIED_YOUTUBE_TRACKS)


@app.route("/api/youtube-id", methods=["GET"])
def get_youtube_id():
    """
    Resolve a YouTube video ID for a given title and artist.
    Checks verified mainstream cache first, then in-memory cache,
    then scrapes YouTube's search results page.
    Returns {"videoId": "...", "embedUrl": "..."} or {"error": "..."} 404.
    """
    title = request.args.get("title", "").strip()
    artist = request.args.get("artist", "").strip()

    if not title or not artist:
        return jsonify({"error": "Both title and artist are required."}), 400

    norm_title = normalize_music_string(title)
    norm_artist = normalize_music_string(artist)
    cache_key = (norm_title, norm_artist)

    # 1. Check verified and cached entries
    if cache_key in youtube_id_cache:
        cached = youtube_id_cache[cache_key]
        if cached is None:
            return jsonify({"error": "No YouTube video found for this track."}), 404
        return jsonify({"videoId": cached, "embedUrl": f"https://www.youtube.com/embed/{cached}"})

    # Also check partial match in verified tracks (e.g., if artist name in query has 'feat' or difference)
    for (vt, va), vid in VERIFIED_YOUTUBE_TRACKS.items():
        if vt == norm_title and (va in norm_artist or norm_artist in va):
            youtube_id_cache[cache_key] = vid
            return jsonify({"videoId": vid, "embedUrl": f"https://www.youtube.com/embed/{vid}"})

    # Build search query: "Artist Title official audio"
    query = quote(f"{artist} {title} official audio")
    search_url = f"https://www.youtube.com/results?search_query={query}"

    try:
        req = urllib.request.Request(
            search_url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "en-US,en;q=0.9",
            },
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="replace")

        # Extract first watch?v= video ID from the page
        matches = re.findall(r'"videoId":"([a-zA-Z0-9_-]{11})"', html)
        if not matches:
            app.logger.info(f"[YouTube] No video IDs found for: {title} - {artist}")
            youtube_id_cache[cache_key] = None
            return jsonify({"error": "No YouTube video found for this track."}), 404

        video_id = matches[0]
        app.logger.info(f"[YouTube] Resolved '{title}' by '{artist}' → {video_id}")
        youtube_id_cache[cache_key] = video_id
        return jsonify({
            "videoId": video_id,
            "embedUrl": f"https://www.youtube.com/embed/{video_id}",
        })

    except Exception as exc:
        app.logger.warning(f"[YouTube] Search failed for '{title}' by '{artist}': {exc}")
        return jsonify({"error": f"YouTube lookup failed: {str(exc)}"}), 502


if __name__ == "__main__":
    print("Starting MoodMusicPlayer Flask Backend on http://127.0.0.1:5000 ...")
    app.run(host="127.0.0.1", port=5000, debug=False)

