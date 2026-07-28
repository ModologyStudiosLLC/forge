"use client";

import { useEffect, useRef, useState } from "react";
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

// Mirrors the MATERIALS keys/labels/groups in src/app/api/cad/bom/route.ts.
const MATERIAL_GROUPS = [
  {
    label: "Wrought (CNC)",
    options: [
      { value: "aluminum-6061", label: "Aluminum 6061" },
      { value: "steel-1018", label: "Mild Steel 1018" },
      { value: "stainless-304", label: "Stainless Steel 304" },
      { value: "stainless-17-4ph", label: "Stainless Steel 17-4PH" },
      { value: "titanium-ti6al4v", label: "Titanium Ti-6Al-4V" },
    ],
  },
  {
    label: "Metal Binder Jet",
    options: [
      { value: "bj-316l", label: "316L Stainless" },
      { value: "bj-17-4ph", label: "17-4PH Stainless" },
      { value: "bj-420-bronze", label: "420 Stainless + Bronze" },
      { value: "bj-tungsten-carbide", label: "Tungsten Carbide-Cobalt" },
    ],
  },
  {
    label: "SLA/DLP Resin",
    options: [
      { value: "resin-standard", label: "Standard Resin" },
      { value: "resin-tough", label: "Tough/Durable Resin" },
      { value: "resin-castable", label: "Castable Resin (investment casting)" },
    ],
  },
] as const;

export default function PropertiesPanel() {
  const {
    selectedFace,
    selectedFaceId,
    measurements,
    dfmIssues,
    selectionMode,
    modelName,
    aiSuggestions,
    setAISuggestion,
    volumeMm3,
    material,
    setMaterial,
    bom,
    setBOM,
    meshFaces,
    stepBuffer,
  } = useForgeStore();

  const dims = selectedFaceId ? measurements[selectedFaceId] : null;
  const faceDFM = dfmIssues.filter(i => i.faceId === selectedFaceId);
  const globalDFM = dfmIssues.filter(i => !i.faceId);
  const currentSuggestion = selectedFaceId ? aiSuggestions[selectedFaceId] : null;
  const traceInputRef = useRef<HTMLInputElement>(null);
  // tracks which faceId has an in-flight request — per-face so rapid clicks don't corrupt loading state
  const [loadingFaceId, setLoadingFaceId] = useState<string | null>(null);
  const lastFetchedRef = useRef<string | null>(null);
  const aiLoading = loadingFaceId === selectedFaceId;
  const [bomLoading, setBomLoading] = useState(false);
  const [bomError, setBomError] = useState<string | null>(null);
  const [gcodeLoading, setGcodeLoading] = useState(false);
  const [gcodeError, setGcodeError] = useState<string | null>(null);
  const [gcodeUrl, setGcodeUrl] = useState<string | null>(null);

  // Auto-calculate BOM whenever the loaded part's volume or chosen material changes
  useEffect(() => {
    if (!volumeMm3) return;
    setBomLoading(true);
    setBomError(null);
    fetch("/api/cad/bom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ volumeMm3, material }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setBOM(data);
      })
      .catch(e => setBomError(e.message ?? "BOM calculation failed"))
      .finally(() => setBomLoading(false));
  }, [volumeMm3, material]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerateGcode() {
    if (!stepBuffer) return;
    setGcodeLoading(true);
    setGcodeError(null);
    if (gcodeUrl) URL.revokeObjectURL(gcodeUrl);
    setGcodeUrl(null);

    const formData = new FormData();
    formData.append("file", new Blob([stepBuffer], { type: "application/octet-stream" }), modelName ?? "model.step");

    try {
      const res = await fetch("/api/cad/gcode", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const blob = new Blob([data.gcode], { type: "text/plain" });
      setGcodeUrl(URL.createObjectURL(blob));
    } catch (e) {
      setGcodeError(e instanceof Error ? e.message : "G-code generation failed");
    } finally {
      setGcodeLoading(false);
    }
  }

  // Auto-fetch suggestion when a face with dimensions is selected
  useEffect(() => {
    if (!selectedFaceId || !selectedFace || !dims) return;
    if (aiSuggestions[selectedFaceId]) return; // already cached
    if (lastFetchedRef.current === selectedFaceId) return;

    lastFetchedRef.current = selectedFaceId;
    setLoadingFaceId(selectedFaceId);

    fetch("/api/cad/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelName,
        faceId: selectedFaceId,
        dims,
        face: {
          area: selectedFace.area,
          normal: selectedFace.normal,
          center: selectedFace.center,
        },
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.suggestion) setAISuggestion(selectedFaceId, data.suggestion);
      })
      .catch(() => setAISuggestion(selectedFaceId, "Suggestion unavailable."))
      .finally(() => setLoadingFaceId(prev => prev === selectedFaceId ? null : prev));
  }, [selectedFaceId, dims]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleTraceUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedFaceId || !dims || !selectedFace) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const [header, b64] = dataUrl.split(",");
      const mimeType = header.match(/:(.*?);/)?.[1] ?? "image/png";

      setLoadingFaceId(selectedFaceId);
      try {
        const r = await fetch("/api/cad/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelName,
            faceId: selectedFaceId,
            dims,
            face: {
              area: selectedFace.area,
              normal: selectedFace.normal,
              center: selectedFace.center,
            },
            traceBase64: b64,
            traceMimeType: mimeType,
          }),
        });
        const data = await r.json();
        if (data.suggestion) setAISuggestion(selectedFaceId, data.suggestion);
      } catch {
        // keep existing suggestion
      } finally {
        setLoadingFaceId(prev => prev === selectedFaceId ? null : prev);
        // reset so same file can be uploaded again
        e.target.value = "";
      }
    };
    reader.readAsDataURL(file);
  }

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

        {/* BOM — model-level, independent of face selection */}
        {modelName && (
          <section style={{ marginBottom: "16px" }}>
            <div style={sectionHeader}>Bill of Materials</div>
            <div style={{ marginBottom: "8px" }}>
              <select
                value={material}
                onChange={e => setMaterial(e.target.value)}
                style={{
                  width: "100%",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  color: "var(--text)",
                  fontSize: "11px",
                  padding: "5px 6px",
                }}
              >
                {MATERIAL_GROUPS.map(group => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {!volumeMm3 ? (
              <div style={{ color: "var(--text-muted)", fontSize: "11px", fontStyle: "italic" }}>
                {meshFaces
                  ? "BOM needs an exact solid volume — not available for image→3D meshes yet."
                  : "Volume unavailable for this model."}
              </div>
            ) : bomLoading ? (
              <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>Calculating...</div>
            ) : bomError ? (
              <div style={{ color: "var(--dfm-fail)", fontSize: "11px" }}>{bomError}</div>
            ) : bom ? (
              <>
                <div style={propRow}>
                  <span style={propLabel}>Volume</span>
                  <span style={propValue}>{(bom.volumeMm3 / 1000).toFixed(2)} cm³</span>
                </div>
                <div style={propRow}>
                  <span style={propLabel}>Mass</span>
                  <span style={propValue}>{bom.massKg.toFixed(3)} kg</span>
                </div>
                <div style={propRow}>
                  <span style={propLabel}>Material cost</span>
                  <span style={propValue}>${bom.materialCostUsd.toFixed(2)}</span>
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: "10px", marginTop: "6px", lineHeight: "1.5" }}>
                  {bom.priceNote}
                </div>
              </>
            ) : null}
          </section>
        )}

        {/* G-code — 3-axis roughing pass, fixed default preset (6mm endmill, no parameter UI yet) */}
        {modelName && (
          <section style={{ marginBottom: "16px" }}>
            <div style={sectionHeader}>G-code (3-axis roughing)</div>
            {!stepBuffer ? (
              <div style={{ color: "var(--text-muted)", fontSize: "11px", fontStyle: "italic" }}>
                G-code needs a real CAD solid — not available for image→3D meshes yet.
              </div>
            ) : (
              <>
                <button
                  onClick={handleGenerateGcode}
                  disabled={gcodeLoading}
                  style={{
                    width: "100%",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: "4px",
                    color: "var(--text)",
                    fontSize: "11px",
                    padding: "6px 8px",
                    cursor: gcodeLoading ? "default" : "pointer",
                  }}
                >
                  {gcodeLoading ? "Generating…" : "Generate G-code"}
                </button>
                {gcodeError && (
                  <div style={{ color: "var(--dfm-fail)", fontSize: "11px", marginTop: "6px" }}>
                    {gcodeError}
                  </div>
                )}
                {gcodeUrl && (
                  <a
                    href={gcodeUrl}
                    download={`${(modelName ?? "model").replace(/\.(step|stp)$/i, "")}.ngc`}
                    style={{
                      display: "block",
                      marginTop: "6px",
                      fontSize: "11px",
                      color: "var(--accent, #3B82F6)",
                    }}
                  >
                    Download .ngc
                  </a>
                )}
                <div style={{ color: "var(--text-muted)", fontSize: "10px", marginTop: "6px", lineHeight: "1.5" }}>
                  Fixed preset: 6mm flat endmill, 2mm stepdown, 50% stepover, 5mm stock margin. No parameter picker yet.
                </div>
              </>
            )}
          </section>
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

        {/* AI Rail */}
        <section>
          <div style={{ ...sectionHeader, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>AI Rail</span>
            {selectedFaceId && dims && (
              <>
                <button
                  onClick={() => traceInputRef.current?.click()}
                  title="Add product_trace reference image"
                  style={{
                    background: "none",
                    border: "1px solid var(--border)",
                    borderRadius: "4px",
                    color: "var(--text-muted)",
                    fontSize: "9px",
                    padding: "2px 6px",
                    cursor: "pointer",
                    letterSpacing: "0.05em",
                  }}
                >
                  + trace
                </button>
                <input
                  ref={traceInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleTraceUpload}
                />
              </>
            )}
          </div>

          {aiLoading ? (
            <div style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "10px",
              color: "var(--text-muted)",
              fontSize: "11px",
            }}>
              <span style={{ opacity: 0.7 }}>Analyzing face...</span>
            </div>
          ) : currentSuggestion ? (
            <div style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "10px",
              color: "var(--text)",
              fontSize: "11px",
              lineHeight: "1.6",
              whiteSpace: "pre-wrap",
            }}>
              {currentSuggestion}
            </div>
          ) : (
            <div style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "10px",
              color: "var(--text-muted)",
              fontSize: "11px",
              fontStyle: "italic",
            }}>
              {selectedFaceId && !dims
                ? "Waiting for face dimensions..."
                : "Select a face to get AI suggestions."}
            </div>
          )}
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
