import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Droplet, PenTool, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface SignatureStylingProps {
  initialDataUrl: string;
  initialOpacity: number;
  onSave: (dataUrl: string, opacity: number) => void;
  onCancel: () => void;
  onRedraw: () => void;
}

const COLORS = [
  { name: 'Asli', value: 'original', class: 'bg-white border-slate-200' },
  { name: 'Hitam', value: '#000000', class: 'bg-black' },
  { name: 'Biru', value: '#2563eb', class: 'bg-blue-600' },
  { name: 'Merah', value: '#dc2626', class: 'bg-red-600' },
  { name: 'Hijau', value: '#059669', class: 'bg-emerald-600' },
];

export const SignatureStyling: React.FC<SignatureStylingProps> = ({
  initialDataUrl,
  initialOpacity,
  onSave,
  onCancel,
  onRedraw,
}) => {
  const [opacity, setOpacity] = useState(initialOpacity);
  const [selectedColor, setSelectedColor] = useState('original');
  const [previewUrl, setPreviewUrl] = useState(initialDataUrl);
  
  // Keep track of the original image to always recolor from base
  const originalImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = initialDataUrl;
    img.onload = () => {
      originalImageRef.current = img;
    };
  }, [initialDataUrl]);

  // Handle Recoloring
  useEffect(() => {
    if (selectedColor === 'original') {
      setPreviewUrl(initialDataUrl);
      return;
    }

    if (!originalImageRef.current) return;

    const img = originalImageRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Draw original
      ctx.drawImage(img, 0, 0);
      
      // Use composite operation to tint non-transparent pixels
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = selectedColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      setPreviewUrl(canvas.toDataURL('image/png'));
    }
  }, [selectedColor, initialDataUrl]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
            <Droplet className="w-5 h-5 text-blue-600" />
            Edit Tampilan
          </h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-100 rounded-full">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Preview */}
          <div className="bg-slate-100 rounded-lg p-4 border border-slate-200 flex items-center justify-center min-h-[160px] bg-[url('https://www.transparenttextures.com/patterns/grid-noise.png')]">
            <img 
              src={previewUrl} 
              alt="Signature Preview" 
              className="max-w-full max-h-[120px] object-contain transition-all duration-200"
              style={{ opacity: opacity }}
            />
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Opacity Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium text-slate-700">
                <span>Transparansi</span>
                <span>{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Color Picker */}
            <div className="space-y-2">
              <span className="text-sm font-medium text-slate-700 block">Warna Tinta</span>
              <div className="flex gap-3 justify-between sm:justify-start">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setSelectedColor(color.value)}
                    className={`group relative w-10 h-10 rounded-full border border-slate-200 transition-transform duration-200 ${color.class} ${
                      selectedColor === color.value 
                        ? 'scale-110 shadow-lg ring-2 ring-offset-2 ring-blue-500' 
                        : 'hover:scale-110 hover:shadow-md'
                    }`}
                    title={color.name}
                  >
                    {selectedColor === color.value && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <Check className={`w-5 h-5 drop-shadow-sm ${color.value === 'original' || color.value === '#ffffff' ? 'text-slate-900' : 'text-white'}`} />
                        </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="pt-2">
               <Button variant="secondary" onClick={onRedraw} className="w-full text-slate-600">
                 <RefreshCw className="w-4 h-4 mr-2" />
                 Gambar Ulang / Ganti
               </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <Button variant="secondary" onClick={onCancel}>Batal</Button>
          <Button onClick={() => onSave(previewUrl, opacity)} className="px-6">
            <Check className="w-4 h-4 mr-2" />
            Simpan
          </Button>
        </div>
      </div>
    </div>
  );
};
