'use client';

import React, { useState, useRef } from 'react';
import { Zap, Target, AlertTriangle, ChevronRight, FileJson, Trash2, Loader2, Info, ShieldCheck, UserCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { GlassButton } from './ui/Glass';
import clsx from 'clsx';
// Import the baseline calculator
import { runQuickScan as libRunQuickScan, calculateBaselineSimilarity } from '../lib/quickScan';
import { findExcerptRects } from '../lib/ai-utils';

interface AiCheckerPanelProps {
    file: File | null;
    aiCheckResults: any;
    setAiCheckResults: (results: any) => void;
    updateAiCheckStatus: (status: 'idle' | 'extracting' | 'scanning' | 'analyzing' | 'completed' | 'error', mode?: 'quick' | 'deep') => void;
    setActiveAIHighlight: (highlight: any) => void;
    redactionSettings: any;
    setRedactionSettings: (settings: any) => void;
    extractTextFromPDF: (file: File, onProgress: (p: number) => void, signal: AbortSignal) => Promise<any>;
    runQuickScan: (chunks: any[]) => any; // We might bypass this prop if we import directly, but let's keep it compatible
    redactText: (text: string, settings: any) => string;
}

export default function AiCheckerPanel({
    file,
    aiCheckResults,
    setAiCheckResults,
    updateAiCheckStatus,
    setActiveAIHighlight,
    redactionSettings,
    setRedactionSettings,
    extractTextFromPDF,
    runQuickScan, // Still available as prop, but we might use the imported lib function for customized logic if needed
    redactText
}: AiCheckerPanelProps) {
    const [extractProgress, setExtractProgress] = useState(0);
    const [consent, setConsent] = useState(false);
    const [baselineText, setBaselineText] = useState('');
    const [showBaselineInput, setShowBaselineInput] = useState(false);
    const [textIndex, setTextIndex] = useState<any>(null); // Store geometric index
    const abortController = useRef<AbortController | null>(null);

    const status = aiCheckResults?.status || 'idle';

    // --- NEW RISK HELPERS ---
    const getRiskColor = (band: string) => {
        switch (band) {
            case 'Very High': return 'bg-red-500 text-white';
            case 'High': return 'bg-orange-500 text-white';
            case 'Medium': return 'bg-yellow-500 text-white';
            default: return 'bg-green-500 text-white'; // Low
        }
    };

    const getRiskTextColor = (band: string) => {
        switch (band) {
            case 'Very High': return 'text-red-500';
            case 'High': return 'text-orange-500';
            case 'Medium': return 'text-yellow-600';
            default: return 'text-green-600';
        }
    };

    const getScoreBg = (score: number) => {
        if (score < 30) return 'bg-green-500/10';
        if (score < 70) return 'bg-yellow-500/10';
        return 'bg-red-500/10';
    };

    const calculateBaseline = (chunks: any[]) => {
        if (!baselineText.trim()) return null;
        const fullText = chunks.map(c => c.text).join(' ');
        if (fullText.length < 50 || baselineText.length < 50) return null;
        return calculateBaselineSimilarity(fullText, baselineText);
    };

    const handleRunQuickScan = async () => {
        if (!file) return;
        updateAiCheckStatus('extracting', 'quick');
        setExtractProgress(0);
        abortController.current = new AbortController();

        try {
            const result = await extractTextFromPDF(file, (p) => setExtractProgress(p), abortController.current.signal);
            const chunks = result.chunks || result; // Fallback if API mismatch
            const index = result.textIndex || null;
            setTextIndex(index);

            updateAiCheckStatus('scanning', 'quick');

            await new Promise(r => setTimeout(r, 800)); // UX delay

            const scanResults = runQuickScan(chunks);
            const baselineComparison = calculateBaseline(chunks);

            setAiCheckResults({
                ...scanResults,
                baselineComparison,
                analysisTime: Date.now(),
                status: 'completed'
            });
        } catch (e: any) {
            if (e.name !== 'AbortError') updateAiCheckStatus('error');
        }
    };

    const handleRunDeepCheck = async () => {
        if (!file || !consent) return;
        updateAiCheckStatus('extracting', 'deep');
        setExtractProgress(0);
        abortController.current = new AbortController();

        let chunks: any[] = [];

        try {
            const result = await extractTextFromPDF(file, (p) => setExtractProgress(p), abortController.current.signal);
            chunks = result.chunks || result;
            const index = result.textIndex || null;
            setTextIndex(index);

            updateAiCheckStatus('analyzing', 'deep');

            const preparedChunks = chunks.map(c => ({
                ...c,
                text: redactText(c.text, redactionSettings)
            }));

            // Set a client-side timeout for the fetch (30s) to force fallback if it hangs
            const timeoutId = setTimeout(() => abortController.current?.abort(), 30000);

            try {
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

                clearTimeout(timeoutId);

                if (!response.ok) {
                    let errorMsg = 'Deep analysis failed';
                    try {
                        const errData = await response.json();
                        if (errData.error) errorMsg = errData.error;
                        if (errData.details) errorMsg += ` (${errData.details})`;
                    } catch (e) { }
                    throw new Error(errorMsg);
                }
                const data = await response.json();

                // Calculate baseline manually since API doesn't do it
                const baselineComparison = calculateBaseline(chunks);

                setAiCheckResults({ ...data, baselineComparison, mode: 'deep', status: 'completed' });
            } catch (fetchError: any) {
                clearTimeout(timeoutId);
                throw fetchError; // Re-throw to be caught by outer catch
            }

        } catch (e: any) {
            // If aborted manually by user (handleStop), do nothing.
            // If aborted by timeout logic above, we proceed to fallback.
            const isTimeout = e.name === 'AbortError' && status === 'analyzing';

            if (e.name === 'AbortError' && !isTimeout) return;

            if (chunks.length > 0) {
                // Fallback to Quick Scan
                const quickResults = runQuickScan(chunks);
                const baselineComparison = calculateBaseline(chunks);

                setAiCheckResults({
                    ...quickResults,
                    baselineComparison,
                    mode: 'quick',
                    status: 'completed',
                    notes: `Deep Check failed: ${e.message}. Showing Quick Scan results.`
                });
            } else {
                updateAiCheckStatus('error');
            }
        }
    };

    const handleStop = () => {
        abortController.current?.abort();
        updateAiCheckStatus('idle');
    };

    const handleJump = (item: any) => {
        const pageElement = document.getElementById(`page_${item.pageIndex + 1}`);
        if (pageElement) {
            pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Try to find exact rects using our index
        let rects: any[] | null = null;
        if (textIndex && item.excerpt) {
            rects = findExcerptRects(item.pageIndex, item.excerpt, textIndex);
        }

        if (item.rect) {
            rects = [item.rect];
        }

        // Fallback
        if (!rects || rects.length === 0) {
            rects = [{ x: 0.1, y: 0.1, w: 0.8, h: 0.05 }];
        }

        setActiveAIHighlight({
            pageIndex: item.pageIndex,
            rects: rects
        });
    };

    const handleDownload = () => {
        if (!aiCheckResults) return;
        const data = JSON.stringify(aiCheckResults, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-report-${aiCheckResults.mode}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    };

    // --- HELPERS FOR TEST BUTTONS ---
    const handleLoadSample = (type: 'ai' | 'human') => {
        import('../lib/sample-text').then(mod => {
            const text = type === 'ai' ? mod.SAMPLE_AI_TEXT : mod.SAMPLE_HUMAN_TEXT;
            const fakeChunk = {
                pageIndex: 0,
                chunkId: `sample-${type}-${Date.now()}`,
                text: text.trim()
            };
            const quickRes = runQuickScan([fakeChunk]);
            // No baseline for sample loading unless specifically testing that path, 
            // but we can add dummy logic if user wants to test baseline tool too.
            // For now, keep simple.

            setAiCheckResults({
                ...quickRes,
                analysisTime: Date.now(),
                status: 'completed',
                debug: {
                    chunkCount: 1,
                    wordCount: text.split(/\s+/).length,
                    firstChunkPreview: text.substring(0, 200),
                    source: `Sample ${type.toUpperCase()}`
                }
            });
        });
    };

    return (
        <div role="tabpanel" id="ai-checker-panel" className="p-6 space-y-6">

            {/* PERSISTENT DISCLAIMER */}
            <div className="bg-gray-50 rounded-xl p-3 flex gap-3 border border-gray-100">
                <ShieldCheck className="text-gray-400 shrink-0" size={16} />
                <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                    <strong>Writing Analysis Report:</strong> This tool analyzes linguistic patterns. It cannot prove authorship. Use as one signal among many.
                </p>
            </div>

            {/* DEV TOOLS (TOP) */}
            {process.env.NODE_ENV === 'development' && (
                <div className="bg-slate-900 rounded-xl p-3 mb-4 text-slate-400 text-[10px] font-mono">
                    <div className="flex justify-between items-center mb-2">
                        <strong className="text-slate-200">DEV TOOLS v3</strong>
                        <span className="bg-slate-800 px-1 rounded">Signals & Baseline</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <button onClick={() => handleLoadSample('ai')} className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded hover:bg-purple-500/30">Load AI</button>
                        <button onClick={() => handleLoadSample('human')} className="px-2 py-1 bg-green-500/20 text-green-300 rounded hover:bg-green-500/30">Load Human</button>
                        <button onClick={() => {
                            if (textIndex && textIndex[0]) {
                                const allRects = textIndex[0].items.map((i: any) => ({ x: i.x, y: i.y, w: i.w, h: i.h }));
                                setActiveAIHighlight({ pageIndex: 0, rects: allRects });
                            }
                        }} className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30">Show Text Box (P1)</button>
                    </div>
                </div>
            )}

            {status === 'idle' ? (
                <div className="space-y-4">
                    <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100/50">
                        <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                            <Zap size={16} className="text-blue-600" /> Quick Scan
                        </h4>
                        <p className="text-[11px] text-gray-500 leading-relaxed mb-6">
                            Analyze linguistic signals (repetition, variance) locally in your browser.
                        </p>
                        <GlassButton onClick={handleRunQuickScan} disabled={!file} className="w-full !py-3 bg-blue-600 text-white hover:!bg-blue-700 font-black uppercase tracking-widest text-[10px] disabled:opacity-50">
                            Generate Signal Report
                        </GlassButton>
                    </div>

                    <div className="p-6 bg-purple-50/50 rounded-3xl border border-purple-100/50">
                        <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                            <Target size={16} className="text-purple-600" /> Deep Analysis
                        </h4>
                        <p className="text-[11px] text-gray-500 leading-relaxed mb-6">
                            Send redacted text to LLM for qualitative stylistic analysis.
                        </p>
                        <div className="space-y-4 mb-6">
                            <div className="grid grid-cols-2 gap-2">
                                {(Object.keys(redactionSettings) as string[]).map(key => (
                                    <label key={key} className="flex items-center gap-2 p-2 bg-white rounded-xl border border-black/5 cursor-pointer hover:border-purple-200 transition-colors">
                                        <input type="checkbox" checked={redactionSettings[key as keyof typeof redactionSettings]} onChange={(e) => setRedactionSettings({ ...redactionSettings, [key]: e.target.checked })} className="rounded border-gray-300 text-purple-600" />
                                        <span className="text-[9px] font-bold text-gray-600 uppercase">Mask {key}</span>
                                    </label>
                                ))}
                            </div>
                            <label className="flex gap-3 items-start cursor-pointer group bg-purple-100/30 p-3 rounded-xl border border-purple-200/50">
                                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 rounded border-gray-300 text-purple-600" />
                                <p className="text-[10px] text-purple-800 font-medium leading-tight">I consent to sending redacted text for analysis.</p>
                            </label>
                        </div>
                        <GlassButton disabled={!consent || !file} onClick={handleRunDeepCheck} className="w-full !py-3 bg-purple-600 text-white hover:!bg-purple-700 font-black uppercase tracking-widest text-[10px] disabled:opacity-50">
                            Run Deep Analysis
                        </GlassButton>
                    </div>

                    {/* BASELINE INPUT TOGGLE */}
                    <div className="pt-2 border-t border-gray-100">
                        <button onClick={() => setShowBaselineInput(!showBaselineInput)} className="w-full flex justify-between items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-blue-600 transition-colors bg-white p-3 rounded-xl border border-gray-100 hover:border-blue-200">
                            <span className="flex items-center gap-2"><UserCheck size={14} /> Compare against baseline</span>
                            <ChevronRight size={14} className={clsx("transition-transform", showBaselineInput ? "rotate-90" : "")} />
                        </button>

                        {showBaselineInput && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 space-y-2">
                                <p className="text-[10px] text-gray-400">Paste a known human sample (e.g., previous email) to verify consistency.</p>
                                <textarea
                                    className="w-full h-24 p-2 text-[10px] rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-500 transition-all resize-none font-mono"
                                    placeholder="Paste known author text here..."
                                    value={baselineText}
                                    onChange={(e) => setBaselineText(e.target.value)}
                                />
                            </motion.div>
                        )}
                    </div>
                </div>
            ) : status === 'completed' ? (
                <div className="space-y-6">
                    {/* RISK CARD */}
                    <div className="relative overflow-hidden rounded-3xl bg-white border border-gray-100 shadow-xl shadow-gray-200/50">
                        <div className={clsx("absolute top-0 left-0 w-full h-2", getRiskColor(aiCheckResults.riskBand || 'Low'))} />
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Risk Assessment</div>
                                    <div className={clsx("text-3xl font-black tracking-tighter", getRiskTextColor(aiCheckResults.riskBand || 'Low'))}>
                                        {aiCheckResults.riskBand || 'Low'} Risk
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1">Confidence</div>
                                    <div className="px-2 py-1 bg-gray-100 rounded-lg text-[10px] font-black uppercase text-gray-600 inline-block">
                                        {aiCheckResults.confidence || 'N/A'}
                                    </div>
                                </div>
                            </div>

                            {/* AI Index (Secondary) */}
                            <div className="flex items-center gap-2 mb-4 opacity-50">
                                <div className="text-[9px] font-mono text-gray-400">AI-Likeness Index: {aiCheckResults.score}/100</div>
                            </div>

                            {aiCheckResults.notes && (
                                <div className="p-3 bg-blue-50 rounded-xl text-[11px] text-blue-800 leading-relaxed border border-blue-100 italic">
                                    &ldquo;{aiCheckResults.notes}&rdquo;
                                </div>
                            )}
                        </div>
                    </div>

                    {/* BASELINE COMPARISON (if available) */}
                    {aiCheckResults.baselineComparison && (
                        <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100 flex flex-col gap-3">
                            <div className="flex justify-between items-center">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-800 flex items-center gap-2">
                                    <UserCheck size={14} /> Author Baseline Match
                                </h4>
                                <span className={clsx("px-2 py-1 rounded-md text-[9px] font-black uppercase text-white shadow-sm",
                                    aiCheckResults.baselineComparison.verdict === 'High' ? 'bg-indigo-500' :
                                        aiCheckResults.baselineComparison.verdict === 'Medium' ? 'bg-indigo-400' : 'bg-indigo-300'
                                )}>
                                    {aiCheckResults.baselineComparison.verdict} Match
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="p-2 bg-white rounded-xl border border-indigo-50 text-center">
                                    <div className="text-[8px] text-gray-400 uppercase mb-1">Vocabulary</div>
                                    <div className="text-sm font-black text-indigo-900">{aiCheckResults.baselineComparison.metrics.vocabOverlap}%</div>
                                </div>
                                <div className="p-2 bg-white rounded-xl border border-indigo-50 text-center">
                                    <div className="text-[8px] text-gray-400 uppercase mb-1">Structure</div>
                                    <div className="text-sm font-black text-indigo-900">{aiCheckResults.baselineComparison.metrics.sentenceMatch}%</div>
                                </div>
                                <div className="p-2 bg-white rounded-xl border border-indigo-50 text-center">
                                    <div className="text-[8px] text-gray-400 uppercase mb-1">Tone</div>
                                    <div className="text-sm font-black text-indigo-900">{aiCheckResults.baselineComparison.metrics.toneMatch}%</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SIGNAL GAUGES */}
                    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
                        <h3 className="text-[11px] font-black text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Target size={14} className="text-gray-400" /> Signal Profile
                        </h3>
                        <div className="space-y-3">
                            {[
                                { l: 'Genericness / Vagueness', v: aiCheckResults.signalsSummary?.genericness },
                                { l: 'Burstiness (Structure Uniformity)', v: aiCheckResults.signalsSummary?.burstiness || aiCheckResults.signalsSummary?.averageBurstiness },
                                { l: 'Lexical Diversity (Repetition)', v: aiCheckResults.signalsSummary?.lexicalDiversity || aiCheckResults.signalsSummary?.averageTTR },
                                { l: 'Transition Word Overuse', v: aiCheckResults.signalsSummary?.transitions || aiCheckResults.signalsSummary?.averageTransitions },
                            ].map((s, i) => (
                                <div key={i} className="flex flex-col gap-1">
                                    <div className="flex justify-between text-[9px] font-bold text-gray-500 uppercase">
                                        <span>{s.l}</span>
                                        <span>{s.v || 0}/100</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={clsx("h-full rounded-full transition-all duration-1000", getScoreBg(s.v || 0).replace('/10', ''))}
                                            style={{ width: `${Math.min(100, s.v || 0)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* EVIDENCE SECTION */}
                    <div>
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 px-1">Evidence & Highlights</h3>

                        {/* FLAGGED (Risk Factors) */}
                        {aiCheckResults.flagged?.length > 0 && (
                            <div className="space-y-3 mb-6">
                                <div className="text-[9px] font-bold text-red-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <AlertTriangle size={12} /> Risk Factors (AI-Like)
                                </div>
                                {aiCheckResults.flagged.map((item: any, i: number) => (
                                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} key={`flag-${i}`} onClick={() => handleJump(item)} className="p-4 bg-red-50/50 hover:bg-red-50 rounded-2xl border border-red-100 cursor-pointer transition-colors group">
                                        <div className="flex justify-between mb-2">
                                            <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[8px] font-black uppercase">P{item.pageIndex + 1}</span>
                                            {item.score && <span className="text-[9px] font-black text-red-400">{item.score}% Match</span>}
                                        </div>
                                        <p className="text-[11px] text-gray-700 italic leading-snug mb-2 border-l-2 border-red-200 pl-2">
                                            &ldquo;{item.excerpt}&rdquo;
                                        </p>
                                        <div className="flex flex-wrap gap-1">
                                            {item.reasons?.map((r: string, idx: number) => (
                                                <span key={idx} className="text-[8px] font-bold text-red-500 uppercase bg-white border border-red-100 px-1.5 py-0.5 rounded">{r}</span>
                                            ))}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}

                        {/* COUNTER-EVIDENCE (Human-Like) */}
                        {aiCheckResults.counterEvidence?.length > 0 && (
                            <div className="space-y-3">
                                <div className="text-[9px] font-bold text-green-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <ShieldCheck size={12} /> Human-Like Signals
                                </div>
                                {aiCheckResults.counterEvidence.map((item: any, i: number) => (
                                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} key={`counter-${i}`} onClick={() => handleJump(item)} className="p-4 bg-green-50/50 hover:bg-green-50 rounded-2xl border border-green-100 cursor-pointer transition-colors">
                                        <div className="flex justify-between mb-2">
                                            <span className="px-1.5 py-0.5 bg-green-100 text-green-600 rounded text-[8px] font-black uppercase">P{item.pageIndex + 1}</span>
                                        </div>
                                        <p className="text-[11px] text-gray-700 italic leading-snug mb-2 border-l-2 border-green-200 pl-2">
                                            &ldquo;{item.excerpt}&rdquo;
                                        </p>
                                        <div className="flex flex-wrap gap-1">
                                            {item.reasons?.map((r: string, idx: number) => (
                                                <span key={idx} className="text-[8px] font-bold text-green-500 uppercase bg-white border border-green-100 px-1.5 py-0.5 rounded">{r}</span>
                                            ))}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}

                        {(!aiCheckResults.flagged?.length && !aiCheckResults.counterEvidence?.length) && (
                            <div className="p-8 text-center border-2 border-dashed border-gray-100 rounded-3xl">
                                <p className="text-[10px] text-gray-400 font-medium">No strong signals detected.</p>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <GlassButton onClick={handleDownload} className="flex-1 gap-2 !py-3 !bg-white border border-black/5">
                            <FileJson size={14} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Export Report</span>
                        </GlassButton>
                        <GlassButton onClick={() => setAiCheckResults(null)} className="!p-3 !bg-red-50 !text-red-500 active:scale-95 border border-red-100">
                            <Trash2 size={14} />
                        </GlassButton>
                    </div>

                    {/* DEV DEBUG (BOTTOM, COLLAPSED) */}
                    {process.env.NODE_ENV === 'development' && (
                        <details className="mt-8 p-2 bg-black/5 rounded-lg border border-black/5 opacity-50 hover:opacity-100 transition-opacity">
                            <summary className="text-[9px] font-black uppercase tracking-widest text-gray-500 cursor-pointer select-none">Raw Debug Info</summary>
                            <div className="mt-2 text-[9px] font-mono text-gray-500 break-all p-2 bg-white rounded">
                                {JSON.stringify(aiCheckResults.debug || {}, null, 2)}
                            </div>
                        </details>
                    )}
                </div>
            ) : (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                    <div className="relative mb-6">
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="text-blue-600">
                            <Loader2 size={48} strokeWidth={1.5} />
                        </motion.div>
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-blue-600">{extractProgress}%</div>
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 mb-1 uppercase tracking-tight">Analyzing Signals</h3>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-8">Processing...</p>
                    <GlassButton onClick={handleStop} className="!px-6 !py-2 bg-red-50 text-red-600 border border-red-100"><span className="text-[10px] font-black uppercase tracking-widest">Cancel</span></GlassButton>
                </div>
            )}
        </div>
    );
}
