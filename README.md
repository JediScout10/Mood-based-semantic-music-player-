# MoodMusicPlayer — Full Stack with Validated Facial Expression Recognition

MoodMusicPlayer is an affective music discovery web application combining real-time facial expression recognition (OpenCV YuNet + MobileFaceNet ONNX) with a curated 6,000-track music recommendation engine based on Spotify audio features (valence, energy, danceability, acousticness, tempo).

---

## 🔍 Model Architecture, Preprocessing & Contract Verification

The facial emotion recognition pipeline was verified against the official **OpenCV Zoo** model source code (`facial_fer_model.py`):

| Parameter | Specification Verified |
| :--- | :--- |
| **Model Weights** | `facial_expression_recognition_mobilefacenet_2022july.onnx` (4.79 MB) |
| **Face Detector** | `face_detection_yunet_2023mar.onnx` (232 KB) |
| **Input Tensor Name** | `'data'` |
| **Input Shape** | `[1, 3, 112, 112]` (Batch Size: 1, RGB channels: 3, Height: 112, Width: 112) |
| **Channel Order** | **RGB** (`cv2.cvtColor(image, cv2.COLOR_BGR2RGB)`) |
| **Pixel Normalization** | $(image_{float32} / 255.0 - 0.5) / 0.5 \implies [-1.0, 1.0]$ with `mean=[0.5, 0.5, 0.5]` and `std=[0.5, 0.5, 0.5]` |
| **Facial Alignment** | **5-point non-reflective similarity affine transformation** based on YuNet landmarks (Right Eye, Left Eye, Nose Tip, Right Mouth Corner, Left Mouth Corner) mapped to canonical standard coordinates `_std_points` |
| **Output Tensor Name** | `['label']` |
| **Output Shape** | `[1, 7]` (Logits over 7 RAF-DB facial expression classes) |
| **Official Class Order** | `[0: 'angry', 1: 'disgust', 2: 'fearful', 3: 'happy', 4: 'neutral', 5: 'sad', 6: 'surprised']` |

---

## 📊 Rigorous Model Validation Results

Tested using `python backend/validate_model.py` across diverse, consented benchmark test images:

| Test Case | Ground Truth Hint | Predicted Expression | Confidence | Mapped Music Mood | All Class Probabilities |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Smiling Selfie (OpenCV Zoo)** | Happy | **Happy** | **99.99%** | **HAPPY** | Happy: 99.99%, Neutral: 0.00%, Sad: 0.00% |
| **Smiling Woman Portrait** | Happy | **Happy** | **100.0%** | **HAPPY** | Happy: 100.0%, Others: 0.00% |
| **Ekman Universal Expression: Surprised** | Surprised | **Surprised** | **99.59%** | **ENERGETIC** | Surprised: 99.59%, Happy: 0.22%, Fearful: 0.16% |
| **Ekman Universal Expression: Neutral** | Neutral | **Neutral** | **72.41%** | **NEUTRAL** | Neutral: 72.41%, Angry: 19.23%, Disgust: 7.89% |
| **Darwin Plate V (Grief & Sadness)** | Sad | **Sad** | **88.65%** | **SAD** | Sad: 88.65%, Neutral: 7.70%, Disgust: 3.54% |
| **Intense Affect Portrait (Contempt / Aversion)** | Contempt / Angry | **Happy** *(Misclassified)* | **71.07%** | **HAPPY** | Happy: 71.07%, Neutral: 23.94%, Angry: 1.30% |
| **Negative Case (Blank Image, No Face)** | No Face | **None** | — | — | Correctly returns `face_detected: false` with prompt to position face |

---

## 🔬 Investigation: Why Was a Smiling Face Previously Misclassified as Sad?

During initial testing without face alignment, a smiling face was occasionally misclassified as sad. Root-cause analysis confirmed:
1. **Lack of Landmark-Based Alignment**: The pretrained MobileFaceNet model was trained on **RAF-DB**, which strictly pre-aligns faces using 5 facial landmarks (eyes, nose, mouth corners) into canonical 112×112 coordinates.
2. **Receptive Field Distortion**: When an unaligned bounding-box crop is fed directly, head tilt, eye angle, and mouth positioning are displaced relative to the convolution filters, distorting facial Action Unit (AU) detection and yielding incorrect negative valence predictions.
3. **Resolution**: Integrated the official `FaceAlignment` affine warping class from OpenCV Zoo. Once the 5 YuNet landmarks are mapped to the canonical coordinates, smiling faces consistently score **$\ge 99.9\%$ Happy**.

---

## ⚠️ Known Scientific Limitations

1. **Facial Expression $\neq$ Emotional Reality**: Action units (AU) measure superficial muscular movement. A person may smile politely while feeling anxious, or scowl while focusing deeply.
2. **Unilateral Expression Ambiguity (e.g., Contempt)**: Unilateral mouth curl (smirk/contempt) is frequently misread as a smile (Happy: 71.07%) because 7-class models lack a dedicated `contempt` class.
3. **Lighting & Occlusion Sensitivity**: Low light or partial obstruction (glasses, hand on chin) reduces YuNet landmark precision, causing fallbacks to unaligned crops.

---

## 🚀 How to Run and Test

### 1. Start Python Flask API Server:
```powershell
cd c:\Users\rohit\Downloads\MoodMusicPlayer
python backend/app.py
```
*Backend runs on: `http://127.0.0.1:5000`*

### 2. Start React Vite Frontend:
```powershell
cd c:\Users\rohit\Downloads\MoodMusicPlayer
npm run dev
```
*Frontend runs on: `http://localhost:5173`*

### 3. Run Automated Validation Suite:
```powershell
python backend/validate_model.py
```

---

## 🎵 Jamendo Real Audio Streaming Integration

MoodMusicPlayer integrates with the **Jamendo API (v3.0)** for real-time online music streaming without requiring local MP3 files.

### Configuration
1. Register a free developer account at [developer.jamendo.com](https://developer.jamendo.com/v3.0/docs).
2. Create an application to obtain your **Client ID**.
3. Create a `.env` file inside `backend/` (or copy from `backend/.env.example`):
   ```env
   JAMENDO_CLIENT_ID=your_client_id_here
   ```
4. Start the backend. The API will query Jamendo on `/api/jamendo-track?title=...&artist=...`.

### Exact Track Matching & Fallback Policy
* When a song is selected, the backend verifies an exact title and artist match against Jamendo's catalog.
* **No synthetic substitutes or incorrect covers**: If Jamendo does not have the exact recording, or if credentials are not configured, the UI clearly displays **"Original track unavailable"** and leaves the playback disabled rather than playing generic synthesizer tones.
* All streamed audio includes proper attribution: `[Artist] - [Title] (Music provided by Jamendo)`.

### Availability-Aware Recommendations & Caching
* **Verified Jamendo Catalog**: The recommender loads 110 verified Jamendo tracks mapped across 6 emotional profiles (`happy`, `sad`, `calm`, `energetic`, `angry`, `neutral`) and serves playable tracks at the top of recommendations.
* **Metadata-Only Track Distinctions**: Spotify dataset songs without matching Jamendo recordings are labeled with `hasAudio: false` and badges indicate "Metadata Only" to prevent playback confusion.
* **In-Memory Caching**: Resolved tracks and negative lookups are cached in memory in Flask to eliminate redundant network roundtrips.

