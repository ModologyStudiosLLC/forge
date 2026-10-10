import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const CADQUERY_URL = process.env.CADQUERY_API_URL ?? "http://localhost:8097";

const MODEL = process.env.NL2STEP_MODEL ?? "claude-sonnet-5-5";
const MAX_ATTEMPTS = 3;

const SYSTEM_PROMPT = `You write CadQuery Python scripts that build parametric solid geometry.

Rules:
- Only "import cadquery as cq" and "import math" are allowed — no other imports, no file access, no open()/eval()/__import__.
- The script must assign the final solid to a variable named exactly "result" (a cq.Workplane or cq.Shape). It must be ONE non-empty solid.
- Use millimeters for all dimensions unless the prompt says otherwise. Put the key dimensions in named variables at the top.
- Output ONLY the Python code, no markdown fences, no explanation, no comments about what you're doing.

Hard-won rules (these cause most failures):
- Build with one Workplane chain where possible. To combine separate Workplanes use .union(other) or .cut(other) — never "+" or "-".
- box() and cylinder() are centered on the origin by default. Pass centered=(True, True, False) to sit a part on the z=0 plane.
- Through-holes: .faces(">Z").workplane().hole(diameter) with no depth cuts all the way through. Holes at several positions: .pushPoints([...]), .rarray(xSpacing, ySpacing, xCount, yCount) or .polarArray(radius, 0, 360, count) before .hole().
- If you cut with a cylinder instead, make it TALLER than the part so it fully penetrates.
- AVOID fillet() and chamfer() unless the prompt asks for them. When needed, select real edges with a selector string, e.g. .edges("|Z").fillet(2), do it BEFORE cutting holes, and keep the radius smaller than half the thinnest adjacent wall.
- Never call show_object(), cq.exporters, or anything that writes files — the service exports "result" itself.

Example — plate with a centre through-hole:
import cadquery as cq
length, width, thickness, hole_d = 120.0, 80.0, 8.0, 20.0
result = cq.Workplane("XY").box(length, width, thickness).faces(">Z").workplane().hole(hole_d)

Example — plate with four corner holes:
import cadquery as cq
length, width, thickness, hole_d, inset = 100.0, 60.0, 10.0, 8.0, 12.0
result = (
    cq.Workplane("XY")
    .box(length, width, thickness)
    .faces(">Z").workplane()
    .rarray(length - 2 * inset, width - 2 * inset, 2, 2)
    .hole(hole_d)
)

Example — flanged pipe with a bolt circle:
import cadquery as cq
flange_d, flange_t, pipe_od, pipe_id, pipe_len = 100.0, 12.0, 50.0, 38.0, 100.0
bolt_pcd, bolt_d, bolt_count = 70.0, 6.0, 6
flange = cq.Workplane("XY").circle(flange_d / 2).extrude(flange_t)
pipe = cq.Workplane("XY").circle(pipe_od / 2).extrude(flange_t + pipe_len)
bore = cq.Workplane("XY").circle(pipe_id / 2).extrude(flange_t + pipe_len)
body = flange.union(pipe).cut(bore)
result = body.faces("<Z").workplane().polarArray(bolt_pcd / 2, 0, 360, bolt_count).hole(bolt_d)`;

// One JSON file per request (success or failure): prompt, model, every script tried and the
// error it produced. Failures are the useful part — they show which prompt rules to add next.
// Best-effort: a logging problem must never fail a generation.
const RUN_LOG_DIR = process.env.NL2STEP_RUN_LOG_DIR ?? path.join(process.cwd(), ".forge-runs");

async function logRun(entry: Record<string, unknown>): Promise<string> {
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  try {
    await mkdir(RUN_LOG_DIR, { recursive: true });
    await writeFile(path.join(RUN_LOG_DIR, `${runId}.json`), JSON.stringify({ run_id: runId, model: MODEL, ...entry }, null, 2));
  } catch (err) {
    console.error("[nl2step] could not write run log", err);
  }
  return runId;
}

function extractScript(message: Anthropic.Message): string {
  const text = message.content
    .filter(b => b.type === "text")
    .map(b => (b as Anthropic.TextBlock).text)
    .join("");
  // Prefer the contents of a fenced block if the model added one despite instructions.
  const fenced = text.match(/```(?:python)?\s*\n([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

export async function POST(req: NextRequest) {
  try {
    const { prompt } = (await req.json()) as { prompt?: string };
    if (!prompt?.trim()) {
      return NextResponse.json({ error: "prompt required" }, { status: 400 });
    }

    // Generate, run, and on a script failure feed the error back to the model so it
    // can correct itself. Only a 400 from the CadQuery service (the script's fault)
    // is retried; anything else (service down, 5xx) fails immediately.
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
    let script = "";
    let lastError = "CadQuery generation failed";
    const tries: { script: string; error?: string }[] = [];

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages,
      });
      script = extractScript(message);

      const cqRes = await fetch(`${CADQUERY_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script }),
      });
      const cqData = await cqRes.json();

      if (cqRes.ok) {
        tries.push({ script });
        const runId = await logRun({ prompt, success: true, attempts: attempt, metrics: cqData.metrics, tries });
        return NextResponse.json({
          step_b64: cqData.step_b64, script, attempts: attempt, metrics: cqData.metrics, run_id: runId,
        });
      }
      lastError = cqData.detail ?? lastError;
      tries.push({ script, error: lastError });
      if (cqRes.status !== 400) {
        const runId = await logRun({ prompt, success: false, attempts: attempt, tries });
        return NextResponse.json({ error: lastError, script, run_id: runId }, { status: cqRes.status });
      }

      messages.push(
        { role: "assistant", content: script },
        {
          role: "user",
          content: `That script failed with this error:\n${lastError}\n\nReturn the complete corrected script. Same rules: only code, final solid in "result".`,
        },
      );
    }

    const runId = await logRun({ prompt, success: false, attempts: MAX_ATTEMPTS, tries });
    return NextResponse.json(
      { error: `Failed after ${MAX_ATTEMPTS} attempts. Last error: ${lastError}`, script, run_id: runId },
      { status: 400 },
    );
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
