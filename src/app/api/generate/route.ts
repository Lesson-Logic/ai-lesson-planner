import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `
You are an expert curriculum designer. Produce a concise, practical lesson plan and a differentiated activity worksheet.

Rules:
- Total response must be under 600 words.
- Use Markdown with clear headings (##) and bullet points.
- Be direct — no filler, no repetition.
- Never restate the grade, subject, or objectives back to the user.
- Generate a unique, engaging, and creative name for EVERY activity.
- Specify a clear, measurable learning outcome for every single section and task.
- Provide a clear list of physical props/materials needed and dynamic digital resource TODOs.

Output structure (use exactly these headings and markdown formatting):

## Lesson Plan
**Duration:** [estimate]

## Materials & Resources
- **Physical Props:** [List 2-3 physical props/materials the teacher needs to bring/prepare]
- **Digital Resources:**
  - [TODO] [Digital resource to refer to or create dynamically, e.g. '[TODO] Link to simulation on X' or '[TODO] Create dynamically: Y worksheet']

## Lesson Steps
- **Hook - [Creative Name]:** [One engaging opening sentence or question]
  *(Learning Outcome: [Specific outcome])*
- **Instruction - [Creative Name]:** [2–3 bullet points covering core concept]
  *(Learning Outcome: [Specific outcome])*
- **Guided Practice - [Creative Name]:** [1–2 bullet points (teacher-led activity)]
  *(Learning Outcome: [Specific outcome])*
- **Independent Practice - [Creative Name]:** [1 bullet point]
  *(Learning Outcome: [Specific outcome])*
- **Closure - [Creative Name]:** [One exit-ticket or reflection prompt]
  *(Learning Outcome: [Specific outcome])*

## Differentiated Worksheet
- **Beginner - [Creative Name]:** [1–2 simple tasks]
  *(Learning Outcome: [Specific outcome])*
- **Intermediate - [Creative Name]:** [1–2 tasks requiring application]
  *(Learning Outcome: [Specific outcome])*
- **Advanced - [Creative Name]:** [1–2 tasks requiring analysis or creation]
  *(Learning Outcome: [Specific outcome])*
`.trim();

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL ?? "google/gemini-2.0-flash-lite-001";

  try {
    // ── Parse request body ────────────────────────────────────────────────
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { grade, subject, objectives } = body;

    if (!grade || !subject || !objectives) {
      return NextResponse.json(
        { error: "Missing required fields: grade, subject, or objectives" },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY is not set. Add it to your .env.local file." },
        { status: 500 }
      );
    }

    const userMessage = `Grade: ${grade}\nSubject: ${subject}\nObjectives: ${objectives}`;

    // ── Call OpenRouter ───────────────────────────────────────────────────
    const requestBody = {
      model,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userMessage },
      ],
    };

    let openRouterRes: Response;
    try {
      openRouterRes = await fetch(
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
    } catch (fetchErr) {
      console.error("[DEBUG] fetch() threw an exception (network error?):", fetchErr);
      return NextResponse.json(
        { error: `Network error calling OpenRouter: ${String(fetchErr)}` },
        { status: 502 }
      );
    }

    // ── 4. Check HTTP status ──────────────────────────────────────────────
    if (!openRouterRes.ok) {
      const errText = await openRouterRes.text();
      console.error("[API] OpenRouter error:", openRouterRes.status, errText);
      return NextResponse.json(
        { error: `OpenRouter API error (${openRouterRes.status}): ${errText}` },
        { status: openRouterRes.status }
      );
    }

    if (!openRouterRes.body) {
      return NextResponse.json(
        { error: "OpenRouter returned an empty body." },
        { status: 502 }
      );
    }

    // ── Transform SSE → plain-text stream ────────────────────────────────
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
                // malformed SSE line — skip
              }
            }
          }

          controller.close();
        } catch (streamErr) {
          console.error("[API] Stream error:", streamErr);
          controller.error(streamErr);
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error: any) {
    console.error("[DEBUG] Unhandled error in POST handler:", error);
    return NextResponse.json(
      { error: error.message || "An error occurred during generation." },
      { status: 500 }
    );
  }
}
