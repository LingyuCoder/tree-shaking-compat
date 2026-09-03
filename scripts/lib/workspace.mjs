import fs from "node:fs/promises";
import path from "node:path";
import { listFiles } from "./io.mjs";
import { runsRoot } from "./paths.mjs";
import { runCommand } from "./process.mjs";

export const resultPrefix = "__TREE_SHAKING_RESULT__";

function safeSegment(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "__");
}

export function caseRunRoot(bundler, profile, id) {
  return path.join(runsRoot, safeSegment(bundler), safeSegment(profile), safeSegment(id));
}

export async function prepareCaseWorkspace(bundler, profile, item) {
  const root = caseRunRoot(bundler, profile, item.id);
  const sourceDir = path.join(root, "source");
  const outDir = path.join(root, "dist");
  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(sourceDir, { recursive: true });
  await fs.mkdir(outDir, { recursive: true });

  for (const [relative, contents] of Object.entries(item.files)) {
    const output = path.join(sourceDir, relative);
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, contents.endsWith("\n") ? contents : `${contents}\n`);
  }

  const packageFile = path.join(sourceDir, "package.json");
  try {
    await fs.access(packageFile);
  } catch {
    await fs.writeFile(packageFile, '{"private":true,"type":"module"}\n');
  }

  const importLine =
    item.module === "commonjs"
      ? `import fixtureModule from ${JSON.stringify(`./${item.entry}`)};\nconst fixtureRun = fixtureModule.run;`
      : `import { run as fixtureRun } from ${JSON.stringify(`./${item.entry}`)};`;
  const runner = [
    importLine,
    "Promise.resolve()",
    "  .then(() => fixtureRun())",
    `  .then(value => process.stdout.write(${JSON.stringify(resultPrefix)} + JSON.stringify(value) + "\\n"))`,
    "  .catch(error => { console.error(error); process.exitCode = 1; });",
    "",
  ].join("\n");
  const runnerPath = path.join(sourceDir, "__runner.mjs");
  await fs.writeFile(runnerPath, runner);
  return { root, sourceDir, outDir, runnerPath };
}

export async function collectJavaScript(outDir) {
  const files = await listFiles(outDir, (file) => /\.(?:[cm]?js)$/.test(file));
  const chunks = await Promise.all(files.map((file) => fs.readFile(file, "utf8")));
  return { files, code: chunks.join("\n") };
}

export async function executeBundle(entryFile, cwd) {
  const run = await runCommand(process.execPath, [entryFile], { cwd, timeoutMs: 60_000 });
  const line = run.stdout
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(resultPrefix));
  if (!run.ok) {
    return { ok: false, actual: null, stdout: run.stdout, stderr: run.stderr, error: run.error || `exit ${run.code}` };
  }
  if (!line) {
    return { ok: false, actual: null, stdout: run.stdout, stderr: run.stderr, error: "result sentinel was not printed" };
  }
  try {
    return { ok: true, actual: JSON.parse(line.slice(resultPrefix.length)), stdout: run.stdout, stderr: run.stderr, error: null };
  } catch (error) {
    return { ok: false, actual: null, stdout: run.stdout, stderr: run.stderr, error: `invalid result JSON: ${error.message}` };
  }
}
