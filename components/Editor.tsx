'use client';

import React, { useEffect, useState } from 'react';
import { usePDFStore } from '@/store/usePDFStore';
import dynamic from 'next/dynamic';
import Toolbar from './Toolbar';
import Sidebar from './Sidebar';
import ShortcutOverlay from './pdf/ShortcutOverlay';
import { Upload, FileText, Sparkles } from 'lucide-react';

const PDFViewer = dynamic(() => import('./pdf/PDFViewer'), {
    ssr: false,
    loading: () => (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <p className="font-medium animate-pulse">Initializing PDF Engine...</p>
        </div>
    )
});

import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '@/components/ui/Glass';

export default function Editor() {
    const { file } = usePDFStore();
    const [showShortcuts, setShowShortcuts] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '?' && !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)) {
                setShowShortcuts(prev => !prev);
            }
            if (e.key === 'Escape') {
                setShowShortcuts(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="flex flex-col h-screen editor-bg text-gray-900 selection:bg-blue-200/50">
            <Toolbar onShowHelp={() => setShowShortcuts(true)} />
            <div className="flex-1 overflow-hidden relative flex flex-row p-2 sm:p-4 gap-2 sm:gap-4">
                {/* Main Content Area */}
                <GlassPanel
                    className="flex-1 rounded-[2.5rem] overflow-hidden shadow-2xl relative z-20"
                >
                    <div className="relative h-full overflow-auto custom-scrollbar bg-white/20">
                        {file ? (
                            <PDFViewer />
                        ) : (
                            <UploadPlaceholder />
                        )}
                    </div>
                </GlassPanel>

                {/* Right Sidebar Container */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, type: "spring", damping: 25, stiffness: 200 }}
                    className="h-full z-30 w-[360px] xl:w-[440px] flex-shrink-0 transition-all duration-300"
                >
                    <Sidebar />
                </motion.div>
            </div>

            <AnimatePresence>
                {showShortcuts && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200]"
                    >
                        <ShortcutOverlay onClose={() => setShowShortcuts(false)} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}


function UploadPlaceholder() {
    const { setFile } = usePDFStore();
    const [isDragging, setIsDragging] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            if (e.dataTransfer.files[0].type === 'application/pdf') {
                setFile(e.dataTransfer.files[0]);
            }
        }
    };

    return (
        <div className="flex items-center justify-center h-full p-6">
            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                className={`
                    max-w-xl w-full aspect-[4/3] rounded-3xl border-2 border-dashed transition-all duration-300
                    flex flex-col items-center justify-center p-12 text-center relative overflow-hidden
                    ${isDragging
                        ? 'border-blue-500 bg-blue-50/50 scale-[1.02] shadow-2xl shadow-blue-500/10'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-xl hover:shadow-gray-200/50'
                    }
                `}
            >
                {/* Decorative Elements */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-50 rounded-full blur-3xl opacity-50" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-50 rounded-full blur-3xl opacity-50" />

                <div className={`
                    w-20 h-20 rounded-2xl flex items-center justify-center mb-8 transition-transform duration-500
                    ${isDragging ? 'bg-blue-500 text-white rotate-12 scale-110' : 'bg-blue-50 text-blue-600'}
                `}>
                    {isDragging ? <Sparkles size={40} /> : <FileText size={40} />}
                </div>

                <h2 className="text-3xl font-black mb-4 text-gray-900 tracking-tight">
                    {isDragging ? "Drop your PDF here" : "Start with a PDF"}
                </h2>

                <p className="text-gray-500 mb-10 max-w-sm font-medium leading-relaxed">
                    Drag and drop your file here, or click the button below to browse. Your work is automatically saved.
                </p>

                <label className="group relative cursor-pointer">
                    <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <div className="
                        flex items-center gap-3 bg-black text-white px-8 py-4 rounded-2xl font-bold 
                        hover:bg-gray-800 transition-all active:scale-95 shadow-xl shadow-black/20
                        group-hover:translate-y-[-2px]
                    ">
                        <Upload size={20} />
                        Choose PDF File
                    </div>
                </label>

                <div className="mt-8 flex items-center gap-6 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    <span>Secure</span>
                    <span className="w-1 h-1 bg-gray-300 rounded-full" />
                    <span>Private</span>
                    <span className="w-1 h-1 bg-gray-300 rounded-full" />
                    <span>Local</span>
                </div>
            </div>
        </div>
    );
}

