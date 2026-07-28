import fs from "node:fs";
import path from "node:path";

// Server-only OpenCascade loader — see note in cad/parse/route.ts history:
// the package's own init (node_modules/opencascade.js/index.js) passes a
// bundler-emitted asset URL to Emscripten's `locateFile`, which breaks under
// Next.js/Turbopack's Node.js server runtime. This reads the .wasm binary
// straight off disk and hands it to Emscripten via `wasmBinary`, skipping
// locateFile/fetch entirely.
let ocInstance: any = null;

export async function getOpenCascade() {
  if (ocInstance) return ocInstance;

  const wasmPath = path.join(
    process.cwd(),
    "node_modules/opencascade.js/dist/opencascade.wasm.wasm",
  );
  const wasmBinary = fs.readFileSync(wasmPath);

  const { default: opencascade } = await import("opencascade.js/dist/opencascade.wasm.js");
  const oc = await new (opencascade as any)({ wasmBinary });

  if (process.env.OC_DEBUG === "TopoDS_MEMBERS") {
    console.error("[OC_DEBUG] oc.TopoDS own props:", Object.getOwnPropertyNames(oc.TopoDS));
    console.error("[OC_DEBUG] oc.TopoDS proto props:", Object.getOwnPropertyNames(Object.getPrototypeOf(oc.TopoDS ?? {})));
  } else if (process.env.OC_DEBUG) {
    const pattern = new RegExp(process.env.OC_DEBUG, "i");
    const keys = Object.keys(oc).filter(k => pattern.test(k));
    console.error(`[OC_DEBUG /${process.env.OC_DEBUG}/i]`, keys);
  }

  ocInstance = oc;
  return oc;
}
