/**
 * Local heuristic-based AI content scoring.
 */

interface TextChunk {
    pageIndex: number;
    chunkId: string;
    text: string;
}

export interface QuickScanResult {
    mode: 'quick';
    score: number; // AI-likeness index (0-100)
    riskBand: 'Low' | 'Medium' | 'High' | 'Very High';
    confidence: 'Low' | 'Medium' | 'High';
    pages: { pageIndex: number; score: number }[];
    flagged: {
        pageIndex: number;
        chunkId: string;
        excerpt: string;
        score: number;
        reasons: string[];
    }[];
    counterEvidence: {
        pageIndex: number;
        chunkId: string;
        excerpt: string;
        score: number;
        reasons: string[];
    }[];
    signalsSummary: {
        burstiness: number;
        lexicalDiversity: number;
        repetition: number;
        transitions: number;
        punctuation: number;
        genericness: number;
    };
}

// --- HEURISTIC FUNCTIONS ---

function calculateTTR(text: string): number {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    if (words.length === 0) return 1;
    const uniqueWords = new Set(words);
    return uniqueWords.size / words.length;
}

function calculateRepetition(text: string): number {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    if (words.length < 4) return 0;
    const grams = new Set();
    let repeated = 0;
    const totalGrams = words.length - 2;
    for (let i = 0; i < totalGrams; i++) {
        const gram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
        if (grams.has(gram)) repeated++;
        grams.add(gram);
    }
    return repeated / totalGrams;
}

function calculateBurstinessScore(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length < 3) return 50;
    const lengths = sentences.map(s => s.trim().split(/\s+/).length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / lengths.length;
    const stdDev = Math.sqrt(variance);
    // Low SD = High AI Likeness
    return Math.max(0, 100 - (stdDev * 8));
}

function calculateTransitions(text: string): number {
    const aitransitions = [
        "furthermore", "moreover", "additionally", "in conclusion", "consequently",
        "it is important to note", "on the other hand", "to summarize", "in summary",
        "firstly", "lastly", "significantly", "therefore", "thus", "specifically"
    ];
    const lower = text.toLowerCase();
    let count = 0;
    aitransitions.forEach(t => { if (lower.includes(t)) count++; });
    const wordCount = text.split(/\s+/).length;
    return Math.min(100, (count / wordCount) * 100 * 50);
}

function calculatePunctuationProfile(text: string): number {
    const commas = (text.match(/,/g) || []).length;
    const sentences = (text.match(/[.!?]/g) || []).length || 1;
    const ratio = commas / sentences;
    if (ratio > 1.2 && ratio < 2.5) return 60;
    return 20;
}

function calculateGenericness(text: string): number {
    const vagueness = [
        "landscape", "tapestry", "delve", "realm", "underscores", "complex", "multifaceted",
        "crucial", "pivotal", "transformative", "nuanced", "comprehensive", "utilize",
        "leverage", "paradigm", "synergy", "holistic", "framework", "dynamic"
    ];
    const lower = text.toLowerCase();
    let count = 0;
    vagueness.forEach(t => { if (lower.includes(t)) count++; });
    const wordCount = text.split(/\s+/).length;
    // >2 vague words per 100 words is high genericness
    return Math.min(100, (count / wordCount) * 100 * 50);
}

// --- MAIN RUNNER ---

export function runQuickScan(chunks: TextChunk[]): QuickScanResult {
    const pageScores: Map<number, number[]> = new Map();
    const flaggedChunks: QuickScanResult['flagged'] = [];
    const counterChunks: QuickScanResult['counterEvidence'] = [];

    // Accumulators for averages
    let agg = { burst: 0, ttr: 0, rep: 0, trans: 0, punc: 0, gen: 0 };

    chunks.forEach(chunk => {
        // 1. Calculate Signals
        const s = {
            burst: calculateBurstinessScore(chunk.text),
            ttr: Math.max(0, (0.55 - calculateTTR(chunk.text)) * 200),
            rep: Math.min(100, calculateRepetition(chunk.text) * 500),
            trans: calculateTransitions(chunk.text),
            punc: calculatePunctuationProfile(chunk.text),
            gen: calculateGenericness(chunk.text)
        };

        // Accumulate
        agg.burst += s.burst; agg.ttr += s.ttr; agg.rep += s.rep;
        agg.trans += s.trans; agg.punc += s.punc; agg.gen += s.gen;

        // 2. Weighted Score (AI-Index)
        const score = (s.burst * 0.35) + (s.ttr * 0.15) + (s.rep * 0.15) + (s.trans * 0.15) + (s.gen * 0.15) + (s.punc * 0.05);

        if (!pageScores.has(chunk.pageIndex)) pageScores.set(chunk.pageIndex, []);
        pageScores.get(chunk.pageIndex)!.push(score);

        // 3. Identification
        const excerpt = chunk.text.substring(0, 150) + '...';

        // Flag as Evidence (High AI score)
        if (score > 60) {
            const reasons = [];
            if (s.burst > 70) reasons.push("Uniform sentence length");
            if (s.gen > 60) reasons.push("Generic/Vague phrasing");
            if (s.rep > 50) reasons.push("Repetitive structure");
            if (s.trans > 60) reasons.push("Transition overuse");
            if (s.ttr > 60) reasons.push("Low vocabulary variety");

            flaggedChunks.push({
                pageIndex: chunk.pageIndex,
                chunkId: chunk.chunkId,
                score: Math.round(score),
                excerpt,
                reasons
            });
        }
        // Flag as Counter-Evidence (Very Human-like: Low AI score)
        else if (score < 30) {
            const reasons = [];
            if (s.burst < 20) reasons.push("High burstiness (Varied Pacing)");
            if (s.ttr < 20) reasons.push("Rich vocabulary");
            if (s.gen < 20) reasons.push("Specific/Concrete language");

            counterChunks.push({
                pageIndex: chunk.pageIndex,
                chunkId: chunk.chunkId,
                score: Math.round(score), // Low score = Human
                excerpt,
                reasons
            });
        }
    });

    // 4. Aggregation
    const count = chunks.length || 1;
    const summary = {
        burstiness: Math.round(agg.burst / count),
        lexicalDiversity: Math.round(agg.ttr / count),
        repetition: Math.round(agg.rep / count),
        transitions: Math.round(agg.trans / count),
        punctuation: Math.round(agg.punc / count),
        genericness: Math.round(agg.gen / count)
    };

    const overallScore = Math.round(
        (summary.burstiness * 0.35) + (summary.lexicalDiversity * 0.15) +
        (summary.repetition * 0.15) + (summary.transitions * 0.15) +
        (summary.genericness * 0.15) + (summary.punctuation * 0.05)
    );

    // 5. Risk Band & Confidence
    let riskBand: QuickScanResult['riskBand'] = 'Low';
    if (overallScore > 80) riskBand = 'Very High';
    else if (overallScore > 60) riskBand = 'High';
    else if (overallScore > 35) riskBand = 'Medium';

    // Confidence: Variance between signals. 
    // If all signals roughly agree (standard deviation of signals is low), confidence is high.
    // If signals diverge widely (e.g. High Burst but Low Genericness), confidence is lower.
    const signals = [summary.burstiness, summary.lexicalDiversity, summary.repetition, summary.transitions, summary.genericness];
    const meanSig = signals.reduce((a, b) => a + b, 0) / signals.length;
    const varSig = signals.reduce((a, b) => a + Math.pow(b - meanSig, 2), 0) / signals.length;
    const sdSig = Math.sqrt(varSig);

    let confidence: QuickScanResult['confidence'] = 'High';
    if (sdSig > 25) confidence = 'Low'; // Signals disagree significantly
    else if (sdSig > 15) confidence = 'Medium';

    // Page scores
    const pages = Array.from(pageScores.entries()).map(([p, s]) => ({
        pageIndex: p,
        score: Math.round(s.reduce((a, b) => a + b, 0) / s.length)
    }));

    return {
        mode: 'quick',
        score: overallScore, // AI Index
        riskBand,
        confidence,
        pages,
        flagged: flaggedChunks.sort((a, b) => b.score - a.score).slice(0, 5),
        counterEvidence: counterChunks.sort((a, b) => a.score - b.score).slice(0, 5), // sort by lowest score (most human)
        signalsSummary: summary
    };
}

/**
 * Compares target text against a human baseline.
 * Returns similarity metrics (0-100).
 */
export function calculateBaselineSimilarity(target: string, baseline: string): {
    overallMatch: number;
    metrics: { vocabOverlap: number; sentenceMatch: number; toneMatch: number };
    verdict: 'Low' | 'Medium' | 'High';
} {
    // 1. Vocabulary Overlap (Jaccard)
    const getWords = (t: string) => new Set(t.toLowerCase().match(/\b\w+\b/g) || []);
    const targetWords = getWords(target);
    const baselineWords = getWords(baseline);

    // Intersection
    let intersection = 0;
    targetWords.forEach(w => { if (baselineWords.has(w)) intersection++; });
    const union = new Set([...targetWords, ...baselineWords]).size;
    const vocabOverlap = union === 0 ? 0 : (intersection / union) * 100;

    // 2. Sentence Structure (Avg Length comparison)
    const getAvgLen = (t: string) => {
        const s = t.split(/[.!?]+/).filter(x => x.trim().length > 0);
        const lens = s.map(x => x.trim().split(/\s+/).length);
        return lens.reduce((a, b) => a + b, 0) / (lens.length || 1);
    };
    const targetLen = getAvgLen(target);
    const baselineLen = getAvgLen(baseline);
    // Similarity: 100 - difference percentage (capped)
    const diff = Math.abs(targetLen - baselineLen);
    const sentenceMatch = Math.max(0, 100 - (diff * 5)); // e.g., 5 words difference = 75% match

    // 3. Tone/Stylistic Markers (Simple punctuation density comparison)
    // Reuse PunctuationProfile logic slightly modified 
    const getPuncDensity = (t: string) => (t.match(/[^\w\s]/g) || []).length / (t.length || 1);
    const tPunc = getPuncDensity(target);
    const bPunc = getPuncDensity(baseline);
    const toneMatch = Math.max(0, 100 - (Math.abs(tPunc - bPunc) * 1000)); // *1000 because density is small (0.0x)

    // Weighted Average (Vocab is strongest indicator of authorship usually)
    const overall = (vocabOverlap * 0.5) + (sentenceMatch * 0.3) + (toneMatch * 0.2);

    let verdict: 'Low' | 'Medium' | 'High' = 'Low';
    if (overall > 60) verdict = 'High';
    else if (overall > 30) verdict = 'Medium';

    return {
        overallMatch: Math.round(overall),
        metrics: {
            vocabOverlap: Math.round(vocabOverlap),
            sentenceMatch: Math.round(sentenceMatch),
            toneMatch: Math.round(toneMatch)
        },
        verdict
    };
}
