import React, { useRef, useEffect, useState } from 'react';
import { Stroke, StrokePoint } from '../types';

interface FreeDrawLayerProps {
  width: number;
  height: number;
  scale: number;
  strokes: Stroke[];
  isDrawingMode: boolean;
  brushColor: string;
  brushWidth: number;
  onAddStroke: (stroke: Stroke) => void;
}

export const FreeDrawLayer: React.FC<FreeDrawLayerProps> = ({
  width,
  height,
  scale,
  strokes,
  isDrawingMode,
  brushColor,
  brushWidth,
  onAddStroke,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentPoints, setCurrentPoints] = useState<StrokePoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // Render strokes when they change or canvas resizes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Common settings
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Draw existing saved strokes
    strokes.forEach(stroke => {
      if (stroke.points.length < 2) return;
      
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width * scale; // Scale thickness

      const first = stroke.points[0];
      ctx.moveTo(first.x * width, first.y * height);

      for (let i = 1; i < stroke.points.length; i++) {
        const p = stroke.points[i];
        ctx.lineTo(p.x * width, p.y * height);
      }
      ctx.stroke();
    });

    // 2. Draw current active stroke
    if (currentPoints.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushWidth * scale;

      const first = currentPoints[0];
      ctx.moveTo(first.x * width, first.y * height);

      for (let i = 1; i < currentPoints.length; i++) {
        const p = currentPoints[i];
        ctx.lineTo(p.x * width, p.y * height);
      }
      ctx.stroke();
    }
  }, [width, height, scale, strokes, currentPoints, brushColor, brushWidth]);

  const getNormalizedPos = (e: React.MouseEvent | React.TouchEvent): StrokePoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingMode) return;
    // Prevent default to stop scrolling on mobile while drawing
    if ('touches' in e) {
        // e.preventDefault(); // Sometimes needed, but can block UI interactions
    }
    
    setIsDrawing(true);
    setCurrentPoints([getNormalizedPos(e)]);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingMode || !isDrawing) return;
    e.preventDefault(); // Stop scrolling when drawing
    setCurrentPoints(prev => [...prev, getNormalizedPos(e)]);
  };

  const handleEnd = () => {
    if (!isDrawingMode || !isDrawing) return;
    setIsDrawing(false);

    if (currentPoints.length > 1) {
      onAddStroke({
        points: currentPoints,
        color: brushColor,
        width: brushWidth
      });
    }
    setCurrentPoints([]);
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`absolute inset-0 z-10 ${isDrawingMode ? 'cursor-crosshair' : 'pointer-events-none'}`}
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      style={{
        width: '100%',
        height: '100%',
        touchAction: isDrawingMode ? 'none' : 'auto'
      }}
    />
  );
};