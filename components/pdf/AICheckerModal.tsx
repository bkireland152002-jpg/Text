'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldAlert, CheckCircle2, AlertTriangle, Download, FileJson, Sparkles, Loader2, ChevronRight, Zap, Target, ShieldCheck, Settings2, Trash2, Info } from 'lucide-react';
import { GlassPanel, GlassButton, MotionPresets } from '../ui/Glass';
import { usePDFStore } from '@/store/usePDFStore';
import { extractTextFromPDF, TextChunk } from '@/lib/ai-utils';
import { runQuickScan } from '@/lib/quickScan';
import { redactText } from '@/lib/redact';
import clsx from 'clsx';

export default function AICheckerModal({ onClose, onCancel }: { onClose: () => void, onCancel?: () => void }) {
    const {
        file,
        aiCheckResults,
        setAiCheckResults,
        updateAiCheckStatus,
        setActiveAIHighlight,
        redactionSettings,
        setRedactionSettings
    } = usePDFStore();

    const [activeTab, setActiveTab] = useState<'quick' | 'deep'>('quick');
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<any>(aiCheckResults?.status || 'idle');
    const [consent, setConsent] = useState(false);
    const abortController = useRef<AbortController | null>(null);

    const getScoreColor = (score: number) => {
        if (score < 30) return 'text-green-500';
        if (score < 70) return 'text-yellow-500';
        return 'text-red-500';
    };

    const getScoreBg = (score: number) => {
        if (score < 30) return 'bg-green-500/10';
        if (score < 70) return 'bg-yellow-500/10';
        return 'bg-red-500/10';
    };

    const handleRunQuickScan = async () => {
        if (!file) return;
        setStatus('extracting');
        setProgress(0);
        abortController.current = new AbortController();

        try {
            const chunks = await extractTextFromPDF(file, (p) => setProgress(p), abortController.current.signal);
            setStatus('analyzing');

            // Artificial delay for UX "feeling" of analysis
            await new Promise(r => setTimeout(r, 800));

            const results = runQuickScan(chunks);
            setAiCheckResults({ ...results, analysisTime: Date.now(), status: 'completed' });
            setStatus('completed');
        } catch (e: any) {
            if (e.name !== 'AbortError') setStatus('error');
        }
    };

    const handleRunDeepCheck = async () => {
        if (!file || !consent) return;
        setStatus('extracting');
        setProgress(0);
        abortController.current = new AbortController();

        try {
            const chunks = await extractTextFromPDF(file, (p) => setProgress(p), abortController.current.signal);
            setStatus('analyzing');

            // Redact before sending
            const preparedChunks = chunks.map(c => ({
                ...c,
                text: redactText(c.text, redactionSettings)
            }));

            const response = await fetch('/api/ai-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chunks: preparedChunks,
                    redactionSettings,
                    redactionEnabled: true
                }),
                signal: abortController.current.signal
            });

            if (!response.ok) throw new Error('Deep analysis failed');
            const data = await response.json();

            setAiCheckResults({ ...data, mode: 'deep', status: 'completed' });
            setStatus('completed');
        } catch (e: any) {
            if (e.name !== 'AbortError') setStatus('error');
        }
    };

    const handleStop = () => {
        abortController.current?.abort();
        setStatus('idle');
        if (onCancel) onCancel();
    };

    const handleClear = () => {
        setAiCheckResults(null);
        setStatus('idle');
    };

    const handleJump = (item: any) => {
        const pageElement = document.getElementById(`page_${item.pageIndex + 1}`);
        if (pageElement) {
            pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        if (item.rect) {
            setActiveAIHighlight({ pageIndex: item.pageIndex, rect: item.rect });
        } else {
            // Fallback highlight for page
            setActiveAIHighlight({
                pageIndex: item.pageIndex,
                rect: { x: 0.1, y: 0.05, w: 0.8, h: 0.05 } // Subtle header bar
            });
        }
        onClose();
    };

    const handleDownload = () => {
        if (!aiCheckResults) return;
        const data = JSON.stringify(aiCheckResults, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-report-${activeTab}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/5 backdrop-blur-md p-4">
            <GlassPanel className="w-full max-w-2xl max-h-[85vh] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] rounded-[2.5rem] overflow-hidden flex flex-col" variant="light">

                {/* Header */}
                <div className="p-8 border-b border-black/5 flex items-center justify-between bg-white/40 sticky top-0 z-20">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                            <Sparkles size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">AI Checker</h2>
                            <p className="text-[10px] font-black text-blue-600/70 uppercase tracking-[0.2em] mt-1">Probabilistic Analysis</p>
                        </div>
                    </div>
                    <GlassButton onClick={onClose} className="!p-2 hover:!bg-black hover:!text-white transition-colors">
                        <X size={20} />
                    </GlassButton>
                </div>

                {/* Tabs */}
                {status === 'idle' && (
                    <div className="px-8 pt-6 flex gap-2">
                        <button
                            onClick={() => setActiveTab('quick')}
                            className={clsx(
                                "flex-1 py-3 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all font-black text-[10px] uppercase tracking-widest",
                                activeTab === 'quick' ? "bg-white shadow-sm text-blue-600" : "text-gray-400 hover:text-gray-600"
                            )}
                        >
                            <Zap size={14} /> Quick Scan
                        </button>
                        <button
                            onClick={() => setActiveTab('deep')}
                            className={clsx(
                                "flex-1 py-3 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all font-black text-[10px] uppercase tracking-widest",
                                activeTab === 'deep' ? "bg-white shadow-sm text-purple-600" : "text-gray-400 hover:text-gray-600"
                            )}
                        >
                            <Target size={14} /> Deep Check
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                    {status === 'idle' ? (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-6"
                        >
                            <div className="bg-amber-50 rounded-2xl p-4 flex gap-3 border border-amber-100">
                                <AlertTriangle className="text-amber-500 shrink-0" size={18} />
                                <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                                    <strong>Estimates Only:</strong> This tool detects linguistic patterns common in AI models. It does NOT provide proof of authorship or intent.
                                </p>
                            </div>

                            {activeTab === 'quick' ? (
                                <div className="space-y-4">
                                    <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100/50">
                                        <h4 className="text-sm font-bold text-gray-900 mb-2">Instant Local Analysis</h4>
                                        <p className="text-xs text-gray-500 leading-relaxed mb-6">
                                            Runs entirely in your browser. Analyzes lexical diversity, burstiness, and repetition patterns locally.
                                        </p>
                                        <GlassButton
                                            onClick={handleRunQuickScan}
                                            className="w-full !py-4 bg-blue-600 text-white hover:!bg-blue-700 font-black uppercase tracking-widest text-[11px]"
                                        >
                                            Start Quick Scan
                                        </GlassButton>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="p-6 bg-purple-50/50 rounded-3xl border border-purple-100/50">
                                        <h4 className="text-sm font-bold text-gray-900 mb-2">Deep Stylistic Check</h4>
                                        <p className="text-xs text-gray-500 leading-relaxed mb-6">
                                            Sends redacted text chunks to our server for deeper linguistic analysis. Use this for more detailed feedback on consistency and tone.
                                        </p>

                                        <div className="space-y-3 mb-6">
                                            <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Privacy Controls</h5>
                                            <div className="grid grid-cols-2 gap-2">
                                                {(Object.keys(redactionSettings) as Array<keyof typeof redactionSettings>).map(key => (
                                                    <label key={key} className="flex items-center gap-2 p-3 bg-white rounded-xl border border-black/5 cursor-pointer hover:border-purple-200 transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            checked={redactionSettings[key]}
                                                            onChange={(e) => setRedactionSettings({ ...redactionSettings, [key]: e.target.checked })}
                                                            className="rounded border-gray-300 text-purple-600"
                                                        />
                                                        <span className="text-[10px] font-bold text-gray-600 uppercase">Mask {key}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        <label className="flex gap-3 mb-6 items-start cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={consent}
                                                onChange={(e) => setConsent(e.target.checked)}
                                                className="mt-1 rounded border-gray-300 text-purple-600"
                                            />
                                            <p className="text-[11px] text-gray-500 group-hover:text-gray-700 transition-colors italic">
                                                I understand that only extracted text chunks (not the PDF file) will be sent to the server for analysis.
                                            </p>
                                        </label>

                                        <GlassButton
                                            disabled={!consent}
                                            onClick={handleRunDeepCheck}
                                            className="w-full !py-4 bg-purple-600 text-white hover:!bg-purple-700 font-black uppercase tracking-widest text-[11px] disabled:opacity-50"
                                        >
                                            Start Deep Check
                                        </GlassButton>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ) : status === 'extracting' || status === 'analyzing' ? (
                        <div className="py-20 flex flex-col items-center justify-center text-center">
                            <div className="relative mb-8">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                    className="text-blue-600"
                                >
                                    <Loader2 size={64} strokeWidth={1.5} />
                                </motion.div>
                                <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-blue-600">
                                    {progress}%
                                </div>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">
                                {status === 'extracting' ? 'Extracting Content' : 'Analyzing Signatures'}
                            </h3>
                            <p className="text-xs text-gray-400 max-w-xs mb-10 uppercase tracking-widest font-black">
                                Processing {file?.name}
                            </p>
                            <GlassButton onClick={handleStop} className="!px-8 !py-2 bg-red-50 text-red-600 hover:!bg-red-500 hover:!text-white border border-red-200">
                                <span className="text-[10px] font-black uppercase tracking-widest">Cancel</span>
                            </GlassButton>
                        </div>
                    ) : (
                        <div className="space-y-10 pb-10">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <GlassPanel className={clsx("p-6 rounded-[2rem] flex flex-col items-center justify-center text-center border-none overflow-hidden relative", getScoreBg(aiCheckResults!.overallScore))}>
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        {aiCheckResults?.mode === 'deep' ? <Target size={60} /> : <Zap size={60} />}
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500/60 mb-2">AI Likelihood</span>
                                    <div className={clsx("text-6xl font-black mb-1 tracking-tighter", getScoreColor(aiCheckResults!.overallScore))}>{aiCheckResults?.overallScore}%</div>
                                    <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">
                                        {aiCheckResults?.mode === 'deep' ? 'Deep Check' : 'Quick Scan'}
                                    </span>
                                </GlassPanel>

                                <GlassPanel className="p-6 rounded-[2rem] flex flex-col items-center justify-center text-center bg-blue-500/5 border-none">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500/60 mb-2">Scanned</span>
                                    <div className="text-4xl font-black mb-1 text-blue-600">{aiCheckResults?.pages.length}</div>
                                    <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Total Pages</span>
                                </GlassPanel>

                                <GlassPanel className="p-6 rounded-[2rem] flex flex-col items-center justify-center text-center bg-purple-500/5 border-none">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500/60 mb-2">Signals</span>
                                    <div className="text-4xl font-black mb-1 text-purple-600">{aiCheckResults?.flagged.length}</div>
                                    <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Flagged Spots</span>
                                </GlassPanel>
                            </div>

                            {aiCheckResults?.notes && (
                                <div className="bg-blue-50/50 rounded-2xl p-5 border border-blue-100/50 flex gap-4">
                                    <Info className="text-blue-500 shrink-0" size={20} />
                                    <p className="text-xs text-blue-800 leading-relaxed italic">
                                        &ldquo;{aiCheckResults.notes}&rdquo;
                                    </p>
                                </div>
                            )}

                            {/* Page Breakdown */}
                            <div>
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 px-1">Page Risk Heatmap</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                    {aiCheckResults?.pages.map(p => (
                                        <div key={p.pageIndex} className="p-3 bg-white/40 rounded-2xl border border-black/5 flex flex-col items-center">
                                            <span className="text-[8px] font-black text-gray-400 uppercase mb-2">Page {p.pageIndex + 1}</span>
                                            <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mb-2">
                                                <div
                                                    className={clsx("h-full transition-all duration-1000", p.score > 60 ? "bg-red-500" : p.score > 30 ? "bg-yellow-500" : "bg-green-500")}
                                                    style={{ width: `${p.score}%` }}
                                                />
                                            </div>
                                            <span className={clsx("text-xs font-black", getScoreColor(p.score))}>{p.score}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Flagged Passages */}
                            <div>
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 px-1">Signal Hotspots</h3>
                                <div className="space-y-4">
                                    {aiCheckResults?.flagged.length === 0 ? (
                                        <div className="p-12 border-2 border-dashed border-gray-100 rounded-[2.5rem] text-center">
                                            <ShieldCheck size={40} className="mx-auto text-green-500 mb-4 opacity-20" />
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">All systems clear</p>
                                        </div>
                                    ) : (
                                        aiCheckResults?.flagged.map((item, i) => (
                                            <motion.div
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                key={i}
                                                onClick={() => handleJump(item)}
                                                className="group p-6 bg-white/60 hover:bg-white rounded-[2rem] border border-black/5 transition-all cursor-pointer flex gap-5 items-start shadow-sm hover:shadow-md"
                                            >
                                                <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner", getScoreBg(item.score))}>
                                                    <ShieldAlert size={20} className={getScoreColor(item.score)} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-2 py-0.5 bg-black/5 rounded text-[8px] font-black uppercase tracking-widest text-gray-500">P{item.pageIndex + 1}</span>
                                                            <span className={clsx("text-[10px] font-black uppercase", getScoreColor(item.score))}>{item.score}% Risk</span>
                                                        </div>
                                                        <ChevronRight className="text-gray-300 group-hover:text-blue-500 transition-colors" size={16} />
                                                    </div>
                                                    <p className="text-sm text-gray-600 italic leading-relaxed mb-4">&ldquo;{item.excerpt}&rdquo;</p>
                                                    <div className="flex gap-2 flex-wrap">
                                                        {item.reasons.map((r, ri) => (
                                                            <span key={ri} className="px-3 py-1 bg-white/80 rounded-full text-[9px] font-bold text-gray-500 border border-black/5">{r}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 bg-white/60 border-t border-black/5 flex items-center justify-between backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                            {status === 'completed'
                                ? `Analysis Complete (${new Date(aiCheckResults!.analysisTime).toLocaleTimeString()})`
                                : 'Privacy Secured: Data Redacted'
                            }
                        </p>
                    </div>
                    <div className="flex gap-3">
                        {status === 'completed' && (
                            <>
                                <GlassButton onClick={handleClear} className="!p-3 !bg-red-50 !text-red-500 hover:!bg-red-500 hover:!text-white group border-red-100">
                                    <Trash2 size={16} />
                                </GlassButton>
                                <GlassButton onClick={handleDownload} className="gap-3 !px-6 !bg-white !text-gray-700 hover:!bg-black hover:!text-white border border-gray-100">
                                    <FileJson size={16} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Export</span>
                                </GlassButton>
                            </>
                        )}
                        <GlassButton onClick={onClose} className="!px-10 !bg-black !text-white hover:!bg-gray-800 shadow-2xl shadow-black/20">
                            <span className="text-[10px] font-black uppercase tracking-widest">
                                {status === 'completed' ? 'Done' : 'Cancel'}
                            </span>
                        </GlassButton>
                    </div>
                </div>
            </GlassPanel>
        </div>
    );
}
