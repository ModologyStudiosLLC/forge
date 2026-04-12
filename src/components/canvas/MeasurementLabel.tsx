"use client";

import { Html } from "@react-three/drei";
import { useForgeStore, SelectedFace } from "@/lib/store/forgeStore";

interface Props {
  face: SelectedFace;
}

export default function MeasurementLabel({ face }: Props) {
  const { measurements, selectedFaceId } = useForgeStore();
  const dims = selectedFaceId ? measurements[selectedFaceId] : null;

  if (!face.center || !dims) return null;

  const [x, y, z] = face.center;

  return (
    <Html
      position={[x, y + 0.5, z]}
      center
      style={{ pointerEvents: "none" }}
    >
      <div style={{
        background: "rgba(8,11,16,0.88)",
        border: "1px solid rgba(163,230,53,0.4)",
        borderRadius: "4px",
        padding: "6px 10px",
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        color: "#A3E635",
        whiteSpace: "nowrap",
        lineHeight: 1.6,
        backdropFilter: "blur(4px)",
      }}>
        <div>W: {dims.width.toFixed(2)} mm</div>
        <div>H: {dims.height.toFixed(2)} mm</div>
        <div>D: {dims.depth.toFixed(2)} mm</div>
      </div>
    </Html>
  );
}
