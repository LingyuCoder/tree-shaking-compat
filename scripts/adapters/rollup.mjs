import path from "node:path";
import { importTool } from "../lib/tools.mjs";

export async function build({ workspace, profile }) {
  const [{ rollup }, { nodeResolve }, commonjsModule, jsonModule] = await Promise.all([
    importTool("rollup"),
    importTool("@rollup/plugin-node-resolve"),
    importTool("@rollup/plugin-commonjs"),
    importTool("@rollup/plugin-json"),
  ]);
  const commonjs = commonjsModule.default;
  const json = jsonModule.default;
  const warnings = [];
  const bundle = await rollup({
    input: workspace.runnerPath,
    treeshake: true,
    plugins: [
      nodeResolve({ extensions: [".mjs", ".js", ".cjs", ".json"] }),
      commonjs({ transformMixedEsModules: true }),
      json({ preferConst: true, compact: profile === "production" }),
    ],
    onwarn(warning) {
      warnings.push(warning.message);
    },
  });
  await bundle.write({
    dir: workspace.outDir,
    format: "es",
    entryFileNames: "bundle.mjs",
    chunkFileNames: "chunks/[name]-[hash].mjs",
    generatedCode: "es2015",
    sourcemap: false,
  });
  await bundle.close();
  return {
    entryFile: path.join(workspace.outDir, "bundle.mjs"),
    warnings,
    note: "Rollup has no built-in production minifier; both profiles measure Rollup core tree-shaking.",
  };
}
