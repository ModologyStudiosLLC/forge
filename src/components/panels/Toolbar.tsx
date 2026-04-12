"use client";

import { useForgeStore, SelectionMode } from "@/lib/store/forgeStore";

const MODES: { value: SelectionMode; label: string }[] = [
  { value: "face",   label: "Face" },
  { value: "edge",   label: "Edge" },
  { value: "vertex", label: "Vertex" },
  { value: "body",   label: "Body" },
];

export default function Toolbar() {
  const { selectionMode, setSelectionMode, pushPullActive, setPushPullActive, modelName } = useForgeStore();

  return (
    <div style={{
      height: "44px",
      background: "var(--surface)",
      borderBottom: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      padding: "0 16px",
      gap: "24px",
      flexShrink: 0,
    }}>
      {/* Brand */}
      <div style={{
        fontWeight: 700,
        fontSize: "15px",
        letterSpacing: "-0.01em",
        color: "var(--text)",
      }}>
        Forge
      </div>

      <div style={{ width: "1px", height: "20px", background: "var(--border)" }} />

      {/* Mode selector */}
      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
        <span style={{ color: "var(--text-muted)", fontSize: "11px", marginRight: "6px" }}>
          SELECT
        </span>
        {MODES.map(m => (
          <button
            key={m.value}
            onClick={() => setSelectionMode(m.value)}
            style={{
              padding: "3px 10px",
              borderRadius: "4px",
              border: "1px solid",
              borderColor: selectionMode === m.value ? "var(--accent)" : "var(--border)",
              background: selectionMode === m.value ? "var(--accent-dim)" : "transparent",
              color: selectionMode === m.value ? "var(--accent)" : "var(--text-muted)",
              fontSize: "11px",
              cursor: "pointer",
              transition: "all 0.1s",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div style={{ width: "1px", height: "20px", background: "var(--border)" }} />

      {/* Push/pull toggle */}
      <button
        onClick={() => setPushPullActive(!pushPullActive)}
        style={{
          padding: "3px 10px",
          borderRadius: "4px",
          border: "1px solid",
          borderColor: pushPullActive ? "var(--measure)" : "var(--border)",
          background: pushPullActive ? "rgba(163,230,53,0.08)" : "transparent",
          color: pushPullActive ? "var(--measure)" : "var(--text-muted)",
          fontSize: "11px",
          cursor: "pointer",
        }}
      >
        Push / Pull
      </button>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Model name */}
      {modelName && (
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          color: "var(--text-muted)",
        }}>
          {modelName}
        </div>
      )}

      {/* Placeholder actions */}
      <div style={{ display: "flex", gap: "8px" }}>
        {["Undo", "Redo"].map(label => (
          <button
            key={label}
            style={{
              padding: "3px 10px",
              borderRadius: "4px",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-muted)",
              fontSize: "11px",
              cursor: "not-allowed",
              opacity: 0.5,
            }}
          >
            {label}
          </button>
        ))}
        <button style={{
          padding: "3px 12px",
          borderRadius: "4px",
          border: "none",
          background: "var(--accent)",
          color: "#fff",
          fontSize: "11px",
          fontWeight: 600,
          cursor: "pointer",
          opacity: 0.5,
        }}>
          Export
        </button>
      </div>
    </div>
  );
}
