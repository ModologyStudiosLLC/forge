declare module "opencascade.js" {
  function initOpenCascade(): Promise<any>;
  export { initOpenCascade };
  export default initOpenCascade;
}
