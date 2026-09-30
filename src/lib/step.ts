import { getOpenCascade, type OpenCascade } from "@/lib/opencascade";

// Server-only STEP → per-face triangle mesh via OpenCASCADE. Shared by the
// viewer's parse route and the Alloy quote route (which converts to STL).

export type Vec3 = [number, number, number];

export interface TessellatedFace {
  id: string;
  positions: number[];
  normals: number[];
  indices: number[];
  center: Vec3;
}

export interface TessellatedStep {
  faces: TessellatedFace[];
  volumeMm3: number | null;
}

let parseCounter = 0;

export async function tessellateStep(buffer: Buffer): Promise<TessellatedStep> {
  const oc: OpenCascade = await getOpenCascade();
  // Distinct per request so a failed parse can never leave a stale file that
  // collides with the next upload. Keep it SHORT: this opencascade.js build
  // corrupts longer path strings passed to ReadFile (a UUID-based name makes
  // every read silently return an empty shape), while <=10-char names are safe.
  parseCounter = (parseCounter + 1) % 100_000;
  const fileName = `p${parseCounter}.stp`;

  try {
    // Write STEP to OC virtual FS
    oc.FS.createDataFile("/", fileName, buffer, true, true, true);

    const reader = new oc.STEPControl_Reader_1();
    reader.ReadFile(fileName);
    reader.TransferRoots();
    const shape = reader.OneShape(); // already a TopoDS_Shape in this build; no cast needed

    // Exact solid volume (mm^3, assuming the STEP file's native units are mm
    // as elsewhere in this codebase) via OCCT's mass-property integration —
    // used for BOM material-mass estimation. Best-effort: a binding mismatch
    // here shouldn't break the viewer, which only needs the tessellation below.
    let volumeMm3: number | null = null;
    try {
      const gprops = new oc.GProp_GProps_1();
      oc.BRepGProp.VolumeProperties_1(shape, gprops, false, false, false);
      volumeMm3 = gprops.Mass();
    } catch (e) {
      console.error("Volume computation failed (non-fatal):", e);
    }

    // Tessellate each face
    const faces: TessellatedFace[] = [];

    const explorer = new oc.TopExp_Explorer_2(
      shape,
      oc.TopAbs_ShapeEnum.TopAbs_FACE,
      oc.TopAbs_ShapeEnum.TopAbs_SHAPE
    );

    let faceIndex = 0;
    while (explorer.More()) {
      const face = oc.TopoDS.Face_1(explorer.Current());
      const mesh = new oc.BRepMesh_IncrementalMesh_2(face, 0.1, false, 0.5, false);
      mesh.Perform();

      const location = new oc.TopLoc_Location_1();
      const triangulation = oc.BRep_Tool.Triangulation(face, location);

      if (!triangulation.IsNull()) {
        const tris = triangulation.get();
        const nbNodes = tris.NbNodes();
        const nbTriangles = tris.NbTriangles();

        // Triangulation nodes are in the face's local frame; faces inside
        // assemblies (or any located sub-shape) need the location applied or
        // they render/analyse in the wrong place.
        const trsf = location.IsIdentity() ? null : location.Transformation();
        // OCCT triangles are wound for the underlying surface's natural
        // orientation. A REVERSED face points the other way, so flip winding
        // to get outward normals (and correct front faces in the viewer).
        const reversed =
          face.Orientation_1() === oc.TopAbs_Orientation.TopAbs_REVERSED;

        const positions: number[] = [];
        const indices: number[] = [];
        let cx = 0, cy = 0, cz = 0;

        for (let i = 1; i <= nbNodes; i++) {
          const raw = tris.Node(i);
          const node = trsf ? raw.Transformed(trsf) : raw;
          positions.push(node.X(), node.Y(), node.Z());
          cx += node.X(); cy += node.Y(); cz += node.Z();
        }
        cx /= nbNodes; cy /= nbNodes; cz /= nbNodes;

        for (let i = 1; i <= nbTriangles; i++) {
          const tri = tris.Triangle(i);
          const a = tri.Value(1) - 1, b = tri.Value(2) - 1, c = tri.Value(3) - 1;
          if (reversed) indices.push(a, c, b);
          else indices.push(a, b, c);
        }

        faces.push({
          id: `face_${faceIndex}`,
          positions,
          normals: vertexNormals(positions, indices),
          indices,
          center: [cx, cy, cz],
        });
      }

      faceIndex++;
      explorer.Next();
    }

    return { faces, volumeMm3 };
  } finally {
    try {
      oc.FS.unlink(`/${fileName}`);
    } catch {
      // file was never written
    }
  }
}

/** Binary STL (little-endian) from tessellated faces. Units unchanged (mm). */
export function toBinaryStl(faces: TessellatedFace[]): Buffer {
  const triCount = faces.reduce((n, f) => n + f.indices.length / 3, 0);
  const out = Buffer.alloc(84 + triCount * 50);
  out.write("FORGE STEP->STL", 0, "ascii");
  out.writeUInt32LE(triCount, 80);
  let o = 84;
  for (const { positions: p, indices } of faces) {
    for (let t = 0; t < indices.length; t += 3) {
      const [a, b, c] = [indices[t] * 3, indices[t + 1] * 3, indices[t + 2] * 3];
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) || 1;
      for (const v of [nx / len, ny / len, nz / len]) { out.writeFloatLE(v, o); o += 4; }
      for (const i of [a, b, c]) {
        out.writeFloatLE(p[i], o); out.writeFloatLE(p[i + 1], o + 4); out.writeFloatLE(p[i + 2], o + 8);
        o += 12;
      }
      o += 2; // attribute byte count
    }
  }
  return out;
}

// Area-weighted per-vertex normals from triangle winding. The DFM thin-wall
// check relies on these to find opposing faces, so they must be real — a
// constant placeholder makes every face look parallel and the check never fires.
function vertexNormals(positions: number[], indices: number[]): number[] {
  const normals = new Array<number>(positions.length).fill(0);
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t] * 3, indices[t + 1] * 3, indices[t + 2] * 3];
    const e1x = positions[b] - positions[a], e1y = positions[b + 1] - positions[a + 1], e1z = positions[b + 2] - positions[a + 2];
    const e2x = positions[c] - positions[a], e2y = positions[c + 1] - positions[a + 1], e2z = positions[c + 2] - positions[a + 2];
    // Unnormalised cross product: magnitude is 2x triangle area, which gives
    // the area weighting for free.
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    for (const v of [a, b, c]) {
      normals[v] += nx; normals[v + 1] += ny; normals[v + 2] += nz;
    }
  }
  for (let v = 0; v < normals.length; v += 3) {
    const len = Math.hypot(normals[v], normals[v + 1], normals[v + 2]) || 1;
    normals[v] /= len; normals[v + 1] /= len; normals[v + 2] /= len;
  }
  return normals;
}
