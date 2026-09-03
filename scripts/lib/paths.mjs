import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const cacheRoot = path.join(repoRoot, ".cache");
export const toolchainRoot = path.join(cacheRoot, "toolchain");
export const toolchainModules = path.join(toolchainRoot, "node_modules");
export const runsRoot = path.join(cacheRoot, "runs");
export const upstreamCacheRoot = path.join(cacheRoot, "upstreams");
export const versionsPath = path.join(repoRoot, "data/results/versions.json");
export const resultsPath = path.join(repoRoot, "data/results/latest.json");
export const inventoryPath = path.join(repoRoot, "data/upstreams/latest.json");

export function fromRoot(...segments) {
  return path.join(repoRoot, ...segments);
}
