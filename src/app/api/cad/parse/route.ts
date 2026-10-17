import { NextRequest, NextResponse } from "next/server";
import { tessellateStep } from "@/lib/step";

// OpenCascade runs server-side (Node.js) — it uses require("fs") internally
// and cannot be bundled for the browser.

// Upper bound on uploaded STEP size. OCCT tessellation is CPU- and
// memory-heavy and runs on the request thread, so an unbounded upload is an
// easy way to wedge the server.
const MAX_STEP_BYTES = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
    if (file.size > MAX_STEP_BYTES) {
      return NextResponse.json(
        { error: `STEP file too large (max ${MAX_STEP_BYTES / 1024 / 1024} MB)` },
        { status: 413 },
      );
    }

    const { faces, volumeMm3 } = await tessellateStep(Buffer.from(await file.arrayBuffer()));

    if (faces.length === 0) {
      return NextResponse.json(
        { error: "No geometry found — is this a valid STEP file?" },
        { status: 422 },
      );
    }

    return NextResponse.json({ faces, faceCount: faces.length, volumeMm3 });
  } catch (err: unknown) {
    console.error("STEP parse error:", err);
    const message = err instanceof Error ? err.message : "Parse failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
