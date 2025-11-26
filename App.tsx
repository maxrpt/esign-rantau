import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, ChevronLeft, ChevronRight, Download, PenTool, Trash2, XCircle, Lock, Unlock, Move, Layout, RotateCw, Undo, Redo, Pencil, X, Check, ZoomIn, ZoomOut, Moon, Sun, BookOpen, Copy, Image as ImageIcon } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, degrees, rgb } from 'pdf-lib';
import { Button } from './components/Button';
import { SignaturePad } from './components/SignaturePad';
import { SignatureStyling } from './components/SignatureStyling';
import { FreeDrawLayer } from './components/FreeDrawLayer';
import { setupPdfWorker } from './utils/pdfWorker';
import { SignatureElement, Stroke, PageDrawings } from './types';

// Setup Worker
setupPdfWorker();

// Helper to hex to rgb
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : { r: 0, g: 0, b: 0 };
};

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [viewportDims, setViewportDims] = useState<{width: number, height: number} | null>(null);
  
  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check local storage or system preference
    if (typeof window !== 'undefined') {
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme) {
            return storedTheme === 'dark';
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Apply Dark Mode Class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  // Thumbnails
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);

  // Signatures
  const [showSigPad, setShowSigPad] = useState(false);
  const [showStylingModal, setShowStylingModal] = useState(false);
  const [signatures, setSignatures] = useState<SignatureElement[]>([]);
  const [selectedSigId, setSelectedSigId] = useState<string | null>(null);
  const [editingSigId, setEditingSigId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Free Draw State
  const [isFreeDrawMode, setIsFreeDrawMode] = useState(false);
  const [drawings, setDrawings] = useState<PageDrawings>({});
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushWidth, setBrushWidth] = useState(3);

  // Delete Confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; sigId: string | null }>({
    isOpen: false,
    sigId: null
  });

  // Download Confirmation
  const [downloadConfirmOpen, setDownloadConfirmOpen] = useState(false);
  
  // History / Undo / Redo
  const [history, setHistory] = useState<{
    past: { sigs: SignatureElement[], draws: PageDrawings }[];
    future: { sigs: SignatureElement[], draws: PageDrawings }[];
  }>({ past: [], future: [] });

  // Refs for tracking state inside event listeners without closure staleness
  const signaturesRef = useRef(signatures);
  const historyStartRef = useRef<{ sigs: SignatureElement[], draws: PageDrawings } | null>(null); 
  
  // Ref for PDF Render Task to handle cancellation
  const renderTaskRef = useRef<any>(null);

  // Sync ref with state
  useEffect(() => {
    signaturesRef.current = signatures;
  }, [signatures]);

  // Resize State
  const [aspectRatioLocked, setAspectRatioLocked] = useState(true);
  const [resizeMode, setResizeMode] = useState<{
      isResizing: boolean;
      handle: string | null;
      startPos: { x: number; y: number };
      startSig: SignatureElement | null;
  }>({ isResizing: false, handle: null, startPos: { x: 0, y: 0 }, startSig: null });

  // Rotation State
  const [rotateMode, setRotateMode] = useState<{
    isRotating: boolean;
    startAngle: number;
    initialRotation: number;
    center: { x: number; y: number } | null;
    sigId: string | null;
  }>({ isRotating: false, startAngle: 0, initialRotation: 0, center: null, sigId: null });

  // Snapping State
  const [snapTargets, setSnapTargets] = useState<{ x: number, y: number, width: number, height: number }[]>([]);
  const [snapLines, setSnapLines] = useState<{ orientation: 'vertical' | 'horizontal', position: number }[]>([]);

  // Canvas Refs
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- HISTORY HELPERS ---

  const saveToHistory = () => {
    setHistory(prev => ({
      past: [...prev.past, { sigs: signatures, draws: drawings }],
      future: []
    }));
  };

  const undo = () => {
    if (history.past.length === 0) return;
    const previous = history.past[history.past.length - 1];
    const newPast = history.past.slice(0, -1);
    
    // Save current state to future
    setHistory({
      past: newPast,
      future: [{ sigs: signatures, draws: drawings }, ...history.future]
    });
    setSignatures(previous.sigs);
    setDrawings(previous.draws);
  };

  const redo = () => {
    if (history.future.length === 0) return;
    const next = history.future[0];
    const newFuture = history.future.slice(1);

    setHistory({
      past: [...history.past, { sigs: signatures, draws: drawings }],
      future: newFuture
    });
    setSignatures(next.sigs);
    setDrawings(next.draws);
  };

  // Keyboard Shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, signatures, drawings]); 

  // 1. Handle File Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    
    const selectedFile = fileList[0];
    if (selectedFile.type !== 'application/pdf') {
      alert('Mohon unggah file PDF yang valid.');
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);
    setThumbnails([]); // Clear old thumbnails
    
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      setPageNum(1);
      setSignatures([]);
      setDrawings({});
      setHistory({ past: [], future: [] });
    } catch (error) {
      console.error('Error loading PDF:', error);
      alert('Gagal memuat PDF. File mungkin rusak.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Generate Thumbnails
  useEffect(() => {
    if (!pdfDoc) return;

    const generateThumbnails = async () => {
      setIsGeneratingThumbnails(true);
      const thumbs: string[] = [];
      try {
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: 0.2 }); // Small scale for thumbnail
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({
            canvasContext: context!,
            viewport: viewport
          } as any).promise;

          thumbs.push(canvas.toDataURL());
        }
        setThumbnails(thumbs);
      } catch (error) {
        console.error("Error generating thumbnails", error);
      } finally {
        setIsGeneratingThumbnails(false);
      }
    };

    generateThumbnails();
  }, [pdfDoc]);

  // 3a. Initial Fit Width Logic
  useEffect(() => {
    if (!pdfDoc || !canvasContainerRef.current) return;

    const fitToWidth = async () => {
        try {
            const page = await pdfDoc.getPage(1);
            const containerWidth = canvasContainerRef.current!.clientWidth;
            const unscaledViewport = page.getViewport({ scale: 1 });
            // Calculate scale to fit container width minus padding
            const desiredScale = (containerWidth - 48) / unscaledViewport.width; 
            const finalScale = Math.min(Math.max(desiredScale, 0.5), 2.0);
            setScale(finalScale);
        } catch (e) {
            console.error("Error fitting to width", e);
        }
    };
    fitToWidth();
  }, [pdfDoc]);

  // 3b. Render PDF Page and Fetch Annotations for Snapping
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !canvasContainerRef.current) return;

    const renderPage = async () => {
      // 1. Cancel previous render task if active to avoid "Cannot use the same canvas" error
      if (renderTaskRef.current) {
        try {
          await renderTaskRef.current.cancel();
        } catch (e) {
          // Swallow cancellation errors
        }
      }

      try {
        const page = await pdfDoc.getPage(pageNum);
        
        // Use current state scale instead of calculating it every time
        const viewport = page.getViewport({ scale: scale });
        setViewportDims({ width: viewport.width, height: viewport.height });

        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d');

        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        // 2. Start new render task and save reference
        const renderTask = page.render(renderContext as any);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        
        // Clear task if finished successfully
        if (renderTaskRef.current === renderTask) {
           renderTaskRef.current = null;
        }

        // Fetch Annotations (Form Fields) for Snapping
        const annotations = await page.getAnnotations();
        const newTargets = annotations
          .filter((a: any) => a.subtype === 'Widget') // We mostly care about form widgets
          .map((annot: any) => {
            const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(annot.rect);
            // Standardize coordinates (top-left width height)
            const x = Math.min(x1, x2);
            const y = Math.min(y1, y2);
            const w = Math.abs(x1 - x2);
            const h = Math.abs(y1 - y2);
            
            // Convert to percentage relative to viewport
            return {
              x: (x / viewport.width) * 100,
              y: (y / viewport.height) * 100,
              width: (w / viewport.width) * 100,
              height: (h / viewport.height) * 100
            };
          });
        setSnapTargets(newTargets);

      } catch (error: any) {
        // Ignore errors caused by cancellation
        if (error.name === 'RenderingCancelledException') {
            return;
        }
        console.error("Render error", error);
      }
    };

    renderPage();

    return () => {
      // Cancel on cleanup
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, pageNum, scale]); // Dependencies: Re-render if Doc, Page, or Scale changes

  // Zoom Handlers
  const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 3.0)); // Max zoom 300%
  const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.5)); // Min zoom 50%


  // 4. Handle Signature Creation / Update
  const handleSaveSignature = (dataUrl: string) => {
    // Save history before change
    saveToHistory();

    const img = new Image();
    img.onload = () => {
      const aspectRatio = img.width / img.height;

      if (editingSigId) {
        // Update existing signature (Redraw)
        setSignatures(prev => prev.map(s => {
          if (s.id === editingSigId) {
            return {
              ...s,
              dataUrl,
              aspectRatio // Update AR
            };
          }
          return s;
        }));
        setEditingSigId(null);
      } else {
        // Create new signature
        const newSig: SignatureElement = {
          id: crypto.randomUUID(),
          dataUrl,
          pageIndex: pageNum - 1,
          x: 40, // Centerish
          y: 40, 
          width: 20, 
          aspectRatio,
          rotation: 0,
          opacity: 1
        };
        setSignatures(prev => [...prev, newSig]);
        setSelectedSigId(newSig.id);
      }
      setShowSigPad(false);
    };
    img.src = dataUrl;
  };
  
  const handleSaveStyle = (dataUrl: string, opacity: number) => {
      if (!editingSigId) return;
      saveToHistory();
      
      setSignatures(prev => prev.map(s => {
          if (s.id === editingSigId) {
              return { ...s, dataUrl, opacity };
          }
          return s;
      }));
      setEditingSigId(null);
      setShowStylingModal(false);
  };

  const handleDoubleClick = (e: React.MouseEvent, id: string) => {
    if (isFreeDrawMode) return; // Disable double click editing in draw mode
    e.stopPropagation();
    setEditingSigId(id);
    // Switch to Styling Modal instead of Pad directly
    setShowStylingModal(true);
  };

  const handleRedrawRequest = () => {
      setShowStylingModal(false);
      setShowSigPad(true); // Open the pad with editingSigId already set
  };

  const handleCancelSignature = () => {
    setShowSigPad(false);
    setShowStylingModal(false);
    setEditingSigId(null);
  };

  // 4b. Handle Free Drawing
  const handleAddStroke = (stroke: Stroke) => {
    saveToHistory();
    setDrawings(prev => {
      const pageStrokes = prev[pageNum - 1] || [];
      return {
        ...prev,
        [pageNum - 1]: [...pageStrokes, stroke]
      };
    });
  };

  const handleToggleFreeDraw = () => {
    setIsFreeDrawMode(!isFreeDrawMode);
    if (!isFreeDrawMode) {
      setSelectedSigId(null); // Deselect any signature
    }
  };

  const handleClearPage = () => {
    saveToHistory();
    setDrawings(prev => ({
      ...prev,
      [pageNum - 1]: []
    }));
  };

  // 5. Handle Dragging with Snapping
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent, id: string) => {
    if (isFreeDrawMode) return; // Disable dragging in draw mode
    // If we are resizing or rotating, don't drag
    if (resizeMode.isResizing || rotateMode.isRotating) return;
    
    e.stopPropagation();
    e.preventDefault(); // Prevent touch scroll
    setSelectedSigId(id);
    
    // Snapshot for history logic
    historyStartRef.current = { sigs: signaturesRef.current, draws: drawings };

    const container = canvasContainerRef.current;
    if (!container || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const sig = signatures.find(s => s.id === id);
    if (!sig) return;

    const startLeftPct = sig.x;
    const startTopPct = sig.y;
    
    // Snapping Constants
    const SNAP_THRESHOLD = 0.5; // Percentage threshold for snapping

    const moveHandler = (moveEvent: MouseEvent | TouchEvent) => {
        moveEvent.preventDefault();
        const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

        const deltaXPixels = currentX - startX;
        const deltaYPixels = currentY - startY;

        const deltaXPct = (deltaXPixels / canvasRect.width) * 100;
        const deltaYPct = (deltaYPixels / canvasRect.height) * 100;

        // Current actual height in percentage
        const canvasRatio = canvasRect.width / canvasRect.height;
        const hPct = sig.width * canvasRatio / sig.aspectRatio;

        // Proposed positions
        let nextX = Math.min(Math.max(startLeftPct + deltaXPct, 0), 100 - sig.width);
        let nextY = Math.min(Math.max(startTopPct + deltaYPct, 0), 100 - hPct);

        // --- Snapping Logic ---
        
        // 1. Collect Snap Points (Vertical lines for X snapping, Horizontal lines for Y snapping)
        const vSnapPoints: number[] = [0, 50, 100]; // Page Edges & Center
        const hSnapPoints: number[] = [0, 50, 100];

        // Add other signatures on this page
        signaturesRef.current.forEach(s => {
            if (s.id === id || s.pageIndex !== pageNum - 1) return;
            vSnapPoints.push(s.x, s.x + s.width / 2, s.x + s.width);
            const sHeight = s.width * canvasRatio / s.aspectRatio;
            hSnapPoints.push(s.y, s.y + sHeight / 2, s.y + sHeight);
        });

        // Add Annotations (Form fields)
        snapTargets.forEach(t => {
            vSnapPoints.push(t.x, t.x + t.width / 2, t.x + t.width);
            hSnapPoints.push(t.y, t.y + t.height / 2, t.y + t.height);
        });

        const activeLines: { orientation: 'vertical' | 'horizontal', position: number }[] = [];

        // 2. Snap X
        let snappedX = false;
        const myEdgesX = [
            { offset: 0 },              // Left
            { offset: sig.width / 2 },  // Center
            { offset: sig.width }       // Right
        ];
        
        let minDiffX = SNAP_THRESHOLD;
        for (const edge of myEdgesX) {
            const currentEdgePos = nextX + edge.offset;
            for (const target of vSnapPoints) {
                const diff = Math.abs(currentEdgePos - target);
                if (diff < minDiffX) {
                    minDiffX = diff;
                    nextX = target - edge.offset; // Snap!
                    activeLines.push({ orientation: 'vertical', position: target });
                    snappedX = true;
                }
            }
            if (snappedX) break; 
        }

        // 3. Snap Y
        let snappedY = false;
        const myEdgesY = [
            { offset: 0 },          // Top
            { offset: hPct / 2 },   // Middle
            { offset: hPct }        // Bottom
        ];

        let minDiffY = SNAP_THRESHOLD;
        for (const edge of myEdgesY) {
            const currentEdgePos = nextY + edge.offset;
            for (const target of hSnapPoints) {
                const diff = Math.abs(currentEdgePos - target);
                if (diff < minDiffY) {
                    minDiffY = diff;
                    nextY = target - edge.offset; // Snap!
                    activeLines.push({ orientation: 'horizontal', position: target });
                    snappedY = true;
                }
            }
            if (snappedY) break;
        }

        setSnapLines(activeLines);

        // Update Position
        setSignatures(prev => prev.map(s => {
            if (s.id === id) {
                return {
                    ...s,
                    x: Math.min(Math.max(nextX, 0), 100 - s.width),
                    y: Math.min(Math.max(nextY, 0), 100 - hPct),
                };
            }
            return s;
        }));
    };

    const upHandler = () => {
        setSnapLines([]); // Clear guides
        
        // Commit to history if changed
        const startState = historyStartRef.current;
        if (startState) {
            const hasChanged = JSON.stringify(startState.sigs) !== JSON.stringify(signaturesRef.current);
            if (hasChanged) {
              setHistory(prev => ({
                past: [...prev.past, { sigs: startState.sigs, draws: startState.draws }],
                future: []
              }));
            }
        }

        window.removeEventListener('mousemove', moveHandler);
        window.removeEventListener('mouseup', upHandler);
        window.removeEventListener('touchmove', moveHandler);
        window.removeEventListener('touchend', upHandler);
    };

    window.addEventListener('mousemove', moveHandler);
    window.addEventListener('mouseup', upHandler);
    window.addEventListener('touchmove', moveHandler, { passive: false });
    window.addEventListener('touchend', upHandler);
  };

  // 6. Handle Resizing
  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent, sig: SignatureElement, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Snapshot for history
    historyStartRef.current = { sigs: signaturesRef.current, draws: drawings };

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    setResizeMode({
        isResizing: true,
        handle,
        startPos: { x: clientX, y: clientY },
        startSig: { ...sig }
    });
  };

  useEffect(() => {
    if (!resizeMode.isResizing || !resizeMode.startSig || !canvasRef.current) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const deltaX = clientX - resizeMode.startPos.x;
        const deltaY = clientY - resizeMode.startPos.y;

        const deltaXPct = (deltaX / rect.width) * 100;
        const deltaYPct = (deltaY / rect.height) * 100;

        const s = resizeMode.startSig!;
        let { x, y, width, aspectRatio } = s;

        // Helper: Calculate Height % from Width %
        const getHPct = (w: number, r: number) => (w * rect.width) / r / rect.height;

        let newWidth = width;
        let newHeightPct = getHPct(width, aspectRatio);
        let newX = x;
        let newY = y;

        if (aspectRatioLocked) {
             if (resizeMode.handle?.includes('e')) {
                 newWidth = Math.max(1, width + deltaXPct);
             }
             if (resizeMode.handle?.includes('w')) {
                 const change = Math.min(deltaXPct, width - 1);
                 newWidth = width - change;
                 newX = x + change;
             }
             if (resizeMode.handle?.includes('n')) {
                 const oldH = getHPct(width, aspectRatio);
                 const newH = getHPct(newWidth, aspectRatio);
                 newY = y - (newH - oldH);
             }
        } else {
             if (resizeMode.handle?.includes('e')) {
                 newWidth = Math.max(1, width + deltaXPct);
             } else if (resizeMode.handle?.includes('w')) {
                 const change = Math.min(deltaXPct, width - 1);
                 newWidth = width - change;
                 newX = x + change;
             }

             if (resizeMode.handle?.includes('s')) {
                 newHeightPct = Math.max(0.5, newHeightPct + deltaYPct);
             } else if (resizeMode.handle?.includes('n')) {
                 const change = Math.min(deltaYPct, newHeightPct - 0.5);
                 newHeightPct = newHeightPct - change;
                 newY = y + change;
             }

             const wPx = (newWidth / 100) * rect.width;
             const hPx = (newHeightPct / 100) * rect.height;
             aspectRatio = wPx / hPx;
        }

        if (newWidth < 1) newWidth = 1;
        if (newX < 0) newX = 0;
        
        setSignatures(prev => prev.map(sig => sig.id === s.id ? {
            ...sig, x: newX, y: newY, width: newWidth, aspectRatio
        } : sig));
    };

    const handleUp = () => {
        setResizeMode({ isResizing: false, handle: null, startPos: { x:0,y:0 }, startSig: null });
        
        // Commit History
        const startState = historyStartRef.current;
        if (startState) {
            const hasChanged = JSON.stringify(startState.sigs) !== JSON.stringify(signaturesRef.current);
            if (hasChanged) {
              setHistory(prev => ({
                past: [...prev.past, { sigs: startState.sigs, draws: startState.draws }],
                future: []
              }));
            }
        }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchend', handleUp);
    
    return () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        window.removeEventListener('touchend', handleUp);
    };
  }, [resizeMode, aspectRatioLocked]);

  // 7. Handle Rotation
  const handleRotateStart = (e: React.MouseEvent | React.TouchEvent, sig: SignatureElement) => {
    e.stopPropagation();
    e.preventDefault();

    // Snapshot for history
    historyStartRef.current = { sigs: signaturesRef.current, draws: drawings };

    const target = e.currentTarget as HTMLElement;
    const wrapper = target.parentElement as HTMLElement;
    const rect = wrapper.getBoundingClientRect();
    
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const startAngle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);

    setRotateMode({
      isRotating: true,
      startAngle,
      initialRotation: sig.rotation,
      center: { x: centerX, y: centerY },
      sigId: sig.id
    });
  };

  useEffect(() => {
    if (!rotateMode.isRotating || !rotateMode.center) return;

    const handleRotateMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const currentAngle = Math.atan2(clientY - rotateMode.center!.y, clientX - rotateMode.center!.x) * (180 / Math.PI);
      const deltaAngle = currentAngle - rotateMode.startAngle;
      
      let newRotation = rotateMode.initialRotation + deltaAngle;
      
      setSignatures(prev => prev.map(s => {
        if (s.id === rotateMode.sigId) {
          return { ...s, rotation: newRotation };
        }
        return s;
      }));
    };

    const handleRotateUp = () => {
      setRotateMode(prev => ({ ...prev, isRotating: false, center: null, sigId: null }));
      
      // Commit History
      const startState = historyStartRef.current;
      if (startState) {
          const hasChanged = JSON.stringify(startState.sigs) !== JSON.stringify(signaturesRef.current);
          if (hasChanged) {
            setHistory(prev => ({
              past: [...prev.past, { sigs: startState.sigs, draws: startState.draws }],
              future: []
            }));
          }
      }
    };

    window.addEventListener('mousemove', handleRotateMove);
    window.addEventListener('touchmove', handleRotateMove, { passive: false });
    window.addEventListener('mouseup', handleRotateUp);
    window.addEventListener('touchend', handleRotateUp);

    return () => {
      window.removeEventListener('mousemove', handleRotateMove);
      window.removeEventListener('touchmove', handleRotateMove);
      window.removeEventListener('mouseup', handleRotateUp);
      window.removeEventListener('touchend', handleRotateUp);
    };
  }, [rotateMode]);


  const deleteSignature = (id: string) => {
      // Save history
      saveToHistory();
      
      setSignatures(prev => prev.filter(s => s.id !== id));
      if (selectedSigId === id) setSelectedSigId(null);
  };
  
  const handleConfirmDelete = () => {
    if (deleteConfirm.sigId) {
        deleteSignature(deleteConfirm.sigId);
    }
    setDeleteConfirm({ isOpen: false, sigId: null });
  };

  // Duplicate Signature Handler
  const handleDuplicateSignature = (e: React.MouseEvent, sigId: string) => {
      e.stopPropagation();
      const originalSig = signatures.find(s => s.id === sigId);
      if (!originalSig) return;

      saveToHistory();

      const newSig: SignatureElement = {
          ...originalSig,
          id: crypto.randomUUID(),
          x: Math.min(originalSig.x + 2, 90), // Slight offset
          y: Math.min(originalSig.y + 2, 90),
      };

      setSignatures(prev => [...prev, newSig]);
      setSelectedSigId(newSig.id);
  };

  // 8. Save PDF
  const handleDownload = async () => {
    if (!file || !pdfDoc) return;
    setIsProcessing(true);
    setDownloadConfirmOpen(false);

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDocLib = await PDFDocument.load(arrayBuffer);
        const pages = pdfDocLib.getPages();

        // 1. Burn Drawings
        for (let i = 0; i < pages.length; i++) {
            const pageStrokes = drawings[i];
            if (!pageStrokes || pageStrokes.length === 0) continue;

            const page = pages[i];
            const { width: pageWidth, height: pageHeight } = page.getSize();
            
            pageStrokes.forEach(stroke => {
              if (stroke.points.length < 2) return;
              
              const { r, g, b } = hexToRgb(stroke.color);
              const color = rgb(r, g, b);
              
              // We draw lines between consecutive points
              for (let j = 0; j < stroke.points.length - 1; j++) {
                  const p1 = stroke.points[j];
                  const p2 = stroke.points[j + 1];

                  page.drawLine({
                      start: { x: p1.x * pageWidth, y: pageHeight - (p1.y * pageHeight) },
                      end: { x: p2.x * pageWidth, y: pageHeight - (p2.y * pageHeight) },
                      thickness: stroke.width, // This might need scaling adjustment depending on PDF PPI
                      color: color,
                      opacity: 1,
                  });
              }
            });
        }

        // 2. Burn Signatures
        for (const sig of signatures) {
            const image = await pdfDocLib.embedPng(sig.dataUrl);
            const page = pages[sig.pageIndex];
            const { width: pageWidth, height: pageHeight } = page.getSize();
            
            // Dimensions
            const imgWidth = (sig.width / 100) * pageWidth;
            const imgHeight = imgWidth / sig.aspectRatio;
            
            // Position
            const x = (sig.x / 100) * pageWidth;
            const yFromTopPct = sig.y;
            const yFromTopUnits = (yFromTopPct / 100) * pageHeight;
            const y = pageHeight - yFromTopUnits - imgHeight;

            const drawOptions: any = {
                x,
                y,
                width: imgWidth,
                height: imgHeight,
                opacity: sig.opacity ?? 1
            };

            // Rotation
            if (sig.rotation !== 0) {
              const rads = (sig.rotation * -1) * (Math.PI / 180);
              const centerX = x + imgWidth / 2;
              const centerY = y + imgHeight / 2;
              
              const cos = Math.cos(rads);
              const sin = Math.sin(rads);
              
              const rotX = (imgWidth / 2) * cos - (imgHeight / 2) * sin;
              const rotY = (imgWidth / 2) * sin + (imgHeight / 2) * cos;
              
              drawOptions.x = centerX - rotX;
              drawOptions.y = centerY - rotY;
              drawOptions.rotate = degrees(sig.rotation * -1);
            }
            
            page.drawImage(image, drawOptions);
        }

        const pdfBytes = await pdfDocLib.save();
        // Explicitly cast to any to avoid TypeScript complaints about SharedArrayBuffer vs ArrayBuffer compatibility
        const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `signed_${file.name}`;
        link.click();
        URL.revokeObjectURL(url);

    } catch (e) {
        console.error("Save error", e);
        alert("Gagal menyimpan PDF. Silakan coba lagi.");
    } finally {
        setIsProcessing(false);
    }
  };

  // 9. Export Current Page As Image
  const handleExportPageAsImage = async () => {
    if (!pdfDoc) return;
    setIsProcessing(true);

    try {
        const page = await pdfDoc.getPage(pageNum);
        // Render at high resolution (e.g. scale 2.0) for quality
        const exportScale = 2.0;
        const viewport = page.getViewport({ scale: exportScale });
        
        // Create off-screen canvas
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) throw new Error("Could not create canvas context");

        // 1. Render PDF Page
        await page.render({
            canvasContext: ctx,
            viewport: viewport
        } as any).promise;

        // 2. Draw Strokes (Free Draw)
        const pageStrokes = drawings[pageNum - 1] || [];
        if (pageStrokes.length > 0) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            pageStrokes.forEach(stroke => {
                if (stroke.points.length < 2) return;
                
                ctx.beginPath();
                ctx.strokeStyle = stroke.color;
                ctx.lineWidth = stroke.width * exportScale; // Scale line width

                const first = stroke.points[0];
                ctx.moveTo(first.x * viewport.width, first.y * viewport.height);

                for (let i = 1; i < stroke.points.length; i++) {
                    const p = stroke.points[i];
                    ctx.lineTo(p.x * viewport.width, p.y * viewport.height);
                }
                ctx.stroke();
            });
        }

        // 3. Draw Signatures
        const pageSignatures = signatures.filter(s => s.pageIndex === pageNum - 1);
        for (const sig of pageSignatures) {
            await new Promise<void>((resolve) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => {
                    const width = (sig.width / 100) * viewport.width;
                    const height = width / sig.aspectRatio;
                    const x = (sig.x / 100) * viewport.width;
                    const y = (sig.y / 100) * viewport.height;

                    ctx.save();
                    
                    // Handle Rotation & Opacity
                    ctx.globalAlpha = sig.opacity ?? 1;
                    
                    const cx = x + width / 2;
                    const cy = y + height / 2;
                    
                    ctx.translate(cx, cy);
                    ctx.rotate((sig.rotation * Math.PI) / 180);
                    ctx.translate(-cx, -cy);
                    
                    ctx.drawImage(img, x, y, width, height);
                    
                    ctx.restore();
                    resolve();
                };
                img.src = sig.dataUrl;
            });
        }

        // Export
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `page_${pageNum}_${file?.name.replace('.pdf', '') || 'export'}.png`;
        link.click();

    } catch (e) {
        console.error("Export error", e);
        alert("Gagal mengekspor gambar. Silakan coba lagi.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleReset = () => {
      setFile(null);
      setPdfDoc(null);
      setSignatures([]);
      setDrawings({});
      setThumbnails([]);
      setPageNum(1);
      setHistory({ past: [], future: [] });
  };

  return (
    <div className="h-screen flex flex-col font-sans overflow-hidden bg-slate-100 dark:bg-slate-900 transition-colors">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm shrink-0 z-30 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <FileText className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">E-sign PDF - Agent Rantau</h1>
          </div>
          
          <div className="flex items-center gap-3">
              <button 
                  onClick={toggleDarkMode}
                  className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                  title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                  {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              {file && (
                  <>
                      <Button variant="ghost" onClick={handleExportPageAsImage} disabled={isProcessing}>
                        <ImageIcon className="w-4 h-4 mr-2" />
                        Export Img
                      </Button>
                      <Button variant="ghost" onClick={handleReset}>
                        <XCircle className="w-4 h-4 mr-2" />
                        Reset
                      </Button>
                      <Button onClick={() => setDownloadConfirmOpen(true)} disabled={isProcessing}>
                          <Download className="w-4 h-4 mr-2" />
                          {isProcessing ? 'Memproses...' : 'Unduh PDF'}
                      </Button>
                  </>
              )}
          </div>
        </div>
      </header>

      <main className="flex-1 bg-slate-100 dark:bg-slate-900 flex flex-col overflow-hidden transition-colors">
        {!file ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto">
                <div className="w-full max-w-xl animate-fade-in-up">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 sm:p-12 text-center border border-slate-200 dark:border-slate-700 transition-colors">
                        <div className="bg-blue-50 dark:bg-blue-900/30 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Upload className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Unggah Dokumen PDF</h2>
                        <p className="text-slate-500 dark:text-slate-400 mb-8">Pilih file PDF yang ingin Anda tanda tangani secara digital.</p>
                        <label className="block w-full">
                            <input 
                                type="file" 
                                accept="application/pdf" 
                                onChange={handleFileChange}
                                className="hidden" 
                            />
                            <div className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition shadow-lg hover:shadow-blue-500/30 transform hover:-translate-y-1">
                                Pilih File PDF
                            </div>
                        </label>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">File diproses di browser Anda. Aman & Privat.</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                          dibuat oleh <a href="https://makmurriansyah.github.io/" target="_blank" rel="noopener noreferrer" className="font-bold hover:text-blue-500 dark:hover:text-blue-400 hover:underline">Max NM</a>
                        </p>
                    </div>
                </div>
            </div>
        ) : (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Top Control Bar */}
                <div className="bg-white dark:bg-slate-800 p-3 border-b border-slate-200 dark:border-slate-700 flex flex-col gap-3 shrink-0 shadow-sm z-20 transition-colors">
                    <div className="flex flex-wrap justify-between items-center gap-4">
                        <div className="flex items-center gap-3">
                             <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 rounded-lg p-1 transition-colors">
                                <button 
                                    onClick={() => setPageNum(p => Math.max(1, p - 1))}
                                    disabled={pageNum <= 1}
                                    className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded-md disabled:opacity-30 transition shadow-sm disabled:shadow-none text-slate-600 dark:text-slate-300"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-sm font-medium px-2 min-w-[80px] text-center text-slate-700 dark:text-slate-200">
                                    Hal {pageNum} / {totalPages}
                                </span>
                                <button 
                                    onClick={() => setPageNum(p => Math.min(totalPages, p + 1))}
                                    disabled={pageNum >= totalPages}
                                    className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded-md disabled:opacity-30 transition shadow-sm disabled:shadow-none text-slate-600 dark:text-slate-300"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                            
                            {/* Zoom Controls */}
                            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 rounded-lg p-1 transition-colors">
                                <button 
                                    onClick={handleZoomOut}
                                    className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded-md transition shadow-sm text-slate-600 dark:text-slate-300"
                                    title="Zoom Out"
                                >
                                    <ZoomOut className="w-4 h-4" />
                                </button>
                                <span className="text-sm font-medium px-1 min-w-[50px] text-center text-slate-600 dark:text-slate-200">
                                    {Math.round(scale * 100)}%
                                </span>
                                <button 
                                    onClick={handleZoomIn}
                                    className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded-md transition shadow-sm text-slate-600 dark:text-slate-300"
                                    title="Zoom In"
                                >
                                    <ZoomIn className="w-4 h-4" />
                                </button>
                            </div>
                        </div>


                        <div className="flex gap-2 items-center">
                            <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg mr-2 transition-colors">
                            <button 
                                onClick={undo}
                                disabled={history.past.length === 0}
                                title="Undo (Ctrl+Z)"
                                className="p-2 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 rounded shadow-sm disabled:opacity-30 disabled:shadow-none disabled:bg-transparent transition"
                            >
                                <Undo className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={redo}
                                disabled={history.future.length === 0}
                                title="Redo (Ctrl+Y)"
                                className="p-2 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 rounded shadow-sm disabled:opacity-30 disabled:shadow-none disabled:bg-transparent transition"
                            >
                                <Redo className="w-4 h-4" />
                            </button>
                            </div>
                            
                            <Button 
                                variant={isFreeDrawMode ? 'primary' : 'secondary'} 
                                onClick={handleToggleFreeDraw}
                                title="Mode Gambar Bebas"
                            >
                                {isFreeDrawMode ? (
                                    <>
                                        <Check className="w-4 h-4 mr-2" /> Selesai
                                    </>
                                ) : (
                                    <>
                                        <Pencil className="w-4 h-4 mr-2" /> Gambar
                                    </>
                                )}
                            </Button>

                            <Button onClick={() => setShowSigPad(true)} disabled={isFreeDrawMode}>
                                <PenTool className="w-4 h-4 mr-2" />
                                Tanda Tangan
                            </Button>
                        </div>
                    </div>

                    {/* Sub Toolbar for Free Draw */}
                    {isFreeDrawMode && (
                        <div className="flex items-center gap-4 px-2 py-1 animate-fade-in border-t border-slate-100 dark:border-slate-700 pt-3">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pengaturan Kuas:</span>
                            
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-600 dark:text-slate-300">Warna:</span>
                                <div className="flex gap-1">
                                    {['#000000', '#2563eb', '#dc2626', '#059669'].map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setBrushColor(c)}
                                            className={`w-6 h-6 rounded-full border border-slate-200 dark:border-slate-600 transition-transform ${brushColor === c ? 'scale-125 ring-2 ring-blue-300' : 'hover:scale-110'}`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </div>
                            
                            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-2"></div>

                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-600 dark:text-slate-300">Ukuran: {brushWidth}px</span>
                                <input 
                                    type="range" 
                                    min="1" 
                                    max="10" 
                                    value={brushWidth} 
                                    onChange={(e) => setBrushWidth(parseInt(e.target.value))}
                                    className="w-24 h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-slate-800 dark:accent-slate-200"
                                />
                            </div>
                            
                             <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-2"></div>
                             
                             {/* Undo/Redo for Draw Mode */}
                             <div className="flex items-center gap-1">
                                 <button 
                                    onClick={undo}
                                    disabled={history.past.length === 0}
                                    className="p-1 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 disabled:opacity-30 transition"
                                    title="Undo"
                                 >
                                     <Undo className="w-4 h-4" />
                                 </button>
                                 <button 
                                    onClick={redo}
                                    disabled={history.future.length === 0}
                                    className="p-1 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 disabled:opacity-30 transition"
                                    title="Redo"
                                 >
                                     <Redo className="w-4 h-4" />
                                 </button>
                             </div>

                             <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-2"></div>

                             <button 
                                onClick={handleClearPage}
                                className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 font-medium flex items-center gap-1 px-2 py-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                             >
                                <Trash2 className="w-3 h-3" /> Hapus Halaman Ini
                             </button>
                        </div>
                    )}
                </div>

                {/* Main Content Area: Sidebar + Canvas */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Thumbnail Sidebar */}
                    <div className="hidden md:flex flex-col w-48 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 overflow-y-auto p-4 gap-4 shrink-0 transition-colors">
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                            <Layout className="w-3 h-3" />
                            Halaman
                        </div>
                        {isGeneratingThumbnails && thumbnails.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500 gap-2">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                                <span className="text-xs">Memuat Pratinjau...</span>
                            </div>
                        ) : (
                            thumbnails.map((thumb, index) => (
                                <div 
                                    key={index}
                                    onClick={() => setPageNum(index + 1)}
                                    className={`group relative cursor-pointer flex flex-col items-center gap-2 transition-all duration-200 ${pageNum === index + 1 ? 'scale-105' : 'hover:scale-102'}`}
                                >
                                    <div className={`relative rounded shadow-sm overflow-hidden border-2 transition-colors ${pageNum === index + 1 ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900' : 'border-transparent group-hover:border-slate-300 dark:group-hover:border-slate-600'}`}>
                                        <img src={thumb} alt={`Page ${index + 1}`} className="w-full h-auto object-contain bg-slate-50 dark:bg-slate-900" />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 dark:group-hover:bg-white/5 transition-colors"></div>
                                    </div>
                                    <span className={`text-xs font-medium ${pageNum === index + 1 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                        {index + 1}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>

                    {/* PDF Canvas Area */}
                    <div className="flex-1 relative bg-slate-200/50 dark:bg-slate-900 overflow-auto flex justify-center p-4 sm:p-8 transition-colors">
                        <div 
                            ref={canvasContainerRef}
                            className="relative shadow-2xl h-fit my-auto"
                        >
                            <canvas ref={canvasRef} className="block rounded-sm bg-white" />
                            
                            {/* Free Draw Overlay */}
                            {viewportDims && (
                                <FreeDrawLayer 
                                    width={viewportDims.width}
                                    height={viewportDims.height}
                                    scale={scale}
                                    strokes={drawings[pageNum - 1] || []}
                                    isDrawingMode={isFreeDrawMode}
                                    brushColor={brushColor}
                                    brushWidth={brushWidth}
                                    onAddStroke={handleAddStroke}
                                />
                            )}

                            {/* Snap Lines */}
                            {snapLines.map((line, i) => (
                                <div
                                    key={i}
                                    className={`absolute z-40 border-dashed border-cyan-500 pointer-events-none ${
                                        line.orientation === 'vertical' ? 'border-l-2' : 'border-t-2'
                                    }`}
                                    style={{
                                        left: line.orientation === 'vertical' ? `${line.position}%` : '0',
                                        top: line.orientation === 'horizontal' ? `${line.position}%` : '0',
                                        width: line.orientation === 'vertical' ? '1px' : '100%',
                                        height: line.orientation === 'horizontal' ? '1px' : '100%',
                                    }}
                                />
                            ))}

                            {signatures.filter(s => s.pageIndex === pageNum - 1).map((sig) => (
                                <div
                                    key={sig.id}
                                    onMouseDown={(e) => handleDragStart(e, sig.id)}
                                    onTouchStart={(e) => handleDragStart(e, sig.id)}
                                    onClick={(e) => { 
                                        if(!isFreeDrawMode) {
                                            e.stopPropagation(); 
                                            setSelectedSigId(sig.id); 
                                        }
                                    }}
                                    onDoubleClick={(e) => handleDoubleClick(e, sig.id)}
                                    className={`absolute group select-none ${selectedSigId === sig.id ? 'z-20' : 'z-0'} ${isFreeDrawMode ? 'pointer-events-none' : ''}`}
                                    style={{
                                        left: `${sig.x}%`,
                                        top: `${sig.y}%`,
                                        width: `${sig.width}%`,
                                        aspectRatio: sig.aspectRatio,
                                        transform: `rotate(${sig.rotation}deg)`,
                                        cursor: resizeMode.isResizing ? 'grabbing' : 'move',
                                        touchAction: 'none'
                                    }}
                                >
                                    {/* Selection Border */}
                                    <div 
                                        className={`w-full h-full ${selectedSigId === sig.id && !isFreeDrawMode ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                                        style={{ opacity: sig.opacity ?? 1 }}
                                    >
                                        <img 
                                            src={sig.dataUrl} 
                                            alt="signature" 
                                            className="w-full h-full object-contain pointer-events-none" 
                                        />
                                    </div>
                                    
                                    {selectedSigId === sig.id && !isFreeDrawMode && (
                                        <>
                                            {/* Rotation Handle */}
                                            <div 
                                                className="absolute -top-8 left-1/2 -translate-x-1/2 w-6 h-6 bg-white rounded-full shadow-md border border-slate-200 flex items-center justify-center cursor-alias hover:text-blue-600 text-slate-500 z-50"
                                                onMouseDown={(e) => handleRotateStart(e, sig)}
                                                onTouchStart={(e) => handleRotateStart(e, sig)}
                                            >
                                                <RotateCw className="w-3.5 h-3.5" />
                                            </div>

                                            {/* Resize Handles */}
                                            <div 
                                                className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-blue-600 border border-white rounded-full cursor-nw-resize z-20"
                                                onMouseDown={(e) => handleResizeStart(e, sig, 'nw')}
                                                onTouchStart={(e) => handleResizeStart(e, sig, 'nw')}
                                            />
                                            <div 
                                                className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-blue-600 border border-white rounded-full cursor-ne-resize z-20"
                                                onMouseDown={(e) => handleResizeStart(e, sig, 'ne')}
                                                onTouchStart={(e) => handleResizeStart(e, sig, 'ne')}
                                            />
                                            <div 
                                                className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-blue-600 border border-white rounded-full cursor-sw-resize z-20"
                                                onMouseDown={(e) => handleResizeStart(e, sig, 'sw')}
                                                onTouchStart={(e) => handleResizeStart(e, sig, 'sw')}
                                            />
                                            <div 
                                                className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-blue-600 border border-white rounded-full cursor-se-resize z-20"
                                                onMouseDown={(e) => handleResizeStart(e, sig, 'se')}
                                                onTouchStart={(e) => handleResizeStart(e, sig, 'se')}
                                            />

                                            {/* Toolbar */}
                                            <div 
                                                className="absolute -bottom-14 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white dark:bg-slate-800 shadow-lg rounded-lg p-1 border border-slate-100 dark:border-slate-700 z-30 min-w-max"
                                                style={{ cursor: 'default' }}
                                                onMouseDown={e => e.stopPropagation()}
                                            >
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setAspectRatioLocked(!aspectRatioLocked); }}
                                                    className={`p-1.5 rounded-md transition ${aspectRatioLocked ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                                    title={aspectRatioLocked ? "Rasio Terkunci" : "Rasio Tidak Terkunci"}
                                                >
                                                    {aspectRatioLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                                </button>
                                                <div className="w-px bg-slate-200 dark:bg-slate-700 mx-0.5 h-4"></div>
                                                <button
                                                    onClick={(e) => handleDuplicateSignature(e, sig.id)}
                                                    className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-md transition"
                                                    title="Duplikat"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                                <div className="w-px bg-slate-200 dark:bg-slate-700 mx-0.5 h-4"></div>
                                                <div className="flex items-center px-1 text-xs text-slate-400 dark:text-slate-500 select-none">
                                                    <Move className="w-3 h-3 mr-1" />
                                                    Geser
                                                </div>
                                                <div className="w-px bg-slate-200 dark:bg-slate-700 mx-0.5 h-4"></div>
                                                <button 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        setDeleteConfirm({ isOpen: true, sigId: sig.id }); 
                                                    }}
                                                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition"
                                                    title="Hapus"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Download Confirmation Modal */}
        {downloadConfirmOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6 transform scale-100 transition-all border border-slate-200 dark:border-slate-700">
                    <div className="text-center">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
                            <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Konfirmasi Unduhan</h3>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            Apakah Anda yakin ingin menyimpan dokumen ini?
                        </p>
                        
                        <div className="mt-6 mb-2">
                           <blockquote className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border-l-4 border-blue-500 italic text-slate-700 dark:text-slate-300 text-sm leading-relaxed relative">
                               <span className="text-2xl text-blue-300 absolute -top-2 left-2">"</span>
                               Barangsiapa yang memudahkan urusan saudaranya, Allah akan memudahkan urusannya di dunia dan akhirat.
                               <span className="text-2xl text-blue-300 absolute -bottom-4 right-2">"</span>
                               <footer className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400 not-italic text-right">
                                  — (HR. Muslim)
                               </footer>
                           </blockquote>
                        </div>
                    </div>
                    <div className="mt-6 flex gap-3">
                        <Button 
                            variant="secondary" 
                            className="flex-1 justify-center"
                            onClick={() => setDownloadConfirmOpen(false)}
                        >
                            Batal
                        </Button>
                        <Button 
                            className="flex-1 justify-center"
                            onClick={handleDownload}
                        >
                            Unduh Sekarang
                        </Button>
                    </div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}
