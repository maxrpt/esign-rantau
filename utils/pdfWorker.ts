import * as pdfjsLib from 'pdfjs-dist';

// Use a specific version compatible with the library to avoid version mismatch errors
// In a real prod build, this would be a local file, but for this SPA setup, we use Unpkg.
export const setupPdfWorker = () => {
  // When using the ESM import of pdfjs-dist, the worker must also be loaded as a module.
  // We point to the .mjs version on unpkg to prevent "Failed to fetch dynamically imported module" errors.
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;
};