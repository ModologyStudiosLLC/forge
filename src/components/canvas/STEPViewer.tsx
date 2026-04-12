"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { Canvas, useThree, ThreeEvent } from "@react-three/fiber";
import {
  OrbitControls,
  Grid,
  GizmoHelper,
  GizmoViewport,
  Html,
  Environment,
} from "@react-three/drei";
import * as THREE from "three";
import { useForgeStore } from "@/lib/store/forgeStore";
import MeasurementLabel from "./MeasurementLabel";
import PushPullHandle from "./PushPullHandle";

// ── OpenCascade STEP loader ────────────────────────────────────────────────────

function useOpenCascade() {
  const [oc, setOc] = useState<any>(null);

  useEffect(() => {
    import("opencascade.js").then(mod => {
      const initOC = mod.default ?? mod;
      initOC({
        locateFile: (f: string) => `/wasm/${f}`,
      }).then((instance: any) => setOc(instance));
    }).catch(() => {
      // OC not available in this environment — viewer will show drop zone
    });
  }, []);

  return oc;
}

// ── STEP geometry parser ───────────────────────────────────────────────────────

interface ParsedMesh {
  geometry: THREE.BufferGeometry;
  faceId: string;
  faceIndex: number;
}

function parseSTEPWithOC(
  oc: any,
  buffer: ArrayBuffer
): ParsedMesh[] {
  try {
    const fileName = "model.step";
    oc.FS.createDataFile("/", fileName, new Uint8Array(buffer), true, true, true);

    const reader = new oc.STEPControl_Reader_1();
    reader.ReadFile(fileName);
    reader.TransferRoots(new oc.Message_ProgressRange_1());
    const shape = reader.OneShape();

    const meshes: ParsedMesh[] = [];
    const builder = new oc.BRep_Builder();
    const explorer = new oc.TopExp_Explorer_2(
      shape,
      oc.TopAbs_ShapeEnum.TopAbs_FACE,
      oc.TopAbs_ShapeEnum.TopAbs_SHAPE
    );

    let faceIndex = 0;
    while (explorer.More()) {
      const face = oc.TopoDS.Face_1(explorer.Current());
      const mesh = new oc.BRepMesh_IncrementalMesh_2(face, 0.1, false, 0.1, false);
      mesh.Perform(new oc.Message_ProgressRange_1());

      const location = new oc.TopLoc_Location_1();
      const triangulation = oc.BRep_Tool.Triangulation(face, location, 0);

      if (!triangulation.IsNull()) {
        const positions: number[] = [];
        const normals: number[] = [];
        const indices: number[] = [];

        const nbNodes = triangulation.get().NbNodes();
        const nbTriangles = triangulation.get().NbTriangles();

        for (let i = 1; i <= nbNodes; i++) {
          const node = triangulation.get().Node(i);
          positions.push(node.X(), node.Y(), node.Z());
          normals.push(0, 1, 0); // placeholder
        }

        for (let i = 1; i <= nbTriangles; i++) {
          const tri = triangulation.get().Triangle(i);
          const [n1, n2, n3] = [tri.Value(1) - 1, tri.Value(2) - 1, tri.Value(3) - 1];
          indices.push(n1, n2, n3);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        geo.computeBoundingBox();

        meshes.push({ geometry: geo, faceId: `face_${faceIndex}`, faceIndex });
        faceIndex++;
      }

      explorer.Next();
    }

    oc.FS.unlink(`/${fileName}`);
    return meshes;
  } catch (err) {
    console.error("STEP parse error:", err);
    return [];
  }
}

// ── Face mesh component ────────────────────────────────────────────────────────

function FaceMesh({
  geo,
  faceId,
  isSelected,
  hasDFMIssue,
  onClick,
}: {
  geo: THREE.BufferGeometry;
  faceId: string;
  isSelected: boolean;
  hasDFMIssue: "fail" | "warn" | null;
  onClick: (faceId: string, geo: THREE.BufferGeometry) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const color = isSelected
    ? "#3B82F6"
    : hasDFMIssue === "fail"
    ? "#EF4444"
    : hasDFMIssue === "warn"
    ? "#F59E0B"
    : "#2A3A52";

  const emissive = isSelected
    ? "#1E3A6E"
    : hasDFMIssue
    ? (hasDFMIssue === "fail" ? "#4A0000" : "#4A3000")
    : "#000000";

  return (
    <mesh
      ref={meshRef}
      geometry={geo}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick(faceId, geo);
      }}
    >
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        roughness={0.4}
        metalness={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ── Scene content ──────────────────────────────────────────────────────────────

function SceneContent({
  meshes,
  onFaceClick,
}: {
  meshes: ParsedMesh[];
  onFaceClick: (faceId: string, geo: THREE.BufferGeometry) => void;
}) {
  const { selectedFaceId, selectedFace, dfmIssues, pushPullActive } = useForgeStore();
  const { camera } = useThree();

  // Center camera on model
  useEffect(() => {
    if (meshes.length === 0) return;
    const box = new THREE.Box3();
    meshes.forEach(m => {
      const b = new THREE.Box3();
      b.setFromBufferAttribute(
        m.geometry.attributes.position as THREE.BufferAttribute
      );
      box.union(b);
    });
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    (camera as THREE.PerspectiveCamera).near = maxDim * 0.001;
    (camera as THREE.PerspectiveCamera).far = maxDim * 100;
    camera.position.set(center.x + maxDim * 1.5, center.y + maxDim, center.z + maxDim * 1.5);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  }, [meshes, camera]);

  const dfmMap = new Map(dfmIssues.map(i => [i.faceId, i.severity]));

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-5, -5, -5]} intensity={0.3} />
      <Environment preset="city" />

      <Grid
        args={[100, 100]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1a2030"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#243050"
        fadeDistance={150}
        fadeStrength={1}
        position={[0, -0.01, 0]}
      />

      {meshes.map(({ geometry, faceId }) => (
        <FaceMesh
          key={faceId}
          geo={geometry}
          faceId={faceId}
          isSelected={faceId === selectedFaceId}
          hasDFMIssue={
            (dfmMap.get(faceId) as "fail" | "warn" | null) ?? null
          }
          onClick={onFaceClick}
        />
      ))}

      {/* Measurement labels on selected face */}
      {selectedFace?.center && selectedFace?.id && (
        <MeasurementLabel face={selectedFace} />
      )}

      {/* Push/pull handle on selected face */}
      {pushPullActive && selectedFace?.center && (
        <PushPullHandle face={selectedFace} />
      )}

      <OrbitControls makeDefault />
      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport
          axisColors={["#EF4444", "#22C55E", "#3B82F6"]}
          labelColor="white"
        />
      </GizmoHelper>
    </>
  );
}

// ── Drop zone overlay ──────────────────────────────────────────────────────────

function DropZone() {
  return (
    <div style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "12px",
      pointerEvents: "none",
    }}>
      <div style={{
        border: "2px dashed rgba(59,130,246,0.3)",
        borderRadius: "12px",
        padding: "48px 64px",
        textAlign: "center",
      }}>
        <div style={{ fontSize: "32px", marginBottom: "8px", opacity: 0.4 }}>⬡</div>
        <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>
          Drop a .STEP file here or use the panel to load one
        </div>
        <div style={{
          color: "var(--text-muted)",
          fontSize: "11px",
          marginTop: "6px",
          fontFamily: "var(--font-mono)",
          opacity: 0.6,
        }}>
          .step · .stp
        </div>
      </div>
    </div>
  );
}

// ── Main viewer ────────────────────────────────────────────────────────────────

export default function STEPViewer() {
  const { stepBuffer, stepUrl, selectFace, setMeasurements } = useForgeStore();
  const [meshes, setMeshes] = useState<ParsedMesh[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const oc = useOpenCascade();

  // Parse STEP when buffer or OC changes
  useEffect(() => {
    if (!stepBuffer || !oc) {
      if (stepBuffer && !oc) setLoading(true);
      return;
    }
    setLoading(true);
    setError(null);

    // Run in a setTimeout so UI updates first
    setTimeout(() => {
      try {
        const parsed = parseSTEPWithOC(oc, stepBuffer);
        if (parsed.length === 0) {
          setError("No geometry found in STEP file.");
        } else {
          setMeshes(parsed);
        }
      } catch (e: any) {
        setError(e?.message ?? "Failed to parse STEP file.");
      } finally {
        setLoading(false);
      }
    }, 50);
  }, [stepBuffer, oc]);

  const handleFaceClick = useCallback(
    (faceId: string, geo: THREE.BufferGeometry) => {
      geo.computeBoundingBox();
      const box = geo.boundingBox!;
      const center = new THREE.Vector3();
      box.getCenter(center);
      const size = box.getSize(new THREE.Vector3());

      const face = {
        id: faceId,
        center: [center.x, center.y, center.z] as [number, number, number],
        area: size.x * size.z,
      };
      selectFace(face);
      setMeasurements(faceId, { width: size.x, height: size.y, depth: size.z });
    },
    [selectFace, setMeasurements]
  );

  const hasModel = meshes.length > 0;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: [3, 3, 3], fov: 50 }}
        style={{ background: "#080B10" }}
        onClick={(e) => {
          // Deselect if clicking empty space
          if (e.target === e.currentTarget) selectFace(null);
        }}
      >
        <Suspense fallback={null}>
          {hasModel && (
            <SceneContent meshes={meshes} onFaceClick={handleFaceClick} />
          )}
          {!hasModel && (
            <>
              <OrbitControls makeDefault />
              <Grid
                args={[50, 50]}
                cellSize={1}
                cellColor="#1a2030"
                sectionSize={10}
                sectionColor="#243050"
                position={[0, -0.01, 0]}
                fadeDistance={80}
              />
              <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
                <GizmoViewport
                  axisColors={["#EF4444", "#22C55E", "#3B82F6"]}
                  labelColor="white"
                />
              </GizmoHelper>
            </>
          )}
        </Suspense>
      </Canvas>

      {!hasModel && !loading && <DropZone />}

      {loading && (
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(8,11,16,0.7)",
          backdropFilter: "blur(4px)",
        }}>
          <div style={{
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
          }}>
            Parsing geometry…
          </div>
        </div>
      )}

      {error && (
        <div style={{
          position: "absolute",
          bottom: "16px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(239,68,68,0.15)",
          border: "1px solid rgba(239,68,68,0.4)",
          borderRadius: "6px",
          padding: "8px 16px",
          color: "#FCA5A5",
          fontSize: "12px",
          fontFamily: "var(--font-mono)",
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
