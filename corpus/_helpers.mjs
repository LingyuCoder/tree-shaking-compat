export const upstream = {
  esbuild: "https://github.com/evanw/esbuild/blob/master/internal/bundler_tests/bundler_dce_test.go",
  parcel: "https://github.com/parcel-bundler/parcel/blob/v2/packages/core/integration-tests/test/scope-hoisting.js",
  turbopack: "https://github.com/vercel/next.js/tree/canary/turbopack/crates/turbopack-tests/tests/execution/turbopack/tree-shaking",
  rolldown: "https://github.com/rolldown/rolldown/tree/main/crates/rolldown/tests/rolldown/tree_shaking",
  rollup: "https://github.com/rollup/rollup/tree/master/test/form/samples",
  webpack: "https://github.com/webpack/webpack/tree/main/test/cases",
  rspack: "https://github.com/web-infra-dev/rspack/tree/main/tests/rspack-test/treeShakingCases",
  bun: "https://github.com/oven-sh/bun/blob/main/test/bundler/esbuild/dce.test.ts",
};

export function provenance(...bundlers) {
  return bundlers.map((bundler) => ({ bundler, url: upstream[bundler] }));
}

export function defineCase(value) {
  return {
    description: "",
    features: [],
    ...value,
    expect: { present: [], ...value.expect },
  };
}
