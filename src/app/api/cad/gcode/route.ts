import { NextRequest, NextResponse } from "next/server";

// Forwards to the local freecad-poc service (headless FreeCAD Path/CAM),
// same pattern as image23d/nl2step. Fixed default roughing preset — no
// tool/stock parameter UI yet.
const FREECAD_SERVICE_URL = "http://localhost:8101/gcode";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const forwardData = new FormData();
    forwardData.append("file", file, file.name);

    const res = await fetch(FREECAD_SERVICE_URL, { method: "POST", body: forwardData });
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
    console.error("G-code generation error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
