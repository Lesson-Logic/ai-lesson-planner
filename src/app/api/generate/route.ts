import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: Request) {
  try {
    const { grade, subject, objectives } = await req.json();

    if (!grade || !subject || !objectives) {
      return NextResponse.json(
        { error: "Missing required fields: grade, subject, or objectives" },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not set in the environment variables. Please add it to your .env.local file." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `You are an expert teacher. Create a comprehensive lesson plan and a differentiated activity worksheet.

Grade Level: ${grade}
Subject: ${subject}
Learning Objectives: ${objectives}

Please structure your response clearly using Markdown:
1. Lesson Plan (including intro, direct instruction, guided practice, independent practice, closure)
2. Differentiated Activity Worksheet (with sections for beginner, intermediate, and advanced levels)
`;

    console.log("[API] Starting generateContentStream request...");
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-2.0-flash-lite",
      contents: prompt,
    });
    console.log("[API] Connection established. Starting stream to client...");

    const stream = new ReadableStream({
      async start(controller) {
        console.log("[API] ReadableStream started processing chunks...");
        try {
          for await (const chunk of responseStream) {
            if (chunk.text) {
              console.log(`[API] Received chunk of length: ${chunk.text.length}`);
              controller.enqueue(new TextEncoder().encode(chunk.text));
            }
          }
          console.log("[API] Stream finished successfully.");
          controller.close();
        } catch (streamErr) {
          console.error("[API] Error while reading stream chunks:", streamErr);
          controller.error(streamErr);
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error: any) {
    console.error("Error generating lesson plan:", error);
    return NextResponse.json(
      { error: error.message || "An error occurred during generation." },
      { status: 500 }
    );
  }
}
