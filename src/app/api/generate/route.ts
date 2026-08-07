import { NextResponse } from "next/server";
import { getNepGuidelines } from "@/lib/db/nep2020";
import { getMarbleTaxonomyRAGContext } from "@/lib/rag/os-taxonomy";

const SYSTEM_PROMPT = `
You are an expert curriculum designer. Produce a highly engaging, structured educational deliverable pack tailored to the teacher's selections.

Visual Formatting & Reading Comfort Rules:
- Include visual breaks between sections: use callout quotes, bold bullet points, and clean subheadings.
- Insert standard thematic visual image banner placeholders at key section transitions using markdown image syntax:
  - Header Banner: ![Visual Topic Header](https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1000&q=80)
  - Activity Banner: ![Hands-on Learning](https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=1000&q=80)
  - Assessment Banner: ![Assessment & Quiz](https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1000&q=80)
- Be direct, practical, and highly organized — avoid fluff.
- Generate creative activity names and explicit learning outcome tags for every section.
- Tag activities with '[Verbal Q&A]', '[Worksheet Task]', '[PPT Slide]', or '[Hands-On Activity]'.

Include requested section deliverables clearly (e.g. Lesson Plan, Differentiated Worksheet & Quiz, PPT Presentation Outline, Hands-On Activity Guide).
`.trim();

async function checkClarity(
  grade: string,
  subject: string,
  objectives: string,
  apiKey: string,
  model: string
): Promise<{ clear: boolean; questions?: string[]; suggestions?: string[] }> {
  try {
    const prompt = `
You are an AI curricular assistant. Analyze if the following lesson details are clear and specific enough to generate a highly effective, practical lesson plan:
Grade: "${grade}"
Subject: "${subject}"
Objectives: "${objectives}"

If the inputs are clear and have a specific grade level, subject, and learning goal, respond with exactly:
CLEAR

If the inputs are vague, ambiguous, or lack specific details (e.g. if objectives are just "teach math" or "read", or grade is "kids", or if any field contains nonsense/gibberish), respond with exactly a JSON object in this format:
{
  "unclear": true,
  "questions": [
    "One or two specific questions to clarify the topic, grade, or objectives"
  ],
  "suggestions": [
    "Two specific suggested choices/topics the teacher can pick from"
  ]
}

Only output the raw text "CLEAR" or the raw JSON. Do not wrap in markdown code blocks like \`\`\`json.
`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      return { clear: true };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) return { clear: true };
    if (content === "CLEAR") return { clear: true };

    try {
      const parsed = JSON.parse(content);
      if (parsed.unclear) {
        return {
          clear: false,
          questions: parsed.questions || [],
          suggestions: parsed.suggestions || []
        };
      }
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          if (parsed.unclear) {
            return {
              clear: false,
              questions: parsed.questions || [],
              suggestions: parsed.suggestions || []
            };
          }
        } catch (_) {}
      }
    }

    return { clear: true };
  } catch (err) {
    console.error("Clarity check error:", err);
    return { clear: true };
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat";

  try {
    // ── Parse request body ────────────────────────────────────────────────
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { grade, subject, objectives, clarified, clarification, messages, mode, deliverables } = body;

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

    // ── Check Clarity if not clarified and this is the first turn ──────────
    const isFirstTurn = !messages || !Array.isArray(messages) || messages.length === 0;
    if (!clarified && isFirstTurn) {
      const clarity = await checkClarity(grade, subject, objectives, apiKey, model);
      if (!clarity.clear) {
        return NextResponse.json({
          clarificationRequired: true,
          questions: clarity.questions,
          suggestions: clarity.suggestions
        });
      }
    }

    const finalObjectives = clarification ? `${objectives} (Clarification: ${clarification})` : objectives;
    const requestedDeliverables = deliverables && Array.isArray(deliverables) && deliverables.length > 0
      ? deliverables.join(", ")
      : "Lesson Plan, Differentiated Worksheet & Quiz, PPT Presentation Outline";

    // ── Context Grounding based on Experience Mode ──────────────────────────
    let experienceContext = "";
    if (mode === "marble_rag") {
      experienceContext = getMarbleTaxonomyRAGContext(grade, subject, finalObjectives);
    } else {
      const { stage } = getNepGuidelines(grade);
      experienceContext = `
Pedagogical Stage Alignment:
You must align the lesson plan and worksheet with India's National Education Policy (NEP) 2020.
The student is in the "${stage.stageName}" (Grades: ${stage.grades}, Ages: ${stage.ages}).
Pedagogical Focus: ${stage.focus}
Pedagogical Principles to apply:
${stage.pedagogicalPrinciples.map(p => `- ${p}`).join("\n")}
`;
    }

    const dynamicSystemPrompt = `${SYSTEM_PROMPT}\n\nRequested Deliverable Assets: ${requestedDeliverables}\n\n${experienceContext}`;
    const userMessage = `Grade: ${grade}\nSubject: ${subject}\nObjectives: ${finalObjectives}\nRequested Deliverables: ${requestedDeliverables}`;

    // Construct conversation history for OpenRouter
    let finalMessages: any[] = [];
    if (messages && Array.isArray(messages) && messages.length > 0) {
      finalMessages = [
        { role: "system", content: dynamicSystemPrompt },
        ...messages
      ];
    } else {
      finalMessages = [
        { role: "system", content: dynamicSystemPrompt },
        { role: "user",   content: userMessage },
      ];
    }

    // ── Call OpenRouter ───────────────────────────────────────────────────
    const requestBody = {
      model,
      stream: true,
      messages: finalMessages,
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
