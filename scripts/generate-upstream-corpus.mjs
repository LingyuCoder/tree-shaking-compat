import fs from "node:fs/promises";
import { builtinModules } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { classifyCase } from "./lib/taxonomy.mjs";
import { exists, readJson, writeJson } from "./lib/io.mjs";
import { fromRoot, upstreamCacheRoot } from "./lib/paths.mjs";

const inventory = await readJson(fromRoot("data/upstreams/latest.json"));
const outputPath = fromRoot("corpus/generated/upstream.json");
const repositoryRoots = {
  rollup: path.join(upstreamCacheRoot, "rollup"),
  webpack: path.join(upstreamCacheRoot, "webpack"),
  rspack: path.join(upstreamCacheRoot, "rspack"),
  parcel: path.join(upstreamCacheRoot, "parcel"),
  turbopack: path.join(upstreamCacheRoot, "next"),
  rolldown: path.join(upstreamCacheRoot, "rolldown"),
  bun: path.join(upstreamCacheRoot, "bun"),
  esbuild: path.join(upstreamCacheRoot, "esbuild"),
};

const sourceExtensions = /\.(?:[cm]?[jt]sx?)$/i;
const sourceFileNames = /^(?:package\.json|[^.].*\.(?:[cm]?[jt]sx?|json|css|txt|text|data|html|svg))$/i;
const excludedDirectories = new Set(["_expected", "__snapshots__", "issues", "output", "dist"]);
const excludedFiles = /^(?:_config\.|_expected(?:\.|$)|webpack\.config\.|rspack\.config\.|test\.config\.|test\.filter\.|options\.json|artifacts\.snap|output\.md|README\.md|diff\.md|yarn\.lock|package-lock\.json)/i;
const bundlerIds = ["rollup", "rolldown", "webpack", "rspack", "esbuild", "parcel", "bun", "turbopack"];
const builtinSpecifiers = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);
const sharedToolchainPackages = new Set(["react", "react-dom"]);

function slug(value) {
  return value
    .replace(/^Test/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function normalizedName(value) {
  return value.replace(/^Test/, "").replace(/^dce\//, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1 ");
}

function stringTokens(source) {
  const tokens = [];
  for (const match of stripComments(source).matchAll(/(["'`])((?:\\.|(?!\1)[^\\\r\n])*)\1/g)) {
    const value = match[2];
    if (value.length >= 4 && !/^\.?\.?\//.test(value) && !/^node:/.test(value)) tokens.push(value);
  }
  return tokens;
}

function stripStrings(source) {
  return stripComments(source).replace(/(["'`])(?:\\.|(?!\1)[^\\\r\n])*\1/g, " ");
}

function identifierTokens(source) {
  const ignored = new Set(
    "await async break case catch class const continue debugger default delete do else export extends false finally for from function get if import in instanceof let new null of return set static super switch this throw true try typeof undefined var void while with yield console globalThis process module exports require Object Array String Number Boolean Symbol Math JSON Promise Error Set Map WeakMap WeakSet".split(
      " ",
    ),
  );
  return [...stripStrings(source).matchAll(/\b[A-Za-z_$][\w$]{3,}\b/g)]
    .map((match) => match[0])
    .filter((value) => !ignored.has(value));
}

function declarationTokens(source) {
  const values = [];
  const clean = stripStrings(source);
  for (const match of clean.matchAll(/\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) values.push(match[1]);
  for (const match of clean.matchAll(/\b(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g)) {
    if (match[1]) values.push(match[1]);
  }
  return values;
}

function unique(values) {
  return [...new Set(values)];
}

function deriveOracle(source, expected = "") {
  const strings = unique(stringTokens(source));
  const expectedHas = (token) => expected.includes(token);
  const explicitDead = unique([
    ...identifierTokens(source).filter(
      (token) =>
        token.length >= 5 &&
        /(?:fail(?:ed)?|drop|remove|dead)/i.test(token) &&
        !/^(?:fail|failed|drop|remove|removed|dead)$/i.test(token) &&
        !/possible.?removal/i.test(token),
    ),
    ...strings.filter(
      (token) =>
        /(?:fail(?:ed)?|drop|remove|dead)/i.test(token) &&
        (/^[A-Z0-9_ :.-]+$/.test(token) || !/\s/.test(token)) &&
        !/possible.?removal/i.test(token),
    ),
  ]);
  const explicitLive = unique(
    [...identifierTokens(source), ...strings].filter(
      (token) => /(?:keep|preserve|reserved)/i.test(token) && !/(?:unused|remove)/i.test(token),
    ),
  );
  let absent = expected ? explicitDead.filter((token) => !expectedHas(token)) : explicitDead;
  if (expected && absent.length === 0) {
    absent = unique(strings.filter((token) => !expectedHas(token))).slice(0, 16);
  }
  if (expected && absent.length === 0) {
    absent = unique(declarationTokens(source).filter((token) => !expectedHas(token) && token.length >= 5)).slice(0, 16);
  }
  const present = expected
    ? explicitLive.filter(expectedHas).slice(0, 16)
    : explicitLive.filter((token) => /keep|preserve|reserved/i.test(token)).slice(0, 16);
  return {
    kind: expected ? "upstream-snapshot" : absent.length || present.length ? "explicit-markers" : "build-and-runtime",
    absent: absent.slice(0, 24),
    present,
    stringMarkers: unique([...absent, ...present].filter((token) => strings.includes(token))),
  };
}

async function collectFiles(directory, { stripInput = false } = {}) {
  const files = {};
  async function visit(current, relative = "") {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
      const nextRelative = relative ? `${relative}/${entry.name}` : entry.name;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute, nextRelative);
      } else if (entry.isFile() && sourceFileNames.test(entry.name) && !excludedFiles.test(entry.name)) {
        let target = nextRelative;
        if (stripInput && target.startsWith("input/")) target = target.slice("input/".length);
        if (target.startsWith("../") || path.isAbsolute(target)) continue;
        files[target] = await fs.readFile(absolute, "utf8");
      }
    }
  }
  await visit(directory);
  return files;
}

async function expectedText(directory) {
  const candidates = [
    "artifacts.snap",
    "output.md",
    "_expected.js",
    "_expected/es.js",
    "__snapshots__/treeshaking.snap.txt",
  ];
  const chunks = [];
  for (const candidate of candidates) {
    const file = path.join(directory, candidate);
    if (await exists(file)) chunks.push(await fs.readFile(file, "utf8"));
  }
  const snapshots = path.join(directory, "__snapshots__");
  if (await exists(snapshots)) {
    for (const name of await fs.readdir(snapshots)) {
      const file = path.join(snapshots, name);
      if ((await fs.stat(file)).isFile()) chunks.push(await fs.readFile(file, "utf8"));
    }
  }
  return chunks.join("\n");
}

function chooseEntries(files, upstream) {
  const names = Object.keys(files);
  const priorities =
    upstream === "turbopack"
      ? ["index.js", "input.js", "main.js", "entry.js", "test.js", "test.jsx", "a.js"]
      : ["index.js", "main.js", "entry.js", "main.ts", "entry.ts", "test.js", "test.jsx", "entry.jsx", "a.js", "input.js"];
  for (const candidate of priorities) {
    if (names.includes(candidate)) return [candidate];
  }
  const source = names.find((name) => sourceExtensions.test(name) && !name.endsWith("package.json"));
  return source ? [source] : [];
}

function packageName(specifier) {
  return specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];
}

function matchesExternal(specifier, patterns) {
  return patterns.some(
    (pattern) =>
      pattern === "*" ||
      pattern === specifier ||
      specifier.startsWith(`${pattern}/`) ||
      (pattern.endsWith("/*") && specifier.startsWith(pattern.slice(0, -1))),
  );
}

function unresolvedBareSpecifiers(files, declaredExternal = []) {
  const specifiers = new Set();
  const patterns = [
    /\b(?:import|export)\s+(?:[^;"']*?\s+from\s*)?["']([^"']+)["']/g,
    /\b(?:require|import)\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const source of Object.values(files)) {
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const specifier = match[1];
        if (
          specifier.startsWith(".") ||
          specifier.startsWith("/") ||
          specifier.startsWith("#") ||
          specifier.startsWith("data:") ||
          builtinSpecifiers.has(specifier) ||
          matchesExternal(specifier, declaredExternal)
        ) {
          continue;
        }
        const dependency = packageName(specifier);
        const embedded = Object.keys(files).some(
          (file) =>
            file === `node_modules/${dependency}/package.json` || file.startsWith(`node_modules/${dependency}/`),
        );
        if (!embedded && !sharedToolchainPackages.has(dependency)) specifiers.add(specifier);
      }
    }
  }
  return [...specifiers].sort();
}

function unresolvedRelativeSpecifiers(files) {
  const names = new Set(Object.keys(files));
  const missing = new Set();
  const patterns = [
    /\b(?:import|export)\s+(?:[^;"']*?\s+from\s*)?["']([^"']+)["']/g,
    /\b(?:require|import)\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const [file, source] of Object.entries(files)) {
    if (!sourceExtensions.test(file)) continue;
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const specifier = match[1].split(/[?#]/, 1)[0];
        if (!specifier.startsWith(".")) continue;
        const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
        const candidates = [
          base,
          ...[".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".json", ".css", ".txt", ".data"].map(
            (extension) => `${base}${extension}`,
          ),
          ...["index.js", "index.mjs", "index.cjs", "index.ts", "index.tsx", "index.json"].map((name) => `${base}/${name}`),
        ];
        if (!candidates.some((candidate) => names.has(candidate))) missing.add(`${file} → ${specifier}`);
      }
    }
  }
  return [...missing].sort();
}

function containsTestHarness(files, entries) {
  const source = entries.map((entry) => files[entry] || "").join("\n");
  return /\b(?:it|test)\s*\(\s*["'`]/.test(source) || /\bdescribe\s*\(/.test(source);
}

function upstreamById(id) {
  return inventory.upstreams.find((item) => item.id === id);
}

function sourceRecord(upstream, suite, entry, override = {}) {
  return {
    bundler: upstream.id,
    suite: suite.id,
    caseId: entry.id,
    url: entry.sourceUrl,
    upstreamStatus: "active",
    ...override,
  };
}

function normalizeBunFileName(file) {
  let value = file.replaceAll("\\", "/");
  for (const prefix of ["/Users/user/project/", "/project/", "/Users/user/"]) {
    if (value.startsWith(prefix)) return value.slice(prefix.length);
  }
  return value.replace(/^\/+/, "");
}

function expectShim(value) {
  const matchers = {
    toContain(expected) {
      if (!String(value).includes(expected)) throw new Error(`Expected output to contain ${expected}`);
    },
    toBeTruthy() {
      if (!value) throw new Error("Expected value to be truthy");
    },
    toBeFalsy() {
      if (value) throw new Error("Expected value to be falsy");
    },
    toEqual() {},
    toHaveLength() {},
  };
  matchers.not = {
    toContain(expected) {
      if (String(value).includes(expected)) throw new Error(`Expected output not to contain ${expected}`);
    },
  };
  return matchers;
}

async function bunCases() {
  const bun = upstreamById("bun");
  const esbuild = upstreamById("esbuild");
  const rolldown = upstreamById("rolldown");
  const sourceFile = path.join(repositoryRoots.bun, "test/bundler/esbuild/dce.test.ts");
  let source = await fs.readFile(sourceFile, "utf8");
  source = source.replace(/^import .*$/gm, "").replace(/regex\.exec\(code\)!/g, "regex.exec(code)");
  const captured = [];
  vm.runInNewContext(
    source,
    {
      describe: (_name, callback) => callback(),
      itBundled: (name, options) => captured.push({ name, options }),
      expect: expectShim,
      isWindows: false,
      dedent: (strings, ...values) => String.raw({ raw: strings }, ...values),
      console,
    },
    { timeout: 15_000, filename: sourceFile },
  );

  const bunEntries = new Map(
    bun.suites.flatMap((suite) => suite.entries.map((entry) => [normalizedName(entry.name), { suite, entry }])),
  );
  const esbuildEntries = new Map(
    esbuild.suites.flatMap((suite) => suite.entries.map((entry) => [normalizedName(entry.name), { suite, entry }])),
  );
  const rolldownPort = rolldown.suites.find((suite) => suite.id === "esbuild-dce-port");
  const rolldownEntries = new Map(
    rolldownPort.entries.map((entry) => [normalizedName(entry.name), { suite: rolldownPort, entry }]),
  );
  const cases = [];
  const matched = new Set();
  for (const { name, options } of captured) {
    const files = Object.fromEntries(
      Object.entries(options.files || {}).map(([file, contents]) => [normalizeBunFileName(file), String(contents)]),
    );
    if (
      options.jsx?.runtime === "automatic" &&
      files["node_modules/react/jsx-dev-runtime.js"] &&
      !files["node_modules/react/jsx-runtime.js"]
    ) {
      files["node_modules/react/jsx-runtime.js"] =
        `${files["node_modules/react/jsx-dev-runtime.js"]}\n` +
        `export { jsxDEV as jsx, jsxDEV as jsxs };\n`;
      files["node_modules/react/package.json"] = JSON.stringify({
        name: "react",
        version: "0.0.0-fixture",
        type: "module",
        exports: {
          ".": "./index.js",
          "./jsx-runtime": "./jsx-runtime.js",
          "./jsx-dev-runtime": "./jsx-dev-runtime.js",
        },
      });
    }
    const rawEntries = options.entryPoints || [Object.keys(options.files || {})[0]];
    const entries = rawEntries.map(normalizeBunFileName).filter((entry) => files[entry]);
    if (!entries.length) continue;
    const key = normalizedName(name);
    matched.add(key);
    const sources = [];
    const bunMatch = bunEntries.get(key);
    if (bunMatch) sources.push(sourceRecord(bun, bunMatch.suite, bunMatch.entry, { upstreamStatus: options.todo ? "todo" : "active" }));
    const esbuildMatch = esbuildEntries.get(key);
    if (esbuildMatch) sources.push(sourceRecord(esbuild, esbuildMatch.suite, esbuildMatch.entry));
    const rolldownMatch = rolldownEntries.get(key);
    if (rolldownMatch) sources.push(sourceRecord(rolldown, rolldownMatch.suite, rolldownMatch.entry));
    if (!sources.length) {
      sources.push({
        bundler: "bun",
        suite: "esbuild-dce-port",
        caseId: name,
        url: `https://github.com/${bun.repository}/blob/${bun.release.commit}/test/bundler/esbuild/dce.test.ts`,
        upstreamStatus: options.todo ? "todo" : "active",
      });
    }
    const fileSource = Object.values(files).join("\n");
    const oracle = deriveOracle(fileSource);
    if (options.dce) {
      oracle.absent = unique([
        ...oracle.absent,
        ...identifierTokens(fileSource).filter(
          (token) => /FAIL|FAILED|DROP|REMOVE/i.test(token) && !/^(?:fail|failed|drop|remove|removed)$/i.test(token),
        ),
        ...stringTokens(fileSource).filter(
          (token) => /FAIL|FAILED|DROP|REMOVE/i.test(token) && (/^[A-Z0-9_ :.-]+$/.test(token) || !/\s/.test(token)),
        ),
      ]).slice(0, 48);
      oracle.kind = options.run ? "runtime-and-dce-markers" : "explicit-dce-markers";
    }
    const run = Array.isArray(options.run) ? null : options.run;
    const canRun = run && typeof run === "object" && Object.hasOwn(run, "stdout") && !run.file && entries.length === 1;
    const declaredExternal = options.external || [];
    const unresolved = unresolvedBareSpecifiers(files, declaredExternal);
    const effectiveLoader = { ...(options.loader || {}) };
    if (Object.keys(files).some((file) => file.endsWith(".txt")) && !effectiveLoader[".txt"]) {
      effectiveLoader[".txt"] = "text";
    }
    const customLoader = Object.keys(effectiveLoader).length > 0;
    const frameworkRewritesFixtureReact = Boolean(files["node_modules/react/jsx-runtime.js"]);
    oracle.stringMarkers = unique(
      [...oracle.absent, ...oracle.present].filter((token) => stringTokens(fileSource).includes(token)),
    );
    cases.push({
      id: `upstream/esbuild/${slug(name)}`,
      title: name.replace(/^dce\//, ""),
      category: classifyCase(name),
      description: "Imported from Bun's executable port of the esbuild DCE suite.",
      module: "esm",
      entries,
      entry: entries[0],
      files,
      execution: canRun
        ? { kind: "stdout", runtime: true, stdout: String(run.stdout).replace(/\n$/, "") }
        : { kind: "side-effect", runtime: false },
      expect: {
        value: canRun ? String(run.stdout).replace(/\n$/, "") : null,
        absent: oracle.absent,
        present: [],
      },
      oracle,
      provenance: sources,
      upstreamTodo: Boolean(options.todo),
      portabilityIssues: unresolved.length ? [`Missing runtime dependencies: ${unresolved.join(", ")}`] : [],
      unsupportedBundlers: unique([
        ...(canRun && unresolved.length ? bundlerIds : []),
        ...(customLoader ? ["parcel", "turbopack"] : []),
        ...(frameworkRewritesFixtureReact ? ["turbopack"] : []),
      ]),
      buildOptions: {
        ignoreAnnotations: Boolean(options.ignoreDCEAnnotations),
        jsx: options.jsx || null,
        external: unique([...declaredExternal, ...(!canRun ? unresolved : [])]),
        loader: effectiveLoader,
      },
    });
  }
  return { cases, matched };
}

function localDirectory(upstreamId, entry) {
  if (upstreamId === "turbopack") return path.join(repositoryRoots.turbopack, entry.path);
  return path.join(repositoryRoots[upstreamId], entry.path);
}

async function genericCase(upstream, suite, entry, override = {}) {
  const directory = override.directory || localDirectory(upstream.id, entry);
  if (!(await exists(directory)) || !(await fs.stat(directory)).isDirectory()) return null;
  const stripInput = upstream.id === "turbopack" && (await exists(path.join(directory, "input")));
  const files = await collectFiles(directory, { stripInput });
  const entries = chooseEntries(files, upstream.id);
  if (!entries.length) return null;
  const source = Object.values(files).join("\n");
  const expected = await expectedText(directory);
  const oracle = deriveOracle(source, expected);
  const harness = containsTestHarness(files, entries);
  const webpackRuntimeHarness = /__webpack_exports_info__|__webpack_modules__/.test(source);
  const turbopackRuntimeHarness = /__turbopack_modules__/.test(source);
  const privateHarness = /__STATS__|\b(?:FALSY|IS_FALSE)\b|this\.buildCanonicalizedResource/.test(source);
  const filesystemAssertion = /require\(["'](?:node:)?fs["']\)|\b__filename\b/.test(source);
  const unresolved = unresolvedBareSpecifiers(files);
  const missingRelative = unresolvedRelativeSpecifiers(files);
  const runtime = harness && !filesystemAssertion;
  if (harness) {
    oracle.absent = [];
    oracle.present = [];
    oracle.stringMarkers = [];
    if (!runtime) oracle.kind = "build-and-runtime";
  }
  const unsupportedBundlers = [];
  if (webpackRuntimeHarness) unsupportedBundlers.push(...bundlerIds.filter((id) => !["webpack", "rspack"].includes(id)));
  if (turbopackRuntimeHarness) unsupportedBundlers.push(...bundlerIds.filter((id) => id !== "turbopack"));
  if (privateHarness) unsupportedBundlers.push(...bundlerIds);
  if (runtime && unresolved.length) unsupportedBundlers.push(...bundlerIds);
  if (missingRelative.length) unsupportedBundlers.push(...bundlerIds);
  return {
    id: override.id || `upstream/${upstream.id}/${slug(entry.id)}`,
    title: override.title || entry.name,
    category: classifyCase(suite.id, entry.name, entry.path),
    description: `Imported from ${upstream.id}/${suite.id}.`,
    module: "esm",
    entries,
    entry: entries[0],
    files,
    execution: harness
      ? { kind: "test-harness", runtime }
      : { kind: "side-effect", runtime: false },
    expect: { value: runtime ? { passed: true } : null, absent: oracle.absent, present: oracle.present },
    oracle: { ...oracle, upstreamExpected: Boolean(expected), runtimeHarness: harness },
    provenance: [sourceRecord(upstream, suite, entry)],
    portabilityIssues: [
      ...(webpackRuntimeHarness ? ["Uses webpack/Rspack runtime inspection globals."] : []),
      ...(turbopackRuntimeHarness ? ["Uses a Turbopack runtime inspection global."] : []),
      ...(privateHarness ? ["Uses values injected by the upstream private test harness/config."] : []),
      ...(unresolved.length ? [`Missing upstream-configured dependencies: ${unresolved.join(", ")}`] : []),
      ...(missingRelative.length ? [`Missing upstream virtual/input modules: ${missingRelative.join(", ")}`] : []),
    ],
    unsupportedBundlers: unique(unsupportedBundlers),
    buildOptions: { external: runtime ? [] : unresolved },
  };
}

function rollupPathFromIgnored(name) {
  const match = /^rollup@(form|function|chunking)@([^:]+?)(?:@generates\s+\w+)?(?:\s*:|$)/.exec(name);
  if (!match) return null;
  const pipeline = `${match[1]}-pipeline`;
  return { pipeline, name: match[2].replaceAll("@", "/") };
}

const { cases: generated, matched: bunMatched } = await bunCases();

// Add esbuild DCE cases that are not present in Bun's executable port from Rolldown's fixture port.
const esbuild = upstreamById("esbuild");
const rolldown = upstreamById("rolldown");
const rolldownPort = rolldown.suites.find((suite) => suite.id === "esbuild-dce-port");
const portByName = new Map(rolldownPort.entries.map((entry) => [normalizedName(entry.name), entry]));
for (const suite of esbuild.suites) {
  for (const entry of suite.entries) {
    const key = normalizedName(entry.name);
    const existing = generated.find((item) =>
      item.provenance.some(
        (source) => source.bundler === "esbuild" && normalizedName(source.caseId.split("/").at(-1)) === key,
      ),
    );
    if (existing) continue;
    const port = portByName.get(key);
    if (!port) continue;
    const directory = path.join(repositoryRoots.rolldown, port.path);
    const item = await genericCase(esbuild, suite, entry, {
      directory,
      id: `upstream/esbuild/${slug(entry.name)}`,
      title: entry.name.replace(/^Test/, ""),
    });
    if (item) {
      item.provenance.push(sourceRecord(rolldown, rolldownPort, port));
      generated.push(item);
    }
  }
}

// Add every direct, directory-backed upstream case. Port and ignore lists are mapped separately.
for (const upstream of inventory.upstreams) {
  if (["esbuild", "bun"].includes(upstream.id)) continue;
  for (const suite of upstream.suites) {
    if (upstream.id === "rolldown" && suite.id !== "native-tree-shaking") continue;
    for (const entry of suite.entries) {
      if (entry.relevance !== "direct") continue;
      const item = await genericCase(upstream, suite, entry);
      if (item) generated.push(item);
    }
  }
}

// Rolldown's ignored Rollup lists are exact negative evidence. Attach them to their Rollup cases.
const rollup = upstreamById("rollup");
const rollupCases = new Map();
const mappedNegativeSources = new Set();
for (const item of generated.filter((candidate) => candidate.provenance.some((source) => source.bundler === "rollup"))) {
  for (const source of item.provenance.filter((candidate) => candidate.bundler === "rollup")) {
    rollupCases.set(`${source.suite}/${source.caseId.replace(/^.*?\//, "")}`, item);
    rollupCases.set(`${source.suite}/${source.caseId.split("/").slice(1).join("/")}`, item);
  }
}
for (const suite of rolldown.suites.filter((item) => item.id.startsWith("rollup-incompatibilities"))) {
  for (const entry of suite.entries) {
    const parsed = rollupPathFromIgnored(entry.name);
    if (!parsed) continue;
    let item = [...generated].find((candidate) =>
      candidate.provenance.some(
        (source) => source.bundler === "rollup" && source.suite === parsed.pipeline && source.caseId.endsWith(`/${parsed.name}`),
      ),
    );
    if (!item) {
      const selector = rollup.suites.find((candidate) => candidate.id === parsed.pipeline);
      const root = selector?.root;
      const directory = root ? path.join(repositoryRoots.rollup, root, parsed.name) : null;
      if (directory && (await exists(directory))) {
        const syntheticEntry = {
          id: `${parsed.pipeline}/${parsed.name}`,
          name: parsed.name,
          path: `${root}/${parsed.name}`,
          sourceUrl: `https://github.com/${rollup.repository}/tree/${rollup.release.commit}/${root}/${parsed.name}`,
        };
        item = await genericCase(rollup, selector, syntheticEntry);
        if (item) generated.push(item);
      }
    }
    if (item) {
      mappedNegativeSources.add(`${rolldown.id}:${entry.id}`);
      item.knownFailures = unique([...(item.knownFailures || []), "rolldown"]);
      item.negativeEvidence = [
        ...(item.negativeEvidence || []),
        { bundler: "rolldown", url: entry.sourceUrl, list: suite.id },
      ];
    }
  }
}

const ids = new Set();
const cases = [];
for (const item of generated) {
  if (ids.has(item.id)) {
    const existing = cases.find((candidate) => candidate.id === item.id);
    existing.provenance = unique([...existing.provenance, ...item.provenance].map((value) => JSON.stringify(value))).map(JSON.parse);
    continue;
  }
  ids.add(item.id);
  cases.push(item);
}
cases.sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id));

const mappedSources = new Set(cases.flatMap((item) => item.provenance.map((source) => `${source.bundler}:${source.caseId}`)));
const sourceCoverage = {};
for (const upstream of inventory.upstreams) {
  const direct = upstream.suites.flatMap((suite) => suite.entries.filter((entry) => entry.relevance === "direct"));
  const negative = upstream.suites.flatMap((suite) => suite.entries.filter((entry) => entry.relevance === "negative"));
  const mapped = direct.filter((entry) => mappedSources.has(`${upstream.id}:${entry.id}`)).length;
  const negativeMapped = negative.filter((entry) => mappedNegativeSources.has(`${upstream.id}:${entry.id}`)).length;
  sourceCoverage[upstream.id] = { direct: direct.length, mapped, negative: negative.length, negativeMapped };
}

await writeJson(outputPath, {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  inventoryGeneratedAt: inventory.generatedAt,
  definition:
    "Deduplicated executable corpus generated from every configured upstream tree-shaking suite. Exact upstream paths remain attached as provenance.",
  sourceCoverage,
  count: cases.length,
  cases,
});
console.log(`Wrote ${path.relative(fromRoot(), outputPath)} (${cases.length} executable cases)`);
for (const [id, coverage] of Object.entries(sourceCoverage)) {
  const negative = coverage.negative ? `; ${coverage.negativeMapped}/${coverage.negative} negative records mapped` : "";
  console.log(`${id}: ${coverage.mapped}/${coverage.direct} source cases mapped${negative}`);
}
