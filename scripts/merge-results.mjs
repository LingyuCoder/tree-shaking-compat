import os from "node:os";
import path from "node:path";
import { listFiles, readJson, writeJson } from "./lib/io.mjs";
import { fromRoot, resultsPath } from "./lib/paths.mjs";

const argument = process.argv.find((item) => item.startsWith("--inputs="));
if (!argument) throw new Error("Usage: node scripts/merge-results.mjs --inputs=<directory> [--output=<file>]");
const inputDir = path.resolve(argument.slice("--inputs=".length));
const outputArgument = process.argv.find((item) => item.startsWith("--output="));
const output = outputArgument ? path.resolve(outputArgument.slice("--output=".length)) : resultsPath;
const files = await listFiles(inputDir, (file) => file.endsWith(".json"));
if (!files.length) throw new Error(`No JSON result shards found in ${inputDir}`);
const shards = await Promise.all(files.map(readJson));
const [first] = shards;
const expectedCaseIds = first.corpus.cases.map((item) => item.id);
for (const shard of shards.slice(1)) {
  if (shard.versionResolution.resolvedAt !== first.versionResolution.resolvedAt) {
    throw new Error("Result shards were produced from different version resolutions.");
  }
  if (JSON.stringify(shard.corpus.cases.map((item) => item.id)) !== JSON.stringify(expectedCaseIds)) {
    throw new Error("Result shards contain different case selections.");
  }
}
const merged = {
  ...first,
  generatedAt: new Date().toISOString(),
  bundlers: Object.assign({}, ...shards.map((shard) => shard.bundlers)),
};

function sanitizeForArtifact(value) {
  if (typeof value === "string") {
    return value.replaceAll(fromRoot(), "<repo>").replaceAll(os.homedir(), "<home>");
  }
  if (Array.isArray(value)) return value.map(sanitizeForArtifact);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, sanitizeForArtifact(nested)]));
  }
  return value;
}
if (!process.argv.includes("--allow-partial")) {
  const config = await readJson(fromRoot("config/bundlers.json"));
  const missing = config.bundlers.map((item) => item.id).filter((id) => !merged.bundlers[id]);
  if (missing.length) throw new Error(`Missing result shards: ${missing.join(", ")}`);
}
await writeJson(output, sanitizeForArtifact(merged));
console.log(`Merged ${files.length} shards with ${Object.keys(merged.bundlers).length} bundlers.`);
