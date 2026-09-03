import path from "node:path";
import { importTool } from "../lib/tools.mjs";

export async function build({ workspace, profile }) {
  const esbuild = await importTool("esbuild");
  const result = await esbuild.build({
    entryPoints: [workspace.runnerPath],
    outdir: workspace.outDir,
    entryNames: "bundle",
    chunkNames: "chunks/[name]-[hash]",
    outExtension: { ".js": ".mjs" },
    bundle: true,
    splitting: true,
    platform: "node",
    target: "node22",
    format: "esm",
    treeShaking: true,
    minify: profile === "production",
    sourcemap: false,
    metafile: true,
    logLevel: "silent",
  });
  return {
    entryFile: path.join(workspace.outDir, "bundle.mjs"),
    warnings: result.warnings.map((warning) => warning.text),
    metafile: result.metafile,
  };
}
