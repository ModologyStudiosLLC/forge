import { NextRequest, NextResponse } from "next/server";

interface FaceData {
  id: string;
  positions: number[];
  normals: number[];
  indices: number[];
  center: [number, number, number];
}

interface DFMIssue {
  severity: "fail" | "warn" | "info";
  message: string;
  faceId?: string;
}

type Vec3 = [number, number, number];

// Heuristic thresholds, in the model's native units (assumed mm for typical
// CNC/FDM/SLA prototype-scale parts).
const THIN_WALL_FAIL_MM = 0.8;
const THIN_WALL_WARN_MM = 1.5;
const SMALL_FEATURE_WARN_MM = 1.0;
const SMALL_FEATURE_RATIO = 0.02; // relative to overall part size

function faceAvgNormal(face: FaceData): Vec3 {
  let nx = 0, ny = 0, nz = 0;
  const count = face.normals.length / 3;
  for (let i = 0; i < face.normals.length; i += 3) {
    nx += face.normals[i];
    ny += face.normals[i + 1];
    nz += face.normals[i + 2];
  }
  return [nx / count, ny / count, nz / count];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function dist(a: Vec3, b: Vec3): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function boundingDiagonal(face: FaceData): number {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < face.positions.length; i += 3) {
    const x = face.positions[i], y = face.positions[i + 1], z = face.positions[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2 + (maxZ - minZ) ** 2);
}

export async function POST(req: NextRequest) {
  try {
    const { faces } = (await req.json()) as { faces: FaceData[] };
    if (!faces || !Array.isArray(faces)) {
      return NextResponse.json({ error: "faces array required" }, { status: 400 });
    }

    const issues: DFMIssue[] = [];
    const normals = faces.map(faceAvgNormal);

    // Thin-wall heuristic: for each pair of faces whose average normals are
    // roughly anti-parallel (facing each other), treat centroid-to-centroid
    // distance as an approximate wall thickness. This is a coarse heuristic,
    // not a true offset-surface analysis — good enough to flag obviously
    // problem geometry for v1, not a substitute for a real DFM pass later.
    for (let i = 0; i < faces.length; i++) {
      for (let j = i + 1; j < faces.length; j++) {
        if (dot(normals[i], normals[j]) > -0.9) continue; // not roughly facing each other
        const gap = dist(faces[i].center, faces[j].center);
        if (gap < THIN_WALL_FAIL_MM) {
          issues.push({
            severity: "fail",
            faceId: faces[i].id,
            message: `Wall thickness ~${gap.toFixed(2)}mm between faces ${faces[i].id} and ${faces[j].id} is likely too thin to manufacture reliably.`,
          });
        } else if (gap < THIN_WALL_WARN_MM) {
          issues.push({
            severity: "warn",
            faceId: faces[i].id,
            message: `Wall thickness ~${gap.toFixed(2)}mm between faces ${faces[i].id} and ${faces[j].id} is marginal — verify against your process's minimum wall spec.`,
          });
        }
      }
    }

    // Small-feature heuristic: a face whose bounding diagonal is tiny relative
    // to the whole part may be below typical tooling/tolerance limits.
    const overallDiag = faces.reduce((max, f) => Math.max(max, boundingDiagonal(f)), 0) || 1;
    for (const face of faces) {
      const diag = boundingDiagonal(face);
      if (diag > 0 && diag < SMALL_FEATURE_WARN_MM && diag / overallDiag < SMALL_FEATURE_RATIO) {
        issues.push({
          severity: "info",
          faceId: face.id,
          message: `Face ${face.id} is a small feature (~${diag.toFixed(2)}mm) — confirm it's above your process's minimum feature size.`,
        });
      }
    }

    return NextResponse.json({ issues });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "DFM analysis failed";
    console.error("DFM analysis error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
