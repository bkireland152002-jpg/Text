export interface Point {
    x: number; // 0..1 relative to page width
    y: number; // 0..1 relative to page height
}

export type ToolType = 'select' | 'pen' | 'highlight' | 'text' | 'eraser' | 'whiteout' | 'image';

export interface Annotation {
    id: string;
    type: 'pen' | 'highlight' | 'text' | 'whiteout' | 'text-edit' | 'image';
    pageIndex: number;

    // For Pen
    path?: Point[];
    lineWidth?: number;

    // For Highlight / Text
    rect?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };

    // For Text
    text?: string;
    fontSize?: number;
    fontWeight?: string;

    // For Image
    image?: string; // Base64 data URL
    rotation?: number; // In degrees

    color: string;
    opacity?: number;

    // Background styling
    padding?: number;
    backgroundOpacity?: number;
    borderRadius?: number;
}

export interface RedactionSettings {
    emails: boolean;
    phones: boolean;
    urls: boolean;
    numbers: boolean;
}

export interface AICheckResult {
    overallScore: number;
    analysisTime: number;
    status: 'idle' | 'extracting' | 'scanning' | 'analyzing' | 'completed' | 'error';
    mode: 'quick' | 'deep';
    pages: {
        pageIndex: number;
        score: number;
    }[];
    flagged: {
        pageIndex: number;
        chunkId: string;
        excerpt: string;
        score: number;
        reasons: string[];
        rect?: { x: number, y: number, w: number, h: number };
    }[];
    notes?: string;
    signalsSummary?: any;
}

export interface PDFPageInfo {
    index: number;
    width: number;
    height: number;
}
