export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface SignatureElement {
  id: string;
  dataUrl: string; // Base64 PNG
  pageIndex: number;
  x: number; // Percentage relative to container width (0-100)
  y: number; // Percentage relative to container height (0-100)
  width: number; // Percentage (0-100)
  aspectRatio: number; // width / height
  rotation: number; // Degrees (0-360)
  opacity: number; // 0 to 1
}

export interface StrokePoint {
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
}

export interface Stroke {
  points: StrokePoint[];
  color: string;
  width: number; // Line thickness
}

export type PageDrawings = Record<number, Stroke[]>;

export interface PDFDimensions {
  width: number;
  height: number;
}