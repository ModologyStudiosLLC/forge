import { NextRequest, NextResponse } from "next/server";

const ALLOY_URL = process.env.ALLOY_API_URL ?? "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    // Forward the multipart form to Alloy unchanged
    const res = await fetch(`${ALLOY_URL}/quotes`, {
      method: "POST",
      body: form,
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail ?? "Alloy returned an error" },
        { status: res.status },
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Surface a clear message when Alloy isn't running
    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
      return NextResponse.json(
        { error: "Alloy is not running. Start it with: docker compose up (in ~/projects/alloy)" },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
