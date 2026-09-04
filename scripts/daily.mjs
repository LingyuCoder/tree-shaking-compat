import { runCommand } from "./lib/process.mjs";
import { repoRoot } from "./lib/paths.mjs";

const steps = [
  ["Resolve latest releases", ["scripts/resolve-versions.mjs"]],
  ["Install exact toolchain", ["scripts/install-toolchain.mjs"]],
  ["Inventory upstream suites", ["scripts/sync-upstream-inventory.mjs"]],
  ["Checkout exact upstream fixtures", ["scripts/checkout-upstreams.mjs"]],
  ["Generate complete upstream corpus", ["scripts/generate-upstream-corpus.mjs"]],
  ["Run production conformance corpus", ["scripts/run.mjs", "--profiles=production"]],
  ["Generate report", ["scripts/report.mjs"]],
  ["Validate repository", ["scripts/check.mjs"]],
];

for (const [label, args] of steps) {
  console.log(`\n## ${label}`);
  const result = await runCommand(process.execPath, args, {
    cwd: repoRoot,
    timeoutMs: 60 * 60 * 1000,
    inherit: true,
  });
  if (!result.ok) throw new Error(`${label} failed with exit code ${result.code}`);
}
