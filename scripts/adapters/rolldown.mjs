import path from "node:path";
import { importTool } from "../lib/tools.mjs";

export async function build({ workspace, profile }) {
  const { rolldown } = await importTool("rolldown");
  const warnings = [];
  const bundle = await rolldown({
    input: workspace.runnerPath,
    treeshake: true,
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
    minify: profile === "production",
    sourcemap: false,
  });
  await bundle.close();
  return { entryFile: path.join(workspace.outDir, "bundle.mjs"), warnings };
}
