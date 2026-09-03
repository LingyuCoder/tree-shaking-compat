# Latest tree-shaking conformance report

Generated: `2026-09-03T18:15:18.714Z`

> ✅ = semantics correct and all pruning markers removed; ◐ = semantics correct but expected code remains; ❌ = build/runtime semantics failure; — = unavailable. A missing upstream fixture is never treated as unsupported.

## Releases under test

| Bundler | Version | Production pipeline |
| --- | ---: | --- |
| Rollup | `4.63.1` | core |
| Rolldown | `1.2.7` | core+minifier |
| webpack | `5.110.3` | graph+terser |
| Rspack | `2.2.2` | graph+swc |
| esbuild | `0.28.2` | core+minifier |
| Parcel | `2.16.4` | scope-hoist+optimizer |
| Bun | `1.4.0` | core+minifier |
| Turbopack | `16.3.4` | Next.js production pipeline |

## Summary

| Bundler | Graph-native | Minifier-assisted | Production-only | Missed optimization | Incorrect | Pass rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Rollup | 33 | 0 | 0 | 7 | 2 | 78.6% |
| Rolldown | 28 | 0 | 0 | 13 | 1 | 66.7% |
| webpack | 18 | 18 | 0 | 5 | 1 | 85.7% |
| Rspack | 16 | 19 | 0 | 5 | 2 | 83.3% |
| esbuild | 23 | 1 | 0 | 17 | 1 | 57.1% |
| Parcel | 11 | 21 | 0 | 9 | 1 | 76.2% |
| Bun | 23 | 0 | 0 | 17 | 2 | 54.8% |
| Turbopack | 0 | 0 | 30 | 10 | 2 | 71.4% |

## Capability families (production)

| Family | Cases | Rollup | Rolldown | webpack | Rspack | esbuild | Parcel | Bun | Turbopack |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| esm | 7 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 | 7/7 |
| side-effects | 5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 |
| dynamic-import | 4 | 3/4 | 3/4 | 2/4 | 3/4 | 0/4 | 1/4 | 1/4 | 2/4 |
| statements | 6 | 6/6 | 5/6 | 6/6 | 6/6 | 5/6 | 6/6 | 5/6 | 6/6 |
| object-paths | 7 | 6/7 | 1/7 | 4/7 | 5/7 | 1/7 | 5/7 | 1/7 | 5/7 |
| annotations | 5 | 3/5 | 5/5 | 4/5 | 4/5 | 5/5 | 4/5 | 3/5 | 4/5 |
| commonjs | 7 | 2/7 | 1/7 | 7/7 | 4/7 | 1/7 | 4/7 | 1/7 | 1/7 |
| assets | 1 | 1/1 | 1/1 | 1/1 | 1/1 | 0/1 | 0/1 | 0/1 | 0/1 |

## Case × bundler matrix (production)

| Case | Family | Rollup | Rolldown | webpack | Rspack | esbuild | Parcel | Bun | Turbopack |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `esm/unused-named-export` | esm | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `esm/unused-default-export` | esm | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `esm/star-reexport-chain` | esm | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `esm/namespace-static-member` | esm | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `esm/namespace-dynamic-key-bailout` | esm | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `esm/export-star-conflict-priority` | esm | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `esm/circular-live-binding` | esm | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `side-effects/package-false-bare-import` | side-effects | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `side-effects/package-true-bare-import` | side-effects | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `side-effects/package-glob` | side-effects | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `side-effects/reexport-passthrough` | side-effects | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `side-effects/diamond-order` | side-effects | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `dynamic-import/destructured-binding` | dynamic-import | ✅ | ✅ | ✅ | ✅ | ◐ | ✅ | ◐ | ✅ |
| `dynamic-import/member-access` | dynamic-import | ✅ | ✅ | ◐ | ✅ | ◐ | ◐ | ◐ | ✅ |
| `dynamic-import/destructuring-assignment` | dynamic-import | ◐ | ◐ | ✅ | ✅ | ◐ | ◐ | ◐ | ◐ |
| `dynamic-import/unused-imported-chunk` | dynamic-import | ✅ | ✅ | ◐ | ◐ | ◐ | ◐ | ✅ | ◐ |
| `statements/multi-declarator` | statements | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `statements/dead-if-branch` | statements | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `statements/class-static-block-pure` | statements | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `statements/class-static-block-effect` | statements | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `statements/excess-pure-argument` | statements | ✅ | ◐ | ✅ | ✅ | ◐ | ✅ | ◐ | ✅ |
| `statements/excess-effectful-argument` | statements | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `objects/local-unused-property` | object-paths | ✅ | ◐ | ✅ | ✅ | ◐ | ✅ | ◐ | ✅ |
| `objects/function-parameter-property` | object-paths | ✅ | ◐ | ✅ | ✅ | ◐ | ✅ | ◐ | ✅ |
| `objects/destructured-parameter-property` | object-paths | ✅ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ |
| `objects/nested-property-path` | object-paths | ✅ | ◐ | ✅ | ✅ | ◐ | ✅ | ◐ | ✅ |
| `objects/array-element-path` | object-paths | ◐ | ◐ | ◐ | ✅ | ◐ | ✅ | ◐ | ✅ |
| `objects/getter-effect` | object-paths | ✅ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ |
| `objects/unknown-escape-bailout` | object-paths | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `annotations/pure-call` | annotations | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `annotations/pure-new` | annotations | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `annotations/pure-call-spread-effects` | annotations | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `annotations/no-side-effects-function` | annotations | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ | ✅ |
| `annotations/direct-eval-bailout` | annotations | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `commonjs/require-member` | commonjs | ◐ | ◐ | ✅ | ✅ | ◐ | ✅ | ◐ | ◐ |
| `commonjs/require-destructuring` | commonjs | ◐ | ◐ | ✅ | ✅ | ◐ | ✅ | ◐ | ◐ |
| `commonjs/object-literal-export` | commonjs | ◐ | ◐ | ✅ | ◐ | ◐ | ◐ | ◐ | ◐ |
| `commonjs/object-method-nested-require` | commonjs | ◐ | ◐ | ✅ | ◐ | ◐ | ◐ | ◐ | ◐ |
| `commonjs/unused-pure-require` | commonjs | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `commonjs/unused-effectful-require` | commonjs | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `commonjs/deep-reexport` | commonjs | ◐ | ◐ | ✅ | ✅ | ◐ | ◐ | ◐ | ◐ |
| `assets/json-unused-key` | assets | ✅ | ✅ | ✅ | ✅ | ◐ | ◐ | ◐ | ◐ |

## Optimization-layer dependency

`graph-native` means the unminified bundler graph/output already removed every marker. `minifier-assisted` means only the production profile completed the optimization. Turbopack is exposed through Next.js production builds, so it is reported as `production-only`.

| Case | Rollup | Rolldown | webpack | Rspack | esbuild | Parcel | Bun | Turbopack |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `esm/unused-named-export` | graph-native | graph-native | graph-native | graph-native | graph-native | minifier-assisted | graph-native | production-only |
| `esm/unused-default-export` | graph-native | graph-native | graph-native | graph-native | graph-native | minifier-assisted | graph-native | production-only |
| `esm/star-reexport-chain` | graph-native | graph-native | minifier-assisted | minifier-assisted | graph-native | minifier-assisted | graph-native | production-only |
| `esm/namespace-static-member` | graph-native | graph-native | graph-native | graph-native | graph-native | minifier-assisted | graph-native | production-only |
| `esm/namespace-dynamic-key-bailout` | graph-native | graph-native | graph-native | graph-native | graph-native | graph-native | graph-native | production-only |
| `esm/export-star-conflict-priority` | graph-native | graph-native | graph-native | graph-native | graph-native | minifier-assisted | graph-native | production-only |
| `esm/circular-live-binding` | graph-native | graph-native | minifier-assisted | minifier-assisted | graph-native | minifier-assisted | graph-native | production-only |
| `side-effects/package-false-bare-import` | graph-native | graph-native | graph-native | graph-native | graph-native | graph-native | graph-native | production-only |
| `side-effects/package-true-bare-import` | graph-native | graph-native | graph-native | graph-native | graph-native | graph-native | graph-native | production-only |
| `side-effects/package-glob` | graph-native | graph-native | graph-native | graph-native | graph-native | graph-native | graph-native | production-only |
| `side-effects/reexport-passthrough` | graph-native | graph-native | graph-native | graph-native | graph-native | minifier-assisted | graph-native | production-only |
| `side-effects/diamond-order` | graph-native | graph-native | minifier-assisted | minifier-assisted | graph-native | minifier-assisted | graph-native | production-only |
| `dynamic-import/destructured-binding` | graph-native | graph-native | minifier-assisted | minifier-assisted | missed | minifier-assisted | missed | production-only |
| `dynamic-import/member-access` | graph-native | graph-native | missed | minifier-assisted | missed | missed | missed | production-only |
| `dynamic-import/destructuring-assignment` | missed | missed | minifier-assisted | minifier-assisted | missed | missed | missed | missed |
| `dynamic-import/unused-imported-chunk` | graph-native | graph-native | missed | missed | missed | missed | graph-native | missed |
| `statements/multi-declarator` | graph-native | graph-native | minifier-assisted | minifier-assisted | graph-native | minifier-assisted | graph-native | production-only |
| `statements/dead-if-branch` | graph-native | graph-native | graph-native | graph-native | minifier-assisted | graph-native | graph-native | production-only |
| `statements/class-static-block-pure` | graph-native | graph-native | minifier-assisted | minifier-assisted | graph-native | minifier-assisted | graph-native | production-only |
| `statements/class-static-block-effect` | graph-native | graph-native | graph-native | graph-native | graph-native | graph-native | graph-native | production-only |
| `statements/excess-pure-argument` | graph-native | missed | minifier-assisted | minifier-assisted | missed | minifier-assisted | missed | production-only |
| `statements/excess-effectful-argument` | graph-native | graph-native | graph-native | graph-native | graph-native | graph-native | graph-native | production-only |
| `objects/local-unused-property` | graph-native | missed | minifier-assisted | minifier-assisted | missed | minifier-assisted | missed | production-only |
| `objects/function-parameter-property` | graph-native | missed | minifier-assisted | minifier-assisted | missed | minifier-assisted | missed | production-only |
| `objects/destructured-parameter-property` | graph-native | missed | missed | missed | missed | missed | missed | missed |
| `objects/nested-property-path` | graph-native | missed | minifier-assisted | minifier-assisted | missed | minifier-assisted | missed | production-only |
| `objects/array-element-path` | missed | missed | missed | minifier-assisted | missed | minifier-assisted | missed | production-only |
| `objects/getter-effect` | graph-native | missed | missed | missed | missed | missed | missed | missed |
| `objects/unknown-escape-bailout` | graph-native | graph-native | graph-native | graph-native | graph-native | graph-native | graph-native | production-only |
| `annotations/pure-call` | graph-native | graph-native | minifier-assisted | minifier-assisted | graph-native | minifier-assisted | graph-native | production-only |
| `annotations/pure-new` | graph-native | graph-native | minifier-assisted | minifier-assisted | graph-native | minifier-assisted | graph-native | production-only |
| `annotations/pure-call-spread-effects` | incorrect | graph-native | incorrect | incorrect | graph-native | incorrect | incorrect | incorrect |
| `annotations/no-side-effects-function` | graph-native | graph-native | minifier-assisted | minifier-assisted | graph-native | minifier-assisted | missed | production-only |
| `annotations/direct-eval-bailout` | incorrect | graph-native | graph-native | graph-native | graph-native | graph-native | graph-native | production-only |
| `commonjs/require-member` | missed | missed | minifier-assisted | minifier-assisted | missed | minifier-assisted | missed | missed |
| `commonjs/require-destructuring` | missed | missed | minifier-assisted | minifier-assisted | missed | minifier-assisted | missed | missed |
| `commonjs/object-literal-export` | missed | missed | minifier-assisted | missed | missed | missed | missed | missed |
| `commonjs/object-method-nested-require` | missed | missed | graph-native | missed | missed | missed | missed | missed |
| `commonjs/unused-pure-require` | graph-native | incorrect | graph-native | incorrect | incorrect | graph-native | incorrect | incorrect |
| `commonjs/unused-effectful-require` | graph-native | graph-native | graph-native | graph-native | graph-native | graph-native | graph-native | production-only |
| `commonjs/deep-reexport` | missed | missed | minifier-assisted | minifier-assisted | missed | missed | missed | missed |
| `assets/json-unused-key` | graph-native | graph-native | graph-native | graph-native | missed | missed | missed | missed |

## Misses and correctness failures

| Case | Bundler | Result | First diagnostic |
| --- | --- | --- | --- |
| `dynamic-import/destructured-binding` | esbuild | ◐ pruning | kept TS_DYNAMIC_DESTRUCTURE_UNUSED_a77c7c |
| `dynamic-import/destructured-binding` | Bun | ◐ pruning | kept TS_DYNAMIC_DESTRUCTURE_UNUSED_a77c7c |
| `dynamic-import/member-access` | webpack | ◐ pruning | kept TS_DYNAMIC_MEMBER_UNUSED_27292c |
| `dynamic-import/member-access` | esbuild | ◐ pruning | kept TS_DYNAMIC_MEMBER_UNUSED_27292c |
| `dynamic-import/member-access` | Parcel | ◐ pruning | kept TS_DYNAMIC_MEMBER_UNUSED_27292c |
| `dynamic-import/member-access` | Bun | ◐ pruning | kept TS_DYNAMIC_MEMBER_UNUSED_27292c |
| `dynamic-import/destructuring-assignment` | Rollup | ◐ pruning | kept TS_DYNAMIC_ASSIGN_UNUSED_d43dd5 |
| `dynamic-import/destructuring-assignment` | Rolldown | ◐ pruning | kept TS_DYNAMIC_ASSIGN_UNUSED_d43dd5 |
| `dynamic-import/destructuring-assignment` | esbuild | ◐ pruning | kept TS_DYNAMIC_ASSIGN_UNUSED_d43dd5 |
| `dynamic-import/destructuring-assignment` | Parcel | ◐ pruning | kept TS_DYNAMIC_ASSIGN_UNUSED_d43dd5 |
| `dynamic-import/destructuring-assignment` | Bun | ◐ pruning | kept TS_DYNAMIC_ASSIGN_UNUSED_d43dd5 |
| `dynamic-import/destructuring-assignment` | Turbopack | ◐ pruning | kept TS_DYNAMIC_ASSIGN_UNUSED_d43dd5 |
| `dynamic-import/unused-imported-chunk` | webpack | ◐ pruning | kept TS_DYNAMIC_UNUSED_CHUNK_DROP_87ef4f |
| `dynamic-import/unused-imported-chunk` | Rspack | ◐ pruning | kept TS_DYNAMIC_UNUSED_CHUNK_DROP_87ef4f |
| `dynamic-import/unused-imported-chunk` | esbuild | ◐ pruning | kept TS_DYNAMIC_UNUSED_CHUNK_DROP_87ef4f |
| `dynamic-import/unused-imported-chunk` | Parcel | ◐ pruning | kept TS_DYNAMIC_UNUSED_CHUNK_DROP_87ef4f |
| `dynamic-import/unused-imported-chunk` | Turbopack | ◐ pruning | kept TS_DYNAMIC_UNUSED_CHUNK_DROP_87ef4f |
| `statements/excess-pure-argument` | Rolldown | ◐ pruning | kept TS_EXCESS_PURE_ARG_DROP_b491b3 |
| `statements/excess-pure-argument` | esbuild | ◐ pruning | kept TS_EXCESS_PURE_ARG_DROP_b491b3 |
| `statements/excess-pure-argument` | Bun | ◐ pruning | kept TS_EXCESS_PURE_ARG_DROP_b491b3 |
| `objects/local-unused-property` | Rolldown | ◐ pruning | kept TS_OBJECT_LOCAL_PROP_DROP_b02bf2 |
| `objects/local-unused-property` | esbuild | ◐ pruning | kept TS_OBJECT_LOCAL_PROP_DROP_b02bf2 |
| `objects/local-unused-property` | Bun | ◐ pruning | kept TS_OBJECT_LOCAL_PROP_DROP_b02bf2 |
| `objects/function-parameter-property` | Rolldown | ◐ pruning | kept TS_OBJECT_PARAM_PROP_DROP_810f23 |
| `objects/function-parameter-property` | esbuild | ◐ pruning | kept TS_OBJECT_PARAM_PROP_DROP_810f23 |
| `objects/function-parameter-property` | Bun | ◐ pruning | kept TS_OBJECT_PARAM_PROP_DROP_810f23 |
| `objects/destructured-parameter-property` | Rolldown | ◐ pruning | kept TS_OBJECT_DESTRUCTURED_PROP_DROP_af4d42 |
| `objects/destructured-parameter-property` | webpack | ◐ pruning | kept TS_OBJECT_DESTRUCTURED_PROP_DROP_af4d42 |
| `objects/destructured-parameter-property` | Rspack | ◐ pruning | kept TS_OBJECT_DESTRUCTURED_PROP_DROP_af4d42 |
| `objects/destructured-parameter-property` | esbuild | ◐ pruning | kept TS_OBJECT_DESTRUCTURED_PROP_DROP_af4d42 |
| `objects/destructured-parameter-property` | Parcel | ◐ pruning | kept TS_OBJECT_DESTRUCTURED_PROP_DROP_af4d42 |
| `objects/destructured-parameter-property` | Bun | ◐ pruning | kept TS_OBJECT_DESTRUCTURED_PROP_DROP_af4d42 |
| `objects/destructured-parameter-property` | Turbopack | ◐ pruning | kept TS_OBJECT_DESTRUCTURED_PROP_DROP_af4d42 |
| `objects/nested-property-path` | Rolldown | ◐ pruning | kept TS_OBJECT_NESTED_PROP_DROP_d7f587 |
| `objects/nested-property-path` | esbuild | ◐ pruning | kept TS_OBJECT_NESTED_PROP_DROP_d7f587 |
| `objects/nested-property-path` | Bun | ◐ pruning | kept TS_OBJECT_NESTED_PROP_DROP_d7f587 |
| `objects/array-element-path` | Rollup | ◐ pruning | kept TS_ARRAY_ELEMENT_DROP_4a0a2d |
| `objects/array-element-path` | Rolldown | ◐ pruning | kept TS_ARRAY_ELEMENT_DROP_4a0a2d |
| `objects/array-element-path` | webpack | ◐ pruning | kept TS_ARRAY_ELEMENT_DROP_4a0a2d |
| `objects/array-element-path` | esbuild | ◐ pruning | kept TS_ARRAY_ELEMENT_DROP_4a0a2d |
| `objects/array-element-path` | Bun | ◐ pruning | kept TS_ARRAY_ELEMENT_DROP_4a0a2d |
| `objects/getter-effect` | Rolldown | ◐ pruning | kept TS_OBJECT_GETTER_UNUSED_DROP_912f8c |
| `objects/getter-effect` | webpack | ◐ pruning | kept TS_OBJECT_GETTER_UNUSED_DROP_912f8c |
| `objects/getter-effect` | Rspack | ◐ pruning | kept TS_OBJECT_GETTER_UNUSED_DROP_912f8c |
| `objects/getter-effect` | esbuild | ◐ pruning | kept TS_OBJECT_GETTER_UNUSED_DROP_912f8c |
| `objects/getter-effect` | Parcel | ◐ pruning | kept TS_OBJECT_GETTER_UNUSED_DROP_912f8c |
| `objects/getter-effect` | Bun | ◐ pruning | kept TS_OBJECT_GETTER_UNUSED_DROP_912f8c |
| `objects/getter-effect` | Turbopack | ◐ pruning | kept TS_OBJECT_GETTER_UNUSED_DROP_912f8c |
| `annotations/pure-call-spread-effects` | Rollup | ❌ runtime | expected 2, got 0 |
| `annotations/pure-call-spread-effects` | webpack | ❌ runtime | expected 2, got 0 |
| `annotations/pure-call-spread-effects` | Rspack | ❌ runtime | expected 2, got 0 |
| `annotations/pure-call-spread-effects` | Parcel | ❌ runtime | expected 2, got 0 |
| `annotations/pure-call-spread-effects` | Bun | ❌ runtime | exit 1 |
| `annotations/pure-call-spread-effects` | Turbopack | ❌ runtime | expected 2, got 0 |
| `annotations/no-side-effects-function` | Bun | ◐ pruning | kept TS_NO_SIDE_EFFECTS_DROP_01ac48 |
| `annotations/direct-eval-bailout` | Rollup | ❌ runtime | exit 1 |
| `commonjs/require-member` | Rollup | ◐ pruning | kept TS_CJS_REQUIRE_MEMBER_DROP_ca128c |
| `commonjs/require-member` | Rolldown | ◐ pruning | kept TS_CJS_REQUIRE_MEMBER_DROP_ca128c |
| `commonjs/require-member` | esbuild | ◐ pruning | kept TS_CJS_REQUIRE_MEMBER_DROP_ca128c |
| `commonjs/require-member` | Bun | ◐ pruning | kept TS_CJS_REQUIRE_MEMBER_DROP_ca128c |
| `commonjs/require-member` | Turbopack | ◐ pruning | kept TS_CJS_REQUIRE_MEMBER_DROP_ca128c |
| `commonjs/require-destructuring` | Rollup | ◐ pruning | kept TS_CJS_DESTRUCTURE_DROP_6607f7 |
| `commonjs/require-destructuring` | Rolldown | ◐ pruning | kept TS_CJS_DESTRUCTURE_DROP_6607f7 |
| `commonjs/require-destructuring` | esbuild | ◐ pruning | kept TS_CJS_DESTRUCTURE_DROP_6607f7 |
| `commonjs/require-destructuring` | Bun | ◐ pruning | kept TS_CJS_DESTRUCTURE_DROP_6607f7 |
| `commonjs/require-destructuring` | Turbopack | ◐ pruning | kept TS_CJS_DESTRUCTURE_DROP_6607f7 |
| `commonjs/object-literal-export` | Rollup | ◐ pruning | kept TS_CJS_OBJECT_LITERAL_DROP_a29c42 |
| `commonjs/object-literal-export` | Rolldown | ◐ pruning | kept TS_CJS_OBJECT_LITERAL_DROP_a29c42 |
| `commonjs/object-literal-export` | Rspack | ◐ pruning | kept TS_CJS_OBJECT_LITERAL_DROP_a29c42 |
| `commonjs/object-literal-export` | esbuild | ◐ pruning | kept TS_CJS_OBJECT_LITERAL_DROP_a29c42 |
| `commonjs/object-literal-export` | Parcel | ◐ pruning | kept TS_CJS_OBJECT_LITERAL_DROP_a29c42 |
| `commonjs/object-literal-export` | Bun | ◐ pruning | kept TS_CJS_OBJECT_LITERAL_DROP_a29c42 |
| `commonjs/object-literal-export` | Turbopack | ◐ pruning | kept TS_CJS_OBJECT_LITERAL_DROP_a29c42 |
| `commonjs/object-method-nested-require` | Rollup | ◐ pruning | kept TS_CJS_NESTED_REQUIRE_DROP_1c6660 |
| `commonjs/object-method-nested-require` | Rolldown | ◐ pruning | kept TS_CJS_NESTED_REQUIRE_DROP_1c6660 |
| `commonjs/object-method-nested-require` | Rspack | ◐ pruning | kept TS_CJS_NESTED_REQUIRE_DROP_1c6660 |
| `commonjs/object-method-nested-require` | esbuild | ◐ pruning | kept TS_CJS_NESTED_REQUIRE_DROP_1c6660 |
| `commonjs/object-method-nested-require` | Parcel | ◐ pruning | kept TS_CJS_NESTED_REQUIRE_DROP_1c6660 |
| `commonjs/object-method-nested-require` | Bun | ◐ pruning | kept TS_CJS_NESTED_REQUIRE_DROP_1c6660 |
| `commonjs/object-method-nested-require` | Turbopack | ◐ pruning | kept TS_CJS_NESTED_REQUIRE_DROP_1c6660 |
| `commonjs/unused-pure-require` | Rolldown | ❌ runtime | expected null, got "TS_CJS_UNUSED_REQUIRE_DROP_a5d4f7" |
| `commonjs/unused-pure-require` | Rspack | ❌ runtime | expected null, got "TS_CJS_UNUSED_REQUIRE_DROP_a5d4f7" |
| `commonjs/unused-pure-require` | esbuild | ❌ runtime | expected null, got "TS_CJS_UNUSED_REQUIRE_DROP_a5d4f7" |
| `commonjs/unused-pure-require` | Bun | ❌ runtime | expected null, got "TS_CJS_UNUSED_REQUIRE_DROP_a5d4f7" |
| `commonjs/unused-pure-require` | Turbopack | ❌ runtime | expected null, got "TS_CJS_UNUSED_REQUIRE_DROP_a5d4f7" |
| `commonjs/deep-reexport` | Rollup | ◐ pruning | kept TS_CJS_DEEP_REEXPORT_DROP_db82d3 |
| `commonjs/deep-reexport` | Rolldown | ◐ pruning | kept TS_CJS_DEEP_REEXPORT_DROP_db82d3 |
| `commonjs/deep-reexport` | esbuild | ◐ pruning | kept TS_CJS_DEEP_REEXPORT_DROP_db82d3 |
| `commonjs/deep-reexport` | Parcel | ◐ pruning | kept TS_CJS_DEEP_REEXPORT_DROP_db82d3 |
| `commonjs/deep-reexport` | Bun | ◐ pruning | kept TS_CJS_DEEP_REEXPORT_DROP_db82d3 |
| `commonjs/deep-reexport` | Turbopack | ◐ pruning | kept TS_CJS_DEEP_REEXPORT_DROP_db82d3 |
| `assets/json-unused-key` | esbuild | ◐ pruning | kept TS_JSON_UNUSED_KEY_DROP_9efcdd |
| `assets/json-unused-key` | Parcel | ◐ pruning | kept TS_JSON_UNUSED_KEY_DROP_9efcdd |
| `assets/json-unused-key` | Bun | ◐ pruning | kept TS_JSON_UNUSED_KEY_DROP_9efcdd |
| `assets/json-unused-key` | Turbopack | ◐ pruning | kept TS_JSON_UNUSED_KEY_DROP_9efcdd |

## Upstream test inventory

The inventory tracks every case inside the configured upstream suite boundaries at the exact latest-release commit. `Direct` is evidence explicitly related to DCE/tree shaking; `Inventoried` also includes broad scope-hoisting/optimization pipelines. Raw upstream harnesses are not counted in the cross-bundler matrix until normalized, because their configs and assertions are bundler-specific.

| Upstream | Release | Commit | Direct | Inventoried |
| --- | --- | --- | ---: | ---: |
| esbuild | [`v0.28.2`](https://github.com/evanw/esbuild/releases/tag/v0.28.2) | [`609683d89297`](https://github.com/evanw/esbuild/commit/609683d892977362a0f99026cb74b96263d728a9) | 121 | 121 |
| parcel | [`v2.16.4`](https://github.com/parcel-bundler/parcel/releases/tag/v2.16.4) | [`59484858a1a0`](https://github.com/parcel-bundler/parcel/commit/59484858a1a0bcbb71f74088956bb437a2db6505) | 60 | 283 |
| turbopack | [`v16.3.4`](https://github.com/vercel/next.js/releases/tag/v16.3.4) | [`299180d3315c`](https://github.com/vercel/next.js/commit/299180d3315c7ebd7b199d2b1a265b5986c5fc7d) | 115 | 115 |
| rolldown | [`v1.2.7`](https://github.com/rolldown/rolldown/releases/tag/v1.2.7) | [`26b4c6e56c55`](https://github.com/rolldown/rolldown/commit/26b4c6e56c5553d72a910d0f73d60fa331c0ed88) | 505 | 505 |
| rollup | [`v4.63.1`](https://github.com/rollup/rollup/releases/tag/v4.63.1) | [`78bfef0cb944`](https://github.com/rollup/rollup/commit/78bfef0cb94479566f81012fafa372c84b90bd34) | 321 | 2042 |
| webpack | [`v5.110.3`](https://github.com/webpack/webpack/releases/tag/v5.110.3) | [`a2d7b9ca3439`](https://github.com/webpack/webpack/commit/a2d7b9ca343905667770c3e80321387fb0332c23) | 141 | 161 |
| rspack | [`v2.2.2`](https://github.com/web-infra-dev/rspack/releases/tag/v2.2.2) | [`b4dd1a0e4978`](https://github.com/web-infra-dev/rspack/commit/b4dd1a0e4978a93daa1e4428943169ed1b4fcd37) | 218 | 233 |
| bun | [`bun-v1.4.0`](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.0) | [`34cbb9a40b4b`](https://github.com/oven-sh/bun/commit/34cbb9a40b4bd1bd767d134a7065e66c2432a676) | 107 | 107 |

## Reproducibility

- Exact resolved package versions: [`data/results/versions.json`](../data/results/versions.json)
- Machine-readable observations: [`data/results/latest.json`](../data/results/latest.json)
- Exact upstream case inventory: [`data/upstreams/latest.json`](../data/upstreams/latest.json)
- Runtime assertions distinguish semantic breakage from missed size optimizations.
- Marker scans cover emitted JavaScript only; source maps are disabled.
