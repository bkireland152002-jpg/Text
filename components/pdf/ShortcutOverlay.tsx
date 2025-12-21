'use client';

import React from 'react';
import { X } from 'lucide-react';
import { GlassPanel, GlassButton } from '@/components/ui/Glass';
import { motion } from 'framer-motion';

interface Shortcut {
    key: string;
    description: string;
}

const shortcuts: Shortcut[] = [
    { key: 'Ctrl + Z', description: 'Undo last action' },
    { key: 'Ctrl + Y / Ctrl + Shift + Z', description: 'Redo last undone action' },
    { key: 'Delete / Backspace', description: 'Delete selected annotation' },
    { key: '+ / -', description: 'Zoom in or out' },
    { key: '?', description: 'Toggle this help menu' },
    { key: 'Select Tool', description: 'Click annotations to select/drag/resize' },
    { key: 'Double Click', description: 'Edit text or text-edit annotations' },
];

export default function ShortcutOverlay({ onClose }: { onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/5 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <GlassPanel className="w-full max-w-md shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[2rem] overflow-hidden" variant="light">
                <div className="flex items-center justify-between p-8 border-b border-black/5">
                    <div>
                        <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Shortcuts</h2>
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mt-1">Master the Flow</p>
                    </div>
                    <GlassButton
                        onClick={onClose}
                        className="!p-2 hover:!bg-black hover:!text-white"
                    >
                        <X className="w-5 h-5" />
                    </GlassButton>
                </div>

                <div className="p-8 space-y-5">
                    {shortcuts.map((s, i) => (
                        <div key={i} className="flex items-center justify-between group">
                            <span className="text-gray-500 font-bold text-sm tracking-tight group-hover:text-gray-900 transition-colors">
                                {s.description}
                            </span>
                            <kbd className="px-3 py-1.5 bg-black/5 border border-black/10 rounded-xl text-[10px] font-black text-gray-700 shadow-inner uppercase tracking-wider">
                                {s.key}
                            </kbd>
                        </div>
                    ))}
                </div>

                <div className="p-8 bg-white/40 border-t border-black/5 flex justify-end">
                    <GlassButton
                        onClick={onClose}
                        className="!px-8 !py-3 bg-black !text-white hover:!bg-gray-800 shadow-xl shadow-black/10"
                    >
                        <span className="text-[10px] font-black uppercase tracking-widest">Understood</span>
                    </GlassButton>
                </div>
            </GlassPanel>
        </div>
    );
}
