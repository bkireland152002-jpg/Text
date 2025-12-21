import { pdfjs } from 'react-pdf';

// Ensure worker is loaded (standard React-PDF setup)
if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

export interface TextChunk {
    pageIndex: number;
    chunkId: string;
    text: string;
}

export interface PageTextItem {
    str: string;
    // Normalized Viewport Coordinates (0..1)
    x: number;
    y: number;
    w: number;
    h: number;
    // Character index range in the full page text string
    startIndex: number;
    endIndex: number;
}

export interface PageTextIndex {
    pageIndex: number;
    fullText: string;
    items: PageTextItem[];
}

export interface ExtractionResult {
    chunks: TextChunk[];
    textIndex: Record<number, PageTextIndex>;
}

/**
 * Extracts text content from a PDF file client-side with progress and cancellation.
 * Returns chunks for analysis AND a geometric text index for highlighting.
 */
export async function extractTextFromPDF(
    file: File,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal
): Promise<ExtractionResult> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    const chunks: TextChunk[] = [];
    const textIndex: Record<number, PageTextIndex> = {};

    let totalWordCount = 0;

    for (let i = 1; i <= numPages; i++) {
        if (signal?.aborted) throw new Error('Extraction aborted');

        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // Use default scale 1.0. The geometry will be normalized (0..1) so scale doesn't matter much as long as it's consistent.
        const viewport = page.getViewport({ scale: 1.0 });

        // Build Index for this page
        let fullPageText = '';
        const indexItems: PageTextItem[] = [];

        // Sort items roughly by Y then X to ensure natural reading order for index
        // Note: transform[5] is Y (bottom-up in PDF).
        // Larger Y = Top of page.
        const items = (textContent.items as any[]).sort((a, b) => {
            const y1 = a.transform[5];
            const y2 = b.transform[5];
            const dy = Math.abs(y1 - y2);
            if (dy > (a.height || 10)) {
                return y2 - y1; // Descending Y (Top to Bottom)
            }
            return a.transform[4] - b.transform[4]; // Ascending X (Left to Right)
        });

        for (const item of items) {
            if (!('str' in item)) continue;

            const tx = item.transform;
            // tx = [scaleX, skewY, skewX, scaleY, x, y]
            // PDF Coordinates: (x, y) is insertion point (baseline origin).

            const x = tx[4];
            const y = tx[5];
            const w = item.width || 0;
            const h = item.height || Math.abs(tx[3]); // Fallback to Y-scale (font size approx)

            // Construct 4 corners in PDF space
            // Assuming horizontal text flow for simplicity, but simple rect logic usually suffices.
            // PDF Box: [x, y, x+w, y+h] (BL to TR in PDF space)
            // But wait, Y is baseline. Top is y + h. Bottom is y.
            // actually, for most fonts, (x,y) is baseline. Descent goes below y. Ascent goes to y+h.
            // Let's approximate the visual box as [x, y, x+w, y+h] (ignoring descent for highlighting)

            // Project corners to Viewport (Pixel) space
            // viewport.convertToViewportPoint([x, y]) returns [vx, vy] (Top-Left origin system)

            // We use convertToViewportRectangle for the whole box if available, but manual corners is safer across versions.

            const p1 = viewport.convertToViewportPoint(x, y); // BL (in PDF) -> mapped
            const p2 = viewport.convertToViewportPoint(x + w, y + h); // TR (in PDF) -> mapped
            const p3 = viewport.convertToViewportPoint(x, y + h); // TL (in PDF) -> mapped
            const p4 = viewport.convertToViewportPoint(x + w, y); // BR (in PDF) -> mapped

            // Find bounding box of these projected points
            const xs = [p1[0], p2[0], p3[0], p4[0]];
            const ys = [p1[1], p2[1], p3[1], p4[1]];

            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            // Normalize to 0..1
            const normX = minX / viewport.width;
            const normY = minY / viewport.height;
            const normW = (maxX - minX) / viewport.width;
            const normH = (maxY - minY) / viewport.height;

            const strClean = item.str;
            const startIdx = fullPageText.length;
            fullPageText += strClean;
            const endIdx = fullPageText.length;

            indexItems.push({
                str: strClean,
                x: normX,
                y: normY,
                w: normW,
                h: normH,
                startIndex: startIdx,
                endIndex: endIdx
            });

            fullPageText += ' ';
        }

        // --- Chunking Logic (Simplified) ---
        // We reuse the sorted items for chunking to ensure consistency
        let pageTextForAI = '';
        let lastY_AI = -99999;
        let lastX_AI = -99999;

        // Re-loop for layout-aware text (needs newlines)
        for (const item of items) {
            if (!('str' in item)) continue;
            const x = item.transform[4];
            const y = item.transform[5];
            const str = item.str;

            // Heuristic for newlines/spaces based on PDF raw coordinates
            if (lastY_AI !== -99999 && Math.abs(y - lastY_AI) > 8) {
                pageTextForAI += '\n';
                if (Math.abs(y - lastY_AI) > 20) pageTextForAI += '\n';
            } else if (lastX_AI !== -99999 && x - lastX_AI > 10) {
                pageTextForAI += ' ';
            }
            pageTextForAI += str;
            lastY_AI = y;
            lastX_AI = x + item.width;
        }

        pageTextForAI = pageTextForAI.replace(/\s+/g, ' ').trim();
        totalWordCount += pageTextForAI.split(/\s+/).length;

        // Chunking
        const sentences = pageTextForAI.match(/[^.!?]+[.!?]+(\s|$)/g) || [pageTextForAI];
        let currentChunk = '';
        let localChunkId = 0;
        const flushChunk = () => {
            if (currentChunk.trim().length > 50) {
                chunks.push({
                    pageIndex: i - 1,
                    chunkId: `p${i}-c${localChunkId++}`,
                    text: currentChunk.trim(),
                });
            }
            currentChunk = '';
        };

        for (const s of sentences) {
            if (currentChunk.length + s.length > 800 && currentChunk.length > 100) flushChunk();
            currentChunk += s;
        }
        flushChunk();

        // Save Index
        textIndex[i - 1] = {
            pageIndex: i - 1,
            fullText: fullPageText.toLowerCase(),
            items: indexItems
        };

        if (onProgress) onProgress(Math.round((i / numPages) * 100));
    }

    if (totalWordCount < 50) throw new Error('Not enough text. Document must contain at least 50 words.');

    return { chunks, textIndex };
}

/**
 * Finds rectangles for a given excerpt on a specific page using robust character-range mapping.
 */
export function findExcerptRects(
    pageIndex: number,
    excerpt: string,
    index: Record<number, PageTextIndex>
): { x: number, y: number, w: number, h: number }[] | null {
    const pageData = index[pageIndex];
    if (!pageData) return null;

    // 1. Prepare Text for Search
    // We want to match the excerpt against the fullPageText.
    // However, fullPageText has explicit spaces. Excerpt might have different whitespace.
    // Strategy: Normalize both to single-spaces and lowercase.

    // Create a "Searchable" version of fullText that we can map back to original indices.
    // Actually, pageData.fullText is already "Item1 Item2 ...".
    // Let's assume standard normalization: replace all whitespace with single space.

    const normExcerpt = excerpt.toLowerCase().replace(/\s+/g, ' ').trim();
    const normFullText = pageData.fullText.toLowerCase().replace(/\s+/g, ' ');

    // 2. Find Match Position
    // Try exact match first
    let matchIndex = normFullText.indexOf(normExcerpt);

    // If not found, try matching just the first 50 chars (fuzzy prefix)
    if (matchIndex === -1 && normExcerpt.length > 20) {
        const prefix = normExcerpt.substring(0, Math.min(50, normExcerpt.length));
        matchIndex = normFullText.indexOf(prefix);
    }

    // If still not found, try matching the middle or unique words? 
    // Let's fallback to "first 20 chars" for now as it's the most robust anchor.
    if (matchIndex === -1 && normExcerpt.length > 20) {
        const prefix = normExcerpt.substring(0, 20);
        matchIndex = normFullText.indexOf(prefix);
    }

    if (matchIndex === -1) return null;

    // 3. Determine Map Range
    // We found the start index in normFullText.
    // Since normFullText is identical to pageData.fullText (assuming extractTextFromPDF builds it with single spaces),
    // we can use matchIndex directly against item.startIndex/endIndex.
    // NOTE: extractTextFromPDF adds ' ' after each item.
    // So "Item1 Item2" -> Item1 is 0-5, Item2 is 6-11.
    // normFullText matches this structure.

    const matchEndIndex = matchIndex + normExcerpt.length;

    // 4. Find Overlapping Items
    const matchedItems = pageData.items.filter(item => {
        // Check intersection of [item.start, item.end] and [matchIndex, matchEndIndex]
        const overlapStart = Math.max(item.startIndex, matchIndex);
        const overlapEnd = Math.min(item.endIndex, matchEndIndex);
        return overlapStart < overlapEnd;
    });

    if (matchedItems.length === 0) return null;

    // 5. Construct Rects (Line Aggregation)
    const lines: { y: number, h: number, items: PageTextItem[] }[] = [];

    matchedItems.forEach(item => {
        const existingLine = lines.find(l => Math.abs(l.y - item.y) < 0.02); // 2% tolerance for Y alignment
        if (existingLine) {
            existingLine.items.push(item);
            existingLine.h = Math.max(existingLine.h, item.h);
            existingLine.y = Math.min(existingLine.y, item.y); // Use top-most Y
        } else {
            lines.push({ y: item.y, h: item.h, items: [item] });
        }
    });

    return lines.map(line => {
        const xs = line.items.map(i => i.x);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs.map((x, i) => x + line.items[i].w));
        // Add a little padding
        return {
            x: minX - 0.005,
            y: line.y - 0.005,
            w: (maxX - minX) + 0.01,
            h: line.h + 0.01
        };
    });
}
