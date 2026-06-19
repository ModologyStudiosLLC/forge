"use client";

import { useState } from "react";
import { useForgeStore, SelectionMode } from "@/lib/store/forgeStore";

const MODES: { value: SelectionMode; label: string }[] = [
  { value: "face",   label: "Face" },
  { value: "edge",   label: "Edge" },
  { value: "vertex", label: "Vertex" },
  { value: "body",   label: "Body" },
];

type SendState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "ok"; price: number; quoteId: number }
  | { status: "error"; message: string };

export default function Toolbar() {
  const { selectionMode, setSelectionMode, pushPullActive, setPushPullActive, modelName, stepBuffer } = useForgeStore();
  const [send, setSend] = useState<SendState>({ status: "idle" });

  const canSend = !!stepBuffer && !!modelName && send.status !== "sending";

  async function handleSendToAlloy() {
    if (!stepBuffer || !modelName) return;

    setSend({ status: "sending" });

    const form = new FormData();
    form.append("file", new Blob([stepBuffer], { type: "application/octet-stream" }), modelName);
    form.append("material", "17-4PH");
    form.append("quantity", "1");

    try {
      const res = await fetch("/api/alloy/quote", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setSend({ status: "error", message: data.error ?? "Quote failed" });
        setTimeout(() => setSend({ status: "idle" }), 4000);
        return;
      }

      setSend({ status: "ok", price: data.quoted_price, quoteId: data.id });
    } catch {
      setSend({ status: "error", message: "Could not reach Alloy" });
      setTimeout(() => setSend({ status: "idle" }), 4000);
    }
  }

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

      {/* Actions */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
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

        {/* Quote result inline */}
        {send.status === "ok" && (
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setSend({ status: "idle" })}
            style={{
              fontSize: "11px",
              color: "var(--measure)",
              fontFamily: "var(--font-mono)",
              textDecoration: "none",
              borderBottom: "1px solid currentColor",
            }}
          >
            ~${send.price.toFixed(2)} → view in Alloy
          </a>
        )}
        {send.status === "error" && (
          <span style={{ fontSize: "11px", color: "var(--dfm-fail)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {send.message}
          </span>
        )}

        <button
          onClick={handleSendToAlloy}
          disabled={!canSend}
          style={{
            padding: "3px 12px",
            borderRadius: "4px",
            border: "none",
            background: canSend ? "var(--accent)" : "var(--accent)",
            color: "#fff",
            fontSize: "11px",
            fontWeight: 600,
            cursor: canSend ? "pointer" : "not-allowed",
            opacity: canSend ? 1 : 0.5,
            transition: "opacity 0.1s",
          }}
        >
          {send.status === "sending" ? "Sending..." : "Send to Alloy"}
        </button>
      </div>
    </div>
  );
}
