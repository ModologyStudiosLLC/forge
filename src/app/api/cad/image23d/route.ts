import { NextRequest, NextResponse } from "next/server";

const TRIPOSR_URL = process.env.TRIPOSR_API_URL ?? "http://localhost:8098";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

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
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
