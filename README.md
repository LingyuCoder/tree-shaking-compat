# Tree-shaking compatibility lab

[![Daily tree-shaking matrix](https://github.com/LingyuCoder/tree-shaking-compat/actions/workflows/daily.yml/badge.svg)](https://github.com/LingyuCoder/tree-shaking-compat/actions/workflows/daily.yml)

This repository measures tree-shaking behavior across the latest stable releases of Rollup, Rolldown, webpack, Rspack, esbuild, Parcel, Bun, and Turbopack.

The current result is in **[reports/latest.md](reports/latest.md)**. Machine-readable results live in [`data/results/latest.json`](data/results/latest.json).

## What is measured

There are two deliberately separate datasets:

1. **Upstream inventory** — every test inside explicit DCE/tree-shaking suites plus the configured broader scope-hoisting/optimization suite boundaries. Each entry is tied to an exact release commit and source URL. This prevents “no fixture found” from being misreported as “unsupported.”
2. **Normalized conformance corpus** — portable semantic cases that every bundler can build. Each case has runtime assertions, markers that must disappear, markers that must remain, and links back to upstream evidence.

Upstream harnesses cannot be compared by copying their pass/fail labels: they use different module formats, plugins, snapshot rules, test runners, and optimization layers. The normalized corpus is the cross-bundler measurement; the inventory records the full evidence surface and the remaining normalization backlog.

## Result semantics

| Symbol | Meaning |
| --- | --- |
| ✅ | Build succeeds, runtime semantics match, removable markers disappear, and required markers remain. |
| ◐ | Runtime semantics are correct, but expected dead code remains. |
| ❌ | The release cannot build the case or the emitted bundle changes observable behavior. |
| — | The public release pipeline cannot express this profile. It does **not** mean unsupported. |

Every available bundler is run in two profiles:

- `graph`: tree shaking and scope hoisting enabled, final minification disabled.
- `production`: the bundler's normal production optimizer enabled.

This separates graph-native tree shaking from optimization that only appears after Terser, SWC, or another final optimizer. Rollup has no built-in minifier, so both profiles intentionally measure Rollup core. Turbopack is tested through `next build --turbopack`; because there is no stable standalone production API, only its production profile is reported.

## Run locally

Requirements: Node.js 22+, Corepack, and Bun on `PATH`.

```bash
corepack pnpm check
corepack pnpm versions
corepack pnpm install:toolchain
corepack pnpm inventory
corepack pnpm test
corepack pnpm report
```

Useful filters:

```bash
node scripts/run.mjs --bundlers=rspack,webpack --profiles=production
node scripts/run.mjs --categories=commonjs,annotations
node scripts/run.mjs --cases=annotations/pure-call-spread-effects
```

`data/results/versions.json` records the exact versions selected from npm's `latest` dist-tag and Bun's latest non-prerelease GitHub release. Dependencies are installed into the ignored `.cache/toolchain` directory so the repository lockfile cannot silently pin an older bundler.

## Daily automation

The scheduled workflow runs at **02:00 Asia/Shanghai** (`18:00 UTC` on the previous calendar day). It resolves releases again, refreshes the upstream inventory, executes all adapters in parallel jobs, merges the observations, regenerates the report, and commits only `data/` and `reports/` when they change.

## Adding a case

Add a focused case module under [`corpus/`](corpus/). A case should:

- expose a zero-argument `run()` function (or `exports.run` for CommonJS);
- return a JSON-serializable semantic result;
- use globally unique markers for code that must be absent or present;
- cite at least one upstream test or suite;
- change one semantic dimension at a time, with a bailout sibling when appropriate.

Run `corepack pnpm check` before submitting changes.

## Scope and caveats

- The top-level matrix measures final emitted behavior, not marketing claims or fixture counts.
- Test count is not a capability score; one path-sensitive Rollup case can cover more analysis depth than many syntax fixtures.
- CommonJS results for Rollup use the official CommonJS and node-resolve plugins and report those plugin versions in the resolved toolchain.
- Package `sideEffects` behavior is a contract: fixtures that declare an effectful file side-effect-free expect the file to be dropped.
- A build failure is kept visible instead of being converted to a skip.

MIT licensed.
