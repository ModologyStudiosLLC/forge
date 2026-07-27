"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { Canvas, useThree, ThreeEvent } from "@react-three/fiber";
import {
  OrbitControls,
  Grid,
  GizmoHelper,
  GizmoViewport,
  Html,
} from "@react-three/drei";
import * as THREE from "three";
import { useForgeStore } from "@/lib/store/forgeStore";
import MeasurementLabel from "./MeasurementLabel";
import PushPullHandle from "./PushPullHandle";

// ── Geometry fetcher — sends STEP to API, receives JSON faces ──────────────────

interface FaceData {
  id: string;
  positions: number[];
  normals: number[];
  indices: number[];
  center: [number, number, number];
}

async function parseSTEP(buffer: ArrayBuffer, fileName: string): Promise<FaceData[]> {
  const formData = new FormData();
  formData.append("file", new Blob([buffer], { type: "application/octet-stream" }), fileName);

  const res = await fetch("/api/cad/parse", { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.faces as FaceData[];
}

function buildGeometry(face: FaceData): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(face.positions, 3));
  geo.setAttribute("normal",   new THREE.Float32BufferAttribute(face.normals, 3));
  geo.setIndex(face.indices);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  return geo;
}

// ── Face mesh ─────────────────────────────────────────────────────────────────

interface ParsedMesh {
  geometry: THREE.BufferGeometry;
  faceId: string;
  center: [number, number, number];
}

function FaceMesh({
  geo, faceId, isSelected, dfmSeverity, onClick,
}: {
  geo: THREE.BufferGeometry;
  faceId: string;
  isSelected: boolean;
  dfmSeverity: "fail" | "warn" | null;
  onClick: (faceId: string, geo: THREE.BufferGeometry, center: [number, number, number]) => void;
}) {
  const center = useRef<[number, number, number]>([0, 0, 0]);
  useEffect(() => {
    if (geo.boundingBox) {
      const c = new THREE.Vector3();
      geo.boundingBox.getCenter(c);
      center.current = [c.x, c.y, c.z];
    }
  }, [geo]);

  const color = isSelected ? "#3B82F6"
    : dfmSeverity === "fail" ? "#EF4444"
    : dfmSeverity === "warn" ? "#F59E0B"
    : "#2A3A52";

  const emissive = isSelected ? "#1E3A6E"
    : dfmSeverity === "fail" ? "#4A0000"
    : dfmSeverity === "warn" ? "#4A3000"
    : "#000000";

  return (
    <mesh
      geometry={geo}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick(faceId, geo, center.current);
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

// ── Scene ─────────────────────────────────────────────────────────────────────

function SceneContent({
  meshes, onFaceClick,
}: {
  meshes: ParsedMesh[];
  onFaceClick: (faceId: string, geo: THREE.BufferGeometry, center: [number, number, number]) => void;
}) {
  const { selectedFaceId, selectedFace, dfmIssues, pushPullActive } = useForgeStore();
  const { camera } = useThree();

  useEffect(() => {
    if (meshes.length === 0) return;
    const box = new THREE.Box3();
    meshes.forEach(m => {
      const b = new THREE.Box3();
      b.setFromBufferAttribute(m.geometry.attributes.position as THREE.BufferAttribute);
      box.union(b);
    });
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    camera.position.set(center.x + maxDim * 1.5, center.y + maxDim, center.z + maxDim * 1.5);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  }, [meshes, camera]);

  const dfmMap = new Map(dfmIssues.map(i => [i.faceId, i.severity as "fail" | "warn"]));

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} />
      <directionalLight position={[-5, -5, -5]} intensity={0.3} />

      <Grid
        args={[100, 100]}
        cellSize={1} cellThickness={0.5} cellColor="#1a2030"
        sectionSize={10} sectionThickness={1} sectionColor="#243050"
        fadeDistance={150} position={[0, -0.01, 0]}
      />

      {meshes.map(({ geometry, faceId, center }) => (
        <FaceMesh
          key={faceId}
          geo={geometry}
          faceId={faceId}
          isSelected={faceId === selectedFaceId}
          dfmSeverity={dfmMap.get(faceId) ?? null}
          onClick={(id, geo, c) => onFaceClick(id, geo, c)}
        />
      ))}

      {selectedFace?.center && <MeasurementLabel face={selectedFace} />}
      {pushPullActive && selectedFace?.center && <PushPullHandle face={selectedFace} />}

      <OrbitControls makeDefault />
      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport axisColors={["#EF4444", "#22C55E", "#3B82F6"]} labelColor="white" />
      </GizmoHelper>
    </>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────

function DropZone() {
  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      pointerEvents: "none",
    }}>
      <div style={{
        border: "2px dashed rgba(59,130,246,0.3)", borderRadius: "12px",
        padding: "48px 64px", textAlign: "center",
      }}>
        <div style={{ fontSize: "28px", marginBottom: "8px", opacity: 0.35 }}>⬡</div>
        <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>
          Drop a .STEP file here or use the panel to load one
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "6px", fontFamily: "var(--font-mono)", opacity: 0.6 }}>
          .step · .stp
        </div>
      </div>
    </div>
  );
}

// ── Main viewer ───────────────────────────────────────────────────────────────

export default function STEPViewer() {
  const { stepBuffer, meshFaces, modelName, selectFace, setMeasurements, setDFMIssues } = useForgeStore();
  const [meshes, setMeshes] = useState<ParsedMesh[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastBuffer = useRef<ArrayBuffer | null>(null);
  const lastMeshFaces = useRef<FaceData[] | null>(null);

  const applyFaces = useCallback((faces: FaceData[]) => {
    const parsed: ParsedMesh[] = faces.map(f => ({
      geometry: buildGeometry(f),
      faceId: f.id,
      center: f.center,
    }));
    setMeshes(parsed);

    // DFM is a secondary pass — a failure here shouldn't break the viewer.
    fetch("/api/cad/dfm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ faces }),
    })
      .then(res => res.json())
      .then(data => setDFMIssues(data.issues ?? []))
      .catch(e => console.error("DFM analysis failed:", e));
  }, [setDFMIssues]);

  useEffect(() => {
    if (!stepBuffer || stepBuffer === lastBuffer.current) return;
    lastBuffer.current = stepBuffer;
    setLoading(true);
    setError(null);
    setMeshes([]);

    parseSTEP(stepBuffer, modelName ?? "model.step")
      .then(faces => applyFaces(faces))
      .catch(e => setError(e.message ?? "Failed to parse STEP file."))
      .finally(() => setLoading(false));
  }, [stepBuffer, modelName, applyFaces]);

  useEffect(() => {
    if (!meshFaces || meshFaces === lastMeshFaces.current) return;
    lastMeshFaces.current = meshFaces;
    setError(null);
    setMeshes([]);
    applyFaces(meshFaces);
  }, [meshFaces, applyFaces]);

  const handleFaceClick = useCallback(
    (faceId: string, geo: THREE.BufferGeometry, center: [number, number, number]) => {
      geo.computeBoundingBox();
      const size = geo.boundingBox!.getSize(new THREE.Vector3());
      selectFace({ id: faceId, center, area: size.x * size.z });
      setMeasurements(faceId, { width: size.x, height: size.y, depth: size.z });
    },
    [selectFace, setMeasurements]
  );

  const hasModel = meshes.length > 0;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas camera={{ position: [3, 3, 3], fov: 50 }} style={{ background: "#080B10" }}>
        <Suspense fallback={null}>
          {hasModel
            ? <SceneContent meshes={meshes} onFaceClick={handleFaceClick} />
            : <>
                <OrbitControls makeDefault />
                <Grid args={[50, 50]} cellSize={1} cellColor="#1a2030"
                  sectionSize={10} sectionColor="#243050"
                  position={[0, -0.01, 0]} fadeDistance={80} />
                <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
                  <GizmoViewport axisColors={["#EF4444", "#22C55E", "#3B82F6"]} labelColor="white" />
                </GizmoHelper>
              </>
          }
        </Suspense>
      </Canvas>

      {!hasModel && !loading && <DropZone />}

      {loading && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(8,11,16,0.75)", backdropFilter: "blur(4px)",
        }}>
          <div style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
            Parsing geometry…
          </div>
        </div>
      )}

      {error && (
        <div style={{
          position: "absolute", bottom: "16px", left: "50%", transform: "translateX(-50%)",
          background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)",
          borderRadius: "6px", padding: "8px 16px",
          color: "#FCA5A5", fontSize: "12px", fontFamily: "var(--font-mono)",
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
