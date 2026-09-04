import fs from "node:fs/promises";
import path from "node:path";
import { readJson } from "./lib/io.mjs";
import { fromRoot, upstreamCacheRoot } from "./lib/paths.mjs";
import { runCommand } from "./lib/process.mjs";

const inventory = await readJson(fromRoot("data/upstreams/latest.json"));
const config = await readJson(fromRoot("config/upstreams.json"));
const directoryNames = { turbopack: "next" };
const skipped = new Set(["esbuild"]); // Exact esbuild DCE fixtures are supplied by the Bun and Rolldown ports.

async function git(args, cwd) {
  const result = await runCommand("git", args, { cwd, timeoutMs: 20 * 60 * 1000 });
  if (!result.ok) throw new Error(result.error || result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

async function checkout(upstream) {
  if (skipped.has(upstream.id)) return;
  const release = inventory.upstreams.find((item) => item.id === upstream.id)?.release;
  if (!release) throw new Error(`Missing release metadata for ${upstream.id}`);
  const directory = path.join(upstreamCacheRoot, directoryNames[upstream.id] || upstream.id);
  await fs.mkdir(directory, { recursive: true });
  try {
    await fs.access(path.join(directory, ".git"));
  } catch {
    await git(["init"], directory);
    await git(["remote", "add", "origin", `https://github.com/${upstream.repository}.git`], directory);
  }

  const sparsePaths = [
    ...new Set(
      upstream.suites.map((suite) => {
        const selected = suite.root || suite.path;
        return suite.path ? path.posix.dirname(selected) : selected;
      }),
    ),
  ];
  await git(["sparse-checkout", "init", "--cone"], directory);
  await git(["sparse-checkout", "set", ...sparsePaths], directory);
  const current = await git(["rev-parse", "HEAD"], directory).catch(() => "");
  if (current !== release.commit) {
    await git(["fetch", "--depth=1", "--filter=blob:none", "origin", release.commit], directory);
    await git(["checkout", "--detach", "FETCH_HEAD"], directory);
  }
  console.log(`${upstream.id}: ${release.commit.slice(0, 12)} (${sparsePaths.length} suite paths)`);
}

await fs.mkdir(upstreamCacheRoot, { recursive: true });
for (let index = 0; index < config.upstreams.length; index += 3) {
  await Promise.all(config.upstreams.slice(index, index + 3).map(checkout));
}
