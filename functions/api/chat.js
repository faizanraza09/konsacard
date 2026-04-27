const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export async function onRequestPost(context) {
  const key = (context.env.GEMINI_KEY || "").trim();
  if (!key) {
    return Response.json({ error: "Chat service is not configured." }, { status: 503 });
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { contents, systemPrompt } = body;
  if (!Array.isArray(contents) || !contents.length) {
    return Response.json({ error: "Missing contents." }, { status: 400 });
  }

  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${key}`;

  const geminiResp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(systemPrompt && { system_instruction: { parts: [{ text: systemPrompt }] } }),
      contents,
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 2048,
        topP: 0.95,
      },
    }),
  });

  if (!geminiResp.ok) {
    let errMsg = `Gemini error ${geminiResp.status}`;
    try {
      const errBody = await geminiResp.json();
      errMsg = errBody?.error?.message || errMsg;
    } catch { /* ignore */ }
    return Response.json({ error: errMsg }, { status: geminiResp.status });
  }

  return new Response(geminiResp.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
