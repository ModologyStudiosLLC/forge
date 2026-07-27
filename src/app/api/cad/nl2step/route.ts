import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const CADQUERY_URL = process.env.CADQUERY_API_URL ?? "http://localhost:8097";

const SYSTEM_PROMPT = `You write CadQuery Python scripts that build parametric solid geometry.

Rules:
- Only "import cadquery as cq" and "import math" are allowed — no other imports.
- The script must assign the final solid to a variable named exactly "result" (a cq.Workplane or cq.Shape).
- Use millimeters for all dimensions unless the prompt says otherwise.
- Output ONLY the Python code, no markdown fences, no explanation, no comments about what you're doing.`;

export async function POST(req: NextRequest) {
  try {
    const { prompt } = (await req.json()) as { prompt?: string };
    if (!prompt?.trim()) {
      return NextResponse.json({ error: "prompt required" }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const script = message.content
      .filter(b => b.type === "text")
      .map(b => (b as Anthropic.TextBlock).text)
      .join("")
      .replace(/^```(?:python)?\n?/, "")
      .replace(/```\s*$/, "")
      .trim();

    const cqRes = await fetch(`${CADQUERY_URL}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script }),
    });
    const cqData = await cqRes.json();

    if (!cqRes.ok) {
      return NextResponse.json(
        { error: cqData.detail ?? "CadQuery generation failed", script },
        { status: cqRes.status },
      );
    }

    return NextResponse.json({ step_b64: cqData.step_b64, script });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
      return NextResponse.json(
        { error: "CadQuery service is not running. Start it with: ~/cadquery-poc/run.sh" },
        { status: 503 },
      );
    }
    console.error("[nl2step]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
