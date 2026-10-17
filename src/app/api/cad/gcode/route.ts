import { NextRequest, NextResponse } from "next/server";

// Forwards to the local freecad-poc service (headless FreeCAD Path/CAM),
// same pattern as image23d/nl2step. Fixed default roughing preset — no
// tool/stock parameter UI yet.
const FREECAD_URL = process.env.FREECAD_API_URL ?? "http://localhost:8101";
const MAX_STEP_BYTES = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
    if (file.size > MAX_STEP_BYTES) {
      return NextResponse.json({ error: "STEP file too large (max 50 MB)" }, { status: 413 });
    }

    const forwardData = new FormData();
    forwardData.append("file", file, file.name);

    const res = await fetch(`${FREECAD_URL}/gcode`, { method: "POST", body: forwardData });
    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: `G-code generation failed: ${errorText.slice(0, 500)}` },
        { status: 502 },
      );
    }

    const gcode = await res.text();
    return NextResponse.json({ gcode });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "G-code generation failed";
    if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
      return NextResponse.json(
        { error: "FreeCAD G-code service is not running. Start it with: ~/freecad-poc/run.sh" },
        { status: 503 },
      );
    }
    console.error("G-code generation error:", err);
    return NextResponse.json({ error: "G-code generation failed" }, { status: 500 });
  }
}
