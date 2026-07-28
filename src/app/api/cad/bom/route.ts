import { NextRequest, NextResponse } from "next/server";

// Reference material data — densities are physical constants (accurate).
// Prices are NOT live: no free/keyless API exists that covers structural
// metals (aluminum, steel, titanium) at useful precision — checked
// metals-api.com, metals.dev, metalpriceapi.com, stooq — all either
// precious-metals-only or require a signed-up API key. These are industry
// midpoint reference figures instead, refreshed by hand occasionally.
// Swap PRICE_PER_KG_USD for a live lookup once Mike has a supplier API key
// (e.g. an MSC/McMaster feed) — everything downstream just consumes a number.
export const MATERIALS = {
  "aluminum-6061": {
    label: "Aluminum 6061",
    densityKgM3: 2700,
    pricePerKgUsd: 8.8,
  },
  "steel-1018": {
    label: "Mild Steel 1018",
    densityKgM3: 7870,
    pricePerKgUsd: 2.2,
  },
  "stainless-304": {
    label: "Stainless Steel 304",
    densityKgM3: 8000,
    pricePerKgUsd: 6.6,
  },
  "stainless-17-4ph": {
    label: "Stainless Steel 17-4PH",
    densityKgM3: 7750,
    pricePerKgUsd: 9.9,
  },
  "titanium-ti6al4v": {
    label: "Titanium Ti-6Al-4V",
    densityKgM3: 4430,
    pricePerKgUsd: 55,
  },
} as const;

export type MaterialKey = keyof typeof MATERIALS;

export async function POST(req: NextRequest) {
  try {
    const { volumeMm3, material } = (await req.json()) as {
      volumeMm3: number;
      material: MaterialKey;
    };

    if (!volumeMm3 || volumeMm3 <= 0) {
      return NextResponse.json({ error: "volumeMm3 (positive number) required" }, { status: 400 });
    }
    const spec = MATERIALS[material];
    if (!spec) {
      return NextResponse.json(
        { error: `Unknown material "${material}". Options: ${Object.keys(MATERIALS).join(", ")}` },
        { status: 400 },
      );
    }

    const volumeM3 = volumeMm3 / 1_000_000_000; // mm^3 -> m^3
    const massKg = volumeM3 * spec.densityKgM3;
    const materialCostUsd = massKg * spec.pricePerKgUsd;

    return NextResponse.json({
      material,
      materialLabel: spec.label,
      volumeMm3,
      massKg,
      pricePerKgUsd: spec.pricePerKgUsd,
      materialCostUsd,
      priceSource: "reference",
      priceNote:
        "Reference pricing, not a live quote — no free API covers structural metal spot prices. " +
        "Treat as a rough order-of-magnitude figure.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "BOM calculation failed";
    console.error("BOM calculation error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
