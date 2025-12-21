import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { Annotation } from '@/types';
import { normalizedToPdfRect } from './pdf-utils';

export async function exportPDF(file: File, annotations: Record<number, Annotation[]>) {
    try {
        const fileBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(fileBuffer);
        const pages = pdfDoc.getPages();

        // Embed Fonts
        const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const pageAnnotations = annotations[i] || [];
            const { width: pageWidth, height: pageHeight } = page.getSize();

            for (const ann of pageAnnotations) {
                // Determine Font
                const font = ann.fontWeight === 'bold' ? helveticaBold : helvetica;

                if (ann.type === 'pen' && ann.path && ann.path.length > 1) {
                    const { r, g, b } = hexToRgb(ann.color);
                    const color = rgb(r, g, b);

                    for (let j = 0; j < ann.path.length - 1; j++) {
                        const p1 = ann.path[j];
                        const p2 = ann.path[j + 1];
                        page.drawLine({
                            start: { x: p1.x * pageWidth, y: (1 - p1.y) * pageHeight },
                            end: { x: p2.x * pageWidth, y: (1 - p2.y) * pageHeight },
                            thickness: ann.lineWidth || 2,
                            color: color,
                            opacity: ann.opacity
                        });
                    }

                } else if ((ann.type === 'text' || ann.type === 'text-edit') && ann.rect && ann.text) {
                    const { r, g, b } = hexToRgb(ann.color);
                    const padding = ann.padding || 0;

                    // Convert normalized rect to PDF points
                    const pdfRect = normalizedToPdfRect(ann.rect, pageWidth, pageHeight);

                    // 1. Draw Background Rect (with padding and opacity)
                    page.drawRectangle({
                        x: pdfRect.x - padding,
                        y: pdfRect.y - padding,
                        width: pdfRect.width + (padding * 2),
                        height: pdfRect.height + (padding * 2),
                        color: rgb(1, 1, 1),
                        opacity: ann.backgroundOpacity ?? 1
                    });

                    // 2. Draw Text
                    // Note: text Y in pdf-lib is the baseline, but we render 'hanging' in DOM.
                    // We need to shift down by approx (height) to match DOM 'hanging' baseline.
                    const scaledFontSize = (ann.fontSize || 12) * (pageWidth / 600);
                    // Anchor to top-left of the rect, adjusting for baseline
                    // DOM 'hanging' baseline is at the top. PDF drawText Y is the baseline.
                    // We descend from top (y + height) by approx 0.8 of fontSize to hit baseline.
                    page.drawText(ann.text, {
                        x: pdfRect.x,
                        y: pdfRect.y + pdfRect.height - (scaledFontSize * 0.75),
                        size: scaledFontSize,
                        font: font,
                        color: rgb(r, g, b),
                        lineHeight: scaledFontSize * 1.2
                    });

                } else if ((ann.type === 'highlight' || ann.type === 'whiteout') && ann.rect) {
                    const { r, g, b } = hexToRgb(ann.color);
                    const pdfRect = normalizedToPdfRect(ann.rect, pageWidth, pageHeight);

                    page.drawRectangle({
                        x: pdfRect.x,
                        y: pdfRect.y,
                        width: pdfRect.width,
                        height: pdfRect.height,
                        color: rgb(r, g, b),
                        opacity: ann.opacity || (ann.type === 'highlight' ? 0.4 : 1)
                    });

                } else if (ann.type === 'image' && ann.image && ann.rect) {
                    try {
                        let imageEmbed;
                        if (ann.image.startsWith('data:image/png')) {
                            imageEmbed = await pdfDoc.embedPng(ann.image);
                        } else {
                            imageEmbed = await pdfDoc.embedJpg(ann.image);
                        }

                        const pdfRect = normalizedToPdfRect(ann.rect, pageWidth, pageHeight);

                        page.drawImage(imageEmbed, {
                            x: pdfRect.x,
                            y: pdfRect.y,
                            width: pdfRect.width,
                            height: pdfRect.height,
                            opacity: ann.opacity || 1,
                            rotate: degrees(ann.rotation || 0)
                        });
                    } catch (err) {
                        console.error("Failed to embed image", err);
                    }
                }
            }
        }

        const pdfBytes = await pdfDoc.save();
        downloadBlob(pdfBytes, "edited.pdf", "application/pdf");

    } catch (e) {
        console.error("Export Failed", e);
        alert("Failed to export PDF");
    }
}

function hexToRgb(hex: string) {
    let validHex = hex.replace('#', '');
    if (validHex.length === 3) {
        validHex = validHex.split('').map(c => c + c).join('');
    }
    const r = parseInt(validHex.substring(0, 2), 16) / 255;
    const g = parseInt(validHex.substring(2, 4), 16) / 255;
    const b = parseInt(validHex.substring(4, 6), 16) / 255;
    if (isNaN(r) || isNaN(g) || isNaN(b)) return { r: 0, g: 0, b: 0 };
    return { r, g, b };
}

function downloadBlob(data: Uint8Array, filename: string, mimeType: string) {
    const blob = new Blob([data as any], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
