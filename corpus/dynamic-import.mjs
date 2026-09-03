import { defineCase, provenance } from "./_helpers.mjs";

export default [
  defineCase({
    id: "dynamic-import/destructured-binding",
    title: "Dynamic import destructuring",
    category: "dynamic-import",
    description: "Narrows a dynamically imported namespace through a destructured binding.",
    features: ["dynamic-import"],
    module: "esm",
    entry: "entry.js",
    files: {
      "entry.js": `export async function run() { const { used } = await import("./lib.js"); return used; }`,
      "lib.js": `export const used = 11;\nexport const unused = "TS_DYNAMIC_DESTRUCTURE_UNUSED_a77c7c";`,
    },
    expect: { value: 11, absent: ["TS_DYNAMIC_DESTRUCTURE_UNUSED_a77c7c"] },
    provenance: provenance("parcel", "turbopack", "rolldown", "rollup", "webpack", "rspack"),
  }),
  defineCase({
    id: "dynamic-import/member-access",
    title: "Dynamic import member access",
    category: "dynamic-import",
    description: "Narrows a dynamically imported namespace through direct member access.",
    features: ["dynamic-import"],
    module: "esm",
    entry: "entry.js",
    files: {
      "entry.js": `export async function run() { return (await import("./lib.js")).used; }`,
      "lib.js": `export const used = "ok";\nexport const unused = "TS_DYNAMIC_MEMBER_UNUSED_27292c";`,
    },
    expect: { value: "ok", absent: ["TS_DYNAMIC_MEMBER_UNUSED_27292c"] },
    provenance: provenance("parcel", "turbopack", "rolldown", "rollup", "webpack", "rspack"),
  }),
  defineCase({
    id: "dynamic-import/destructuring-assignment",
    title: "Dynamic import destructuring assignment",
    category: "dynamic-import",
    description: "Tracks a used export through assignment-form destructuring.",
    features: ["dynamic-import"],
    module: "esm",
    entry: "entry.js",
    files: {
      "entry.js": `export async function run() { let used; ({ used } = await import("./lib.js")); return used; }`,
      "lib.js": `export const used = 13;\nexport const unused = "TS_DYNAMIC_ASSIGN_UNUSED_d43dd5";`,
    },
    expect: { value: 13, absent: ["TS_DYNAMIC_ASSIGN_UNUSED_d43dd5"] },
    provenance: provenance("parcel", "turbopack", "rolldown", "rollup", "webpack", "rspack"),
  }),
  defineCase({
    id: "dynamic-import/unused-imported-chunk",
    title: "Unused dynamic import chunk",
    category: "dynamic-import",
    description: "Removes a dynamic import that is only reachable from an unused local function.",
    features: ["dynamic-import"],
    module: "esm",
    entry: "entry.js",
    files: {
      "entry.js": `function neverCalled() { return import("./lazy.js"); }\nexport function run() { return 17; }`,
      "lazy.js": `globalThis.__TS_LAZY = "TS_DYNAMIC_UNUSED_CHUNK_DROP_87ef4f";\nexport const value = 1;`,
    },
    expect: { value: 17, absent: ["TS_DYNAMIC_UNUSED_CHUNK_DROP_87ef4f"] },
    provenance: provenance("turbopack", "rolldown", "rollup", "webpack", "rspack"),
  }),
];
