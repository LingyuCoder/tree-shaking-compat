import fs from "node:fs/promises";
import path from "node:path";
import { listFiles } from "./io.mjs";
import { runsRoot, toolchainModules } from "./paths.mjs";
import { runCommand } from "./process.mjs";
import { importTool } from "./tools.mjs";

export const resultPrefix = "__TREE_SHAKING_RESULT__";

function safeSegment(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "__");
}

export function caseRunRoot(bundler, profile, id) {
  return path.join(runsRoot, safeSegment(bundler), safeSegment(profile), safeSegment(id));
}

export function normalizeRelativeSpecifiers(item, relative, source) {
  const names = new Set(Object.keys(item.files));
  return source.replace(
    /(\b(?:from|import|require)\s*(?:\(\s*)?)(["'])(\.[^"']+)\2/g,
    (match, prefix, quote, specifier) => {
      const suffixIndex = specifier.search(/[?#]/);
      const request = suffixIndex < 0 ? specifier : specifier.slice(0, suffixIndex);
      const suffix = suffixIndex < 0 ? "" : specifier.slice(suffixIndex);
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(relative), request));
      if (names.has(base)) return match;
      for (const extension of [".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".json"]) {
        if (names.has(`${base}${extension}`)) return `${prefix}${quote}${request}${extension}${suffix}${quote}`;
      }
      for (const name of ["index.js", "index.mjs", "index.cjs", "index.ts", "index.tsx", "index.json"]) {
        if (names.has(`${base}/${name}`)) return `${prefix}${quote}${request.replace(/\/$/, "")}/${name}${suffix}${quote}`;
      }
      return match;
    },
  );
}

export function createFixtureRunnerSource(item, { exported = false } = {}) {
  const entries = item.entries || [item.entry];
  const specifiers = entries.map((entry) => JSON.stringify(`./${entry}`));
  const execution = item.execution?.kind || "module-export";
  let importLine;
  if (execution === "side-effect") {
    importLine = exported
      ? [
          "async function fixtureRun() {",
          ...specifiers.map((specifier) => `  await import(${specifier});`),
          "  return null;",
          "}",
        ].join("\n")
      : `${specifiers.map((specifier) => `import ${specifier};`).join("\n")}\nconst fixtureRun = () => null;`;
  } else if (execution === "stdout") {
    importLine = exported
      ? [
          "async function fixtureRun() {",
          "  const lines = [];",
          "  const original = console.log;",
          "  console.log = (...values) => lines.push(values.map(value => typeof value === 'string' ? value : value === undefined ? 'undefined' : JSON.stringify(value)).join(' '));",
          "  try {",
          ...specifiers.map((specifier) => `    await import(${specifier});`),
          "  } finally {",
          "    console.log = original;",
          "  }",
          "  return lines.join('\\n');",
          "}",
        ].join("\n")
      : [
          "async function fixtureRun() {",
          ...specifiers.map((specifier) => `  await import(${specifier});`),
          "  return { __tree_shaking_capture_stdout__: true };",
          "}",
        ].join("\n");
  } else if (execution === "test-harness") {
    importLine = [
      "import assert from 'node:assert';",
      "const pendingTests = [];",
      "const hooks = { beforeEach: [], afterEach: [] };",
      "const asymmetric = Symbol('asymmetric');",
      "function matchesExpected(received, expected, exact = true) {",
      "  if (expected?.[asymmetric] === 'objectContaining') return received != null && Object.entries(expected.value).every(([key, value]) => matchesExpected(received[key], value, false));",
      "  if (expected?.[asymmetric] === 'stringMatching') return typeof received === 'string' && (typeof expected.value === 'string' ? received.includes(expected.value) : expected.value.test(received));",
      "  if (expected?.[asymmetric] === 'stringContaining') return typeof received === 'string' && received.includes(expected.value);",
      "  if (Object.is(received, expected)) return true;",
      "  if (expected instanceof RegExp) return expected.test(String(received));",
      "  if (Array.isArray(expected)) return Array.isArray(received) && received.length === expected.length && expected.every((value, index) => matchesExpected(received[index], value, exact));",
      "  if (expected && typeof expected === 'object') { const keys = Object.keys(expected); return received != null && typeof received === 'object' && (!exact || Object.keys(received).length === keys.length) && keys.every(key => matchesExpected(received[key], expected[key], exact)); }",
      "  return false;",
      "}",
      "const deepEqual = (a, b) => matchesExpected(a, b, true);",
      "function makeMatchers(received, negate = false) {",
      "  const check = (condition, message) => { if (negate ? condition : !condition) throw new Error(message); };",
      "  const api = {",
      "    toBe: expected => check(Object.is(received, expected), `Expected ${JSON.stringify(received)} to be ${JSON.stringify(expected)}`),",
      "    toEqual: expected => check(deepEqual(received, expected), `Expected ${JSON.stringify(received)} to equal ${JSON.stringify(expected)}`),",
      "    toStrictEqual: expected => check(deepEqual(received, expected), `Expected values to strictly equal`),",
      "    toBeTruthy: () => check(Boolean(received), `Expected value to be truthy`),",
      "    toBeFalsy: () => check(!received, `Expected value to be falsy`),",
      "    toBeUndefined: () => check(received === undefined, `Expected value to be undefined`),",
      "    toBeDefined: () => check(received !== undefined, `Expected value to be defined`),",
      "    toBeNull: () => check(received === null, `Expected value to be null`),",
      "    toContain: expected => check(received != null && received.includes(expected), `Expected value to contain ${expected}`),",
      "    toContainEqual: expected => check(Array.isArray(received) && received.some(value => deepEqual(value, expected)), `Expected array to contain equal value`),",
      "    toHaveLength: expected => check(received?.length === expected, `Expected length ${expected}, got ${received?.length}`),",
      "    toMatch: expected => check(typeof expected === 'string' ? String(received).includes(expected) : expected.test(String(received)), `Expected value to match`),",
      "    toMatchObject: expected => check(matchesExpected(received, expected, false), `Expected value to match object`),",
      "    toBeGreaterThan: expected => check(received > expected, `Expected ${received} > ${expected}`),",
      "    toBeGreaterThanOrEqual: expected => check(received >= expected, `Expected ${received} >= ${expected}`),",
      "    toBeLessThan: expected => check(received < expected, `Expected ${received} < ${expected}`),",
      "    toBeLessThanOrEqual: expected => check(received <= expected, `Expected ${received} <= ${expected}`),",
      "    toBeInstanceOf: expected => check(received instanceof expected, `Expected value to be instance of ${expected?.name}`),",
      "    toHaveProperty: (...values) => { const [key, expected] = values; const value = String(key).split('.').reduce((current, part) => current?.[part], received); check(value !== undefined && (values.length < 2 || deepEqual(value, expected)), `Expected property ${key}`); },",
      "    toThrow: expected => { let error; try { received(); } catch (caught) { error = caught; } const matches = !expected || (expected instanceof RegExp ? expected.test(String(error)) : String(error).includes(expected)); check(Boolean(error) && matches, `Expected function to throw`); },",
      "  };",
      "  Object.defineProperty(api, 'not', { get: () => makeMatchers(received, !negate) });",
      "  Object.defineProperty(api, 'resolves', { get: () => new Proxy({}, { get: (_target, key) => (...args) => Promise.resolve(received).then(value => makeMatchers(value, negate)[key](...args)) }) });",
      "  return api;",
      "}",
      "function installHarness() {",
      "  globalThis.expect = value => makeMatchers(value);",
      "  globalThis.assert = assert;",
      "  globalThis.expect.objectContaining = value => ({ [asymmetric]: 'objectContaining', value });",
      "  globalThis.expect.stringMatching = value => ({ [asymmetric]: 'stringMatching', value });",
      "  globalThis.expect.stringContaining = value => ({ [asymmetric]: 'stringContaining', value });",
      "  globalThis.it = globalThis.test = (name, callback) => pendingTests.push(Promise.resolve().then(async () => { for (const hook of hooks.beforeEach) await hook(); await callback(); for (const hook of hooks.afterEach) await hook(); }));",
      "  globalThis.it.skip = globalThis.test.skip = globalThis.it.todo = globalThis.test.todo = () => {};",
      "  globalThis.describe = (_name, callback) => callback();",
      "  globalThis.describe.skip = () => {};",
      "  globalThis.beforeEach = callback => hooks.beforeEach.push(callback);",
      "  globalThis.afterEach = callback => hooks.afterEach.push(callback);",
      "  globalThis.beforeAll = callback => pendingTests.push(Promise.resolve().then(callback));",
      "  globalThis.afterAll = callback => pendingTests.push(Promise.resolve().then(callback));",
      "  globalThis.nsObj = value => value;",
      "  globalThis.output = undefined;",
      "}",
      "async function fixtureRun() {",
      "  installHarness();",
      ...specifiers.map((specifier) => `  await import(${specifier});`),
      "  await Promise.all(pendingTests);",
      "  return { passed: true };",
      "}",
    ].join("\n");
  } else {
    importLine =
      item.module === "commonjs"
        ? `import fixtureModule from ${JSON.stringify(`./${item.entry}`)};\nconst fixtureRun = fixtureModule.run;`
        : `import { run as fixtureRun } from ${JSON.stringify(`./${item.entry}`)};`;
  }

  if (exported) {
    return `${importLine}\nexport async function runFixture() { return fixtureRun(); }\n`;
  }
  return [
    importLine,
    "Promise.resolve()",
    "  .then(() => fixtureRun())",
    `  .then(value => process.stdout.write(${JSON.stringify(resultPrefix)} + JSON.stringify(value) + "\\n"))`,
    "  .catch(error => { console.error(error); process.exitCode = 1; });",
    "",
  ].join("\n");
}

export async function prepareCaseWorkspace(bundler, profile, item) {
  const root = caseRunRoot(bundler, profile, item.id);
  const sourceDir = path.join(root, "source");
  const outDir = path.join(root, "dist");
  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(sourceDir, { recursive: true });
  await fs.mkdir(outDir, { recursive: true });

  let esbuild;
  for (const [relative, originalContents] of Object.entries(item.files)) {
    let contents = normalizeRelativeSpecifiers(item, relative, originalContents);
    const extension = path.extname(relative).toLowerCase();
    if (item.oracle && [".ts", ".tsx", ".jsx"].includes(extension)) {
      esbuild ||= await importTool("esbuild");
      const loader = extension === ".ts" ? "ts" : extension === ".tsx" ? "tsx" : "jsx";
      const transformed = await esbuild.transform(contents, {
        loader,
        format: "esm",
        target: "es2022",
        jsx: item.buildOptions?.jsx?.runtime === "automatic" ? "automatic" : "transform",
        jsxDev: false,
        sourcemap: false,
      });
      contents = transformed.code;
    }
    const output = path.join(sourceDir, relative);
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, contents.endsWith("\n") ? contents : `${contents}\n`);
  }

  const fixtureModules = path.join(sourceDir, "node_modules");
  await fs.mkdir(fixtureModules, { recursive: true });
  for (const dependency of ["react", "react-dom"]) {
    const target = path.join(toolchainModules, dependency);
    const link = path.join(fixtureModules, dependency);
    try {
      await fs.access(link);
    } catch {
      try {
        await fs.symlink(target, link, "dir");
      } catch {
        // A fixture can intentionally provide only part of node_modules.
      }
    }
  }

  const packageFile = path.join(sourceDir, "package.json");
  try {
    await fs.access(packageFile);
  } catch {
    await fs.writeFile(packageFile, item.oracle ? '{"private":true}\n' : '{"private":true,"type":"module"}\n');
  }

  const runner = createFixtureRunnerSource(item);
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
    let actual = JSON.parse(line.slice(resultPrefix.length));
    if (actual?.__tree_shaking_capture_stdout__ === true) {
      actual = run.stdout
        .split(/\r?\n/)
        .filter((candidate) => candidate && !candidate.startsWith(resultPrefix))
        .join("\n");
    }
    return { ok: true, actual, stdout: run.stdout, stderr: run.stderr, error: null };
  } catch (error) {
    return { ok: false, actual: null, stdout: run.stdout, stderr: run.stderr, error: `invalid result JSON: ${error.message}` };
  }
}
