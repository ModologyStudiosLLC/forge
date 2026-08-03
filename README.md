# FORGE

AI-assisted CAD workbench for manufacturing — upload a STEP file, describe a part in
plain English, or turn a photo into a 3D model, then get manufacturability feedback,
material cost estimates, and machine-ready output. Built by [Modology Studios](https://github.com/ModologyStudiosLLC).

FORGE targets the friction that pushes high-mix, low-volume CNC work overseas: slow
domestic quoting and thin engineering bandwidth at small and mid-size shops. It's early
— built and pushed, not yet running in a real shop.

## What it does

All of this lives in a single workspace: a 3D viewer (Three.js / React Three Fiber)
with a toolbar, properties panel, and status bar around it.

| Feature | What it does | Runs |
|---|---|---|
| **STEP import + viewer** | Parses a STEP file server-side with `opencascade.js`, tessellates it for the viewer, and computes exact solid volume via OCCT mass-property integration. | Self-contained |
| **DFM analysis** | Heuristic manufacturability checks against the parsed geometry — thin-wall detection (opposing-face proximity) and small-feature flags relative to overall part size. A coarse v1 pass, not a substitute for a real DFM review. | Self-contained |
| **BOM / material cost** | Volume × density × reference $/kg across a curated material set (CNC wrought metals, binder-jet powders, SLA/DLP resins). Prices are hand-maintained reference figures, not a live feed — no free API covers structural metal spot prices. | Self-contained |
| **AI face suggestions** | Select a face, get 3–4 targeted design notes (manufacturability, function, form) from Claude, optionally informed by a traced reference image. | Needs `ANTHROPIC_API_KEY` |
| **Natural language → STEP** | Describe a part in plain English; Claude writes a CadQuery script, which is executed by a local CadQuery service to produce a real STEP file. | Needs `ANTHROPIC_API_KEY` + companion service |
| **Image → 3D** | Upload a photo or sketch; forwarded to a local TripoSR service for mesh generation. | Needs companion service |
| **G-code generation** | Upload a STEP file; forwarded to a local headless-FreeCAD service for a CAM roughing pass. Fixed preset for now — no tool/stock parameter UI yet. | Needs companion service |
| **Alloy quoting** | Forwards a quote request to Alloy (the metal-AM shop OS), Modology's sister project. | Needs companion service |

## Architecture

- **Next.js 16** (canary — API surface differs from stable, see `AGENTS.md`) + **React 19**
- **Three.js** / **@react-three/fiber** for the viewer, **Zustand** for app state
- **opencascade.js** (OpenCASCADE compiled to WASM) for STEP parsing, running server-side in API routes
- **Anthropic SDK** (`claude-sonnet-4-6`) for the AI-driven features
- Four capabilities call out to **separate local services** rather than running in-process:
  a CadQuery execution service, a TripoSR image-to-3D service, a headless-FreeCAD G-code
  service, and Alloy itself. **None of those services are part of this repo** — they're
  Mike's local dev setup. Cloning FORGE alone gets you the viewer, DFM, BOM, and AI
  suggestions; the other four features will 503 with a clear "not running" message until
  their companion service is available.

## Getting started

```bash
npm install
# add ANTHROPIC_API_KEY to a new .env.local
npm run dev                        # http://localhost:3004
```

Environment variables:

| Variable | Required for | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | AI face suggestions, natural language → STEP | — |
| `CADQUERY_API_URL` | Natural language → STEP | `http://localhost:8097` |
| `TRIPOSR_API_URL` | Image → 3D | `http://localhost:8098` |
| `ALLOY_API_URL` | Alloy quoting | `http://localhost:8000` |

## Status

Phase 1 (STEP viewer, face selection, push/pull scaffold) plus the DFM, BOM, NL→STEP,
Image→3D, and G-code pipelines described above are built. No shop has run a real job
through it yet — that's the next milestone, not this one.
