import path from "node:path";
import { runCommand } from "../lib/process.mjs";

export async function build({ workspace, profile }) {
  const bun = process.env.BUN_BINARY || "bun";
  const entryFile = path.join(workspace.outDir, "bundle.mjs");
  const args = [
    "build",
    workspace.runnerPath,
    `--outfile=${entryFile}`,
    "--target=node",
    "--format=esm",
    "--sourcemap=none",
  ];
  if (profile === "production") args.push("--minify");
  const result = await runCommand(bun, args, { cwd: workspace.sourceDir, timeoutMs: 120_000 });
  if (!result.ok) throw new Error(result.error || result.stderr || `bun build exited with ${result.code}`);
  return { entryFile, warnings: result.stderr ? [result.stderr.trim()] : [] };
}
