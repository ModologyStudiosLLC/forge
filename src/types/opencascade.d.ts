declare module "opencascade.js" {
  function initOpenCascade(): Promise<unknown>;
  export { initOpenCascade };
  export default initOpenCascade;
}

declare module "opencascade.js/dist/opencascade.wasm.js" {
  const opencascade: new (config?: { wasmBinary?: Buffer | Uint8Array }) => Promise<unknown>;
  export default opencascade;
}
