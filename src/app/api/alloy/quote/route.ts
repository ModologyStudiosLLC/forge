import { NextRequest, NextResponse } from "next/server";
import { tessellateStep, toBinaryStl } from "@/lib/step";

const ALLOY_URL = process.env.ALLOY_API_URL ?? "http://localhost:8000";
// Alloy gates /quotes behind staff login (JWT). FORGE logs in server-side as a
// dedicated service account so credentials never reach the browser.
const ALLOY_EMAIL = process.env.ALLOY_EMAIL;
const ALLOY_PASSWORD = process.env.ALLOY_PASSWORD;

let cachedToken: string | null = null;

async function login(): Promise<string> {
  if (!ALLOY_EMAIL || !ALLOY_PASSWORD) {
    throw new AlloyAuthError("ALLOY_EMAIL / ALLOY_PASSWORD are not set — FORGE can't log in to Alloy.");
  }
  const res = await fetch(`${ALLOY_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: ALLOY_EMAIL, password: ALLOY_PASSWORD }),
  });
  if (!res.ok) throw new AlloyAuthError("Alloy rejected FORGE's service-account login.");
  const { access_token } = (await res.json()) as { access_token: string };
  cachedToken = access_token;
  return access_token;
}

class AlloyAuthError extends Error {}

async function postQuote(form: FormData, token: string) {
  return fetch(`${ALLOY_URL}/quotes`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

// Alloy's geometry analysis is trimesh-based and can't read STEP (it lacks the
// optional cascadio dependency), while FORGE's models are STEP. Tessellate
// STEP here with OpenCASCADE and send Alloy an STL of the same part.
async function toAlloyForm(incoming: FormData): Promise<FormData> {
  const file = incoming.get("file");
  if (!(file instanceof File)) throw new BadRequest("No file");
  if (file.size > MAX_UPLOAD_BYTES) throw new BadRequest("File too large (max 50 MB)");

  const form = new FormData();
  for (const [k, v] of incoming) if (k !== "file") form.append(k, v);

  if (/\.(step|stp)$/i.test(file.name)) {
    const { faces } = await tessellateStep(Buffer.from(await file.arrayBuffer()));
    if (faces.length === 0) throw new BadRequest("No geometry found in STEP file");
    const stlName = file.name.replace(/\.(step|stp)$/i, ".stl");
    form.append("file", new Blob([new Uint8Array(toBinaryStl(faces))], { type: "model/stl" }), stlName);
  } else {
    form.append("file", file, file.name);
  }
  return form;
}

class BadRequest extends Error {}

export async function POST(req: NextRequest) {
  try {
    const form = await toAlloyForm(await req.formData());

    let res = await postQuote(form, cachedToken ?? (await login()));
    if (res.status === 401) {
      // Token expired (Alloy issues 12h tokens) — refresh once and retry.
      res = await postQuote(form, await login());
    }

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail ?? "Alloy returned an error" },
        { status: res.status },
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof BadRequest) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof AlloyAuthError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    // Surface a clear message when Alloy isn't running
    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
      return NextResponse.json(
        { error: "Alloy is not running. Start it with: docker compose up (in ~/projects/alloy)" },
        { status: 503 },
      );
    }
    console.error("[alloy/quote]", err);
    return NextResponse.json({ error: "Alloy quote failed" }, { status: 500 });
  }
}
