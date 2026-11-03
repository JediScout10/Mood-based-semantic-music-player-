"""
Real Facial Expression Recognition Module using OpenCV YuNet Face Detection
and MobileFaceNet Emotion Classification (OpenCV Zoo / RAF-DB Pretrained).

Matches the exact preprocessing and canonical 5-point landmark alignment of the
official OpenCV Zoo FER model:
- Input shape: [1, 3, 112, 112]
- Channel order: RGB
- Normalization: (img / 255.0 - 0.5) / 0.5
- Output shape: [1, 7] logits
- Class labels: ["angry", "disgust", "fearful", "happy", "neutral", "sad", "surprised"]
"""

import os
import cv2
import numpy as np

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
YUNET_PATH = os.path.join(MODELS_DIR, "face_detection_yunet_2023mar.onnx")
FER_PATH = os.path.join(MODELS_DIR, "facial_expression_recognition_mobilefacenet_2022july.onnx")

# Documented 7 RAF-DB expression classes for MobileFaceNet
EXPRESSION_LABELS = ["angry", "disgust", "fearful", "happy", "neutral", "sad", "surprised"]

# Explicit mapping from model's 7 facial expressions to MoodMusicPlayer's 6 music moods
EXPRESSION_TO_MOOD_MAP = {
    "happy": "happy",          # Upbeat, high-valence pop / dance
    "sad": "sad",              # Low-energy, melancholic slowcore / acoustic
    "angry": "angry",          # High-arousal, aggressive rock / trap
    "neutral": "neutral",      # Balanced, study / focus lo-fi
    "surprised": "energetic",  # High-arousal excitement / surprise -> energetic synth / EDM
    "disgust": "angry",        # Intense negative valence / agitation -> heavy rock / industrial
    "fearful": "calm",         # Tension relief -> calming, ambient soothing tones
}

class FaceAlignment:
    """
    Official OpenCV Zoo 5-point facial landmark similarity transformation.
    Warps facial crop to standard 112x112 canonical coordinates based on:
    right eye, left eye, nose tip, right mouth corner, left mouth corner.
    """
    def __init__(self, reflective=False):
        self._std_points = np.array([
            [38.2946, 51.6963],  # Right eye
            [73.5318, 51.5014],  # Left eye
            [56.0252, 71.7366],  # Nose tip
            [41.5493, 92.3655],  # Right mouth corner
            [70.7299, 92.2041]   # Left mouth corner
        ])
        self.reflective = reflective

    def __tformfwd(self, trans, uv):
        uv = np.hstack((uv, np.ones((uv.shape[0], 1))))
        xy = np.dot(uv, trans)
        return xy[:, 0:-1]

    def __findNonreflectiveSimilarity(self, uv, xy):
        options = {"K": 2}
        K = options["K"]
        M = xy.shape[0]
        x = xy[:, 0].reshape((-1, 1))
        y = xy[:, 1].reshape((-1, 1))

        tmp1 = np.hstack((x, y, np.ones((M, 1)), np.zeros((M, 1))))
        tmp2 = np.hstack((y, -x, np.zeros((M, 1)), np.ones((M, 1))))
        X = np.vstack((tmp1, tmp2))

        u = uv[:, 0].reshape((-1, 1))
        v = uv[:, 1].reshape((-1, 1))
        U = np.vstack((u, v))

        if np.linalg.matrix_rank(X) >= 2 * K:
            r, _, _, _ = np.linalg.lstsq(X, U, rcond=-1)
            r = np.squeeze(r)
        else:
            raise Exception("cp2tform:twoUniquePointsReq")

        sc = r[0]
        ss = r[1]
        tx = r[2]
        ty = r[3]

        Tinv = np.array([[sc, -ss, 0], [ss, sc, 0], [tx, ty, 1]])
        T = np.linalg.inv(Tinv)
        T[:, 2] = np.array([0, 0, 1])
        return T, Tinv

    def get_align_image(self, image, lm5_points):
        """Align face image using 5 landmarks to 112x112"""
        trans, _ = self.__findNonreflectiveSimilarity(lm5_points, self._std_points)
        cv2_trans = trans[:, 0:2].T
        return cv2.warpAffine(image, cv2_trans, (112, 112))


class EmotionDetector:
    def __init__(self):
        self.yunet_path = YUNET_PATH
        self.fer_path = FER_PATH
        self.fer_net = None
        self.align_model = FaceAlignment()
        self._mean = np.array([0.5, 0.5, 0.5])[np.newaxis, np.newaxis, :]
        self._std = np.array([0.5, 0.5, 0.5])[np.newaxis, np.newaxis, :]
        self.load_models()

    def load_models(self):
        if not os.path.exists(self.yunet_path):
            raise FileNotFoundError(f"YuNet model not found at {self.yunet_path}")
        if not os.path.exists(self.fer_path):
            raise FileNotFoundError(f"FER model not found at {self.fer_path}")

        print(f"[EmotionDetector] Loading MobileFaceNet FER model from {self.fer_path}...")
        self.fer_net = cv2.dnn.readNet(self.fer_path)
        print("[EmotionDetector] Emotion models loaded successfully.")

    def get_face_detector(self, width: int, height: int):
        """Create or resize YuNet detector for frame dimensions"""
        return cv2.FaceDetectorYN_create(
            self.yunet_path,
            "",
            (width, height),
            score_threshold=0.6,
            nms_threshold=0.3,
            top_k=5000
        )

    def predict(self, image_bgr: np.ndarray):
        """
        Detect face using YuNet, align face with 5 landmarks, and classify emotion.
        Returns dict with face_detected, raw_expression, confidence, mapped_mood, all_probabilities.
        """
        if image_bgr is None or image_bgr.size == 0:
            return {
                "face_detected": False,
                "error": "Empty or corrupted image provided."
            }

        h, w = image_bgr.shape[:2]
        detector = self.get_face_detector(w, h)
        faces = detector.detect(image_bgr)

        # Check if any face was detected
        if faces[1] is None or len(faces[1]) == 0:
            return {
                "face_detected": False,
                "error": "No face detected in the camera frame. Please position your face clearly in good lighting.",
                "disclaimer": "Facial detection requires adequate illumination and front-facing visibility."
            }

        # Select the most prominent face (largest bounding box area)
        detected_faces = faces[1]
        best_face = None
        max_area = 0

        for f in detected_faces:
            fx, fy, fw, fh = f[:4]
            area = fw * fh
            if area > max_area:
                max_area = area
                best_face = f

        fx, fy, fw, fh = map(int, best_face[:4])

        # 5 Facial Landmarks: [x_re, y_re, x_le, y_le, x_nt, y_nt, x_rcm, y_rcm, x_lcm, y_lcm]
        landmarks_5 = best_face[4:14].reshape((5, 2))

        # 1. Canonical 5-point face alignment to 112x112
        try:
            aligned_face = self.align_model.get_align_image(image_bgr, landmarks_5)
        except Exception as e:
            # Fallback to simple crop if alignment fails
            print(f"[EmotionDetector] Face alignment fallback: {e}")
            aligned_face = image_bgr[max(0, fy):min(h, fy+fh), max(0, fx):min(w, fx+fw)]
            aligned_face = cv2.resize(aligned_face, (112, 112))

        # 2. Exact Preprocessing matching official OpenCV Zoo MobileFaceNet:
        # BGR -> RGB -> Float32 / 255.0 -> Normalize by mean=0.5, std=0.5 -> blobFromImage
        face_rgb = cv2.cvtColor(aligned_face, cv2.COLOR_BGR2RGB)
        face_float = face_rgb.astype(np.float32, copy=False) / 255.0
        face_norm = (face_float - self._mean) / self._std
        blob = cv2.dnn.blobFromImage(face_norm)

        # 3. Model Forward Pass
        self.fer_net.setInput(blob, "data")
        outputs = self.fer_net.forward(["label"])
        logits = outputs[0][0]

        # 4. Softmax Probabilities
        exp_logits = np.exp(logits - np.max(logits))
        probabilities = exp_logits / np.sum(exp_logits)

        top_idx = int(np.argmax(probabilities))
        raw_expression = EXPRESSION_LABELS[top_idx]
        confidence = float(probabilities[top_idx])

        # Map to 6 music moods
        mapped_mood = EXPRESSION_TO_MOOD_MAP.get(raw_expression, "neutral")

        all_probs = {
            label: round(float(prob), 4)
            for label, prob in zip(EXPRESSION_LABELS, probabilities)
        }

        return {
            "face_detected": True,
            "raw_expression": raw_expression,
            "confidence": round(confidence, 4),
            "confidence_percent": round(confidence * 100, 1),
            "mapped_mood": mapped_mood,
            "all_probabilities": all_probs,
            "face_box": {
                "x": fx,
                "y": fy,
                "width": fw,
                "height": fh
            },
            "disclaimer": "Facial expressions are situational external displays and provide an estimate of momentary affect. They do not equal guaranteed internal mood or emotional state."
        }

emotion_detector = EmotionDetector()
