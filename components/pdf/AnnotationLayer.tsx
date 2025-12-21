'use client';

import React, { useRef, useState, useEffect } from 'react';
import { usePDFStore } from '@/store/usePDFStore';
import { motion } from 'framer-motion';
import { screenToNormalized, normalizedToPdfPoint } from '@/lib/pdf-utils';
import { Point, Annotation } from '@/types';
import { Move } from 'lucide-react';
import clsx from 'clsx';

export default function AnnotationLayer({ pageIndex, width, height }: { pageIndex: number, width: number, height: number }) {
    const getPenRect = (path: Point[]) => {
        if (!path.length) return null;
        const xs = path.map(p => p.x), ys = path.map(p => p.y);
        const x = Math.min(...xs), y = Math.min(...ys);
        return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
    };

    const hitTest = (point: Point, list: Annotation[]): string | null => {
        for (let i = list.length - 1; i >= 0; i--) {
            const ann = list[i];
            if (ann.type === 'pen' && ann.path) {
                const xs = ann.path.map(p => p.x);
                const ys = ann.path.map(p => p.y);
                const minX = Math.min(...xs), maxX = Math.max(...xs);
                const minY = Math.min(...ys), maxY = Math.max(...ys);
                if (point.x >= minX - 0.02 && point.x <= maxX + 0.02 &&
                    point.y >= minY - 0.02 && point.y <= maxY + 0.02) {
                    return ann.id;
                }
            } else if (ann.rect) {
                if (point.x >= ann.rect.x && point.x <= ann.rect.x + ann.rect.width &&
                    point.y >= ann.rect.y && point.y <= ann.rect.y + ann.rect.height) {
                    return ann.id;
                }
            }
        }
        return null;
    };

    const { selectedAnnotation, tool, annotations, addAnnotation, updateAnnotation, deleteAnnotation, setTool, pageInfo, pendingImage, setPendingImage, jumpState, activeAIHighlight } = usePDFStore();
    const pageAnnotations = annotations[pageIndex] || [];
    const svgRef = useRef<SVGSVGElement>(null);

    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPath, setCurrentPath] = useState<Point[]>([]);
    const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
    const [editText, setEditText] = useState("");
    const [originalText, setOriginalText] = useState("");
    const [editPosition, setEditPosition] = useState<Point | null>(null);
    const [selectionBounds, setSelectionBounds] = useState<{ x: number, y: number, width: number, height: number, text: string, fontSize: number, fontWeight: string } | null>(null);

    const getPoint = (e: React.PointerEvent): Point => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const rect = svgRef.current.getBoundingClientRect();
        return screenToNormalized(e.clientX - rect.left, e.clientY - rect.top, width, height);
    };

    useEffect(() => {
        const handleSelection = () => {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
                setSelectionBounds(null);
                return;
            }
            if (!svgRef.current) return;
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const svgRect = svgRef.current.getBoundingClientRect();
            if (rect.top >= svgRect.top && rect.bottom <= svgRect.bottom &&
                rect.left >= svgRect.left && rect.right <= svgRect.right) {
                let fontSize = 12;
                let fontWeight = 'normal';
                if (selection.anchorNode?.parentElement) {
                    const style = window.getComputedStyle(selection.anchorNode.parentElement);
                    fontSize = parseFloat(style.fontSize);
                    fontWeight = style.fontWeight;
                }
                setSelectionBounds({
                    x: rect.left - svgRect.left,
                    y: rect.top - svgRect.top,
                    width: rect.width,
                    height: rect.height,
                    text: selection.toString(),
                    fontWeight: fontWeight,
                    fontSize: fontSize
                });
            } else {
                setSelectionBounds(null);
            }
        };
        document.addEventListener('selectionchange', handleSelection);
        return () => document.removeEventListener('selectionchange', handleSelection);
    }, [pageIndex, width, height]);

    useEffect(() => {
        const { undo, redo } = usePDFStore.getState();
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
            if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); undo(); }
            if ((e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) || (e.key === 'y' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); redo(); }
        };
        window.addEventListener('keydown', handleGlobalKeyDown, true);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
    }, []);

    const interactionRef = useRef<{
        start: Point;
        id: string;
        mode: 'drawing' | 'dragging' | 'resizing' | 'creating_text';
        initialRect?: { x: number, y: number, width: number, height: number };
        initialFontSize?: number;
        handle?: 'nw' | 'ne' | 'sw' | 'se';
    } | null>(null);

    const handleEditSelection = () => {
        if (!selectionBounds) return;
        const normalized = screenToNormalized(selectionBounds.x, selectionBounds.y, width, height);
        const id = crypto.randomUUID();
        addAnnotation({
            id, type: 'text-edit', pageIndex, rect: { x: normalized.x, y: normalized.y, width: selectionBounds.width / width, height: selectionBounds.height / height },
            text: selectionBounds.text, color: 'black', fontSize: selectionBounds.fontSize * (600 / width), fontWeight: selectionBounds.fontWeight, opacity: 1
        });
        setSelectionBounds(null);
        window.getSelection()?.removeAllRanges();
        setEditingAnnotationId(id);
        setEditText(selectionBounds.text);
        setOriginalText(selectionBounds.text);
        setEditPosition(normalized);
    };

    const onDown = (e: React.PointerEvent) => {
        const point = getPoint(e);
        if (tool === 'select') {
            const hitId = hitTest(point, pageAnnotations);
            if (hitId) {
                usePDFStore.setState({ selectedAnnotation: hitId });
                const ann = pageAnnotations.find(a => a.id === hitId);
                if (ann && (ann.rect || (ann.type === 'pen' && ann.path))) {
                    const rect = ann.rect || getPenRect(ann.path!);
                    if (rect) {
                        interactionRef.current = { start: point, id: hitId, mode: 'dragging', initialRect: { ...rect } };
                        e.currentTarget.setPointerCapture(e.pointerId);
                        setIsDrawing(true);
                    }
                }
            } else {
                usePDFStore.setState({ selectedAnnotation: null });
            }
            return;
        }
        if (tool === 'eraser') {
            const hitId = hitTest(point, pageAnnotations);
            if (hitId) deleteAnnotation(hitId);
            return;
        }
        if (tool === 'text') {
            interactionRef.current = { start: point, id: 'temp-text', mode: 'creating_text' };
            setIsDrawing(true);
            setCurrentPath([point]);
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
        }
        const id = crypto.randomUUID();
        interactionRef.current = { start: point, id, mode: 'drawing' };
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDrawing(true);
        if (tool === 'pen') addAnnotation({ id, type: 'pen', pageIndex, path: [point], color: 'black', lineWidth: 3, opacity: 1 });
        else if (tool === 'highlight') addAnnotation({ id, type: 'highlight', pageIndex, rect: { x: point.x, y: point.y, width: 0, height: 0 }, color: 'yellow', opacity: 0.4 });
        else if (tool === 'whiteout') addAnnotation({ id, type: 'whiteout', pageIndex, rect: { x: point.x, y: point.y, width: 0, height: 0 }, color: 'white', opacity: 1 });
        else if (tool === 'image' && pendingImage) {
            const w = 150 / width, h = 150 / height;
            addAnnotation({ id, type: 'image', pageIndex, rect: { x: point.x - w / 2, y: point.y - h / 2, width: w, height: h }, image: pendingImage, color: 'none', opacity: 1 });
            setPendingImage(null);
            setTool('select');
        }
    };

    const onMove = (e: React.PointerEvent) => {
        if (!isDrawing || !interactionRef.current) return;
        const point = getPoint(e);
        const { start, id, mode, initialRect } = interactionRef.current;
        if (mode === 'dragging' && initialRect) {
            updateAnnotation(id, { rect: { ...initialRect, x: initialRect.x + (point.x - start.x), y: initialRect.y + (point.y - start.y) } });
            return;
        }
        if (mode === 'resizing' && initialRect && interactionRef.current.handle) {
            const dx = point.x - start.x, dy = point.y - start.y;
            const { x, y, width: w, height: h } = initialRect;
            const handle = interactionRef.current.handle;
            let newRect = { ...initialRect };
            if (handle === 'se') { newRect.width = Math.max(0.01, w + dx); newRect.height = Math.max(0.01, h + dy); }
            else if (handle === 'sw') { newRect.x = Math.min(x + w, x + dx); newRect.width = Math.max(0.01, w - dx); newRect.height = Math.max(0.01, h + dy); }
            else if (handle === 'ne') { newRect.y = Math.min(y + h, y + dy); newRect.width = Math.max(0.01, w + dx); newRect.height = Math.max(0.01, h - dy); }
            else if (handle === 'nw') { newRect.x = x + dx; newRect.y = y + dy; newRect.width = Math.max(0.01, w - dx); newRect.height = Math.max(0.01, h - dy); }
            const updates: Partial<Annotation> = { rect: newRect };

            if (id && pageAnnotations.find(a => a.id === id)?.type === 'pen') {
                const ann = pageAnnotations.find(a => a.id === id)!;
                if (ann.path) {
                    const scaleX = newRect.width / w, scaleY = newRect.height / h;
                    updates.path = ann.path.map(p => ({
                        x: newRect.x + (p.x - x) * scaleX,
                        y: newRect.y + (p.y - y) * scaleY
                    }));
                }
                delete updates.rect;
            }

            if (interactionRef.current.initialFontSize) updates.fontSize = interactionRef.current.initialFontSize * (newRect.height / h);
            updateAnnotation(id, updates, false);
            return;
        }
        if (tool === 'pen') updateAnnotation(id, { path: [...(usePDFStore.getState().annotations[pageIndex].find(a => a.id === id)?.path || []), point] });
        else if (tool === 'highlight' || tool === 'whiteout') {
            updateAnnotation(id, { rect: { x: Math.min(start.x, point.x), y: Math.min(start.y, point.y), width: Math.abs(start.x - point.x), height: Math.abs(start.y - point.y) } }, false);
        }
    };

    const onUp = (e: React.PointerEvent) => {
        if (interactionRef.current?.mode === 'resizing' && interactionRef.current.id) updateAnnotation(interactionRef.current.id, {}, true);
        if (interactionRef.current?.mode === 'creating_text') {
            const point = getPoint(e), start = interactionRef.current.start;
            const w = Math.abs(point.x - start.x), h = Math.abs(point.y - start.y);
            const isClick = w < 0.01 && h < 0.01;
            const id = crypto.randomUUID();
            addAnnotation({ id, type: 'text', pageIndex, rect: { x: Math.min(point.x, start.x), y: Math.min(point.y, start.y), width: isClick ? 0 : w, height: isClick ? 0 : h }, text: '', color: 'black', fontSize: 12, opacity: 1 });
            setEditingAnnotationId(id);
            setEditText("");
            setEditPosition({ x: Math.min(point.x, start.x), y: Math.min(point.y, start.y) });
        }
        setIsDrawing(false);
        interactionRef.current = null;
    };

    const GlassResizer = ({ ann, hx, hy, handle }: { ann: Annotation, hx: number, hy: number, handle: 'nw' | 'ne' | 'sw' | 'se' }) => (
        <g className="pointer-events-auto cursor-pointer group/handle"
            onPointerDown={(e) => {
                e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId);
                const rect = ann.rect || getPenRect(ann.path || []);
                if (rect) {
                    interactionRef.current = { start: getPoint(e), id: ann.id, mode: 'resizing', initialRect: { ...rect }, initialFontSize: ann.fontSize, handle };
                    setIsDrawing(true);
                }
            }}
        >
            <defs>
                <filter id="handle-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>
            {/* Expanded Hit Area (Invisible) */}
            <circle cx={hx} cy={hy} r={16} fill="transparent" />
            <circle cx={hx} cy={hy} r={8} fill="rgba(59, 130, 246, 0.2)" className="transition-all duration-300 group-hover/handle:scale-150 blur-[3px]" />
            <circle cx={hx} cy={hy} r={5} fill="white" fillOpacity={0.9} stroke="#3b82f6" strokeWidth={2} filter="url(#handle-glow)" className="transition-transform duration-300 group-hover/handle:scale-125 shadow-sm" />
            <circle cx={hx} cy={hy} r={2} fill="#3b82f6" className="pointer-events-none" />
        </g>
    );

    const layerClass = tool === 'select' ? 'pointer-events-none' : 'pointer-events-auto';

    // Helper for normalizing highlight access
    // Fix for type safety: Use any cast if legacy check is needed, or just standard access
    const highlightState = activeAIHighlight as any;
    const highlightRects: any[] = highlightState?.pageIndex === pageIndex
        ? (highlightState.rects || (highlightState.rect ? [highlightState.rect] : []))
        : [];

    return (
        <svg ref={svgRef} className={`absolute top-0 left-0 w-full h-full z-50 touch-none ${layerClass}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
            {pageAnnotations.map(ann => {
                const isSelected = selectedAnnotation === ann.id;
                const showRipple = jumpState?.id === ann.id && Date.now() - jumpState.timestamp < 1500;

                return (
                    <g key={ann.id}>
                        {ann.type === 'pen' && ann.path && (
                            <path d={ann.path.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * width} ${p.y * height}`).join(' ')} stroke={ann.color} strokeWidth={ann.lineWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-auto cursor-pointer" />
                        )}

                        {(ann.type === 'highlight' || ann.type === 'whiteout') && ann.rect && (
                            <rect x={ann.rect.x * width} y={ann.rect.y * height} width={ann.rect.width * width} height={ann.rect.height * height} fill={ann.color} fillOpacity={ann.opacity || 0.4} className={`pointer-events-auto ${isSelected ? "cursor-move" : "cursor-pointer"}`} onClick={(e) => { if (tool === 'select') { e.stopPropagation(); usePDFStore.setState({ selectedAnnotation: ann.id }); } else if (tool === 'eraser') { e.stopPropagation(); deleteAnnotation(ann.id); } }} />
                        )}

                        {(ann.type === 'text' || ann.type === 'text-edit') && ann.rect && (
                            <>
                                <rect x={(ann.rect.x * width) - (ann.padding || 0)} y={(ann.rect.y * height) - (ann.padding || 0)} width={(ann.rect.width * width) + ((ann.padding || 0) * 2)} height={(ann.rect.height * height) + ((ann.padding || 0) * 2)} rx={ann.borderRadius || 0} ry={ann.borderRadius || 0} fill="white" fillOpacity={ann.backgroundOpacity ?? 1} className={`pointer-events-auto ${isSelected ? "cursor-move" : "cursor-pointer"}`} onClick={(e) => { if (tool === 'select') { e.stopPropagation(); usePDFStore.setState({ selectedAnnotation: ann.id }); } }} />
                                <text x={ann.rect.x * width} y={ann.rect.y * height} fill={ann.color} fontSize={(ann.fontSize || 12) * (width / 600)} fontFamily="Helvetica, Arial, sans-serif" dominantBaseline="hanging" className={`pointer-events-auto ${isSelected ? "cursor-move font-bold" : "cursor-pointer"}`} onClick={(e) => { if (tool === 'select') { e.stopPropagation(); usePDFStore.setState({ selectedAnnotation: ann.id }); } else if (tool === 'eraser') { e.stopPropagation(); deleteAnnotation(ann.id); } }} onDoubleClick={(e) => { if (tool === 'select') { e.stopPropagation(); setEditingAnnotationId(ann.id); setEditText(ann.text || ""); setOriginalText(ann.text || ""); setEditPosition({ x: ann.rect!.x, y: ann.rect!.y }); } }}>{ann.text}</text>
                            </>
                        )}

                        {ann.type === 'image' && ann.rect && (
                            <image href={ann.image} x={ann.rect.x * width} y={ann.rect.y * height} width={ann.rect.width * width} height={ann.rect.height * height} className={`pointer-events-auto ${isSelected ? "cursor-move" : "cursor-pointer"}`} onClick={(e) => { if (tool === 'select') { e.stopPropagation(); usePDFStore.setState({ selectedAnnotation: ann.id }); } else if (tool === 'eraser') { e.stopPropagation(); deleteAnnotation(ann.id); } }} />
                        )}

                        {isSelected && (ann.rect || (ann.type === 'pen' && ann.path)) && (() => {
                            const rect = ann.rect || getPenRect(ann.path!);
                            if (!rect) return null;
                            return (
                                <>
                                    <rect x={rect.x * width} y={rect.y * height} width={rect.width * width} height={rect.height * height} fill="none" stroke="#2563eb" strokeWidth={2} strokeDasharray="6 4" className="pointer-events-none" />
                                    <rect x={rect.x * width - 4} y={rect.y * height - 4} width={rect.width * width + 8} height={rect.height * height + 8} fill="none" stroke="#3b82f6" strokeWidth={1} opacity={0.2} rx={4} className="pointer-events-none blur-[1px]" />
                                    {tool === 'select' && ['nw', 'ne', 'sw', 'se'].map(handle => (
                                        <GlassResizer key={handle} ann={ann} hx={(handle.includes('e') ? rect.x + rect.width : rect.x) * width} hy={(handle.includes('s') ? rect.y + rect.height : rect.y) * height} handle={handle as any} />
                                    ))}
                                </>
                            );
                        })()}

                        {showRipple && ann.rect && (
                            <rect x={ann.rect.x * width} y={ann.rect.y * height} width={ann.rect.width * width} height={ann.rect.height * height} fill="none" stroke="rgba(59, 130, 246, 0.4)" strokeWidth={40} rx={ann.borderRadius || 0} className="pointer-events-none animate-glass-ripple" style={{ transformOrigin: 'center' }} />
                        )}
                    </g>
                );
            })}

            {/* AI HIGHLIGHT LAYER */}
            {highlightRects.length > 0 && (
                <g className="pointer-events-none">
                    {highlightRects.map((rect, i) => (
                        <g key={`ai-hl-${i}`}>
                            <motion.rect
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: [0.1, 0.3, 0.1], scale: [1, 1.02, 1] }}
                                transition={{ repeat: Infinity, duration: 2, delay: i * 0.1 }}
                                x={rect.x * width - 4}
                                y={rect.y * height - 4}
                                width={rect.w * width + 8}
                                height={rect.h * height + 8}
                                fill="#facc15"
                                className="blur-[8px]"
                            />
                            <motion.rect
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: 1 }}
                                transition={{ duration: 0.5, delay: i * 0.1 }}
                                x={rect.x * width}
                                y={rect.y * height}
                                width={rect.w * width}
                                height={rect.h * height}
                                fill="none"
                                stroke="#2563eb"
                                strokeWidth={3}
                                strokeLinejoin="round"
                                rx={4}
                            />
                            <rect
                                x={rect.x * width}
                                y={rect.y * height}
                                width={rect.w * width}
                                height={rect.h * height}
                                fill="#ef4444"
                                fillOpacity={0.15}
                                className="blur-[1px]"
                                rx={4}
                            />
                            {/* Glass Ripple */}
                            <rect
                                x={rect.x * width}
                                y={rect.y * height}
                                width={rect.w * width}
                                height={rect.h * height}
                                fill="none"
                                stroke="rgba(37, 99, 235, 0.4)"
                                strokeWidth={20}
                                className="animate-glass-ripple"
                                style={{ transformOrigin: 'center', animationDelay: `${i * 100}ms` }}
                            />
                        </g>
                    ))}
                </g>
            )}

            {selectionBounds && !editingAnnotationId && (
                <foreignObject x={selectionBounds.x} y={selectionBounds.y - 40} width={100} height={30} className="z-[100] pointer-events-auto" onPointerDown={(e) => e.stopPropagation()}>
                    <button onMouseDown={(e) => { e.preventDefault(); handleEditSelection(); }} className="bg-black text-white text-xs px-2 py-1 rounded shadow hover:bg-gray-800">Edit Text</button>
                </foreignObject>
            )}

            {editingAnnotationId && (() => {
                const activeAnnotation = pageAnnotations.find(a => a.id === editingAnnotationId);
                if (!activeAnnotation || !activeAnnotation.rect) return null;
                const boxX = activeAnnotation.rect.x * width, boxY = activeAnnotation.rect.y * height;
                const boxW = Math.max(activeAnnotation.rect.width * width, 50), boxH = Math.max(activeAnnotation.rect.height * height, 20);
                const fontSize = (activeAnnotation.fontSize || 12) * (width / 600);

                return (
                    <>
                        <foreignObject x={boxX} y={boxY - 65} width={300} height={20} className="pointer-events-none z-[70] overflow-visible">
                            <div className="text-[10px] text-gray-500 bg-white/90 px-2 py-0.5 rounded shadow-sm w-fit border border-gray-200">
                                Don't worry about position, it fixes on download
                            </div>
                        </foreignObject>

                        <foreignObject x={boxX} y={boxY - 40} width={140} height={35} className="pointer-events-auto z-[70] overflow-visible" onPointerDown={(e) => e.stopPropagation()}>
                            <div className="flex gap-1 bg-white border border-gray-300 rounded shadow-sm p-1 w-fit">
                                <button className={`px-2 py-0.5 text-sm font-bold border rounded ${activeAnnotation.fontWeight === 'bold' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); updateAnnotation(activeAnnotation.id, { fontWeight: activeAnnotation.fontWeight === 'bold' ? 'normal' : 'bold' }); }}>B</button>
                                <div className="w-px bg-gray-300 mx-1" />
                                <button
                                    className="px-2 py-0.5 text-sm border rounded bg-gray-50 border-gray-200 hover:bg-gray-100 cursor-move flex items-center justify-center text-gray-700"
                                    title="Drag to move"
                                    onPointerDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        e.currentTarget.setPointerCapture(e.pointerId);
                                        const rect = activeAnnotation.rect!;
                                        interactionRef.current = {
                                            start: getPoint(e),
                                            id: activeAnnotation.id,
                                            mode: 'dragging',
                                            initialRect: { ...rect }
                                        };
                                        setIsDrawing(true);
                                    }}
                                >
                                    <Move size={14} />
                                </button>
                            </div>
                        </foreignObject>
                        <foreignObject x={boxX} y={boxY} width={boxW} height={boxH} className="pointer-events-auto z-[60]" onPointerDown={(e) => e.stopPropagation()}>
                            <textarea autoFocus className="w-full h-full bg-transparent resize-none outline-none p-0 m-0 overflow-hidden text-black placeholder-transparent" style={{ fontSize: `${fontSize}px`, lineHeight: 1.2, fontFamily: "Helvetica, Arial, sans-serif", fontWeight: activeAnnotation.fontWeight || 'normal', color: activeAnnotation.color || 'black' }} value={editText} onChange={(e) => { setEditText(e.target.value); updateAnnotation(editingAnnotationId, { text: e.target.value }, false); }} onBlur={() => { const currentId = activeAnnotation.id; if (!editText.trim()) deleteAnnotation(currentId); else updateAnnotation(currentId, {}, true); setEditingAnnotationId(null); setEditPosition(null); }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } else if (e.key === 'Escape') { setEditText(originalText); updateAnnotation(editingAnnotationId, { text: originalText }, false); setTimeout(() => { setEditingAnnotationId(null); setEditPosition(null); }, 0); } }} />
                            <div className="absolute inset-0 border border-dashed border-gray-400 pointer-events-none opacity-50" />
                        </foreignObject>
                    </>
                );
            })()}

            {isDrawing && tool === 'text' && currentPath.length > 0 && interactionRef.current?.mode === 'creating_text' && (() => {
                const start = interactionRef.current.start, end = currentPath[1] || start;
                const x = Math.min(start.x, end.x), y = Math.min(start.y, end.y), w = Math.abs(start.x - end.x), h = Math.abs(start.y - end.y);
                if (w < 0.001 && h < 0.001) return null;
                return <rect x={x * width} y={y * height} width={w * width} height={h * height} fill="none" stroke="blue" strokeDasharray="4" strokeWidth={1} className="pointer-events-none" />;
            })()}
        </svg>
    );
}
