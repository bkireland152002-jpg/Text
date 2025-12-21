
import Groq from 'groq-sdk';
import path from 'path';
import fs from 'fs';

// Load .env.local manually without dotenv
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    console.log(`Loading env from ${envPath}`);
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["']|["']$/g, '');
            process.env[key] = value;
        }
    });
} else {
    console.error("No .env.local found!");
}

const key = process.env.GROQ_API_KEY;
console.log(`API Key Status: ${key ? "Present (" + key.substring(0, 10) + "...)" : "MISSING"}`);

if (!key) {
    console.error("ERROR: Cannot test. Key missing.");
    process.exit(1);
}

const groq = new Groq({ apiKey: key });

async function test() {
    console.log("Attempting connection to Groq...");
    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: 'Say "Hello World"' }],
            model: 'llama-3.1-8b-instant',
        });
        console.log("SUCCESS! Groq responded:");
        console.log(completion.choices[0].message.content);
    } catch (e) {
        console.error("FAILED to connect to Groq:");
        console.error(e);
    }
}

test();
