import { readJson, writeJson } from "./lib/io.mjs";
import { fromRoot, versionsPath } from "./lib/paths.mjs";

const config = await readJson(fromRoot("config/toolchain.json"));
const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "tree-shaking-compat",
  ...(process.env.GITHUB_TOKEN || process.env.GH_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN || process.env.GH_TOKEN}` }
    : {}),
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

const npmEntries = await Promise.all(
  config.npm.map(async (name) => {
    const metadata = await fetchJson(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`);
    return [name, metadata.version];
  }),
);

const bunRelease = await fetchJson(
  `https://api.github.com/repos/${config.github.bun}/releases/latest`,
  { headers },
);
const bunVersion = bunRelease.tag_name.replace(/^bun-v/, "");
const packages = Object.fromEntries(npmEntries.sort(([a], [b]) => a.localeCompare(b)));
const bundlers = {
  rollup: packages.rollup,
  rolldown: packages.rolldown,
  webpack: packages.webpack,
  rspack: packages["@rspack/core"],
  esbuild: packages.esbuild,
  parcel: packages["@parcel/core"],
  bun: bunVersion,
  turbopack: packages.next,
};

const result = {
  schemaVersion: 1,
  resolvedAt: new Date().toISOString(),
  policy: "latest stable npm dist-tag and latest non-prerelease GitHub release",
  node: process.version,
  bundlers,
  packages,
  bun: {
    repository: config.github.bun,
    tag: bunRelease.tag_name,
    version: bunVersion,
    url: bunRelease.html_url,
  },
};

await writeJson(versionsPath, result);
console.log(`Resolved ${Object.keys(bundlers).length} bundlers at ${result.resolvedAt}`);
for (const [name, version] of Object.entries(bundlers)) console.log(`${name.padEnd(10)} ${version}`);
