import path from "node:path";
import { importTool } from "../lib/tools.mjs";

export async function build({ workspace, profile, item }) {
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
    ignoreAnnotations: Boolean(item.buildOptions?.ignoreAnnotations),
    external: item.buildOptions?.external || [],
    loader: item.buildOptions?.loader || {},
    minifySyntax: profile === "production",
    minifyWhitespace: profile === "production",
    minifyIdentifiers: false,
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
