import path from "node:path";
import { pathToFileURL } from "node:url";
import { selectCases } from "./lib/cases.mjs";
import { executeCase } from "./lib/execute-case.mjs";
import { readJson, writeJson } from "./lib/io.mjs";
import { fromRoot } from "./lib/paths.mjs";

const [bundlerId, profile, caseId, output] = process.argv.slice(2);
if (!bundlerId || !profile || !caseId || !output) {
  throw new Error("Usage: node scripts/run-case-worker.mjs <bundler> <profile> <case> <output>");
}
const config = await readJson(fromRoot("config/bundlers.json"));
const bundler = config.bundlers.find((item) => item.id === bundlerId);
if (!bundler) throw new Error(`Unknown bundler: ${bundlerId}`);
const [item] = selectCases({ ids: [caseId] });
if (!item) throw new Error(`Unknown case: ${caseId}`);
const adapter = await import(pathToFileURL(fromRoot("scripts", "adapters", `${bundler.adapter}.mjs`)).href);
const observation = await executeCase(adapter, bundler, profile, item);
await writeJson(path.resolve(output), observation);
