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

export default function WorkspacePage() {
  const { modelName } = useForgeStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageUpload, setImageUpload] = useState<ImageUploadState>({ status: "idle" });

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
