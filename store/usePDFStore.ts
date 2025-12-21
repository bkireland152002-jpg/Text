import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Annotation, ToolType, PDFPageInfo, AICheckResult, RedactionSettings } from '@/types';

interface PDFState {
    file: File | null;
    numPages: number;
    scale: number;
    tool: ToolType;
    selectedAnnotation: string | null;
    annotations: Record<number, Annotation[]>;
    pageInfo: Record<number, PDFPageInfo>;
    aiCheckResults: AICheckResult | null;
    redactionSettings: RedactionSettings;
    sidebarTab: 'history' | 'ai-checker';
    activeAIHighlight: { pageIndex: number; rects: { x: number, y: number, w: number, h: number }[] } | null;

    // Actions
    setFile: (file: File) => void;
    setNumPages: (num: number) => void;
    setScale: (scale: number) => void;
    setTool: (tool: ToolType) => void;
    addAnnotation: (annotation: Annotation) => void;
    updateAnnotation: (id: string, updates: Partial<Annotation>, saveHistory?: boolean) => void;
    deleteAnnotation: (id: string) => void;
    setPageInfo: (index: number, info: PDFPageInfo) => void;
    setAiCheckResults: (results: AICheckResult | null) => void;
    updateAiCheckStatus: (status: AICheckResult['status'], mode?: AICheckResult['mode']) => void;
    setRedactionSettings: (settings: RedactionSettings) => void;
    setSidebarTab: (tab: 'history' | 'ai-checker') => void;
    setActiveAIHighlight: (highlight: PDFState['activeAIHighlight']) => void;

    // Image Upload State
    pendingImage: string | null;
    setPendingImage: (image: string | null) => void;

    // Jump/Highlight State for scroll and pulse
    jumpState: { id: string; timestamp: number } | null;
    jumpToAnnotation: (id: string) => void;

    // History State
    history: HistoryEntry[];
    redoStack: HistoryEntry[];

    // Actions
    undo: () => void;
    redo: () => void;
}

export interface HistoryEntry {
    action: 'Add' | 'Edit' | 'Delete';
    annotationId: string;
    description: string;
    timestamp: number;
    before?: Annotation;
    after?: Annotation;
}


export const usePDFStore = create<PDFState>()(
    persist(
        (set) => ({
            file: null,
            numPages: 0,
            scale: 1.0,
            tool: 'select',
            selectedAnnotation: null,
            annotations: {},
            pageInfo: {},
            aiCheckResults: null,
            redactionSettings: {
                emails: true,
                phones: true,
                urls: true,
                numbers: true
            },
            sidebarTab: 'history',
            activeAIHighlight: null,
            pendingImage: null,
            jumpState: null,
            history: [],
            redoStack: [],

            setFile: (file) => set({ file, numPages: 0, annotations: {}, history: [], redoStack: [], aiCheckResults: null }),
            setNumPages: (num) => set({ numPages: num }),
            setScale: (scale) => set({ scale }),
            setTool: (tool) => set({ tool, selectedAnnotation: null }),
            setPendingImage: (image) => set({ pendingImage: image }),

            addAnnotation: (annotation) => set((state) => {
                const pageAnns = state.annotations[annotation.pageIndex] || [];
                const description = (annotation.text)
                    ? `Added "${annotation.text.substring(0, 20)}${annotation.text.length > 20 ? '...' : ''}"`
                    : `Added ${annotation.type}`;

                const finalAnnotation = {
                    padding: 5,
                    backgroundOpacity: 1,
                    borderRadius: 0,
                    ...annotation
                };

                const newHistoryItem: HistoryEntry = {
                    action: 'Add',
                    annotationId: annotation.id,
                    timestamp: Date.now(),
                    description: description,
                    after: finalAnnotation
                };

                return {
                    annotations: {
                        ...state.annotations,
                        [annotation.pageIndex]: [...pageAnns, finalAnnotation]
                    },
                    history: [newHistoryItem, ...state.history],
                    redoStack: []
                };
            }),

            updateAnnotation: (id, updates, saveHistory = true) => set((state) => {
                const newAnnotations = { ...state.annotations };
                let oldAnn: Annotation | undefined;
                let type = 'Unknown';

                for (const pageIndex in state.annotations) {
                    oldAnn = state.annotations[pageIndex].find(a => a.id === id);
                    if (oldAnn) break;
                }

                if (!oldAnn) return { annotations: newAnnotations };

                for (const pageIndex in newAnnotations) {
                    newAnnotations[pageIndex] = newAnnotations[pageIndex].map(ann => {
                        if (ann.id === id) {
                            type = ann.type;
                            return { ...ann, ...updates };
                        }
                        return ann;
                    });
                }

                if (saveHistory) {
                    let updatedAnn: Annotation | undefined;
                    for (const p in newAnnotations) {
                        updatedAnn = newAnnotations[p].find(a => a.id === id);
                        if (updatedAnn) break;
                    }

                    let description = `Edited ${type}`;
                    if (updatedAnn?.text) {
                        description = `Edited "${updatedAnn.text.substring(0, 20)}${updatedAnn.text.length > 20 ? '...' : ''}"`;
                    }

                    const lastEntry = state.history[0];
                    const isRapidEdit = lastEntry && lastEntry.action === 'Edit' && lastEntry.annotationId === id && (Date.now() - lastEntry.timestamp < 2000);

                    if (isRapidEdit) {
                        const newHistory = [...state.history];
                        newHistory[0] = {
                            ...lastEntry,
                            description: description,
                            timestamp: Date.now(),
                            after: updatedAnn
                        };
                        return {
                            annotations: newAnnotations,
                            history: newHistory
                        };
                    }

                    const newHistoryItem: HistoryEntry = {
                        action: 'Edit',
                        annotationId: id,
                        timestamp: Date.now(),
                        description: description,
                        before: oldAnn,
                        after: updatedAnn
                    };

                    return {
                        annotations: newAnnotations,
                        history: [newHistoryItem, ...state.history],
                        redoStack: []
                    };
                }

                return { annotations: newAnnotations };
            }),

            deleteAnnotation: (id) => set((state) => {
                let oldAnn: Annotation | undefined;
                for (const pageIndex in state.annotations) {
                    oldAnn = state.annotations[pageIndex].find(a => a.id === id);
                    if (oldAnn) break;
                }

                if (!oldAnn) return state;

                const newAnnotations = { ...state.annotations };
                for (const pageIndex in newAnnotations) {
                    newAnnotations[pageIndex] = newAnnotations[pageIndex].filter(ann => ann.id !== id);
                }

                const newHistoryItem: HistoryEntry = {
                    action: 'Delete',
                    annotationId: id,
                    timestamp: Date.now(),
                    description: `Deleted ${oldAnn.type}`,
                    before: oldAnn
                };

                return {
                    annotations: newAnnotations,
                    history: [newHistoryItem, ...state.history],
                    redoStack: []
                };
            }),

            undo: () => set((state) => {
                if (state.history.length === 0) return state;

                const [entry, ...remainingHistory] = state.history;
                const newAnnotations = { ...state.annotations };

                if (entry.action === 'Add') {
                    const ann = entry.after!;
                    newAnnotations[ann.pageIndex] = newAnnotations[ann.pageIndex].filter(a => a.id !== ann.id);
                } else if (entry.action === 'Delete') {
                    const ann = entry.before!;
                    newAnnotations[ann.pageIndex] = [...(newAnnotations[ann.pageIndex] || []), ann];
                } else if (entry.action === 'Edit') {
                    const ann = entry.before!;
                    newAnnotations[ann.pageIndex] = newAnnotations[ann.pageIndex].map(a => a.id === ann.id ? ann : a);
                }

                return {
                    annotations: newAnnotations,
                    history: remainingHistory,
                    redoStack: [entry, ...state.redoStack],
                    selectedAnnotation: null
                };
            }),

            redo: () => set((state) => {
                if (state.redoStack.length === 0) return state;

                const [entry, ...remainingRedo] = state.redoStack;
                const newAnnotations = { ...state.annotations };

                if (entry.action === 'Add') {
                    const ann = entry.after!;
                    newAnnotations[ann.pageIndex] = [...(newAnnotations[ann.pageIndex] || []), ann];
                } else if (entry.action === 'Delete') {
                    const ann = entry.before!;
                    newAnnotations[ann.pageIndex] = newAnnotations[ann.pageIndex].filter(a => a.id !== ann.id);
                } else if (entry.action === 'Edit') {
                    const ann = entry.after!;
                    newAnnotations[ann.pageIndex] = newAnnotations[ann.pageIndex].map(a => a.id === ann.id ? ann : a);
                }

                return {
                    annotations: newAnnotations,
                    history: [entry, ...state.history],
                    redoStack: remainingRedo,
                    selectedAnnotation: entry.annotationId
                };
            }),

            jumpToAnnotation: (id: string) => set({
                selectedAnnotation: id,
                jumpState: { id, timestamp: Date.now() },
                tool: 'select'
            }),

            setPageInfo: (index, info) => set(state => ({
                pageInfo: { ...state.pageInfo, [index]: info }
            })),
            setAiCheckResults: (results) => set({ aiCheckResults: results }),
            setRedactionSettings: (redactionSettings) => set({ redactionSettings }),
            setSidebarTab: (sidebarTab) => set({ sidebarTab }),
            updateAiCheckStatus: (status, mode = 'quick') => set(state => ({
                aiCheckResults: state.aiCheckResults ? { ...state.aiCheckResults, status } : {
                    overallScore: 0,
                    analysisTime: Date.now(),
                    status,
                    mode,
                    pages: [],
                    flagged: []
                }
            })),
            setActiveAIHighlight: (highlight) => set({ activeAIHighlight: highlight }),
        }),
        {
            name: 'pdf-editor-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                annotations: state.annotations,
                history: state.history,
                aiCheckResults: state.aiCheckResults,
                redactionSettings: state.redactionSettings,
                sidebarTab: state.sidebarTab
            }),
        }
    )
);

