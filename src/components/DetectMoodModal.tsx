import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';
import { MoodType } from '../types/music';
import { predictEmotion, EmotionPredictionResult } from '../services/api';
import { addJournalEntry } from '../services/moodJournal';

interface DetectMoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyMood: (mood: MoodType) => void;
}

export const DetectMoodModal: React.FC<DetectMoodModalProps> = ({
  isOpen,
  onClose,
  onApplyMood,
}) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [predictionResult, setPredictionResult] = useState<EmotionPredictionResult | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [activeInputSource, setActiveInputSource] = useState<'webcam' | 'upload'>('webcam');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setPredictionResult(null);
      setServerError(null);
      setCameraError(null);
      setPreviewImage(null);
    } else {
      startCamera();
    }
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setActiveInputSource('webcam');
      setPreviewImage(null);
    } catch (err: unknown) {
      console.warn('Webcam permission error:', err);
      setCameraError('Webcam access was denied or is unavailable. You can upload an image file or use the manual mood selector below.');
      setCameraActive(false);
      setActiveInputSource('upload');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // 1. Live Webcam Capture Path
  const captureAndPredict = async () => {
    if (!videoRef.current || !cameraActive) return;

    setIsAnalyzing(true);
    setPredictionResult(null);
    setServerError(null);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not initialize canvas context');

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setPreviewImage(dataUrl);

      // Call real Flask OpenCV + MobileFaceNet endpoint
      const result = await predictEmotion(dataUrl);

      if (result.error && !result.face_detected) {
        setPredictionResult(result);
      } else if (result.face_detected && result.mapped_mood) {
        setPredictionResult(result);
        addJournalEntry(result.mapped_mood, 'camera');
      } else {
        setServerError(result.error || 'Prediction failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error during inference';
      setServerError(`Backend error: ${msg}. Make sure the Flask server is running.`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 2. Static File Upload Path
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = reader.result as string;
      setPreviewImage(b64);
      setActiveInputSource('upload');
      stopCamera();

      setIsAnalyzing(true);
      setPredictionResult(null);
      setServerError(null);

      try {
        const result = await predictEmotion(b64);
        if (result.error && !result.face_detected) {
          setPredictionResult(result);
        } else if (result.face_detected && result.mapped_mood) {
          setPredictionResult(result);
          addJournalEntry(result.mapped_mood, 'upload');
        } else {
          setServerError(result.error || 'Prediction failed');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Upload inference failed';
        setServerError(msg);
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl bg-white border-3 border-zinc-900 rounded-3xl p-6 sm:p-7 shadow-[6px_8px_0px_0px_rgba(24,24,27,1)] overflow-hidden max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge-sticker bg-mint-light text-zinc-950 px-2.5 py-0.5 text-[10px]">
                OPENCV YUNET + MOBILEFACENET
              </span>
              <span className="text-[10px] font-bold text-zinc-400">
                RAF-DB Validated Model
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">
              Facial Expression Detection
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full border-2 border-zinc-900 hover:bg-zinc-100 transition-colors shadow-sm"
          >
            <X className="w-5 h-5 text-zinc-900" />
          </button>
        </div>

        {/* Camera / Upload Viewport */}
        <div className="relative aspect-video w-full rounded-2xl bg-zinc-950 border-2 border-zinc-900 overflow-hidden flex flex-col items-center justify-center text-white mb-3 shadow-inner">
          {/* Live Video Element */}
          {activeInputSource === 'webcam' && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transform -scale-x-100 ${cameraActive ? 'block' : 'hidden'}`}
            />
          )}

          {/* Static Image Preview Element */}
          {previewImage && activeInputSource === 'upload' && (
            <img
              src={previewImage}
              alt="Test Input"
              className="w-full h-full object-contain"
            />
          )}

          {/* Prompt if Camera Inactive and no Uploaded Image */}
          {!cameraActive && !previewImage && (
            <div className="text-center p-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto text-zinc-400">
                <Camera className="w-6 h-6" />
              </div>
              <p className="text-xs text-zinc-400 font-medium max-w-xs mx-auto">
                {cameraError || 'Use live camera feed or upload a test face image.'}
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={startCamera}
                  className="px-3.5 py-1.5 bg-white text-zinc-900 font-bold text-xs rounded-full border border-zinc-900 hover:bg-zinc-100 transition-all shadow-sm"
                >
                  Enable Camera
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 bg-zinc-800 text-white font-bold text-xs rounded-full border border-zinc-700 hover:bg-zinc-700 transition-all shadow-sm"
                >
                  Upload Image File
                </button>
              </div>
            </div>
          )}

          {/* Face Reticle for Live Webcam */}
          {cameraActive && !isAnalyzing && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-44 h-56 border-2 border-dashed border-mint/70 rounded-full animate-pulse flex items-end justify-center pb-2">
                <span className="text-[9px] font-bold text-mint uppercase tracking-widest bg-zinc-900/80 px-2 py-0.5 rounded-full">
                  Align Face Here
                </span>
              </div>
            </div>
          )}

          {/* Loading Overlay */}
          {isAnalyzing && (
            <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-20">
              <div className="w-9 h-9 border-3 border-mint border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-black tracking-wider text-mint uppercase">
                Detecting Face & Classifying Expression...
              </span>
              <span className="text-[10px] text-zinc-400">
                5-Point Landmark Alignment + MobileFaceNet ONNX
              </span>
            </div>
          )}
        </div>

        {/* Dual Actions: 1. Live Camera Capture | 2. Upload Static Image */}
        <div className="flex items-center gap-2 mb-3">
          {cameraActive ? (
            <button
              onClick={captureAndPredict}
              disabled={isAnalyzing}
              className="flex-1 py-2.5 px-4 bg-zinc-900 text-white rounded-full font-black text-xs hover:bg-zinc-800 active:scale-98 transition-all shadow-[2px_2px_0px_0px_rgba(24,24,27,1)] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Camera className="w-4 h-4" />
              <span>Capture & Analyze Expression</span>
            </button>
          ) : (
            <button
              onClick={startCamera}
              className="flex-1 py-2.5 px-4 bg-white border-2 border-zinc-900 text-zinc-900 rounded-full font-black text-xs hover:bg-zinc-100 active:scale-98 transition-all shadow-[2px_2px_0px_0px_rgba(24,24,27,1)] flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" />
              <span>Switch to Webcam</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
            className="py-2.5 px-3.5 bg-zinc-100 hover:bg-zinc-200 border-2 border-zinc-900 text-zinc-900 rounded-full font-black text-xs transition-colors flex items-center gap-1.5 shadow-xs"
            title="Upload a test face image"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Upload Test Image</span>
          </button>
        </div>

        {/* Negative / No-Face Alert */}
        {predictionResult && !predictionResult.face_detected && (
          <div className="mb-3 p-3 bg-amber-50 border-2 border-zinc-900 rounded-2xl flex items-start gap-2 text-xs text-amber-950 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <div>
              <strong>No Face Detected:</strong> {predictionResult.error}
            </div>
          </div>
        )}

        {/* Server Error Alert */}
        {serverError && (
          <div className="mb-3 p-3 bg-rose-50 border-2 border-zinc-900 rounded-2xl flex items-start gap-2 text-xs text-rose-950 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Server Communication Error:</strong> {serverError}
            </div>
          </div>
        )}

        {/* Prediction Results Card */}
        {predictionResult && predictionResult.face_detected && predictionResult.mapped_mood && (
          <div className="mb-3 p-4 rounded-2xl bg-emerald-50 border-2 border-zinc-900 space-y-3 shadow-sm animate-scaleUp">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-black uppercase text-emerald-950">
                    Detected Expression: <span className="capitalize">{predictionResult.raw_expression}</span>
                  </span>
                </div>
                <div className="text-[11px] text-zinc-600 mt-0.5">
                  Model Confidence: <strong>{predictionResult.confidence_percent || (predictionResult.confidence! * 100).toFixed(1)}%</strong>
                  {' • '}
                  Mapped Music Mood: <strong className="capitalize text-zinc-900">{predictionResult.mapped_mood}</strong>
                </div>
              </div>

              <button
                onClick={() => {
                  onApplyMood(predictionResult.mapped_mood!);
                  onClose();
                }}
                className="px-4 py-2 bg-zinc-900 text-white rounded-full text-xs font-black hover:bg-zinc-800 transition-all shadow-[2px_2px_0px_0px_rgba(24,24,27,1)] flex-shrink-0"
              >
                Apply Recommendations →
              </button>
            </div>

            {/* Scientific Disclaimer */}
            <div className="text-[10px] text-zinc-500 bg-white/70 p-2 rounded-xl border border-zinc-200 leading-normal">
              <strong>Psychological Note:</strong> {predictionResult.disclaimer || 'Facial expressions are situational external displays and provide an estimate of momentary affect. They do not equal guaranteed internal mood or emotional state.'}
            </div>
          </div>
        )}

        {/* Manual Mood Fallback */}
        <div className="pt-2 border-t border-zinc-100">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1.5">
            Manual Mood Fallback (Always Available):
          </span>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {(['happy', 'sad', 'calm', 'energetic', 'angry', 'neutral'] as MoodType[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  addJournalEntry(m, 'manual');
                  onApplyMood(m);
                  onClose();
                }}
                className="py-1.5 px-2 bg-zinc-100 hover:bg-sunny border border-zinc-900 rounded-xl text-[11px] font-bold capitalize text-zinc-900 transition-colors flex items-center justify-center gap-1 shadow-xs"
              >
                <span>{m === 'happy' ? '☀️' : m === 'sad' ? '🌧️' : m === 'calm' ? '🌿' : m === 'energetic' ? '⚡' : m === 'angry' ? '🔥' : '☕'}</span>
                <span>{m}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
