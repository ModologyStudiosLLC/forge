declare module "opencascade.js" {
  function initOpenCascade(options?: { locateFile?: (f: string) => string }): Promise<any>;
  export default initOpenCascade;
}
