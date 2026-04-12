import { NextRequest, NextResponse } from "next/server";

// OpenCascade runs server-side (Node.js) — it uses require("fs") internally
// and cannot be bundled for the browser.
let ocInstance: any = null;

async function getOC() {
  if (ocInstance) return ocInstance;
  const { initOpenCascade } = await import("opencascade.js");
  ocInstance = await initOpenCascade();
  return ocInstance;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const oc = await getOC();

    // Write STEP to OC virtual FS
    const fileName = "input.step";
    oc.FS.createDataFile("/", fileName, buffer, true, true, true);

    const reader = new oc.STEPControl_Reader_1();
    reader.ReadFile(fileName);
    reader.TransferRoots(new oc.Message_ProgressRange_1());
    const shape = oc.TopoDS.Shape_1(reader.OneShape());

    // Tessellate each face
    const faces: Array<{
      id: string;
      positions: number[];
      normals: number[];
      indices: number[];
      center: [number, number, number];
    }> = [];

    const explorer = new oc.TopExp_Explorer_2(
      shape,
      oc.TopAbs_ShapeEnum.TopAbs_FACE,
      oc.TopAbs_ShapeEnum.TopAbs_SHAPE
    );

    let faceIndex = 0;
    while (explorer.More()) {
      const face = oc.TopoDS.Face_1(explorer.Current());
      const mesh = new oc.BRepMesh_IncrementalMesh_2(face, 0.1, false, 0.5, false);
      mesh.Perform(new oc.Message_ProgressRange_1());

      const location = new oc.TopLoc_Location_1();
      const triangulation = oc.BRep_Tool.Triangulation(face, location, 0);

      if (!triangulation.IsNull()) {
        const tris = triangulation.get();
        const nbNodes = tris.NbNodes();
        const nbTriangles = tris.NbTriangles();

        const positions: number[] = [];
        const normals: number[] = [];
        const indices: number[] = [];
        let cx = 0, cy = 0, cz = 0;

        for (let i = 1; i <= nbNodes; i++) {
          const node = tris.Node(i);
          positions.push(node.X(), node.Y(), node.Z());
          normals.push(0, 1, 0);
          cx += node.X(); cy += node.Y(); cz += node.Z();
        }
        cx /= nbNodes; cy /= nbNodes; cz /= nbNodes;

        for (let i = 1; i <= nbTriangles; i++) {
          const tri = tris.Triangle(i);
          indices.push(tri.Value(1) - 1, tri.Value(2) - 1, tri.Value(3) - 1);
        }

        faces.push({
          id: `face_${faceIndex}`,
          positions,
          normals,
          indices,
          center: [cx, cy, cz],
        });
      }

      faceIndex++;
      explorer.Next();
    }

    oc.FS.unlink(`/${fileName}`);

    return NextResponse.json({ faces, faceCount: faces.length });
  } catch (err: any) {
    console.error("STEP parse error:", err);
    return NextResponse.json({ error: err?.message ?? "Parse failed" }, { status: 500 });
  }
}

export const config = { api: { bodyParser: false } };
