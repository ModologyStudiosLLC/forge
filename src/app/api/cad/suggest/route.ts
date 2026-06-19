import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { modelName, faceId, dims, face, traceBase64, traceMimeType } = body as {
      modelName: string | null;
      faceId: string;
      dims: { width: number; height: number; depth: number };
      face: { area?: number; normal?: [number, number, number]; center?: [number, number, number] };
      traceBase64?: string;
      traceMimeType?: string;
    };

    if (!faceId || !dims || !face) {
      return NextResponse.json({ error: "Missing required fields: faceId, dims, face" }, { status: 400 });
    }

    const dimSummary = `${dims.width.toFixed(2)} mm W × ${dims.height.toFixed(2)} mm H × ${dims.depth.toFixed(2)} mm D`;
    const normalSummary = face.normal
      ? `normal [${face.normal.map(v => v.toFixed(2)).join(", ")}]`
      : "";
    const areaSummary = face.area ? `surface area ${face.area.toFixed(2)} mm²` : "";

    const textPrompt = [
      `You are a product design advisor for Modology Studios — a hardware and AI tools company in Atlanta that designs physical products for manufacturing.`,
      ``,
      `The engineer has selected a face in the CAD model${modelName ? ` "${modelName}"` : ""}.`,
      `Face ID: ${faceId}`,
      `Dimensions: ${dimSummary}`,
      areaSummary && `Area: ${areaSummary}`,
      normalSummary && `Orientation: ${normalSummary}`,
      ``,
      `Give 3–4 concise, actionable design suggestions for this face. Focus on:`,
      `- Manufacturability (draft angles, wall thickness, radii)`,
      `- Functional improvements (how this surface interacts with assembly or user)`,
      `- Form language (proportion, chamfer vs fillet, texture)`,
      traceBase64 ? `- How the traced reference product's form language could inform changes to this face` : ``,
      ``,
      `Be specific to the dimensions. No generic advice. No bullet point headers — just the insights.`,
    ].filter(Boolean).join("\n");

    type ContentBlock = Anthropic.TextBlockParam | Anthropic.ImageBlockParam;
    const content: ContentBlock[] = [];

    if (traceBase64 && traceMimeType) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: traceMimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: traceBase64,
        },
      });
    }

    content.push({ type: "text", text: textPrompt });

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      messages: [{ role: "user", content }],
    });

    const suggestion = message.content
      .filter(b => b.type === "text")
      .map(b => (b as Anthropic.TextBlock).text)
      .join("");

    return NextResponse.json({ suggestion });
  } catch (err) {
    console.error("[suggest]", err);
    return NextResponse.json({ error: "AI suggestion failed" }, { status: 500 });
  }
}
