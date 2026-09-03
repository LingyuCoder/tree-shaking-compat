import fs from "node:fs/promises";
import { validateCases } from "./lib/cases.mjs";
import { readJson } from "./lib/io.mjs";
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
  for (const source of item.provenance) {
    if (!bundlerIds.has(source.bundler)) throw new Error(`${item.id}: unknown provenance ${source.bundler}`);
    new URL(source.url);
  }
}
await fs.access(fromRoot("schema/case.schema.json"));
console.log(`Validated ${cases.length} normalized cases and ${bundlerIds.size} bundler adapters.`);
