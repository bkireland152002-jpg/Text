'use client';

import React from 'react';
import { usePDFStore } from '@/store/usePDFStore';
import { Clock, Plus, Pencil, Trash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel, GlassButton, MotionPresets } from './ui/Glass';

export default function HistorySidebar() {
    const { history, redoStack, undo, redo, annotations, jumpToAnnotation } = usePDFStore();

    return (
        <div className="w-80 h-full flex flex-col pointer-events-none">
            <GlassPanel className="flex-1 rounded-[2rem] flex flex-col overflow-hidden pointer-events-auto shadow-2xl">
                <div className="p-6 border-b border-white/20 bg-white/5">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-black text-gray-900 flex items-center gap-2 uppercase tracking-widest">
                            <Clock size={16} className="text-blue-600" />
                            Activity
                        </h3>
                        <div className="flex gap-1">
                            <GlassButton
                                onClick={() => undo()}
                                disabled={history.length === 0}
                                title="Undo (Ctrl+Z)"
                                className="!p-1 w-8 h-8"
                            >
                                <RotateIcon className="rotate-180" />
                            </GlassButton>
                            <GlassButton
                                onClick={() => redo()}
                                disabled={redoStack.length === 0}
                                title="Redo (Ctrl+Shift+Z)"
                                className="!p-1 w-8 h-8"
                            >
                                <RotateIcon />
                            </GlassButton>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar relative">
                    <AnimatePresence mode="popLayout" initial={false}>
                        {history.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex flex-col items-center justify-center mt-20 opacity-30"
                            >
                                <Clock size={40} className="mb-4 text-gray-300" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">No Activity</p>
                            </motion.div>
                        ) : (
                            history.map((item, index) => (
                                <motion.div
                                    layout
                                    variants={MotionPresets.fadeBlur}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    key={`${item.annotationId}-${item.timestamp}-${index}`}
                                    className="p-4 bg-white/40 border border-white/60 rounded-2xl hover:bg-white/80 cursor-pointer transition-all shadow-sm group active:scale-[0.98] relative overflow-hidden"
                                    onClick={() => {
                                        let targetPage = -1;
                                        for (const pageIndex in annotations) {
                                            if (annotations[pageIndex].find(a => a.id === item.annotationId)) {
                                                targetPage = parseInt(pageIndex);
                                                break;
                                            }
                                        }

                                        if (targetPage !== -1) {
                                            const pageElement = document.getElementById(`page_${Number(targetPage) + 1}`);
                                            if (pageElement) {
                                                pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            }
                                        }
                                        jumpToAnnotation(item.annotationId);
                                    }}
                                >
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className={`p-2 rounded-xl shadow-inner ${item.action === 'Add' ? 'bg-green-500/10 text-green-600' :
                                            item.action === 'Edit' ? 'bg-blue-500/10 text-blue-600' :
                                                'bg-red-500/10 text-red-600'
                                            }`}>
                                            {item.action === 'Add' && <Plus size={16} strokeWidth={3} />}
                                            {item.action === 'Edit' && <Pencil size={16} strokeWidth={3} />}
                                            {item.action === 'Delete' && <Trash size={16} strokeWidth={3} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-black text-gray-900 truncate tracking-tight">{item.description}</p>
                                            <p className="text-[9px] text-gray-400 mt-1 uppercase tracking-[0.1em] font-black">
                                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>

                <div className="p-4 border-t border-white/10 bg-white/5">
                    <p className="text-[9px] font-black text-center text-gray-300 uppercase tracking-[0.2em]">BK Project</p>
                </div>
            </GlassPanel>
        </div>
    );
}

const RotateIcon = ({ className }: { className?: string }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
    </svg>
);
