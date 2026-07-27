"use client";

import { useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useForgeStore } from "@/lib/store/forgeStore";
import PropertiesPanel from "@/components/panels/PropertiesPanel";
import Toolbar from "@/components/panels/Toolbar";
import StatusBar from "@/components/panels/StatusBar";

// STEP viewer must be client-only (WebGL + WASM)
const STEPViewer = dynamic(() => import("@/components/canvas/STEPViewer"), {
  ssr: false,
  loading: () => (
    <div style={{
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--text-muted)",
      fontFamily: "var(--font-mono)",
      fontSize: "12px",
    }}>
      Loading canvas…
    </div>
  ),
});

type ImageUploadState =
  | { status: "idle" }
  | { status: "generating" }
  | { status: "error"; message: string };

type NL2StepState =
  | { status: "idle" }
  | { status: "generating" }
  | { status: "error"; message: string };

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export default function WorkspacePage() {
  const { modelName } = useForgeStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageUpload, setImageUpload] = useState<ImageUploadState>({ status: "idle" });
  const [nlPrompt, setNlPrompt] = useState("");
  const [nl2step, setNl2step] = useState<NL2StepState>({ status: "idle" });

  const handleGenerateFromText = useCallback(async () => {
    if (!nlPrompt.trim()) return;
    setNl2step({ status: "generating" });

    try {
      const res = await fetch("/api/cad/nl2step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: nlPrompt }),
      });
      const data = await res.json();

      if (!res.ok) {
        setNl2step({ status: "error", message: data.error ?? "Generation failed" });
        setTimeout(() => setNl2step({ status: "idle" }), 5000);
        return;
      }

      const buf = base64ToArrayBuffer(data.step_b64);
      const name = nlPrompt.trim().slice(0, 40).replace(/[^a-z0-9]+/gi, "_") + ".step";
      useForgeStore.getState().loadStepBuffer(buf, name);
      setNl2step({ status: "idle" });
    } catch {
      setNl2step({ status: "error", message: "Could not reach nl2step" });
      setTimeout(() => setNl2step({ status: "idle" }), 5000);
    }
  }, [nlPrompt]);

  const handleImageFile = useCallback(async (file: File) => {
    setImageUpload({ status: "generating" });
    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/cad/image23d", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setImageUpload({ status: "error", message: data.error ?? "Generation failed" });
        setTimeout(() => setImageUpload({ status: "idle" }), 4000);
        return;
      }

      useForgeStore.getState().loadMeshFaces(data.faces, file.name.replace(/\.[^.]+$/, "") + ".glb");
      setImageUpload({ status: "idle" });
    } catch {
      setImageUpload({ status: "error", message: "Could not reach TripoSR" });
      setTimeout(() => setImageUpload({ status: "idle" }), 4000);
    }
  }, []);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".step") || file.name.endsWith(".stp"))) {
      useForgeStore.getState().loadStepFile(file);
    }
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <Toolbar />

      {/* Main 3-panel layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left panel — future: palette / tools */}
        <div style={{
          width: "200px",
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          flexShrink: 0,
        }}>
          <div style={{ color: "var(--text-muted)", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Files
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: "var(--surface-2)",
              border: "1px dashed var(--border)",
              borderRadius: "6px",
              padding: "12px 8px",
              color: "var(--text-muted)",
              fontSize: "11px",
              cursor: "pointer",
              textAlign: "center",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            + Load STEP file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".step,.stp"
            style={{ display: "none" }}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) useForgeStore.getState().loadStepFile(file);
            }}
          />

          <button
            onClick={() => imageInputRef.current?.click()}
            disabled={imageUpload.status === "generating"}
            style={{
              background: "var(--surface-2)",
              border: "1px dashed var(--border)",
              borderRadius: "6px",
              padding: "12px 8px",
              color: "var(--text-muted)",
              fontSize: "11px",
              cursor: imageUpload.status === "generating" ? "not-allowed" : "pointer",
              opacity: imageUpload.status === "generating" ? 0.5 : 1,
              textAlign: "center",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            {imageUpload.status === "generating" ? "Generating…" : "+ Image → 3D"}
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleImageFile(file);
              e.target.value = "";
            }}
          />
          {imageUpload.status === "error" && (
            <div style={{ fontSize: "11px", color: "var(--dfm-fail)" }}>
              {imageUpload.message}
            </div>
          )}

          <div style={{ color: "var(--text-muted)", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: "8px" }}>
            Generate
          </div>
          <textarea
            value={nlPrompt}
            onChange={e => setNlPrompt(e.target.value)}
            placeholder="Describe a part, e.g. a 40mm mounting bracket with two 5mm bolt holes"
            rows={4}
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "8px",
              color: "var(--text)",
              fontSize: "11px",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={handleGenerateFromText}
            disabled={nl2step.status === "generating" || !nlPrompt.trim()}
            style={{
              background: "var(--accent)",
              border: "none",
              borderRadius: "6px",
              padding: "8px",
              color: "#fff",
              fontSize: "11px",
              fontWeight: 600,
              cursor: nl2step.status === "generating" || !nlPrompt.trim() ? "not-allowed" : "pointer",
              opacity: nl2step.status === "generating" || !nlPrompt.trim() ? 0.5 : 1,
            }}
          >
            {nl2step.status === "generating" ? "Generating…" : "Generate STEP"}
          </button>
          {nl2step.status === "error" && (
            <div style={{ fontSize: "11px", color: "var(--dfm-fail)" }}>
              {nl2step.message}
            </div>
          )}

          {modelName && (
            <div style={{
              background: "var(--surface-2)",
              borderRadius: "4px",
              padding: "8px",
              fontSize: "11px",
              color: "var(--text)",
              fontFamily: "var(--font-mono)",
              wordBreak: "break-all",
            }}>
              {modelName}
            </div>
          )}
        </div>

        {/* Center canvas */}
        <div
          style={{ flex: 1, position: "relative", overflow: "hidden" }}
          onDragOver={e => e.preventDefault()}
          onDrop={handleFileDrop}
        >
          <STEPViewer />
        </div>

        {/* Right panel — properties */}
        <PropertiesPanel />
      </div>

      {/* Bottom status bar */}
      <StatusBar />
    </div>
  );
}
