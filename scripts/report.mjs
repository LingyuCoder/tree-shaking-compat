import fs from "node:fs/promises";
import { categoryOrder } from "./lib/taxonomy.mjs";
import { exists, readJson } from "./lib/io.mjs";
import { fromRoot, inventoryPath, resultsPath } from "./lib/paths.mjs";

if (!(await exists(resultsPath))) throw new Error("Missing data/results/latest.json; run pnpm test first.");
const results = await readJson(resultsPath);
const inventory = (await exists(inventoryPath)) ? await readJson(inventoryPath) : null;
const bundlerOrder = ["rollup", "rolldown", "webpack", "rspack", "esbuild", "parcel", "bun", "turbopack"];
const bundlers = bundlerOrder.filter((id) => results.bundlers[id]);
const corpusCases = results.corpus.cases;
const cases = corpusCases.filter(hasPortableOracle);
const symbols = { pass: "✅", partial: "◐", fail: "❌", unsupported: "—", unverified: "◇" };
const assessedStatuses = new Set(["pass", "partial", "fail"]);

function productionResult(bundler, caseId) {
  return results.bundlers[bundler]?.profiles?.production?.[caseId];
}

function statusOf(bundler, caseId) {
  return productionResult(bundler, caseId)?.status || "unverified";
}

function escapeCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ").replace(/\s+/g, " ").trim();
}

function rateCell(selected, bundler) {
  const statuses = selected.map((item) => statusOf(bundler, item.id));
  const assessed = statuses.filter((status) => assessedStatuses.has(status)).length;
  if (!assessed) return "—";
  const passed = statuses.filter((status) => status === "pass").length;
  const partial = statuses.filter((status) => status === "partial").length;
  const failed = statuses.filter((status) => status === "fail").length;
  return `${passed}/${assessed} (${((passed / assessed) * 100).toFixed(1)}%) · ◐${partial} · ❌${failed}`;
}

function oracleLabel(item) {
  const runtime = item.execution?.runtime !== false;
  const markers = (item.expect?.absent?.length || 0) + (item.expect?.present?.length || 0);
  if (runtime && markers) return "runtime + DCE markers";
  if (runtime) return item.execution?.kind === "test-harness" ? "upstream runtime" : "runtime";
  if (markers && item.oracle?.kind === "upstream-snapshot") return "snapshot markers";
  if (markers) return "DCE markers";
  return "no portable oracle";
}

function hasPortableOracle(item) {
  const runtime = item.execution?.runtime !== false;
  const markers = (item.expect?.absent?.length || 0) + (item.expect?.present?.length || 0);
  return runtime || markers > 0;
}

function sourceLinks(item) {
  const seen = new Set();
  const labels = [];
  for (const source of item.provenance || []) {
    if (seen.has(source.bundler)) continue;
    seen.add(source.bundler);
    labels.push(escapeCell(source.bundler));
  }
  return labels.join(", ");
}

function caseLink(item) {
  const canonicalSource = item.id.split("/")[1];
  const url = item.provenance?.find((source) => source.bundler === canonicalSource)?.url || item.provenance?.[0]?.url;
  const id = escapeCell(item.id);
  return url ? `[${id}](${url})` : id;
}

function rspackDiagnostic(item) {
  const observation = productionResult("rspack", item.id);
  if (!observation) return "No observation";
  if (observation.status === "pass") return "";
  if (observation.status === "unsupported") {
    return escapeCell(item.portabilityIssues?.[0] || observation.build?.error || "Source-specific harness/config").slice(0, 180);
  }
  if (observation.status === "unverified") {
    const build = observation.build?.ok === false ? `build: ${observation.build.error}` : "no portable runtime or code oracle";
    return escapeCell(item.portabilityIssues?.[0] || build).slice(0, 180);
  }
  if (observation.failureKind === "build") return escapeCell(`build: ${observation.build?.error || "failed"}`).slice(0, 180);
  if (observation.failureKind === "runtime") {
    const detail =
      observation.runtime?.error ||
      `expected ${JSON.stringify(observation.runtime?.expected)}, got ${JSON.stringify(observation.runtime?.actual)}`;
    return escapeCell(`runtime: ${detail}`).slice(0, 180);
  }
  const detail = [
    ...(observation.analysis?.unexpectedlyPresent || []).map((marker) => `kept ${marker}`),
    ...(observation.analysis?.unexpectedlyAbsent || []).map((marker) => `lost ${marker}`),
  ].join(", ");
  return escapeCell(detail || observation.failureKind || observation.status).slice(0, 180);
}

const lines = [];
const generatedCount = cases.filter((item) => item.id.startsWith("upstream/")).length;
const supplementalCount = cases.length - generatedCount;
const filteredCount = corpusCases.length - cases.length;
lines.push("# Latest tree-shaking conformance report", "");
lines.push(`Generated: \`${results.generatedAt}\``, "");
lines.push(
  `This production-only report contains **${cases.length} cases with a portable oracle**: ${generatedCount} exact-release upstream fixtures and ${supplementalCount} focused cross-bundler probes. Every reportable case appears exactly once in Table 3.`,
  "",
);
lines.push(
  `${filteredCount} additional inventoried cases without a portable oracle remain in the machine-readable corpus and are intentionally omitted from all three tables and all statistics.`,
  "",
);
lines.push(
  `Releases: ${bundlers.map((id) => `${results.bundlers[id].label} \`${results.bundlers[id].version}\``).join("; ")}.`,
  "",
);
lines.push(
  "> ✅ = portable oracle passed; ◐ = runtime passed but removable code remained; ❌ = build/runtime/oracle failure; — = source-specific and not portable to that adapter; ◇ = this adapter could not apply the case's available oracle. Pass rates use ✅ / (✅ + ◐ + ❌); — and ◇ are excluded from the denominator.",
  "",
);
lines.push(
  "Production compression/DCE is enabled with identifier mangling disabled where the public API permits it, so identifier-based upstream markers remain observable. Turbopack uses string-stable markers because Next.js does not expose that switch.",
  "",
);

lines.push("## 1. Pass rate by upstream source (production)", "");
lines.push("Only cases with a portable oracle are counted. A deduplicated case is counted in every source row that carries its provenance, so source-row case counts intentionally overlap.", "");
lines.push(
  `| Source | Cases | ${bundlers.map((id) => results.bundlers[id].label).join(" | ")} |`,
  `| --- | ---: | ${bundlers.map(() => "---:").join(" | ")} |`,
);
const upstreamById = new Map((inventory?.upstreams || []).map((item) => [item.id, item]));
const upstreamRows = bundlerOrder.map((id) => upstreamById.get(id) || { id });
for (const upstream of upstreamRows) {
  const selected = cases.filter((item) => item.provenance?.some((source) => source.bundler === upstream.id));
  const sourceName = upstream.repository
    ? `[${upstream.id}](https://github.com/${upstream.repository})`
    : upstream.id;
  lines.push(
    `| ${sourceName} | ${selected.length} | ${bundlers.map((id) => rateCell(selected, id)).join(" | ")} |`,
  );
}

const categories = [...new Set(cases.map((item) => item.category))].sort(
  (a, b) => (categoryOrder.indexOf(a) + 1 || 999) - (categoryOrder.indexOf(b) + 1 || 999) || a.localeCompare(b),
);
lines.push("", "## 2. Pass rate by capability family (production)", "");
lines.push(
  `| Capability family | Cases | ${bundlers.map((id) => results.bundlers[id].label).join(" | ")} |`,
  `| --- | ---: | ${bundlers.map(() => "---:").join(" | ")} |`,
);
for (const category of categories) {
  const selected = cases.filter((item) => item.category === category);
  lines.push(`| ${category} | ${selected.length} | ${bundlers.map((id) => rateCell(selected, id)).join(" | ")} |`);
}

const rspackRank = { fail: 0, partial: 1, unsupported: 2, unverified: 3, pass: 4 };
const detailedCases = [...cases].sort(
  (a, b) =>
    categories.indexOf(a.category) - categories.indexOf(b.category) ||
    rspackRank[statusOf("rspack", a.id)] - rspackRank[statusOf("rspack", b.id)] ||
    a.id.localeCompare(b.id),
);
lines.push("", "## 3. Case × bundler matrix (production)", "");
lines.push(
  "Rows are grouped by capability family and put Rspack failures/misses first, so each gap can be opened at its exact upstream source and turned into a focused fix.",
  "",
);
lines.push(
  `| Case | Source | Family | Oracle | ${bundlers.map((id) => results.bundlers[id].label).join(" | ")} | Rspack diagnostic |`,
  `| --- | --- | --- | --- | ${bundlers.map(() => "---:").join(" | ")} | --- |`,
);
for (const item of detailedCases) {
  const cells = bundlers.map((id) => symbols[statusOf(id, item.id)] || "◇");
  lines.push(
    `| ${caseLink(item)} | ${sourceLinks(item)} | ${escapeCell(item.category)} | ${oracleLabel(item)} | ${cells.join(" | ")} | ${rspackDiagnostic(item)} |`,
  );
}

if (detailedCases.length !== cases.length || new Set(detailedCases.map((item) => item.id)).size !== cases.length) {
  throw new Error("Detailed report matrix lost or duplicated a case.");
}
if (detailedCases.some((item) => oracleLabel(item) === "no portable oracle")) {
  throw new Error("Detailed report matrix contains a case without a portable oracle.");
}

lines.push(
  "",
  `Machine-readable observations: [\`data/results/latest.json\`](../data/results/latest.json). Exact generated fixtures and provenance: [\`corpus/generated/upstream.json\`](../corpus/generated/upstream.json). Release inventory: [\`data/upstreams/latest.json\`](../data/upstreams/latest.json).`,
  "",
);

await fs.mkdir(fromRoot("reports"), { recursive: true });
await fs.writeFile(fromRoot("reports/latest.md"), `${lines.join("\n").trimEnd()}\n`);
console.log(
  `Wrote reports/latest.md (${cases.length} portable-oracle cases × ${bundlers.length} bundlers; ${filteredCount} unverified cases filtered; exactly 3 result tables)`,
);
