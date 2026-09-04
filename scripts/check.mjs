import fs from "node:fs/promises";
import { validateCases } from "./lib/cases.mjs";
import { exists, readJson } from "./lib/io.mjs";
import { fromRoot } from "./lib/paths.mjs";

const cases = validateCases();
const bundlers = await readJson(fromRoot("config/bundlers.json"));
const upstreams = await readJson(fromRoot("config/upstreams.json"));
const bundlerIds = new Set(bundlers.bundlers.map((item) => item.id));
if (bundlerIds.size !== bundlers.bundlers.length) throw new Error("Duplicate bundler id");
if (new Set(upstreams.upstreams.map((item) => item.id)).size !== upstreams.upstreams.length) {
  throw new Error("Duplicate upstream id");
}
for (const item of cases) {
  for (const bundler of item.unsupportedBundlers || []) {
    if (!bundlerIds.has(bundler)) throw new Error(`${item.id}: unknown unsupported bundler ${bundler}`);
  }
  for (const source of item.provenance) {
    if (!bundlerIds.has(source.bundler)) throw new Error(`${item.id}: unknown provenance ${source.bundler}`);
    new URL(source.url);
  }
}
const generatedPath = fromRoot("corpus/generated/upstream.json");
if (await exists(generatedPath)) {
  const generated = await readJson(generatedPath);
  if (generated.count !== generated.cases.length) throw new Error("Generated corpus count is stale.");
  for (const [source, coverage] of Object.entries(generated.sourceCoverage || {})) {
    if (coverage.mapped !== coverage.direct) {
      throw new Error(`${source}: only ${coverage.mapped}/${coverage.direct} direct upstream fixtures are mapped.`);
    }
    if (coverage.negativeMapped !== coverage.negative) {
      throw new Error(`${source}: only ${coverage.negativeMapped}/${coverage.negative} negative records are mapped.`);
    }
  }
}
await fs.access(fromRoot("schema/case.schema.json"));
console.log(`Validated ${cases.length} canonical cases, complete direct-source coverage, and ${bundlerIds.size} bundler adapters.`);
