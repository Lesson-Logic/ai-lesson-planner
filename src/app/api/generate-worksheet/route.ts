import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `
You are an expert curriculum designer. Generate a highly structured, practical, and printable worksheet (with 3-5 targeted tasks/questions and an answer key) specifically for the following lesson plan section.

Rules:
- Focus solely on the objectives and scope of the provided section.
- Output in clean Markdown using clear headings (##) and bullet points.
- Include lines or spaces for student responses.
- Keep the total worksheet concise and print-ready.
- Provide a brief, accurate Answer Key at the very bottom.

Output structure:
# Worksheet: [Creative Activity Name]
**Grade:** [Grade] | **Subject:** [Subject]

## Student Name: _________________  Date: _________

## Tasks & Questions
[List 3-5 specific questions or tasks with placeholders for answers, e.g. "Answer: _________________"]

## Answer Key
[Provide concise answers for each task/question above]
`.trim();

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL ?? "google/gemini-2.0-flash-lite-001";

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { sectionText, grade, subject } = body;

    if (!sectionText || !grade || !subject) {
      return NextResponse.json(
        { error: "Missing required fields: sectionText, grade, or subject" },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY is not set." },
        { status: 500 }
      );
    }

    const userMessage = `Grade: ${grade}\nSubject: ${subject}\nSection Details:\n${sectionText}`;

    // Call OpenRouter
    const requestBody = {
      model,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userMessage },
      ],
    };

    const openRouterRes = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(process.env.OPENROUTER_SITE_URL && {
            "HTTP-Referer": process.env.OPENROUTER_SITE_URL,
          }),
          ...(process.env.OPENROUTER_SITE_NAME && {
            "X-Title": process.env.OPENROUTER_SITE_NAME,
          }),
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!openRouterRes.ok) {
      const errText = await openRouterRes.text();
      return NextResponse.json(
        { error: `OpenRouter API error: ${errText}` },
        { status: openRouterRes.status }
      );
    }

    if (!openRouterRes.body) {
      return NextResponse.json(
        { error: "OpenRouter returned an empty body." },
        { status: 502 }
      );
    }

    // SSE -> plain-text stream
    const stream = new ReadableStream({
      async start(controller) {
        const reader = openRouterRes.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === "data: [DONE]") continue;
              if (!trimmed.startsWith("data: ")) continue;

              try {
                const json = JSON.parse(trimmed.slice(6));
                const text: string | undefined = json.choices?.[0]?.delta?.content;
                if (text) controller.enqueue(new TextEncoder().encode(text));
              } catch {
                // skip
              }
            }
          }
          controller.close();
        } catch (streamErr) {
          controller.error(streamErr);
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "An error occurred during worksheet generation." },
      { status: 500 }
    );
  }
}
