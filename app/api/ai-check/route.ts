
import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

/**
 * AI Checker API Route (Deep Check)
 * ANALYSIS ENGINE v3: "Writing Signals Report"
 * Focuses on explaining qualitative signals rather than binary detection.
 */

export async function POST(req: NextRequest) {
    try {
        const { chunks, redactionSettings } = await req.json();

        // 1. Validation
        if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        if (!process.env.GROQ_API_KEY) {
            return NextResponse.json({ error: 'API Key missing.' }, { status: 503 });
        }

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

        // 2. Select Chunks (up to 20)
        const chunksToAnalyze = chunks.length > 20
            ? [...chunks.slice(0, 10), ...chunks.slice(-10)]
            : chunks;

        const batchContent = chunksToAnalyze.map((c: any) => {
            let text = c.text;
            if (redactionSettings?.emails) text = text.replace(/\S+@\S+\.\S+/g, '[EMAIL]');
            if (redactionSettings?.phones) text = text.replace(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE]');
            return `### CHUNK (Page: ${c.pageIndex}, ID: ${c.chunkId})\n"${text.substring(0, 1500)}..."`;
        }).join('\n\n');

        // 3. New "Analyst" Prompt
        const SYSTEM_PROMPT = `
You are an expert Writing Style Analyst. Your job is NOT to "catch" AI, but to explain linguistic patterns to a human reviewer.

Analyze the provided text for specific signals often associated with LLMs (e.g., GPT-4, Llama):
1. **Genericness:** Overuse of vague, "safe", corporate-sounding moralizations or summaries.
2. **Structure:** Highly uniform sentence lengths, perfectly balanced paragraphs (Burstiness).
3. **Transitions:** Robotic use of "Furthermore", "In conclusion", "It is important to note".
4. **Depth:** Surface-level analysis masking as deep insight.

### OUTPUT REQUIREMENTS
Return a STRICT JSON object representing a "Risk Report".

Schema:
{
  "riskBand": "Low" | "Medium" | "High" | "Very High",
  "confidence": "Low" | "Medium" | "High", // How consistent are the signals?
  "score": number, // 0-100 "AI-Likeness Index" (Secondary metric)
  "signals": {
    "burstiness": number, // 0 (Varied/Human) - 100 (Uniform/AI)
    "lexicalDiversity": number, // 0 (Rich) - 100 (Repetitive)
    "repetition": number, // 0 (None) - 100 (High)
    "transitions": number, // 0 (Natural) - 100 (Robotic overuse)
    "genericness": number // 0 (Specific) - 100 (Vague/Template-like)
  },
  "flagged": [ // Top 3-5 chunks that look MOST AI-like
    { "chunkId": "string", "score": number, "reasons": ["string"], "excerpt": "string" }
  ],
  "counterEvidence": [ // Top 3-5 chunks that look MOST HUMAN (varied, specific, idiomatic)
    { "chunkId": "string", "score": number, "reasons": ["string"], "excerpt": "string" }
  ],
  "notes": "Brief summary for a human reviewer (max 2 sentences)."
}

### IMPORTANT
- If the text looks human, cite "Varied sentence structure" or "Specific personal details" as counter-evidence.
- "Confidence" should be LOW if the text is too short or mixed.
`;

        try {
            const completion = await groq.chat.completions.create({
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: `Analyze these chunks:\n${batchContent}` }
                ],
                model: 'llama-3.1-8b-instant',
                temperature: 0,
                response_format: { type: 'json_object' }
            });

            const content = completion.choices[0]?.message?.content;
            if (!content) throw new Error("No content from LLM");
            const result = JSON.parse(content);

            // Remap chunk IDs to Page Indices for UI
            const remap = (list: any[]) => list?.map((item: any) => {
                const original = chunksToAnalyze.find((c: any) => c.chunkId === item.chunkId);
                return {
                    ...item,
                    pageIndex: original ? original.pageIndex : 0,
                    score: Math.min(100, Math.max(0, item.score || 0)) // clamp
                };
            }) || [];

            const flagged = remap(result.flagged);
            const counterEvidence = remap(result.counterEvidence);

            return NextResponse.json({
                mode: 'deep',
                riskBand: result.riskBand || 'Low',
                confidence: result.confidence || 'Low',
                score: result.score || 0,
                signalsSummary: result.signals || { burstiness: 0, lexicalDiversity: 0, repetition: 0, transitions: 0, genericness: 0 },
                flagged,
                counterEvidence,
                notes: result.notes || "Analysis complete.",
                analysisTime: Date.now(),
                debug: {
                    chunkCount: chunksToAnalyze.length,
                    model: 'llama-3.1-8b-instant'
                }
            });

        } catch (err: any) {
            console.error("Deep Check Logic Error:", err);
            return NextResponse.json({ error: 'Deep Analysis Failed', details: err.message }, { status: 500 });
        }

    } catch (e: any) {
        console.error('Handler Error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
