import path from "node:path";
import { runCommand } from "../lib/process.mjs";

export async function build({ workspace, profile, item }) {
  const bun = process.env.BUN_BINARY || "bun";
  const entryFile = path.join(workspace.outDir, "bundle.mjs");
  const args = [
    "build",
    workspace.runnerPath,
    `--outdir=${workspace.outDir}`,
    "--entry-naming=bundle.mjs",
    "--chunk-naming=chunks/[name]-[hash].mjs",
    "--asset-naming=assets/[name]-[hash][ext]",
    "--target=node",
    "--format=esm",
    "--sourcemap=none",
  ];
  for (const external of item.buildOptions?.external || []) args.push(`--external=${external}`);
  for (const [extension, loader] of Object.entries(item.buildOptions?.loader || {})) {
    args.push(`--loader:${extension}=${loader}`);
  }
  if (item.buildOptions?.ignoreAnnotations) args.push("--ignore-dce-annotations");
  if (profile === "production") args.push("--minify-syntax", "--minify-whitespace");
  const result = await runCommand(bun, args, { cwd: workspace.sourceDir, timeoutMs: 120_000 });
  if (!result.ok) throw new Error(result.error || result.stderr || `bun build exited with ${result.code}`);
  return { entryFile, warnings: result.stderr ? [result.stderr.trim()] : [] };
}
