import fs from "node:fs/promises";
import { exists, readJson } from "./lib/io.mjs";
import { fromRoot, inventoryPath, resultsPath } from "./lib/paths.mjs";

if (!(await exists(resultsPath))) throw new Error("Missing data/results/latest.json; run pnpm test first.");
const results = await readJson(resultsPath);
const inventory = (await exists(inventoryPath)) ? await readJson(inventoryPath) : null;
const bundlerOrder = ["rollup", "rolldown", "webpack", "rspack", "esbuild", "parcel", "bun", "turbopack"];
const bundlers = bundlerOrder.filter((id) => results.bundlers[id]);
const cases = results.corpus.cases;
const symbols = { pass: "✅", partial: "◐", fail: "❌", unsupported: "—" };

function productionResult(bundler, caseId) {
  return results.bundlers[bundler]?.profiles?.production?.[caseId];
}

function graphResult(bundler, caseId) {
  return results.bundlers[bundler]?.profiles?.graph?.[caseId];
}

function dependencyClass(bundler, caseId) {
  const production = productionResult(bundler, caseId);
  const graph = graphResult(bundler, caseId);
  if (!production) return "unavailable";
  if (production.status === "fail") return "incorrect";
  if (production.status === "partial") return "missed";
  if (production.status === "unsupported") return "unavailable";
  if (!graph) return "production-only";
  if (graph.status === "pass") return "graph-native";
  return "minifier-assisted";
}

function countBy(values, key) {
  return values.reduce((counts, value) => {
    const name = key(value);
    counts[name] = (counts[name] || 0) + 1;
    return counts;
  }, {});
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

const lines = [];
lines.push("# Latest tree-shaking conformance report", "");
lines.push(`Generated: \`${results.generatedAt}\``, "");
lines.push(
  "> ✅ = semantics correct and all pruning markers removed; ◐ = semantics correct but expected code remains; ❌ = build/runtime semantics failure; — = unavailable. A missing upstream fixture is never treated as unsupported.",
  "",
);
lines.push("## Releases under test", "");
lines.push("| Bundler | Version | Production pipeline |", "| --- | ---: | --- |");
for (const id of bundlers) {
  const item = results.bundlers[id];
  lines.push(`| ${item.label} | \`${item.version}\` | ${item.productionLayer} |`);
}

lines.push("", "## Summary", "");
lines.push(
  "| Bundler | Graph-native | Minifier-assisted | Production-only | Missed optimization | Incorrect | Pass rate |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
);
for (const id of bundlers) {
  const classes = cases.map((item) => dependencyClass(id, item.id));
  const counts = countBy(classes, (value) => value);
  const supported = classes.filter((value) => !["unavailable"].includes(value)).length;
  const passed = classes.filter((value) => ["graph-native", "minifier-assisted", "production-only"].includes(value)).length;
  lines.push(
    `| ${results.bundlers[id].label} | ${counts["graph-native"] || 0} | ${counts["minifier-assisted"] || 0} | ${counts["production-only"] || 0} | ${counts.missed || 0} | ${counts.incorrect || 0} | ${supported ? ((passed / supported) * 100).toFixed(1) : "0.0"}% |`,
  );
}

const categories = [...new Set(cases.map((item) => item.category))];
lines.push("", "## Capability families (production)", "");
lines.push(`| Family | Cases | ${bundlers.map((id) => results.bundlers[id].label).join(" | ")} |`);
lines.push(`| --- | ---: | ${bundlers.map(() => "---:").join(" | ")} |`);
for (const category of categories) {
  const selected = cases.filter((item) => item.category === category);
  const cells = bundlers.map((id) => {
    const passed = selected.filter((item) => productionResult(id, item.id)?.status === "pass").length;
    const runnable = selected.filter((item) => productionResult(id, item.id)?.status !== "unsupported").length;
    return `${passed}/${runnable || selected.length}`;
  });
  lines.push(`| ${category} | ${selected.length} | ${cells.join(" | ")} |`);
}

lines.push("", "## Case × bundler matrix (production)", "");
lines.push(`| Case | Family | ${bundlers.map((id) => results.bundlers[id].label).join(" | ")} |`);
lines.push(`| --- | --- | ${bundlers.map(() => "---:").join(" | ")} |`);
for (const item of cases) {
  const cells = bundlers.map((id) => symbols[productionResult(id, item.id)?.status || "unsupported"]);
  lines.push(`| \`${escapeCell(item.id)}\` | ${escapeCell(item.category)} | ${cells.join(" | ")} |`);
}

lines.push("", "## Optimization-layer dependency", "");
lines.push(
  "`graph-native` means the unminified bundler graph/output already removed every marker. `minifier-assisted` means only the production profile completed the optimization. Turbopack is exposed through Next.js production builds, so it is reported as `production-only`.",
  "",
);
lines.push(`| Case | ${bundlers.map((id) => results.bundlers[id].label).join(" | ")} |`);
lines.push(`| --- | ${bundlers.map(() => "---").join(" | ")} |`);
for (const item of cases) {
  lines.push(`| \`${escapeCell(item.id)}\` | ${bundlers.map((id) => dependencyClass(id, item.id)).join(" | ")} |`);
}

const noteworthy = [];
for (const item of cases) {
  for (const id of bundlers) {
    const current = productionResult(id, item.id);
    if (!current || current.status === "pass") continue;
    let detail = "";
    if (current.failureKind === "build") detail = current.build?.error || "build failed";
    else if (current.failureKind === "runtime") {
      detail = current.runtime?.error || `expected ${JSON.stringify(current.runtime?.expected)}, got ${JSON.stringify(current.runtime?.actual)}`;
    } else if (current.failureKind === "pruning") {
      detail = [
        ...(current.analysis?.unexpectedlyPresent || []).map((marker) => `kept ${marker}`),
        ...(current.analysis?.unexpectedlyAbsent || []).map((marker) => `lost ${marker}`),
      ].join(", ");
    }
    noteworthy.push({ item, id, current, detail: detail.split("\n")[0].slice(0, 240) });
  }
}
lines.push("", "## Misses and correctness failures", "");
if (!noteworthy.length) lines.push("No production-profile misses or failures in this run.");
else {
  lines.push("| Case | Bundler | Result | First diagnostic |", "| --- | --- | --- | --- |");
  for (const { item, id, current, detail } of noteworthy) {
    lines.push(`| \`${item.id}\` | ${results.bundlers[id].label} | ${symbols[current.status]} ${current.failureKind} | ${escapeCell(detail)} |`);
  }
}

if (inventory) {
  lines.push("", "## Upstream test inventory", "");
  lines.push(
    "The inventory tracks every case inside the configured upstream suite boundaries at the exact latest-release commit. `Direct` is evidence explicitly related to DCE/tree shaking; `Inventoried` also includes broad scope-hoisting/optimization pipelines. Raw upstream harnesses are not counted in the cross-bundler matrix until normalized, because their configs and assertions are bundler-specific.",
    "",
  );
  lines.push("| Upstream | Release | Commit | Direct | Inventoried |", "| --- | --- | --- | ---: | ---: |");
  for (const item of inventory.upstreams) {
    lines.push(
      `| ${item.id} | [\`${item.release.tag}\`](${item.release.url}) | [\`${item.release.commit.slice(0, 12)}\`](https://github.com/${item.repository}/commit/${item.release.commit}) | ${item.directCount} | ${item.count} |`,
    );
  }
}

lines.push("", "## Reproducibility", "");
lines.push(
  `- Exact resolved package versions: [\`data/results/versions.json\`](../data/results/versions.json)`,
  `- Machine-readable observations: [\`data/results/latest.json\`](../data/results/latest.json)`,
  `- Exact upstream case inventory: [\`data/upstreams/latest.json\`](../data/upstreams/latest.json)`,
  "- Runtime assertions distinguish semantic breakage from missed size optimizations.",
  "- Marker scans cover emitted JavaScript only; source maps are disabled.",
  "",
);

await fs.mkdir(fromRoot("reports"), { recursive: true });
await fs.writeFile(fromRoot("reports/latest.md"), `${lines.join("\n").trimEnd()}\n`);
console.log(`Wrote reports/latest.md (${cases.length} cases × ${bundlers.length} bundlers)`);
