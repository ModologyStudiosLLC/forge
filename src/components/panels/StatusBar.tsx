"use client";

import { useForgeStore } from "@/lib/store/forgeStore";

export default function StatusBar() {
  const { modelName, selectedFaceId, dfmIssues, selectionMode } = useForgeStore();

  const fails  = dfmIssues.filter(i => i.severity === "fail").length;
  const warns  = dfmIssues.filter(i => i.severity === "warn").length;

  return (
    <div style={{
      height: "28px",
      background: "var(--surface)",
      borderTop: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      padding: "0 12px",
      gap: "20px",
      fontSize: "11px",
      color: "var(--text-muted)",
      flexShrink: 0,
      fontFamily: "var(--font-mono)",
    }}>
      <span>Phase 1 — STEP Viewer</span>

      <Dot />

      <span style={{ color: modelName ? "var(--text)" : "var(--text-muted)" }}>
        {modelName ?? "No model loaded"}
      </span>

      {selectedFaceId && (
        <>
          <Dot />
          <span style={{ color: "var(--accent)" }}>
            {selectionMode}: {selectedFaceId}
          </span>
        </>
      )}

      <div style={{ flex: 1 }} />

      {fails > 0 && (
        <span style={{ color: "#EF4444" }}>
          {fails} DFM error{fails > 1 ? "s" : ""}
        </span>
      )}
      {warns > 0 && (
        <span style={{ color: "#F59E0B" }}>
          {warns} warning{warns > 1 ? "s" : ""}
        </span>
      )}
      {dfmIssues.length === 0 && modelName && (
        <span style={{ color: "#22C55E" }}>DFM OK</span>
      )}
    </div>
  );
}

function Dot() {
  return (
    <span style={{ color: "var(--border)", userSelect: "none" }}>·</span>
  );
}
