import annotations from "./annotations.mjs";
import assets from "./assets.mjs";
import commonjs from "./commonjs.mjs";
import dynamicImport from "./dynamic-import.mjs";
import esm from "./esm.mjs";
import objects from "./objects.mjs";
import sideEffects from "./side-effects.mjs";
import statements from "./statements.mjs";

export default [
  ...esm,
  ...sideEffects,
  ...dynamicImport,
  ...statements,
  ...objects,
  ...annotations,
  ...commonjs,
  ...assets,
];
