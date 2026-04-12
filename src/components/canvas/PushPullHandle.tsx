"use client";

import { useRef, useState, useCallback } from "react";
import { ThreeEvent, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { useForgeStore, SelectedFace } from "@/lib/store/forgeStore";

interface Props {
  face: SelectedFace;
}

const ARROW_LENGTH = 0.5;

export default function PushPullHandle({ face }: Props) {
  const { camera, gl } = useThree();
  const [dragging, setDragging] = useState(false);
  const [delta, setDelta] = useState(0);
  const startY = useRef(0);

  if (!face.center) return null;
  const [x, y, z] = face.center;
  const normal = face.normal ?? [0, 1, 0];

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setDragging(true);
    startY.current = e.clientY;
    gl.domElement.style.cursor = "ns-resize";

    const onMove = (ev: PointerEvent) => {
      const diff = (startY.current - ev.clientY) * 0.01;
      setDelta(diff);
    };
    const onUp = (ev: PointerEvent) => {
      const finalDelta = (startY.current - ev.clientY) * 0.01;
      setDragging(false);
      gl.domElement.style.cursor = "default";
      // Dispatch to backend
      useForgeStore.getState().setPushPullActive(false);
      window.dispatchEvent(new CustomEvent("forge:pushpull", {
        detail: { faceId: face.id, delta: finalDelta },
      }));
      setDelta(0);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [face.id, gl]);

  const tipY = y + ARROW_LENGTH + delta;

  return (
    <group position={[x, y, z]}>
      {/* Arrow shaft */}
      <mesh position={[0, ARROW_LENGTH / 2 + delta / 2, 0]}>
        <cylinderGeometry args={[0.02, 0.02, ARROW_LENGTH + delta, 8]} />
        <meshStandardMaterial color="#3B82F6" />
      </mesh>

      {/* Arrow head — draggable */}
      <mesh
        position={[0, tipY - y, 0]}
        onPointerDown={handlePointerDown}
      >
        <coneGeometry args={[0.08, 0.2, 8]} />
        <meshStandardMaterial
          color={dragging ? "#60A5FA" : "#3B82F6"}
          emissive={dragging ? "#1E3A6E" : "#000"}
        />
      </mesh>

      {/* Delta label when dragging */}
      {dragging && (
        <Html position={[0.3, tipY - y, 0]} style={{ pointerEvents: "none" }}>
          <div style={{
            background: "rgba(59,130,246,0.9)",
            color: "#fff",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            padding: "3px 8px",
            borderRadius: "4px",
            whiteSpace: "nowrap",
          }}>
            {delta >= 0 ? "+" : ""}{(delta * 1000).toFixed(1)} mm
          </div>
        </Html>
      )}
    </group>
  );
}
