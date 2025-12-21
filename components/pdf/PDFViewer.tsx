'use client';

import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { usePDFStore } from '@/store/usePDFStore';
import AnnotationLayer from './AnnotationLayer';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

import { GlassButton, GlassPanel } from '@/components/ui/Glass';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

export default function PDFViewer() {
    const { file, scale, setScale, setNumPages } = usePDFStore();
    const [error, setError] = useState<Error | null>(null);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        setError(null);
    }

    function onDocumentLoadError(err: Error) {
        console.error("PDF Load Error:", err);
        setError(err);
    }

    return (
        <div className="h-full overflow-auto bg-[#f8fafc] p-8 flex justify-center relative custom-scrollbar">
            {/* Floating Zoom Controls */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[50]">
                <GlassPanel className="flex items-center gap-1 p-1.5 rounded-2xl shadow-2xl border-white/40">
                    <GlassButton
                        onClick={() => setScale(Math.max(0.5, scale - 0.1))}
                        className="!p-2"
                        title="Zoom Out"
                    >
                        <ZoomOut size={18} />
                    </GlassButton>

                    <div className="px-3 min-w-[60px] text-center">
                        <span className="text-[11px] font-black text-gray-900 tracking-tighter">
                            {Math.round(scale * 100)}%
                        </span>
                    </div>

                    <GlassButton
                        onClick={() => setScale(Math.min(3, scale + 0.1))}
                        className="!p-2"
                        title="Zoom In"
                    >
                        <ZoomIn size={18} />
                    </GlassButton>

                    <div className="w-px h-6 bg-black/5 mx-1" />

                    <GlassButton
                        onClick={() => setScale(1)}
                        className="!p-2 text-blue-600 hover:!text-blue-700"
                        title="Reset Zoom"
                    >
                        <Maximize size={18} />
                    </GlassButton>
                </GlassPanel>
            </div>

            {error ? (
                <div className="text-red-500 bg-white p-4 rounded shadow">
                    Failed to load PDF: {error.message}
                </div>
            ) : (
                <Document
                    file={file}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={<div className="text-gray-500">Loading PDF...</div>}
                    className="flex flex-col gap-8"
                >
                    {Array.from(new Array(usePDFStore.getState().numPages), (el, index) => (
                        <PDFPageWrapper key={`page_${index + 1}`} pageIndex={index} />
                    ))}
                </Document>
            )}
        </div>
    );
}

function PDFPageWrapper({ pageIndex }: { pageIndex: number }) {
    const { scale, setPageInfo } = usePDFStore();
    const [size, setSize] = useState({ width: 0, height: 0 });

    return (
        <div id={`page_${pageIndex + 1}`} className="relative shadow-lg border border-gray-200 bg-white">
            <Page
                pageNumber={pageIndex + 1}
                scale={scale}
                onLoadSuccess={(page) => {
                    setPageInfo(pageIndex, { index: pageIndex, width: page.originalWidth, height: page.originalHeight });
                    setSize({ width: page.width, height: page.height });
                }}
                renderAnnotationLayer={false} // We implement our own or custom
                renderTextLayer={true} // Enabled for text selection
            />
            {size.width > 0 && (
                <AnnotationLayer
                    pageIndex={pageIndex}
                    width={size.width}
                    height={size.height}
                />
            )}
        </div>
    );
}
