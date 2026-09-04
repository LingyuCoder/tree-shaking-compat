import path from "node:path";
import { importTool } from "../lib/tools.mjs";
import { assetModulePlugin } from "../lib/fixture-options.mjs";

export async function build({ workspace, profile, item }) {
  const { rolldown } = await importTool("rolldown");
  const warnings = [];
  const bundle = await rolldown({
    input: workspace.runnerPath,
    external: item.buildOptions?.external || [],
    treeshake: item.buildOptions?.ignoreAnnotations ? { annotations: false } : true,
    plugins: [assetModulePlugin(item, "tree-shaking-fixture-assets")],
    onLog(level, log, handler) {
      if (level === "warn") warnings.push(log.message);
      else handler(level, log);
    },
  });
  await bundle.write({
    dir: workspace.outDir,
    format: "es",
    entryFileNames: "bundle.mjs",
    chunkFileNames: "chunks/[name]-[hash].mjs",
    minify: profile === "production" ? "dce-only" : false,
    sourcemap: false,
  });
  await bundle.close();
  return { entryFile: path.join(workspace.outDir, "bundle.mjs"), warnings };
}
