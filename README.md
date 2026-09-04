# Tree-shaking compatibility lab

[![Daily tree-shaking matrix](https://github.com/LingyuCoder/tree-shaking-compat/actions/workflows/daily.yml/badge.svg)](https://github.com/LingyuCoder/tree-shaking-compat/actions/workflows/daily.yml)

This repository measures production tree-shaking behavior across the latest stable releases of Rollup, Rolldown, webpack, Rspack, esbuild, Parcel, Bun, and Turbopack.

The current result is in **[reports/latest.md](reports/latest.md)**. Machine-readable observations live in [`data/results/latest.json`](data/results/latest.json).

## Complete-corpus boundary

“Complete” has a reproducible definition here: every case found inside the versioned upstream suite selectors in [`config/upstreams.json`](config/upstreams.json) is inventoried at the exact latest-release commit. Every fixture classified as direct tree-shaking/DCE evidence is mapped into the canonical corpus; explicit upstream incompatibility lists are also retained as negative evidence.

The current corpus has 1,248 canonical cases: 1,206 generated from exact upstream release fixtures and 42 focused portable probes. Ports of the same esbuild or Rollup case in multiple projects are deduplicated into one case with multiple provenance links, so copied tests do not inflate pass rates.

The generated corpus records source files, upstream paths, release commits, oracle type, broad capability family, portability limitations, and known negative evidence in [`corpus/generated/upstream.json`](corpus/generated/upstream.json). The generator verifies that every configured direct source entry is mapped.

## The three report views

The report deliberately contains three result tables:

1. Pass rate grouped by upstream source.
2. Pass rate grouped by broad capability family.
3. Every canonical case × every bundler, with exact source links and an Rspack-focused diagnostic.

The symbols are: ✅ portable oracle passed; ◐ runtime passed but removable code remained; ❌ build/runtime/oracle failed; — the case depends on a source-specific harness or configuration that the adapter cannot express; ◇ the fixture is present but has no portable oracle yet. Only ✅, ◐, and ❌ enter pass-rate denominators. This prevents missing assertions or source-specific harnesses from being reported as bundler failures.

## What is executed

Each case is built with the bundler's production pipeline. Runtime assertions check observable behavior; emitted-code markers check whether dead declarations and effects disappeared while required code remained. Production compression/DCE stays enabled, while identifier mangling is disabled where a public switch exists so upstream identifier markers remain observable. Turbopack is tested through `next build --turbopack` and uses route-specific output traces plus string-stable markers.

Some upstream tests are inseparable from a project's private test runner, loader, alias, filesystem snapshot, or compiler-internal global. They still appear in the detailed table, but are marked — or ◇ and excluded from rates until a portable oracle exists. This is intentional: complete provenance and honest uncertainty are more useful than false passes.

## Run locally

Requirements: Node.js 22+, Corepack, Git, and Bun on `PATH` when running the Bun adapter.

```bash
corepack pnpm check
corepack pnpm versions
corepack pnpm install:toolchain
corepack pnpm inventory
corepack pnpm checkout:upstreams
corepack pnpm corpus
node scripts/run.mjs --profiles=production
corepack pnpm report
```

Useful filters:

```bash
node scripts/run.mjs --bundlers=rspack,webpack --profiles=production
node scripts/run.mjs --categories=commonjs,annotations --profiles=production
node scripts/run.mjs --cases=annotations/pure-call-spread-effects --profiles=production
```

[`data/results/versions.json`](data/results/versions.json) records the exact versions selected from npm's `latest` dist-tag and Bun's latest GitHub release. Dependencies are installed into the ignored `.cache/toolchain` directory, and upstream repositories are sparse-checked out into `.cache/upstreams` at exact release commits.

## Daily automation

The scheduled workflow runs at **02:00 Asia/Shanghai** (`18:00 UTC` on the previous calendar day). It resolves releases, rebuilds the complete upstream corpus, runs all eight production adapters in parallel jobs, merges the observations, regenerates the three tables, validates source coverage, and commits changed corpus/data/report artifacts.

## Adding a focused probe

Add a small case module under [`corpus/`](corpus/) when an upstream fixture cannot isolate the semantic distinction by itself. A focused probe should expose `run()`, return a JSON-serializable result, use globally unique emitted-code markers, cite exact upstream evidence, and change one semantic dimension at a time.

Run `corepack pnpm check` before submitting changes. Imported upstream fixture snippets retain their original licenses; see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

MIT licensed.
