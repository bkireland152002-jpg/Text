'use client';

import React from 'react';
import clsx from 'clsx';
import { Clock, Sparkles } from 'lucide-react';

interface SidebarTabsProps {
    activeTab: 'history' | 'ai-checker';
    onTabChange: (tab: 'history' | 'ai-checker') => void;
}

export default function SidebarTabs({ activeTab, onTabChange }: SidebarTabsProps) {
    const handleKeyDown = (e: React.KeyboardEvent, tab: 'history' | 'ai-checker') => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onTabChange(tab);
        }
        // Optional: Arrow key navigation
        if (e.key === 'ArrowRight') {
            onTabChange(tab === 'history' ? 'ai-checker' : 'history');
        }
        if (e.key === 'ArrowLeft') {
            onTabChange(tab === 'history' ? 'ai-checker' : 'history');
        }
    };

    return (
        <div className="px-6 pt-6 flex gap-2">
            <div
                className="w-full p-1.5 bg-black/5 rounded-[2rem] flex gap-1"
                role="tablist"
                aria-label="Sidebar navigation"
            >
                <button
                    role="tab"
                    aria-selected={activeTab === 'history'}
                    aria-controls="history-panel"
                    id="history-tab"
                    tabIndex={activeTab === 'history' ? 0 : -1}
                    onClick={() => onTabChange('history')}
                    onKeyDown={(e) => handleKeyDown(e, 'history')}
                    className={clsx(
                        "flex-1 py-3 px-4 rounded-[1.5rem] flex items-center justify-center gap-2 transition-all font-black text-[10px] uppercase tracking-widest focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                        activeTab === 'history'
                            ? "bg-white shadow-lg text-blue-600 scale-[1.02] ring-1 ring-black/5"
                            : "text-gray-500 hover:text-gray-700 hover:bg-white/40"
                    )}
                >
                    <Clock size={16} strokeWidth={2.5} aria-hidden="true" />
                    <span>History</span>
                </button>
                <button
                    role="tab"
                    aria-selected={activeTab === 'ai-checker'}
                    aria-controls="ai-checker-panel"
                    id="ai-checker-tab"
                    tabIndex={activeTab === 'ai-checker' ? 0 : -1}
                    onClick={() => onTabChange('ai-checker')}
                    onKeyDown={(e) => handleKeyDown(e, 'ai-checker')}
                    className={clsx(
                        "flex-1 py-3 px-4 rounded-[1.5rem] flex items-center justify-center gap-2 transition-all font-black text-[10px] uppercase tracking-widest focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2",
                        activeTab === 'ai-checker'
                            ? "bg-white shadow-lg text-purple-600 scale-[1.02] ring-1 ring-black/5"
                            : "text-gray-500 hover:text-gray-700 hover:bg-white/40"
                    )}
                >
                    <Sparkles size={16} strokeWidth={2.5} aria-hidden="true" />
                    <span>AI Checker</span>
                </button>
            </div>
        </div>
    );
}
