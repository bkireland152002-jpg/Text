import { Point } from '@/types';

// Convert screen/event coordinates to normalized (0..1) page coordinates
export const screenToNormalized = (
    screenX: number,
    screenY: number,
    pageWidth: number,
    pageHeight: number
): Point => {
    return {
        x: Math.min(Math.max(screenX / pageWidth, 0), 1),
        y: Math.min(Math.max(screenY / pageHeight, 0), 1),
    };
};

// Convert normalized coordinates to PDF coordinates (points)
// PDF origin is bottom-left, DOM is top-left
export const normalizedToPdfPoint = (
    point: Point,
    pdfPageWidth: number,
    pdfPageHeight: number
) => {
    return {
        x: point.x * pdfPageWidth,
        y: (1 - point.y) * pdfPageHeight, // Flip Y for PDF (this is for points)
    };
};

/**
 * Returns PDF coordinates for a rectangle.
 * PDF origin (0,0) is bottom-left. 
 *DOM origin is top-left.
 */
export const normalizedToPdfRect = (
    rect: { x: number; y: number; width: number; height: number },
    pdfPageWidth: number,
    pdfPageHeight: number
) => {
    return {
        x: rect.x * pdfPageWidth,
        y: (1 - rect.y - rect.height) * pdfPageHeight, // Correct Y flip for rect origin
        width: rect.width * pdfPageWidth,
        height: rect.height * pdfPageHeight,
    };
};
