import Link from "next/link";

export default function Home() {
  return (
    <main style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      gap: "24px",
      background: "var(--bg)",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          letterSpacing: "0.2em",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}>
          AI Hardware Studio
        </div>
        <h1 style={{
          fontSize: "48px",
          fontWeight: 700,
          color: "var(--text)",
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}>
          Forge
        </h1>
        <p style={{ color: "var(--text-muted)", marginTop: "8px", fontSize: "14px" }}>
          Sketch it, shoot it, or say it. Ship the part.
        </p>
      </div>

      <Link href="/workspace" style={{
        background: "var(--accent)",
        color: "#fff",
        padding: "10px 24px",
        borderRadius: "6px",
        textDecoration: "none",
        fontSize: "13px",
        fontWeight: 600,
        letterSpacing: "0.01em",
      }}>
        Open Workspace
      </Link>
    </main>
  );
}
