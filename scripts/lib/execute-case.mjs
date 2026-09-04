import crypto from "node:crypto";
import path from "node:path";
import { evaluateObservation } from "./evaluate.mjs";
import { fromRoot } from "./paths.mjs";
import { compactError } from "./process.mjs";
import { collectJavaScript, executeBundle, prepareCaseWorkspace } from "./workspace.mjs";

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function unsupportedObservation() {
  return {
    unsupported: true,
    build: { ok: false, durationMs: 0, error: "The upstream case depends on a source-specific harness, dependency, or option." },
    runtime: null,
    code: "",
    files: [],
    warnings: [],
  };
}

export async function executeCase(adapter, bundler, profile, item) {
  const startedAt = Date.now();
  if (item.unsupportedBundlers?.includes(bundler.id)) {
    return evaluateObservation(item, unsupportedObservation());
  }
  try {
    const workspace = await prepareCaseWorkspace(bundler.id, profile, item);
    const built = await adapter.build({ workspace, profile, item });
    const emitted = await collectJavaScript(workspace.outDir);
    const runtime =
      item.execution?.runtime === false
        ? { ok: true, actual: null, stdout: "", stderr: "", error: null }
        : await executeBundle(built.entryFile, workspace.outDir);
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
      build: { ok: false, durationMs: Date.now() - startedAt, error: compactError(error).replaceAll(fromRoot(), "<repo>") },
      runtime: null,
      code: "",
      files: [],
      warnings: [],
    });
  }
}
