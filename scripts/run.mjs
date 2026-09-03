import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { selectCases } from "./lib/cases.mjs";
import { evaluateObservation } from "./lib/evaluate.mjs";
import { exists, readJson, writeJson } from "./lib/io.mjs";
import { fromRoot, resultsPath, versionsPath } from "./lib/paths.mjs";
import { compactError, runCommand } from "./lib/process.mjs";
import { readToolVersion } from "./lib/tools.mjs";
import { collectJavaScript, executeBundle, prepareCaseWorkspace } from "./lib/workspace.mjs";

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
  if (typeof value === "string") return value.replaceAll(fromRoot(), "<repo>");
  if (Array.isArray(value)) return value.map(sanitizeForArtifact);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, sanitizeForArtifact(nested)]));
  }
  return value;
}

async function runCase(adapter, bundler, profile, item) {
  const startedAt = Date.now();
  try {
    const workspace = await prepareCaseWorkspace(bundler.id, profile, item);
    const built = await adapter.build({ workspace, profile, item });
    const emitted = await collectJavaScript(workspace.outDir);
    const runtime = await executeBundle(built.entryFile, workspace.outDir);
    return evaluateObservation(item, {
      build: { ok: true, durationMs: Date.now() - startedAt, error: null },
      runtime,
      code: emitted.code,
      outputHash: hash(emitted.code),
      files: emitted.files.map((file) => path.relative(workspace.outDir, file)),
      warnings: built.warnings,
      note: built.note,
    });
  } catch (error) {
    return evaluateObservation(item, {
      build: { ok: false, durationMs: Date.now() - startedAt, error: compactError(error) },
      runtime: null,
      code: "",
      files: [],
      warnings: [],
    });
  }
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
      const observations = await adapter.runBatch({ cases: selectedCases, profile, versions });
      for (const item of selectedCases) {
        const evaluated = evaluateObservation(item, observations.get(item.id));
        profileResults[item.id] = evaluated;
        process.stdout.write(evaluated.status === "pass" ? "." : evaluated.status === "partial" ? "p" : "F");
      }
      process.stdout.write("\n");
      continue;
    }

    for (const item of selectedCases) {
      const evaluated = await runCase(adapter, bundler, profile, item);
      profileResults[item.id] = evaluated;
      process.stdout.write(evaluated.status === "pass" ? "." : evaluated.status === "partial" ? "p" : "F");
    }
    process.stdout.write("\n");
  }
}

await writeJson(options.output, sanitizeForArtifact(result));
console.log(`\nWrote ${path.relative(fromRoot(), options.output)}`);
