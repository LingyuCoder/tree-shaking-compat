import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { selectCases } from "./lib/cases.mjs";
import { evaluateObservation } from "./lib/evaluate.mjs";
import { executeCase, unsupportedObservation } from "./lib/execute-case.mjs";
import { exists, readJson, writeJson } from "./lib/io.mjs";
import { fromRoot, resultsPath, versionsPath } from "./lib/paths.mjs";
import { runCommand } from "./lib/process.mjs";
import { readToolVersion } from "./lib/tools.mjs";

function parseArgs(argv) {
  const parsed = {};
  for (const argument of argv) {
    if (!argument.startsWith("--")) continue;
    const [key, value = "true"] = argument.slice(2).split("=", 2);
    parsed[key] = value;
  }
  const csv = (value) => (value ? value.split(",").map((item) => item.trim()).filter(Boolean) : []);
  return {
    bundlers: csv(parsed.bundlers),
    profiles: csv(parsed.profiles),
    cases: csv(parsed.cases),
    categories: csv(parsed.categories),
    output: parsed.output ? path.resolve(parsed.output) : resultsPath,
  };
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

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

function statusCharacter(status) {
  return { pass: ".", partial: "p", fail: "F", unsupported: "-", unverified: "?" }[status] || "?";
}

const workerRunId = crypto.randomUUID();

async function runIsolatedCase(bundler, profile, item) {
  if (item.unsupportedBundlers?.includes(bundler.id)) {
    return evaluateObservation(item, unsupportedObservation());
  }
  const output = fromRoot(".cache", "worker-results", workerRunId, bundler.id, `${hash(item.id)}.json`);
  const startedAt = Date.now();
  const run = await runCommand(
    process.execPath,
    [fromRoot("scripts/run-case-worker.mjs"), bundler.id, profile, item.id, output],
    { timeoutMs: 4 * 60 * 1000 },
  );
  if (run.ok && (await exists(output))) return readJson(output);
  return evaluateObservation(item, {
    build: {
      ok: false,
      durationMs: Date.now() - startedAt,
      error: run.error || run.stderr || run.stdout || `Isolated worker exited with ${run.code}`,
    },
    runtime: null,
    code: "",
    files: [],
    warnings: [],
  });
}

const options = parseArgs(process.argv.slice(2));
if (!(await exists(versionsPath))) throw new Error("Missing data/results/versions.json; run pnpm versions first.");
const versions = await readJson(versionsPath);
const config = await readJson(fromRoot("config/bundlers.json"));
const selectedCases = selectCases({ ids: options.cases, categories: options.categories });
const selectedBundlers = config.bundlers.filter(
  (bundler) => !options.bundlers.length || options.bundlers.includes(bundler.id),
);
if (!selectedCases.length) throw new Error("No cases selected.");
if (!selectedBundlers.length) throw new Error("No bundlers selected.");

const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
  },
  versionResolution: versions,
  corpus: {
    count: selectedCases.length,
    cases: selectedCases.map(({ files, ...item }) => ({ ...item, fileNames: Object.keys(files) })),
  },
  bundlers: {},
};

async function mapWithConcurrency(values, concurrency, callback) {
  const output = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      output[index] = await callback(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return output;
}

for (const bundler of selectedBundlers) {
  const expectedVersion = versions.bundlers[bundler.id];
  let actualVersion;
  if (bundler.id === "bun") {
    const detected = await runCommand(process.env.BUN_BINARY || "bun", ["--version"], { timeoutMs: 30_000 });
    if (!detected.ok) throw new Error(`Cannot execute Bun ${expectedVersion}: ${detected.error || detected.stderr}`);
    actualVersion = detected.stdout.trim();
  } else {
    actualVersion = await readToolVersion(bundler.package);
  }
  if (actualVersion !== expectedVersion) {
    throw new Error(`${bundler.label} version mismatch: resolved ${expectedVersion}, installed ${actualVersion}`);
  }
  console.log(`\n## ${bundler.label} ${expectedVersion}`);
  const adapterUrl = pathToFileURL(fromRoot("scripts", "adapters", `${bundler.adapter}.mjs`)).href;
  const adapter = await import(adapterUrl);
  const profiles = bundler.profiles.filter(
    (profile) => !options.profiles.length || options.profiles.includes(profile),
  );
  const bundlerResult = {
    label: bundler.label,
    version: expectedVersion,
    actualVersion,
    productionLayer: bundler.productionLayer,
    profiles: {},
  };
  result.bundlers[bundler.id] = bundlerResult;

  for (const profile of profiles) {
    console.log(`  ${profile}`);
    const profileResults = {};
    bundlerResult.profiles[profile] = profileResults;
    if (typeof adapter.runBatch === "function") {
      const runnableCases = selectedCases.filter((item) => !item.unsupportedBundlers?.includes(bundler.id));
      const observations = runnableCases.length
        ? await adapter.runBatch({ cases: runnableCases, profile, versions })
        : new Map();
      for (const item of selectedCases) {
        const observation = item.unsupportedBundlers?.includes(bundler.id)
          ? unsupportedObservation()
          : observations.get(item.id);
        const evaluated = evaluateObservation(item, observation);
        profileResults[item.id] = evaluated;
        process.stdout.write(statusCharacter(evaluated.status));
      }
      process.stdout.write("\n");
      continue;
    }

    const evaluatedCases = await mapWithConcurrency(
      selectedCases,
      Number(process.env.BUNDLER_CASE_CONCURRENCY || bundler.concurrency || 2),
      (item) =>
        bundler.isolateCases
          ? runIsolatedCase(bundler, profile, item)
          : executeCase(adapter, bundler, profile, item),
    );
    for (let index = 0; index < selectedCases.length; index++) {
      const item = selectedCases[index];
      const evaluated = evaluatedCases[index];
      profileResults[item.id] = evaluated;
      process.stdout.write(statusCharacter(evaluated.status));
    }
    process.stdout.write("\n");
  }
}

await writeJson(options.output, sanitizeForArtifact(result));
console.log(`\nWrote ${path.relative(fromRoot(), options.output)}`);
