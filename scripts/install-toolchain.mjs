import fs from "node:fs/promises";
import path from "node:path";
import { exists, readJson } from "./lib/io.mjs";
import { toolchainRoot, versionsPath } from "./lib/paths.mjs";
import { runCommand } from "./lib/process.mjs";

if (!(await exists(versionsPath))) await import("./resolve-versions.mjs");
const versions = await readJson(versionsPath);
const manifest = {
  name: "tree-shaking-compat-toolchain",
  private: true,
  version: "0.0.0",
  dependencies: versions.packages,
};
await fs.mkdir(toolchainRoot, { recursive: true });
await fs.writeFile(path.join(toolchainRoot, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await fs.writeFile(
  path.join(toolchainRoot, "pnpm-workspace.yaml"),
  `allowBuilds:\n  '@parcel/watcher': true\n  '@swc/core': true\n  esbuild: true\n  lmdb: true\n  msgpackr-extract: true\n`,
);

const result = await runCommand(
  "corepack",
  ["pnpm", "--dir", toolchainRoot, "install", "--no-frozen-lockfile", "--prefer-offline"],
  { timeoutMs: 15 * 60 * 1000, inherit: true },
);
if (!result.ok) throw new Error(result.error || `toolchain install exited with ${result.code}`);
console.log(`Installed ${Object.keys(manifest.dependencies).length} exact package releases in .cache/toolchain`);
