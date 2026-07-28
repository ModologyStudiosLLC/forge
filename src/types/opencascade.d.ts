declare module "opencascade.js" {
  function initOpenCascade(): Promise<any>;
  export { initOpenCascade };
  export default initOpenCascade;
}

declare module "opencascade.js/dist/opencascade.wasm.js" {
  const opencascade: (config?: { wasmBinary?: Buffer | Uint8Array }) => Promise<any>;
  export default opencascade;
}
