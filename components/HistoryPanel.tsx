'use client';

import React from 'react';
import { Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { MotionPresets } from './ui/Glass';

interface HistoryPanelProps {
    history: any[];
    annotations: any;
    jumpToAnnotation: (id: string) => void;
}

export default function HistoryPanel({ history, annotations, jumpToAnnotation }: HistoryPanelProps) {
    return (
        <div
            role="tabpanel"
            id="history-panel"
            aria-labelledby="history-tab"
            className="p-4 space-y-3"
        >
            {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center mt-20 opacity-30">
                    <Clock size={40} className="mb-4 text-gray-300" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">No Activity</p>
                </div>
            ) : (
                history.map((item, index) => (
                    <HistoryItem
                        key={index}
                        item={item}
                        jumpToAnnotation={jumpToAnnotation}
                        annotations={annotations}
                    />
                ))
            )}
        </div>
    );
}

function HistoryItem({ item, jumpToAnnotation, annotations }: any) {
    return (
        <motion.div
            layout
            variants={MotionPresets.fadeBlur}
            initial="initial"
            animate="animate"
            exit="exit"
            className="p-4 bg-white/40 border border-white/60 rounded-2xl hover:bg-white/80 cursor-pointer transition-all shadow-sm group active:scale-[0.98] relative overflow-hidden"
            onClick={() => {
                let targetPage = -1;
                for (const pageIndex in annotations) {
                    if (annotations[pageIndex].find((a: any) => a.id === item.annotationId)) {
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
                    <ActionIcon action={item.action} />
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
    );
}

function ActionIcon({ action }: { action: string }) {
    if (action === 'Add') return <PlusIcon />;
    if (action === 'Edit') return <PencilIcon />;
    return <TrashIcon />;
}

const PlusIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

const PencilIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
);

const TrashIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
);
