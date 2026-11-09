// Used only by tsconfig.api.json, which turns resolveJsonModule off so the
// typecheck does not have to infer a literal type for megabytes of inventory.
// There, a JSON import is simply untyped; tsconfig.check.json and the build
// still see the real shapes.
declare module "*.json" {
  const value: any;
  export default value;
}
