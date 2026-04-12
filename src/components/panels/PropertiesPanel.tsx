"use client";

import { useForgeStore } from "@/lib/store/forgeStore";

const SEVERITY_COLOR = {
  fail: "#EF4444",
  warn: "#F59E0B",
  info: "#3B82F6",
} as const;

const SEVERITY_LABEL = {
  fail: "Error",
  warn: "Warning",
  info: "Info",
} as const;

export default function PropertiesPanel() {
  const {
    selectedFace,
    selectedFaceId,
    measurements,
    dfmIssues,
    selectionMode,
  } = useForgeStore();

  const dims = selectedFaceId ? measurements[selectedFaceId] : null;
  const faceDFM = dfmIssues.filter(i => i.faceId === selectedFaceId);
  const globalDFM = dfmIssues.filter(i => !i.faceId);

  return (
    <div style={{
      width: "260px",
      background: "var(--surface)",
      borderLeft: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "10px 12px",
        borderBottom: "1px solid var(--border)",
        fontSize: "10px",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
      }}>
        Properties
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>

        {/* Selection info */}
        {selectedFace ? (
          <section style={{ marginBottom: "16px" }}>
            <div style={sectionHeader}>Selected {selectionMode}</div>
            <div style={propRow}>
              <span style={propLabel}>ID</span>
              <span style={propValue}>{selectedFace.id}</span>
            </div>
            {dims && (
              <>
                <div style={propRow}>
                  <span style={propLabel}>Width</span>
                  <span style={propValue}>{dims.width.toFixed(3)} mm</span>
                </div>
                <div style={propRow}>
                  <span style={propLabel}>Height</span>
                  <span style={propValue}>{dims.height.toFixed(3)} mm</span>
                </div>
                <div style={propRow}>
                  <span style={propLabel}>Depth</span>
                  <span style={propValue}>{dims.depth.toFixed(3)} mm</span>
                </div>
              </>
            )}
            {selectedFace.center && (
              <div style={propRow}>
                <span style={propLabel}>Center</span>
                <span style={{ ...propValue, fontFamily: "var(--font-mono)", fontSize: "10px" }}>
                  {selectedFace.center.map(v => v.toFixed(2)).join(", ")}
                </span>
              </div>
            )}
          </section>
        ) : (
          <div style={{
            color: "var(--text-muted)",
            fontSize: "11px",
            textAlign: "center",
            padding: "24px 0",
          }}>
            Click a face to inspect
          </div>
        )}

        {/* DFM on selected face */}
        {faceDFM.length > 0 && (
          <section style={{ marginBottom: "16px" }}>
            <div style={sectionHeader}>DFM — This Face</div>
            {faceDFM.map((issue, i) => (
              <DFMRow key={i} issue={issue} />
            ))}
          </section>
        )}

        {/* Global DFM issues */}
        {globalDFM.length > 0 && (
          <section style={{ marginBottom: "16px" }}>
            <div style={sectionHeader}>DFM — Model</div>
            {globalDFM.map((issue, i) => (
              <DFMRow key={i} issue={issue} />
            ))}
          </section>
        )}

        {/* AI Rail placeholder */}
        <section>
          <div style={sectionHeader}>AI Rail</div>
          <div style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "10px",
            color: "var(--text-muted)",
            fontSize: "11px",
            fontStyle: "italic",
          }}>
            Select a face to get AI suggestions.
          </div>
        </section>
      </div>
    </div>
  );
}

function DFMRow({ issue }: { issue: import("@/lib/store/forgeStore").DFMIssue }) {
  const color = SEVERITY_COLOR[issue.severity];
  const label = SEVERITY_LABEL[issue.severity];
  return (
    <div style={{
      display: "flex",
      gap: "8px",
      alignItems: "flex-start",
      marginBottom: "6px",
      fontSize: "11px",
    }}>
      <span style={{
        color,
        fontWeight: 700,
        fontSize: "10px",
        flexShrink: 0,
        marginTop: "1px",
      }}>
        {label}
      </span>
      <span style={{ color: "var(--text)" }}>{issue.message}</span>
    </div>
  );
}

const sectionHeader: React.CSSProperties = {
  fontSize: "10px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  marginBottom: "8px",
};

const propRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "4px 0",
  borderBottom: "1px solid var(--border)",
  gap: "8px",
};

const propLabel: React.CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "11px",
  flexShrink: 0,
};

const propValue: React.CSSProperties = {
  color: "var(--text)",
  fontSize: "11px",
  textAlign: "right",
  wordBreak: "break-all",
};
