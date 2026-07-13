import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const keyMatch = envFile.match(/GEMINI_API_KEY=(.+)/);
const apiKey = keyMatch ? keyMatch[1].trim() : null;

if (!apiKey) {
    console.log("No key found");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
async function run() {
    try {
        const response = await ai.models.list();
        for await (const model of response) {
            console.log(model.name);
        }
    } catch(e) {
        console.log("Error:", e.message);
    }
}
run();
