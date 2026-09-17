import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  PenTool,
  RotateCcw,
  Trash2,
  Check,
  X,
  Laptop,
  Smartphone,
  Sparkles,
  Maximize2,
  Minimize2,
  Sliders,
  ShieldCheck,
  FileEdit,
  AlertCircle,
  Upload,
  FileUp,
  FileText,
  Image as ImageIcon,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Layers,
  Info,
} from 'lucide-react';
import { sanitizeAndValidateSignatureFile, ProcessSignatureResult } from '../utils/signatureUtils';

interface DigitalSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacherName: string;
  nip: string;
  sessionType: 'masuk' | 'pulang';
  dateStr: string;
  existingSignature?: string | null;
  onSaveSignature: (
    signatureDataUrl: string,
    deviceType: string,
    timeStr: string,
    revisionReason?: string
  ) => void;
}

type DeviceType = 'touchpad' | 'mouse' | 'touchscreen' | 'stylus';

interface RelativePoint {
  xr: number; // 0..1 relative to canvas width
  yr: number; // 0..1 relative to canvas height
}

interface StrokeRecord {
  points: RelativePoint[];
  color: string;
  width: number;
}

export const DigitalSignatureModal: React.FC<DigitalSignatureModalProps> = ({
  isOpen,
  onClose,
  teacherName,
  nip,
  sessionType,
  dateStr,
  existingSignature,
  onSaveSignature,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Mode tab: 'draw' | 'upload'
  const [activeTab, setActiveTab] = useState<'draw' | 'upload'>('draw');

  const [hasDrawn, setHasDrawn] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const hasDrawnRef = useRef(false);
  const isDrawingRef = useRef(false);
  const [detectedDevice, setDetectedDevice] = useState<DeviceType>('mouse');
  const [strokeColor, setStrokeColor] = useState<string>('#0f172a'); // Hitam resmi
  const [strokeWidth, setStrokeWidth] = useState<number>(3.5);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [justCleared, setJustCleared] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [shakeCanvas, setShakeCanvas] = useState<boolean>(false);
  const [revisionReason, setRevisionReason] = useState<string>('');

  // Uploaded signature file states
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFileInfo, setUploadedFileInfo] = useState<{
    fileName: string;
    fileType: 'jpg' | 'png' | 'pdf';
    totalPages?: number;
    currentPage: number;
  } | null>(null);
  const [removeWhiteBg, setRemoveWhiteBg] = useState<boolean>(true);
  const [enhanceContrast, setEnhanceContrast] = useState<boolean>(true);
  const [uploadedSignatureDataUrl, setUploadedSignatureDataUrl] = useState<string | null>(null);
  const uploadedImageObjRef = useRef<HTMLImageElement | null>(null);
  const rawUploadedFileRef = useRef<File | null>(null);

  // Drag & drop state
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Informational FAQ toggle: Why camera has issues and why upload/draw is recommended
  const [showCameraFaq, setShowCameraFaq] = useState<boolean>(false);

  // Vector strokes storage for flawless orientation & resize responsiveness
  const strokesRef = useRef<StrokeRecord[]>([]);
  const currentStrokeRef = useRef<RelativePoint[]>([]);
  const strokeHistoryRef = useRef<StrokeRecord[][]>([]);
  const [historyLength, setHistoryLength] = useState<number>(0);

  // Helper to draw smooth Bézier curve from points on canvas context
  const renderSmoothStroke = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      points: Array<{ x: number; y: number }>,
      color: string,
      width: number
    ) => {
      if (points.length === 0) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (points.length === 1) {
        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, Math.max(1, width / 2), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      if (points.length === 2) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.stroke();
        ctx.restore();
        return;
      }

      // Smooth Bézier curve with Catmull-Rom midpoint interpolation
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }

      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.stroke();
      ctx.restore();
    },
    []
  );

  // Detect device category & set optimal stroke width
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isTouchDevice =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-ignore
        (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0);

      const isMobile = isTouchDevice && window.innerWidth <= 768;

      if (isMobile) {
        setDetectedDevice('touchscreen');
        setStrokeWidth(4.0);
      } else {
        setDetectedDevice('mouse');
        setStrokeWidth(2.8);
      }
    }
  }, [isOpen]);

  // Helper to clear canvas context
  const clearCanvasContext = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  };

  // Setup / resize canvas with HiDPI support and redraw vector strokes and uploaded signature
  const initCanvas = useCallback(
    (preserveContent = true) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      // Set display size
      const width = Math.floor(rect.width) || 480;
      const height = Math.floor(rect.height) || 240;

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // Set buffer size scaled by DPR for razor-sharp strokes
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 1. If an uploaded signature image exists, draw it centered and proportional
        if (preserveContent && uploadedImageObjRef.current) {
          const img = uploadedImageObjRef.current;
          const maxW = width * 0.88;
          const maxH = height * 0.82;
          const scale = Math.min(maxW / (img.naturalWidth || 1), maxH / (img.naturalHeight || 1), 1.0);
          const dw = img.naturalWidth * scale;
          const dh = img.naturalHeight * scale;
          const dx = (width - dw) / 2;
          const dy = (height - dh) / 2;
          ctx.drawImage(img, dx, dy, dw, dh);
          hasDrawnRef.current = true;
          setHasDrawn(true);
        } else if (uploadedSignatureDataUrl && preserveContent && !uploadedImageObjRef.current) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            uploadedImageObjRef.current = img;
            const maxW = width * 0.88;
            const maxH = height * 0.82;
            const scale = Math.min(maxW / (img.naturalWidth || 1), maxH / (img.naturalHeight || 1), 1.0);
            const dw = img.naturalWidth * scale;
            const dh = img.naturalHeight * scale;
            const dx = (width - dw) / 2;
            const dy = (height - dh) / 2;
            ctx.drawImage(img, dx, dy, dw, dh);
            hasDrawnRef.current = true;
            setHasDrawn(true);
          };
          img.src = uploadedSignatureDataUrl;
        }

        // 2. Redraw all vector strokes scaled proportionally to new dimensions
        if (preserveContent && strokesRef.current.length > 0) {
          strokesRef.current.forEach((stroke) => {
            const absolutePoints = stroke.points.map((pt) => ({
              x: pt.xr * width,
              y: pt.yr * height,
            }));
            renderSmoothStroke(ctx, absolutePoints, stroke.color, stroke.width);
          });
          hasDrawnRef.current = true;
          setHasDrawn(true);
        } else if (
          existingSignature &&
          strokesRef.current.length === 0 &&
          !hasDrawnRef.current &&
          !uploadedSignatureDataUrl
        ) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.drawImage(img, 0, 0, width, height);
            hasDrawnRef.current = true;
            setHasDrawn(true);
          };
          img.src = existingSignature;
        }
      }
    },
    [existingSignature, renderSmoothStroke, uploadedSignatureDataUrl]
  );

  // Initialize once when modal opens
  useEffect(() => {
    if (isOpen) {
      hasDrawnRef.current = false;
      isDrawingRef.current = false;
      strokesRef.current = [];
      strokeHistoryRef.current = [];
      setHistoryLength(0);
      setHasDrawn(false);
      setValidationError(null);
      setUploadError(null);
      setRevisionReason('');
      setUploadedSignatureDataUrl(null);
      setUploadedFileInfo(null);
      uploadedImageObjRef.current = null;
      rawUploadedFileRef.current = null;
      setActiveTab('draw');

      const timer = setTimeout(() => {
        initCanvas(false);
      }, 70);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initCanvas]);

  // Process uploaded signature file (JPG, PNG, or PDF)
  const handleProcessFile = async (
    file: File,
    pageNum: number = 1,
    removeWhite: boolean = removeWhiteBg,
    enhance: boolean = enhanceContrast
  ) => {
    setIsUploading(true);
    setUploadError(null);
    setValidationError(null);

    try {
      rawUploadedFileRef.current = file;
      const result: ProcessSignatureResult = await sanitizeAndValidateSignatureFile(file, {
        pageNumber: pageNum,
        removeWhiteBg: removeWhite,
        enhanceContrast: enhance,
      });

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        uploadedImageObjRef.current = img;
        setUploadedSignatureDataUrl(result.dataUrl);
        setUploadedFileInfo({
          fileName: result.fileName,
          fileType: result.fileType,
          totalPages: result.totalPages,
          currentPage: pageNum,
        });

        // Render directly to canvas
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          const width = Math.floor(rect.width) || 480;
          const height = Math.floor(rect.height) || 240;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            clearCanvasContext();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            const maxW = width * 0.88;
            const maxH = height * 0.82;
            const scale = Math.min(maxW / (img.naturalWidth || 1), maxH / (img.naturalHeight || 1), 1.0);
            const dw = img.naturalWidth * scale;
            const dh = img.naturalHeight * scale;
            const dx = (width - dw) / 2;
            const dy = (height - dh) / 2;
            ctx.drawImage(img, dx, dy, dw, dh);
          }
        }

        hasDrawnRef.current = true;
        setHasDrawn(true);
        setIsUploading(false);
      };

      img.onerror = () => {
        setUploadError('Gagal merender gambar tanda tangan dari berkas.');
        setIsUploading(false);
      };

      img.src = result.dataUrl;
    } catch (err: any) {
      console.error('Signature upload error:', err);
      setUploadError(err.message || 'Terjadi kesalahan saat membaca berkas tanda tangan.');
      setIsUploading(false);
    }
  };

  // Toggle white background removal and re-process current file
  const handleToggleRemoveWhiteBg = (checked: boolean) => {
    setRemoveWhiteBg(checked);
    if (rawUploadedFileRef.current) {
      handleProcessFile(
        rawUploadedFileRef.current,
        uploadedFileInfo?.currentPage || 1,
        checked,
        enhanceContrast
      );
    }
  };

  // Toggle ink enhancement and re-process current file
  const handleToggleEnhanceContrast = (checked: boolean) => {
    setEnhanceContrast(checked);
    if (rawUploadedFileRef.current) {
      handleProcessFile(
        rawUploadedFileRef.current,
        uploadedFileInfo?.currentPage || 1,
        removeWhiteBg,
        checked
      );
    }
  };

  // Navigate PDF pages
  const handleChangePdfPage = (targetPage: number) => {
    if (rawUploadedFileRef.current && uploadedFileInfo?.totalPages) {
      const page = Math.max(1, Math.min(targetPage, uploadedFileInfo.totalPages));
      handleProcessFile(
        rawUploadedFileRef.current,
        page,
        removeWhiteBg,
        enhanceContrast
      );
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      handleProcessFile(file);
    }
  };

  // Handle native file input selection
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleProcessFile(files[0]);
    }
  };

  // Handle window resize and orientation change (portrait <-> landscape) seamlessly
  useEffect(() => {
    if (!isOpen) return;

    const handleOrientationOrResize = () => {
      setTimeout(() => {
        initCanvas(true);
      }, 100);
    };

    window.addEventListener('resize', handleOrientationOrResize);
    window.addEventListener('orientationchange', handleOrientationOrResize);
    if (typeof window !== 'undefined' && window.screen && window.screen.orientation) {
      window.screen.orientation.addEventListener('change', handleOrientationOrResize);
    }

    // ResizeObserver to detect exact container size changes dynamically
    let ro: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        initCanvas(true);
      });
      ro.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleOrientationOrResize);
      window.removeEventListener('orientationchange', handleOrientationOrResize);
      if (typeof window !== 'undefined' && window.screen && window.screen.orientation) {
        window.screen.orientation.removeEventListener('change', handleOrientationOrResize);
      }
      if (ro) ro.disconnect();
    };
  }, [isOpen, initCanvas]);

  // Fullscreen toggle resize
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      initCanvas(true);
    }, 70);
    return () => clearTimeout(timer);
  }, [isFullscreen, initCanvas, isOpen]);

  // Undo last stroke
  const handleUndo = () => {
    if (strokeHistoryRef.current.length === 0) return;
    const prevHistory = [...strokeHistoryRef.current];
    const previousStrokes = prevHistory.pop() || [];
    strokeHistoryRef.current = prevHistory;
    strokesRef.current = previousStrokes;
    setHistoryLength(prevHistory.length);

    clearCanvasContext();
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext('2d');
      if (ctx) {
        previousStrokes.forEach((stroke) => {
          const absolutePoints = stroke.points.map((pt) => ({
            x: pt.xr * rect.width,
            y: pt.yr * rect.height,
          }));
          renderSmoothStroke(ctx, absolutePoints, stroke.color, stroke.width);
        });
      }
    }

    const hasRemaining = previousStrokes.length > 0;
    hasDrawnRef.current = hasRemaining;
    setHasDrawn(hasRemaining);
  };

  // Instant clear canvas & reset uploaded signature
  const handleClear = () => {
    clearCanvasContext();
    strokesRef.current = [];
    strokeHistoryRef.current = [];
    currentStrokeRef.current = [];
    uploadedImageObjRef.current = null;
    rawUploadedFileRef.current = null;
    setUploadedSignatureDataUrl(null);
    setUploadedFileInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setHistoryLength(0);
    hasDrawnRef.current = false;
    isDrawingRef.current = false;
    setHasDrawn(false);
    setValidationError(null);
    setUploadError(null);

    // Visual feedback
    setJustCleared(true);
    setTimeout(() => setJustCleared(false), 800);
  };

  // Extract relative canvas coordinates from PointerEvent
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, width: 480, height: 240 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      width: rect.width || 480,
      height: rect.height || 240,
    };
  };

  // Pointer Down (Start signature)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (e.pointerType === 'touch') {
      setDetectedDevice('touchscreen');
    } else if (e.pointerType === 'pen') {
      setDetectedDevice('stylus');
    } else if (e.pointerType === 'mouse') {
      setDetectedDevice((prev) => (prev === 'touchpad' ? 'touchpad' : 'mouse'));
    }

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    // Save snapshot to history for undo
    strokeHistoryRef.current.push([...strokesRef.current]);
    setHistoryLength(strokeHistoryRef.current.length);

    isDrawingRef.current = true;
    setIsDrawing(true);
    setValidationError(null);

    const { x, y, width, height } = getCanvasCoords(e);
    const firstPoint: RelativePoint = { xr: x / width, yr: y / height };
    currentStrokeRef.current = [firstPoint];

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.arc(x, y, strokeWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // Pointer Move (Draw smooth curve with quadratic bezier interpolation)
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y, width, height } = getCanvasCoords(e);
    const newPoint: RelativePoint = { xr: x / width, yr: y / height };
    currentStrokeRef.current.push(newPoint);

    const pts = currentStrokeRef.current;
    if (pts.length >= 3) {
      const p1 = { x: pts[pts.length - 3].xr * width, y: pts[pts.length - 3].yr * height };
      const p2 = { x: pts[pts.length - 2].xr * width, y: pts[pts.length - 2].yr * height };
      const p3 = { x: pts[pts.length - 1].xr * width, y: pts[pts.length - 1].yr * height };

      const mid1 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const mid2 = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(mid1.x, mid1.y);
      ctx.quadraticCurveTo(p2.x, p2.y, mid2.x, mid2.y);
      ctx.stroke();
    } else if (pts.length === 2) {
      const p0 = { x: pts[0].xr * width, y: pts[0].yr * height };
      const p1 = { x: pts[1].xr * width, y: pts[1].yr * height };
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    hasDrawnRef.current = true;
    setHasDrawn(true);
  };

  // Pointer Up / Cancel
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    isDrawingRef.current = false;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (canvas) {
      try {
        if (canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
    }

    if (currentStrokeRef.current.length > 0) {
      strokesRef.current.push({
        points: [...currentStrokeRef.current],
        color: strokeColor,
        width: strokeWidth,
      });
      currentStrokeRef.current = [];
    }

    hasDrawnRef.current = strokesRef.current.length > 0;
    setHasDrawn(strokesRef.current.length > 0);
  };

  // Generate Sample Signature for quick testing/demo
  const handleGenerateSampleSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    handleClear();

    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    // Create realistic signature stroke flourish as vector points
    const flourishPoints: RelativePoint[] = [
      { xr: 0.15, yr: 0.65 },
      { xr: 0.20, yr: 0.35 },
      { xr: 0.26, yr: 0.22 },
      { xr: 0.32, yr: 0.55 },
      { xr: 0.38, yr: 0.78 },
      { xr: 0.44, yr: 0.32 },
      { xr: 0.50, yr: 0.18 },
      { xr: 0.56, yr: 0.68 },
      { xr: 0.62, yr: 0.42 },
      { xr: 0.70, yr: 0.28 },
      { xr: 0.78, yr: 0.58 },
      { xr: 0.86, yr: 0.48 },
    ];

    const underlinePoints: RelativePoint[] = [
      { xr: 0.18, yr: 0.72 },
      { xr: 0.35, yr: 0.76 },
      { xr: 0.55, yr: 0.72 },
      { xr: 0.75, yr: 0.71 },
      { xr: 0.86, yr: 0.73 },
    ];

    const endDot: RelativePoint[] = [
      { xr: 0.88, yr: 0.72 },
    ];

    strokesRef.current = [
      { points: flourishPoints, color: strokeColor, width: strokeWidth },
      { points: underlinePoints, color: strokeColor, width: Math.max(2, strokeWidth * 0.85) },
      { points: endDot, color: strokeColor, width: strokeWidth * 1.5 },
    ];

    strokesRef.current.forEach((s) => {
      const abs = s.points.map((p) => ({ x: p.xr * w, y: p.yr * h }));
      renderSmoothStroke(ctx, abs, s.color, s.width);
    });

    hasDrawnRef.current = true;
    setHasDrawn(true);
    setDetectedDevice('touchpad');
    setValidationError(null);
  };

  // Save and submit signature with validation
  const handleConfirmSave = () => {
    const canvas = canvasRef.current;
    const isSignatureValid =
      strokesRef.current.length > 0 ||
      !!uploadedSignatureDataUrl ||
      (existingSignature && hasDrawnRef.current);

    // Validation: prevent saving blank canvas & give animated visual toast feedback
    if (!canvas || !isSignatureValid) {
      setValidationError('⚠️ Harap bubuhkan tanda tangan atau unggah berkas tanda tangan terlebih dahulu!');
      setShakeCanvas(true);
      setTimeout(() => setShakeCanvas(false), 800);
      return;
    }

    // Export as high-quality PNG data URL
    const signatureDataUrl = canvas.toDataURL('image/png');

    // Current formatted time (e.g. 07:15 WITA)
    const now = new Date();
    const timeStr = `${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA`;

    // Determine audit device / origin label
    let deviceLabel: string = detectedDevice;
    if (uploadedFileInfo) {
      deviceLabel =
        uploadedFileInfo.fileType === 'pdf'
          ? 'Unggah PDF'
          : `Unggah ${uploadedFileInfo.fileType.toUpperCase()}`;
    }

    onSaveSignature(
      signatureDataUrl,
      deviceLabel,
      timeStr,
      revisionReason.trim() || undefined
    );

    // Pastikan canvas di-clear setelah berhasil disimpan
    handleClear();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div
        className={`bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col transition-all duration-200 ${
          isFullscreen
            ? 'fixed inset-2 sm:inset-4 z-[130] w-auto h-auto max-w-none max-h-none'
            : 'w-full max-w-xl max-h-[95vh]'
        }`}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs font-bold ${
                sessionType === 'masuk' ? 'bg-emerald-600' : 'bg-indigo-600'
              }`}
            >
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                  Tanda Tangan Digital Absen {sessionType === 'masuk' ? 'Masuk' : 'Pulang'}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    sessionType === 'masuk'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  {sessionType}
                </span>
                {existingSignature && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                    Mode Revisi
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium truncate max-w-[260px] sm:max-w-md">
                {teacherName} • NIP: {nip} • {dateStr}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 transition-colors"
              title={isFullscreen ? 'Kecilkan' : 'Perbesar Layar Penuh'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs & Quick Action Bar */}
        <div className="px-4 py-2.5 bg-slate-100/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center space-x-1.5 p-1 bg-slate-200/80 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('draw')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'draw'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Gores Langsung</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('upload');
                if (!uploadedSignatureDataUrl && fileInputRef.current) {
                  fileInputRef.current.click();
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Unggah Berkas (JPG / PNG / PDF)</span>
              {uploadedFileInfo && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>
          </div>

          {/* FAQ Button: Why Camera Has Issues */}
          <button
            type="button"
            onClick={() => setShowCameraFaq(!showCameraFaq)}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center space-x-1 cursor-pointer border ${
              showCameraFaq
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Penjelasan mengapa tanda tangan kamera sering bermasalah dan solusinya"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Kenapa Kamera Bermasalah?</span>
          </button>
        </div>

        {/* Informational Card: Why Camera Signing Has Issues & Why Upload is Superior */}
        {showCameraFaq && (
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-950 space-y-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 font-extrabold text-amber-900">
                <Info className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Mengapa Tanda Tangan Kamera Sering Bermasalah?</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCameraFaq(false)}
                className="text-amber-700 hover:text-amber-900 font-bold p-1 rounded-lg hover:bg-amber-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] leading-relaxed">
              <div className="p-2 bg-white/80 rounded-xl border border-amber-200/70">
                <p className="font-bold text-amber-900">1. Lensa Fokus Makro & Buram</p>
                <p className="text-slate-600 mt-0.5">
                  Webcam laptop & kamera HP umumnya bertipe <em>fixed focus</em> (jarak jauh). Saat kertas tanda tangan didekatkan, gambar menjadi kabur/buram (*out of focus*).
                </p>
              </div>
              <div className="p-2 bg-white/80 rounded-xl border border-amber-200/70">
                <p className="font-bold text-amber-900">2. Silau Cahaya & Bayangan</p>
                <p className="text-slate-600 mt-0.5">
                  Kertas putih memantulkan lampu ruangan (*glare*), sementara tangan pengguna menimbulkan bayangan gelap yang membuat goresan tanda tangan patah.
                </p>
              </div>
              <div className="p-2 bg-white/80 rounded-xl border border-amber-200/70">
                <p className="font-bold text-amber-900">3. Izin Browser & Kunci Kamera</p>
                <p className="text-slate-600 mt-0.5">
                  Akses WebRTC kamera sering dibatasi peramban (*device locked / camera busy*) jika ada tab lain yang membuka kamera.
                </p>
              </div>
              <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200">
                <p className="font-bold text-emerald-900">✅ Solusi Resmi BKD Taliabu</p>
                <p className="text-emerald-800 mt-0.5">
                  Gunakan menu <strong>Unggah Berkas (JPG, PNG, PDF)</strong> atau <strong>Gores Langsung</strong> di layar sentuh HP / touchpad. Sistem otomatis membersihkan latar kertas putih menjadi transparan rapi!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Hidden Native File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Upload Mode Dropzone / Active File Toolbar */}
        {activeTab === 'upload' && (
          <div className="p-4 bg-indigo-50/50 border-b border-indigo-100 space-y-2.5">
            {!uploadedFileInfo ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-4 rounded-2xl border-2 border-dashed transition-all text-center cursor-pointer flex flex-col items-center justify-center space-y-2 ${
                  isDragOver
                    ? 'border-indigo-600 bg-indigo-100/70 scale-[1.01]'
                    : 'border-indigo-300 hover:border-indigo-500 bg-white/80'
                }`}
              >
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
                  <FileUp className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Klik di sini untuk memilih berkas atau Tarik & Lepas berkas Anda
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Mendukung berkas foto tanda tangan (<span className="font-semibold text-indigo-700">JPG, PNG</span>) atau dokumen scan (<span className="font-semibold text-indigo-700">PDF</span>)
                  </p>
                </div>
                <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono">
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-bold text-slate-700">
                    .JPG
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-bold text-slate-700">
                    .PNG
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-bold text-slate-700">
                    .PDF
                  </span>
                  <span>• Maks 15 MB</span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-white rounded-2xl border border-indigo-200 shadow-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
                        uploadedFileInfo.fileType === 'pdf' ? 'bg-rose-600' : 'bg-indigo-600'
                      }`}
                    >
                      {uploadedFileInfo.fileType === 'pdf' ? (
                        <FileText className="w-4 h-4" />
                      ) : (
                        <ImageIcon className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-xs text-slate-900 truncate max-w-[200px] sm:max-w-xs">
                          {uploadedFileInfo.fileName}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase ${
                            uploadedFileInfo.fileType === 'pdf'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {uploadedFileInfo.fileType}
                        </span>
                      </div>
                      <p className="text-[10px] text-emerald-700 font-medium flex items-center space-x-1 mt-0.5">
                        <Check className="w-3 h-3" />
                        <span>Tanda tangan berhasil dimuat ke kanvas</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer flex items-center space-x-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Ganti Berkas</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleClear}
                      className="p-1 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Hapus berkas yang diunggah"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* PDF Multi-page selector (if document has multiple pages) */}
                {uploadedFileInfo.fileType === 'pdf' && (uploadedFileInfo.totalPages || 1) > 1 && (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <span className="text-slate-600 font-medium">Halaman Dokumen PDF:</span>
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        disabled={uploadedFileInfo.currentPage <= 1 || isUploading}
                        onClick={() => handleChangePdfPage(uploadedFileInfo.currentPage - 1)}
                        className="p-1 rounded-lg bg-white border border-slate-300 disabled:opacity-30 hover:bg-slate-100 cursor-pointer"
                        title="Halaman Sebelumnya"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md font-mono font-bold text-slate-800 text-[11px]">
                        {uploadedFileInfo.currentPage} / {uploadedFileInfo.totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={
                          uploadedFileInfo.currentPage >= (uploadedFileInfo.totalPages || 1) ||
                          isUploading
                        }
                        onClick={() => handleChangePdfPage(uploadedFileInfo.currentPage + 1)}
                        className="p-1 rounded-lg bg-white border border-slate-300 disabled:opacity-30 hover:bg-slate-100 cursor-pointer"
                        title="Halaman Berikutnya"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Processing filters: Remove white background & enhance contrast */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[11px]">
                  <label className="flex items-center space-x-1.5 cursor-pointer select-none text-slate-700">
                    <input
                      type="checkbox"
                      checked={removeWhiteBg}
                      onChange={(e) => handleToggleRemoveWhiteBg(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="font-semibold">Hapus Latar Putih (Transparan)</span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer select-none text-slate-700">
                    <input
                      type="checkbox"
                      checked={enhanceContrast}
                      onChange={(e) => handleToggleEnhanceContrast(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="font-semibold">Pertajam Tinta Dokumen Resmi</span>
                  </label>
                </div>
              </div>
            )}

            {/* Upload Error Banner if any */}
            {uploadError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-medium">{uploadError}</span>
              </div>
            )}
          </div>
        )}

        {/* Device Mode & Optimal Stroke Notice Banner */}
        <div className="px-4 py-2 bg-indigo-50/70 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center space-x-1.5 text-indigo-950 font-semibold">
            {uploadedFileInfo ? (
              <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : detectedDevice === 'touchscreen' || detectedDevice === 'stylus' ? (
              <Smartphone className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            ) : (
              <Laptop className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            )}
            <span>
              Mode Input:{' '}
              {uploadedFileInfo
                ? `Berkas ${uploadedFileInfo.fileType.toUpperCase()} (Tanda Tangan Terunggah)`
                : detectedDevice === 'touchscreen'
                ? 'Layar Sentuh HP (Mobile)'
                : detectedDevice === 'stylus'
                ? 'Stylus Pen / Apple Pencil'
                : detectedDevice === 'touchpad'
                ? 'Touchpad Laptop'
                : 'Mouse / Trackpad Laptop'}
            </span>
          </div>

          <div className="flex items-center space-x-2 text-[10.5px]">
            <span className="text-indigo-800 font-medium hidden sm:inline">
              Ketebalan Optimal Terkalibrasi:
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-700 font-extrabold shadow-2xs">
              {strokeWidth.toFixed(1)} px
            </span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>

        {/* Body Canvas Area */}
        <div className="p-4 sm:p-5 flex-1 flex flex-col space-y-3 overflow-hidden">
          {/* Canvas Wrapper with Quick Clear & Guideline */}
          <div
            ref={containerRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative w-full flex-1 min-h-[220px] sm:min-h-[260px] bg-slate-50/90 rounded-2xl border-2 transition-all overflow-hidden flex items-center justify-center cursor-crosshair select-none ${
              isDragOver
                ? 'border-indigo-600 ring-4 ring-indigo-200 bg-indigo-50/50'
                : shakeCanvas
                ? 'border-rose-500 ring-4 ring-rose-200 bg-rose-50/30'
                : justCleared
                ? 'border-emerald-500 ring-2 ring-emerald-200 bg-emerald-50/20'
                : 'border-dashed border-slate-300 hover:border-indigo-400'
            }`}
            style={{ touchAction: 'none' }}
          >
            {/* Drag & Drop Visual Overlay */}
            {isDragOver && (
              <div className="absolute inset-0 z-40 bg-indigo-600/90 text-white flex flex-col items-center justify-center space-y-2 pointer-events-none animate-in fade-in">
                <FileUp className="w-10 h-10 animate-bounce" />
                <p className="font-extrabold text-sm">Lepaskan Berkas di Sini</p>
                <p className="text-xs text-indigo-100">Ekstrak tanda tangan dari JPG, PNG, atau PDF</p>
              </div>
            )}

            {/* Loading Spinner Overlay during PDF/Image Processing */}
            {isUploading && (
              <div className="absolute inset-0 z-40 bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center space-y-2 pointer-events-none">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="font-bold text-xs text-slate-800">
                  Mengekstrak tanda tangan dari berkas...
                </p>
                <p className="text-[10px] text-slate-500">
                  Membersihkan latar belakang kertas & menyesuaikan resolusi
                </p>
              </div>
            )}

            {/* Validation Error Toast Alert */}
            {validationError && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 bg-rose-600 text-white text-[11px] font-bold rounded-full shadow-xl flex items-center space-x-1.5 animate-bounce border border-rose-400">
                <AlertCircle className="w-4 h-4 text-rose-100 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Quick Floating Clear Button inside Canvas (Top-Right) */}
            {hasDrawn && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute top-2.5 right-2.5 z-20 px-2.5 py-1.5 bg-white/90 hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-[11px] font-bold shadow-sm flex items-center space-x-1 transition-all cursor-pointer backdrop-blur-xs"
                title="Bersihkan area tanda tangan seketika"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}

            {/* Just Cleared Toast Badge */}
            {justCleared && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1 bg-slate-900 text-white text-[11px] font-bold rounded-full shadow-lg flex items-center space-x-1.5 animate-in fade-in">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Kanvas Dibersihkan</span>
              </div>
            )}

            {/* Background Guidelines */}
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-end p-6">
              <div className="w-full border-b border-slate-300/80 mb-2 flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Garis Tanda Tangan
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  SMPN 4 Satu Atap Taliabu Barat
                </span>
              </div>
            </div>

            {/* Instruction Overlay if not drawn */}
            {!hasDrawn && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white/90 shadow-sm border border-slate-200 flex items-center justify-center text-slate-400 mb-2">
                  <PenTool className="w-6 h-6 text-indigo-500 animate-bounce" />
                </div>
                <p className="text-xs font-bold text-slate-700">
                  Goreskan tanda tangan Anda di area kotak ini
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs">
                  Gunakan <span className="font-semibold text-slate-800">Touchpad / Mouse</span> pada laptop, atau <span className="font-semibold text-slate-800">Sentuhan Jari / Stylus</span> pada HP
                </p>
              </div>
            )}

            {/* HTML5 Canvas with Pointer Events */}
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="w-full h-full relative z-10 block"
              style={{
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
            />
          </div>

          {/* Stroke Width Adjustment & Color Controls */}
          <div className="space-y-2 bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80">
            {/* Row 1: Stroke Width Slider & Presets for Mobile & Desktop */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-2">
                <Sliders className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="text-[11px] font-bold text-slate-700">Ketebalan Goresan:</span>
                <input
                  type="range"
                  min="1.5"
                  max="6.5"
                  step="0.2"
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(parseFloat(e.target.value))}
                  className="w-24 sm:w-32 h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div
                  className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center shadow-xs"
                  title="Ukuran titik pena"
                >
                  <span
                    className="rounded-full bg-white block"
                    style={{ width: `${Math.min(strokeWidth * 2, 12)}px`, height: `${Math.min(strokeWidth * 2, 12)}px` }}
                  />
                </div>
              </div>

              {/* Quick Presets tailored for Mobile & Desktop */}
              <div className="flex items-center space-x-1">
                {[
                  { width: 2.4, label: 'Mouse (2.4px)', for: 'Laptop' },
                  { width: 3.2, label: 'Touchpad (3.2px)', for: 'Laptop' },
                  { width: 4.2, label: 'Jari HP (4.2px)', for: 'Mobile' },
                  { width: 5.5, label: 'Tebal (5.5px)', for: 'Semua' },
                ].map((item) => (
                  <button
                    key={item.width}
                    type="button"
                    onClick={() => setStrokeWidth(item.width)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      Math.abs(strokeWidth - item.width) < 0.2
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:text-indigo-600'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 2: Tinta & Canvas Actions (Undo, Clear, Auto Demo) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {/* Tinta Pilihan */}
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-bold text-slate-600">Tinta:</span>
                {[
                  { color: '#0f172a', label: 'Hitam Dokumen Resmi' },
                  { color: '#1e3a8a', label: 'Biru Instansi BKD' },
                  { color: '#312e81', label: 'Indigo Gelap' },
                ].map((item) => (
                  <button
                    key={item.color}
                    type="button"
                    onClick={() => setStrokeColor(item.color)}
                    className={`w-6 h-6 rounded-lg transition-transform cursor-pointer flex items-center justify-center ${
                      strokeColor === item.color
                        ? 'scale-110 ring-2 ring-indigo-500 ring-offset-1'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: item.color }}
                    title={item.label}
                  >
                    {strokeColor === item.color && <Check className="w-3 h-3 text-white" />}
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={handleGenerateSampleSignature}
                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-[11px] font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                  title="Isi contoh tanda tangan otomatis untuk demo / pengujian cepat"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden sm:inline">Contoh TTD</span>
                </button>

                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={historyLength === 0}
                  className="px-2.5 py-1 bg-slate-200/80 hover:bg-slate-300 disabled:opacity-40 disabled:pointer-events-none text-slate-700 rounded-xl text-[11px] font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                  title="Batal Goresan Terakhir"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Undo</span>
                </button>

                <button
                  type="button"
                  onClick={handleClear}
                  disabled={!hasDrawn}
                  className="px-3 py-1 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 disabled:pointer-events-none text-rose-700 border border-rose-200 rounded-xl text-[11px] font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                  title="Bersihkan area tanda tangan"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Semua</span>
                </button>
              </div>
            </div>
          </div>

          {/* Revision Reason Input if editing existing signature */}
          {existingSignature && (
            <div className="p-2.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-center space-x-2 text-xs">
              <FileEdit className="w-4 h-4 text-amber-700 shrink-0" />
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Alasan revisi / pembaruan tanda tangan (opsional, dicatat di log audit)"
                  value={revisionReason}
                  onChange={(e) => setRevisionReason(e.target.value)}
                  className="w-full text-xs px-2.5 py-1 bg-white border border-amber-300 rounded-lg focus:outline-none text-amber-950 placeholder-amber-500/70 font-medium"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleConfirmSave}
            className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-extrabold shadow-md transition-all flex items-center space-x-2 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Simpan Tanda Tangan Resmi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
