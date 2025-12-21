'use client';

import React from 'react';
import { usePDFStore } from '@/store/usePDFStore';
import { MousePointer2, Pen, Type, Highlighter, Download, Eraser, Square, Image as ImageIcon, HelpCircle, CheckCircle2, Sparkles as SparklesIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel, GlassButton } from './ui/Glass';
import { exportPDF } from '@/lib/pdf-export';
import clsx from 'clsx';

export default function Toolbar({ onShowHelp }: { onShowHelp: () => void }) {
    const { tool, setTool, scale, setScale, file, annotations, selectedAnnotation, deleteAnnotation, history, aiCheckResults, updateAiCheckStatus, setActiveAIHighlight, setSidebarTab } = usePDFStore();
    const [isSaved, setIsSaved] = React.useState(false);

    // Subtle feedback when state is persisted
    React.useEffect(() => {
        if (history.length > 0) {
            setIsSaved(true);
            const timer = setTimeout(() => setIsSaved(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [annotations, history]);

    const tools = [
        { id: 'select', icon: MousePointer2, label: 'Select' },
        { id: 'pen', icon: Pen, label: 'Pen' },
        { id: 'text', icon: Type, label: 'Text' },
        { id: 'highlight', icon: Highlighter, label: 'Highlight' },
        { id: 'whiteout', icon: Square, label: 'Whiteout' },
        { id: 'image', icon: ImageIcon, label: 'Image' },
        { id: 'eraser', icon: Eraser, label: 'Eraser' },
    ] as const;

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                usePDFStore.getState().setPendingImage(base64);
                setTool('image');
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    const handleDownload = async () => {
        if (!file) return;
        try {
            await exportPDF(file, annotations);
        } catch (e) {
            console.error("Export failed", e);
            alert("Failed to export PDF");
        }
    };

    const handleAICheck = () => {
        if (!file) return;
        setSidebarTab('ai-checker');
    };

    return (
        <div className="h-20 px-6 flex items-center justify-center z-[60] relative pointer-events-none sticky top-0">
            <GlassPanel className="max-w-5xl w-full h-14 rounded-2xl flex items-center px-4 justify-between pointer-events-auto shadow-2xl">
                <div className="flex items-center gap-1 sm:gap-2 relative">
                    <div className="flex flex-col mr-4">
                        <h1 className="text-lg font-black text-gray-900 tracking-tight leading-none uppercase select-none">Editor</h1>
                        <AnimatePresence>
                            {isSaved && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0, y: 5 }}
                                    animate={{ opacity: 1, height: 12, y: 0 }}
                                    exit={{ opacity: 0, height: 0, y: 5 }}
                                    className="flex items-center gap-1 mt-1 overflow-hidden"
                                >
                                    <CheckCircle2 size={10} className="text-green-500" />
                                    <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Saved</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="h-8 w-px bg-black/5 mx-2" />

                    {tools.map((t) => (
                        <GlassButton
                            key={t.id}
                            active={tool === t.id}
                            onClick={() => {
                                if (t.id === 'image') {
                                    fileInputRef.current?.click();
                                } else {
                                    setTool(t.id);
                                }
                            }}
                            title={t.label}
                        >
                            <t.icon size={20} strokeWidth={tool === t.id ? 2.5 : 2} className="relative z-10" />
                            {tool === t.id && (
                                <motion.div
                                    layoutId="nav-bg"
                                    className="absolute inset-0 bg-blue-500/10 rounded-xl blur-[2px] z-0"
                                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                />
                            )}
                        </GlassButton>
                    ))}

                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                    />

                    <AnimatePresence>
                        {selectedAnnotation && (
                            <motion.div
                                initial={{ opacity: 0, x: -10, scale: 0.95 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, x: -10, scale: 0.95 }}
                            >
                                <GlassButton
                                    onClick={() => deleteAnnotation(selectedAnnotation)}
                                    className="ml-2 !bg-red-500/10 !text-red-600 hover:!bg-red-500 hover:!text-white border border-red-500/20 shadow-sm"
                                >
                                    <Eraser size={18} />
                                    <span className="hidden lg:inline ml-2 text-[10px] font-black uppercase tracking-widest">Delete</span>
                                </GlassButton>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="flex items-center gap-2 sm:gap-4">
                    <div className="hidden sm:flex items-center bg-black/5 rounded-xl p-1 gap-1 border border-white/40">
                        <GlassButton
                            className="p-1 px-3 !bg-transparent !shadow-none hover:!bg-white/60"
                            onClick={() => setScale(Math.max(0.5, scale - 0.1))}
                        >
                            <span className="text-sm font-bold">-</span>
                        </GlassButton>
                        <span className="text-[10px] font-black w-10 text-center text-gray-900">
                            {Math.round(scale * 100)}%
                        </span>
                        <GlassButton
                            className="p-1 px-3 !bg-transparent !shadow-none hover:!bg-white/60"
                            onClick={() => setScale(Math.min(3, scale + 0.1))}
                        >
                            <span className="text-sm font-bold">+</span>
                        </GlassButton>
                    </div>

                    <div className="flex items-center gap-2">
                        <GlassButton
                            disabled={!file}
                            onClick={handleAICheck}
                            className="!bg-blue-50 !text-blue-600 hover:!bg-blue-600 hover:!text-white border border-blue-200"
                            title="AI Likelihood Checker"
                        >
                            <SparklesIcon size={20} className={clsx(aiCheckResults?.status === 'analyzing' && "animate-spin")} />
                        </GlassButton>
                        <GlassButton
                            className="!bg-white/20 !text-gray-500 hover:!text-black hover:!bg-white/80 border border-white/40"
                            onClick={onShowHelp}
                            title="Keyboard Shortcuts"
                        >
                            <HelpCircle size={20} strokeWidth={2} />
                        </GlassButton>
                        <GlassButton
                            disabled={!file}
                            onClick={handleDownload}
                            className="!bg-blue-600 !text-white hover:!bg-blue-700 shadow-xl shadow-blue-500/20 disabled:opacity-50"
                        >
                            <Download size={20} strokeWidth={2.5} />
                            <span className="hidden md:inline ml-2 text-[10px] font-black uppercase tracking-widest">Export</span>
                        </GlassButton>
                    </div>
                </div>
            </GlassPanel>
        </div>
    );
}
