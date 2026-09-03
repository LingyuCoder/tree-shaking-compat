import path from "node:path";
import { readJson, writeJson } from "./lib/io.mjs";
import { fromRoot, inventoryPath } from "./lib/paths.mjs";

const config = await readJson(fromRoot("config/upstreams.json"));
const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "tree-shaking-compat",
  ...(process.env.GITHUB_TOKEN || process.env.GH_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN || process.env.GH_TOKEN}` }
    : {}),
};
const directPattern = new RegExp(config.directPattern, "i");
const treeCache = new Map();

async function fetchJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

async function resolveRelease(repository) {
  const release = await fetchJson(`https://api.github.com/repos/${repository}/releases/latest`);
  const commit = await fetchJson(
    `https://api.github.com/repos/${repository}/commits/${encodeURIComponent(release.tag_name)}`,
  );
  return {
    tag: release.tag_name,
    version: release.name || release.tag_name,
    commit: commit.sha,
    publishedAt: release.published_at,
    url: release.html_url,
  };
}

async function gitTree(repository, sha, recursive = false) {
  const key = `${repository}:${sha}:${recursive}`;
  if (!treeCache.has(key)) {
    treeCache.set(
      key,
      fetchJson(
        `https://api.github.com/repos/${repository}/git/trees/${encodeURIComponent(sha)}${recursive ? "?recursive=1" : ""}`,
      ),
    );
  }
  const value = await treeCache.get(key);
  if (value.truncated) throw new Error(`GitHub truncated tree ${repository}@${sha}`);
  return value.tree;
}

async function resolvePathTree(repository, commit, requestedPath) {
  let sha = commit;
  for (const segment of requestedPath.split("/").filter(Boolean)) {
    const entries = await gitTree(repository, sha, false);
    const match = entries.find((entry) => entry.path === segment && entry.type === "tree");
    if (!match) return null;
    sha = match.sha;
  }
  return sha;
}

async function childDirectories(context, selector) {
  const sha = await resolvePathTree(context.repository, context.commit, selector.root);
  if (!sha) return [];
  const entries = await gitTree(context.repository, sha, false);
  return entries
    .filter(
      (entry) => entry.type === "tree" && !entry.path.startsWith("_") && entry.path !== "node_modules",
    )
    .map((entry) => ({ name: entry.path, path: `${selector.root}/${entry.path}`, kind: "tree" }));
}

async function directoriesWithFile(context, selector) {
  const sha = await resolvePathTree(context.repository, context.commit, selector.root);
  if (!sha) return [];
  const names = new Set(selector.fileNames);
  const entries = await gitTree(context.repository, sha, true);
  return entries
    .filter((entry) => entry.type === "blob" && names.has(path.posix.basename(entry.path)))
    .map((entry) => {
      const directory = path.posix.dirname(entry.path);
      return {
        name: directory,
        path: `${selector.root}/${directory}`,
        evidenceFile: `${selector.root}/${entry.path}`,
        kind: "tree",
      };
    });
}

async function readSourceFile(context, file) {
  return fetchText(`https://raw.githubusercontent.com/${context.repository}/${context.commit}/${file}`);
}

async function regexInFile(context, selector) {
  const source = await readSourceFile(context, selector.path);
  const regex = new RegExp(selector.pattern, "g");
  const entries = [];
  for (const match of source.matchAll(regex)) {
    entries.push({ name: match[1], path: selector.path, evidenceFile: selector.path, kind: "blob" });
  }
  return entries;
}

async function jsonStringArray(context, selector) {
  const values = JSON.parse(await readSourceFile(context, selector.path));
  return values.map((value) => ({
    name: value,
    path: selector.path,
    evidenceFile: selector.path,
    kind: "blob",
  }));
}

const extractors = {
  "child-directories": childDirectories,
  "directories-with-file": directoriesWithFile,
  "regex-in-file": regexInFile,
  "quoted-strings-in-file": regexInFile,
  "json-string-array": jsonStringArray,
};

function classify(upstream, selector, raw) {
  const evidence = `${raw.name} ${raw.path}`;
  const directBySuite = !selector.id.includes("pipeline") && upstream.id !== "parcel";
  return directBySuite || directPattern.test(evidence) ? "direct" : "pipeline";
}

const upstreams = [];
for (const upstream of config.upstreams) {
  process.stdout.write(`Inventory ${upstream.id}… `);
  const release = await resolveRelease(upstream.repository);
  const context = { repository: upstream.repository, commit: release.commit };
  const suites = [];
  for (const selector of upstream.suites) {
    const extractor = extractors[selector.kind];
    if (!extractor) throw new Error(`Unknown selector kind: ${selector.kind}`);
    const rawEntries = await extractor(context, selector);
    const entries = [];
    const seen = new Set();
    for (const raw of rawEntries) {
      const name = raw.name.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const relevance = classify(upstream, selector, raw);
      const view = raw.kind === "blob" ? "blob" : "tree";
      entries.push({
        id: `${selector.id}/${name}`,
        name,
        path: raw.path,
        relevance,
        sourceUrl: `https://github.com/${upstream.repository}/${view}/${release.commit}/${raw.path}`,
        normalization: "not-normalized",
      });
    }
    entries.sort((a, b) => a.id.localeCompare(b.id));
    suites.push({
      id: selector.id,
      root: selector.root || selector.path,
      kind: selector.kind,
      count: entries.length,
      directCount: entries.filter((entry) => entry.relevance === "direct").length,
      entries,
    });
  }
  const count = suites.reduce((sum, suite) => sum + suite.count, 0);
  const directCount = suites.reduce((sum, suite) => sum + suite.directCount, 0);
  upstreams.push({ ...upstream, release, count, directCount, suites });
  console.log(`${directCount} direct / ${count} inventoried at ${release.tag}`);
}

const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  definition: {
    direct: "Explicit DCE/tree-shaking suites or path-selected semantic tests.",
    pipeline: "Broader suites that exercise the bundler pipeline but are not counted as direct evidence.",
    normalization: "Upstream tests are inventoried exactly; only portable semantic probes are executed cross-bundler.",
  },
  upstreams,
};
await writeJson(inventoryPath, result);
console.log(`Wrote ${path.relative(fromRoot(), inventoryPath)}`);
