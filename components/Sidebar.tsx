'use client';

import React from 'react';
import { usePDFStore } from '@/store/usePDFStore';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from './ui/Glass';
import SidebarTabs from './SidebarTabs';
import HistoryPanel from './HistoryPanel';
import AiCheckerPanel from './AiCheckerPanel';
import { extractTextFromPDF } from '@/lib/ai-utils';
import { runQuickScan } from '@/lib/quickScan';
import { redactText } from '@/lib/redact';

export default function Sidebar() {
    const {
        history,
        annotations,
        jumpToAnnotation,
        aiCheckResults,
        setAiCheckResults,
        updateAiCheckStatus,
        setActiveAIHighlight,
        redactionSettings,
        setRedactionSettings,
        sidebarTab,
        setSidebarTab,
        file
    } = usePDFStore();

    const status = aiCheckResults?.status || 'idle';

    return (
        <div className="w-full h-full flex flex-col pointer-events-none z-30 relative">
            <GlassPanel className="flex-1 rounded-[2.5rem] flex flex-col overflow-hidden pointer-events-auto shadow-2xl border-white/40">
                <SidebarTabs
                    activeTab={sidebarTab}
                    onTabChange={setSidebarTab}
                />

                <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                    <AnimatePresence mode="wait">
                        {sidebarTab === 'history' ? (
                            <motion.div
                                key="history"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                            >
                                <HistoryPanel
                                    history={history}
                                    annotations={annotations}
                                    jumpToAnnotation={jumpToAnnotation}
                                />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="ai-checker"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                            >
                                <AiCheckerPanel
                                    file={file}
                                    aiCheckResults={aiCheckResults}
                                    setAiCheckResults={setAiCheckResults}
                                    updateAiCheckStatus={updateAiCheckStatus}
                                    setActiveAIHighlight={setActiveAIHighlight}
                                    redactionSettings={redactionSettings}
                                    setRedactionSettings={setRedactionSettings}
                                    extractTextFromPDF={extractTextFromPDF}
                                    runQuickScan={runQuickScan}
                                    redactText={redactText}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="p-4 border-t border-black/5 bg-white/5">
                    <p className="text-[9px] font-black text-center text-gray-300 uppercase tracking-[0.2em]">
                        {status === 'idle' ? 'BK Project' : 'Analysis In Progress'}
                    </p>
                </div>
            </GlassPanel>
        </div>
    );
}
