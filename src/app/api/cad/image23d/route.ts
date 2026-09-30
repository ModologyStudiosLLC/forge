import { NextRequest, NextResponse } from "next/server";

const TRIPOSR_URL = process.env.TRIPOSR_API_URL ?? "http://localhost:8098";
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const image = [...form.values()].find((v): v is File => v instanceof File);
    if (!image) return NextResponse.json({ error: "No image" }, { status: 400 });
    if (!image.type.startsWith("image/")) {
      return NextResponse.json({ error: "Upload must be an image" }, { status: 415 });
    }
    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image too large (max 20 MB)" }, { status: 413 });
    }

    // Forward the uploaded image to TripoSR unchanged
    const res = await fetch(`${TRIPOSR_URL}/generate`, {
      method: "POST",
      body: form,
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail ?? "TripoSR returned an error" },
        { status: res.status },
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
      return NextResponse.json(
        { error: "TripoSR is not running. Start it with: ~/triposr-poc/run.sh" },
        { status: 503 },
      );
    }
    console.error("[image23d]", err);
    return NextResponse.json({ error: "Image-to-3D failed" }, { status: 500 });
  }
}
