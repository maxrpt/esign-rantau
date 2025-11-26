import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Check, X, Palette, Image as ImageIcon, PenTool, Upload, Type, Wand2 } from 'lucide-react';
import { Button } from './Button';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  isEditing?: boolean;
  initialDataUrl?: string;
}

const COLORS = [
  { name: 'Hitam', value: '#000000', class: 'bg-black' },
  { name: 'Biru', value: '#2563eb', class: 'bg-blue-600' },
  { name: 'Merah', value: '#dc2626', class: 'bg-red-600' },
  { name: 'Hijau', value: '#059669', class: 'bg-emerald-600' },
];

const FONTS = [
  { name: 'Alex Brush', family: '"Alex Brush", cursive', class: 'font-alex' },
  { name: 'Dancing Script', family: '"Dancing Script", cursive', class: 'font-dancing' },
  { name: 'Great Vibes', family: '"Great Vibes", cursive', class: 'font-vibes' },
  { name: 'Ephesis', family: '"Ephesis", cursive', class: 'font-ephesis' },
  { name: 'Sacramento', family: '"Sacramento", cursive', class: 'font-sacramento' },
  { name: 'Parisienne', family: '"Parisienne", cursive', class: 'font-parisienne' },
  { name: 'Allura', family: '"Allura", cursive', class: 'font-allura' },
  { name: 'WindSong', family: '"WindSong", cursive', class: 'font-windsong' },
  { name: 'Herr Von Muellerhoff', family: '"Herr Von Muellerhoff", cursive', class: 'font-herr' },
];

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onCancel, isEditing = false, initialDataUrl }) => {
  const [activeTab, setActiveTab] = useState<'draw' | 'type' | 'upload'>('draw');
  
  // Drawing State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  
  // Text State
  const [textInput, setTextInput] = useState('');
  const [selectedFont, setSelectedFont] = useState(FONTS[0]);

  // Upload State
  const [uploadedImage, setUploadedImage] = useState<string | null>(initialDataUrl || null);
  const [autoRemoveBg, setAutoRemoveBg] = useState(true); // Default to true
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Canvas for Drawing & Load Initial Image
  useEffect(() => {
    // We use the same canvas ref for 'draw' and 'type' modes
    if (activeTab === 'upload') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // Set display size (css pixels)
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctxRef.current = ctx;

      // Handle Initial Load for Edit Mode (Draw mode only initially)
      if (activeTab === 'draw' && initialDataUrl && !textInput) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          if (canvasRef.current) {
            const aspect = img.width / img.height;
            const canvasAspect = rect.width / rect.height;
            let drawWidth, drawHeight, offsetX, offsetY;
            
            if (aspect > canvasAspect) {
              drawWidth = rect.width;
              drawHeight = rect.width / aspect;
              offsetX = 0;
              offsetY = (rect.height - drawHeight) / 2;
            } else {
              drawHeight = rect.height;
              drawWidth = rect.height * aspect;
              offsetX = (rect.width - drawWidth) / 2;
              offsetY = 0;
            }
            ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
            setIsEmpty(false);
          }
        };
        img.src = initialDataUrl;
      }
    }
  }, [activeTab]);

  // Handle Type Mode Rendering
  useEffect(() => {
    if (activeTab !== 'type') return;
    
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    
    if (canvas && ctx) {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      setIsEmpty(!textInput.trim());

      if (textInput.trim()) {
        ctx.fillStyle = selectedColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Dynamic font sizing
        let fontSize = 80;
        ctx.font = `${fontSize}px ${selectedFont.family}`;
        
        // Shrink if text is too wide
        let textWidth = ctx.measureText(textInput).width;
        while (textWidth > width - 40 && fontSize > 20) {
            fontSize -= 5;
            ctx.font = `${fontSize}px ${selectedFont.family}`;
            textWidth = ctx.measureText(textInput).width;
        }

        ctx.fillText(textInput, width / 2, height / 2);
      }
    }
  }, [activeTab, textInput, selectedFont, selectedColor]);

  // Update color logic (Draw mode only for existing strokes tinting is complex, usually just new strokes)
  // But we want to preserve path if we could. For simplicity, color change in Draw mode only affects NEW strokes unless we implement history.
  // However, specifically for the background fill trick in `useEffect` below:
  useEffect(() => {
    if (activeTab === 'draw') {
        const ctx = ctxRef.current;
        if (ctx) ctx.strokeStyle = selectedColor;
    }
  }, [selectedColor, activeTab]);


  // --- Drawing Handlers ---
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (activeTab !== 'draw') return;
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(e);
    ctxRef.current?.beginPath();
    ctxRef.current?.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (activeTab !== 'draw') return;
    e.preventDefault();
    if (!isDrawing) return;
    const pos = getPos(e);
    ctxRef.current?.lineTo(pos.x, pos.y);
    ctxRef.current?.stroke();
    setIsEmpty(false);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    ctxRef.current?.closePath();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (canvas && ctx) {
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      setIsEmpty(true);
      if(activeTab === 'type') setTextInput('');
    }
  };

  // --- Image Processing (Remove Background) ---
  const removeBackground = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            resolve(dataUrl);
            return;
        }
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Simple threshold to remove white background
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // If it's close to white (light gray to white)
            if (r > 240 && g > 240 && b > 240) {
                data[i + 3] = 0; // Set alpha to 0
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = dataUrl;
    });
  };


  // --- Upload Handlers ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const result = event.target?.result as string;
        // Basic normalization to PNG
        const img = new Image();
        img.onload = async () => {
           const tempCanvas = document.createElement('canvas');
           tempCanvas.width = img.width;
           tempCanvas.height = img.height;
           const ctx = tempCanvas.getContext('2d');
           if (ctx) {
             ctx.drawImage(img, 0, 0);
             let finalDataUrl = tempCanvas.toDataURL('image/png');
             
             // Auto remove bg if enabled
             if (autoRemoveBg) {
                 finalDataUrl = await removeBackground(finalDataUrl);
             }
             
             setUploadedImage(finalDataUrl);
           }
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Main Save Handler ---
  const handleSave = async () => {
    if (activeTab === 'draw' || activeTab === 'type') {
      const canvas = canvasRef.current;
      if (canvas) {
        onSave(canvas.toDataURL('image/png'));
      }
    } else {
      if (uploadedImage) {
        onSave(uploadedImage);
      }
    }
  };

  const isSaveDisabled = activeTab === 'upload' ? !uploadedImage : isEmpty;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in flex flex-col max-h-[90vh] transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900 shrink-0">
          <h3 className="font-semibold text-slate-800 dark:text-white text-lg flex items-center gap-2">
            {activeTab === 'draw' ? <PenTool className="w-5 h-5 text-blue-600" /> :
             activeTab === 'type' ? <Type className="w-5 h-5 text-blue-600" /> :
             <ImageIcon className="w-5 h-5 text-blue-600" />}
            {isEditing ? 'Edit Tanda Tangan' : 'Buat Tanda Tangan'}
          </h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-slate-100 dark:bg-slate-700 mx-6 mt-4 rounded-lg shrink-0">
            <button
                onClick={() => setActiveTab('draw')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                    activeTab === 'draw' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
            >
                <PenTool className="w-4 h-4" />
                Tulis
            </button>
            <button
                onClick={() => setActiveTab('type')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                    activeTab === 'type' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
            >
                <Type className="w-4 h-4" />
                Teks
            </button>
            <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                    activeTab === 'upload' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
            >
                <ImageIcon className="w-4 h-4" />
                Upload
            </button>
        </div>
        
        {/* Content Area */}
        <div className="flex-1 w-full p-6 bg-white dark:bg-slate-800 flex flex-col items-center gap-6 overflow-y-auto transition-colors">
          
          {/* DRAW & TYPE SHARED CANVAS */}
          {(activeTab === 'draw' || activeTab === 'type') && (
            <>
                <div className="relative w-full shrink-0">
                    <div className="absolute -top-3 left-4 bg-white dark:bg-slate-800 px-2 text-xs font-medium text-slate-400 z-10">
                    {activeTab === 'draw' ? 'Area Gambar' : 'Pratinjau Tanda Tangan'}
                    </div>
                    <div className="relative shadow-sm bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-600 w-full hover:border-blue-300 dark:hover:border-blue-500 transition-colors">
                        <canvas
                            ref={canvasRef}
                            style={{ width: '100%', height: '200px', touchAction: 'none' }}
                            className="block rounded-xl cursor-crosshair transparent-pattern" 
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                        />
                        {!isEmpty && (
                            <div className="absolute bottom-3 right-3 opacity-20 pointer-events-none">
                                <Check className="w-12 h-12 text-slate-900" />
                            </div>
                        )}
                        {activeTab === 'type' && isEmpty && (
                             <div className="absolute inset-0 flex items-center justify-center text-slate-300 pointer-events-none">
                                <span className={`${selectedFont.class} text-4xl opacity-50`}>Pratinjau Nama</span>
                             </div>
                        )}
                    </div>
                    {activeTab === 'draw' && (
                        <div className="mt-2 text-center text-xs text-slate-400">
                            Gunakan mouse atau layar sentuh untuk tanda tangan
                        </div>
                    )}
                </div>

                {/* Type Input Controls */}
                {activeTab === 'type' && (
                    <div className="w-full flex flex-col gap-4 animate-fade-in">
                        <input
                            type="text"
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            placeholder="Ketik nama Anda di sini..."
                            className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-lg"
                            autoFocus
                        />
                        
                        <div className="space-y-2">
                             <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Pilih Gaya Huruf</span>
                             <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {FONTS.map((font) => (
                                    <button
                                        key={font.name}
                                        onClick={() => setSelectedFont(font)}
                                        className={`p-2 border rounded-lg text-center transition-all hover:bg-slate-50 dark:hover:bg-slate-700 flex flex-col items-center justify-center h-16 ${
                                            selectedFont.name === font.name 
                                            ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/20' 
                                            : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50'
                                        }`}
                                    >
                                        <span className={`${font.class} text-xl leading-none text-slate-800 dark:text-slate-200`}>
                                            {textInput.substring(0, 8) || 'Signature'}
                                        </span>
                                        <span className="text-[10px] text-slate-400 mt-1 font-sans">{font.name}</span>
                                    </button>
                                ))}
                             </div>
                        </div>
                    </div>
                )}

                {/* Shared Color Picker */}
                <div className="flex flex-col items-center gap-3 w-full shrink-0">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Pilih Warna Tinta</span>
                    <div className="flex gap-4 p-2 bg-slate-50 dark:bg-slate-900 rounded-full border border-slate-100 dark:border-slate-700">
                        {COLORS.map((color) => (
                        <button
                            key={color.value}
                            onClick={() => setSelectedColor(color.value)}
                            className={`group relative w-10 h-10 rounded-full transition-transform duration-200 ${color.class} ${
                            selectedColor === color.value 
                                ? 'scale-110 shadow-lg ring-2 ring-offset-2 ring-blue-500' 
                                : 'hover:scale-110 hover:shadow-md'
                            }`}
                            title={color.name}
                        >
                            {selectedColor === color.value && (
                                <span className="absolute inset-0 flex items-center justify-center">
                                <Check className="w-5 h-5 text-white drop-shadow-sm" />
                                </span>
                            )}
                        </button>
                        ))}
                    </div>
                </div>
            </>
          )}

          {/* UPLOAD TAB UI */}
          {activeTab === 'upload' && (
            <div className="w-full flex flex-col items-center gap-4 animate-fade-in">
                <div 
                    className={`w-full h-[240px] rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex flex-col items-center justify-center cursor-pointer relative overflow-hidden group ${uploadedImage ? 'transparent-pattern' : 'bg-slate-50 dark:bg-slate-900'}`}
                    onClick={() => fileInputRef.current?.click()}
                >
                    {uploadedImage ? (
                        <>
                            <img src={uploadedImage} alt="Uploaded signature" className="w-full h-full object-contain p-4" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium">
                                Ganti Gambar
                            </div>
                        </>
                    ) : (
                        <div className="text-center p-6">
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Upload className="w-6 h-6" />
                            </div>
                            <p className="text-slate-700 dark:text-slate-200 font-medium">Klik untuk upload gambar</p>
                            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Mendukung PNG, JPG (Max 2MB)</p>
                        </div>
                    )}
                    <input 
                        ref={fileInputRef}
                        type="file" 
                        accept="image/png, image/jpeg, image/jpg"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                </div>
                
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => setAutoRemoveBg(!autoRemoveBg)}>
                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${autoRemoveBg ? 'bg-blue-600 border-blue-600' : 'border-slate-400'}`}>
                        {autoRemoveBg && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <span className="text-sm text-slate-600 dark:text-slate-300">Otomatis Hapus Latar Belakang (Transparan)</span>
                </div>

                {uploadedImage && (
                    <Button 
                        variant="ghost" 
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => {
                            setUploadedImage(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                    >
                        <Eraser className="w-4 h-4 mr-2" />
                        Hapus Gambar
                    </Button>
                )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900 shrink-0">
          {(activeTab === 'draw' || activeTab === 'type') ? (
             <Button 
                variant="ghost" 
                onClick={clear} 
                disabled={isEmpty} 
                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-30"
             >
                <Eraser className="w-4 h-4 mr-2" />
                {activeTab === 'type' ? 'Hapus Teks' : 'Bersihkan'}
            </Button>
          ) : (
             <div></div> 
          )}
         
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onCancel}>Batal</Button>
            <Button onClick={handleSave} disabled={isSaveDisabled} className="px-6">
              <Check className="w-4 h-4 mr-2" />
              {isEditing ? 'Simpan' : 'Selesai'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
