import { defineCase, provenance } from "./_helpers.mjs";

export default [
  defineCase({
    id: "annotations/pure-call",
    title: "PURE call annotation",
    category: "annotations",
    description: "Drops an unused annotated call and the now-unreferenced callee.",
    module: "esm",
    entry: "entry.js",
    files: {
      "entry.js": `function target() { return "TS_PURE_CALL_DROP_a8950f"; }\n/*#__PURE__*/ target();\nexport function run() { return 67; }`,
    },
    expect: { value: 67, absent: ["TS_PURE_CALL_DROP_a8950f"] },
    provenance: provenance("esbuild", "bun", "parcel", "turbopack", "rolldown", "rollup", "webpack", "rspack"),
  }),
  defineCase({
    id: "annotations/pure-new",
    title: "PURE constructor annotation",
    category: "annotations",
    description: "Drops an unused annotated constructor call and class body.",
    module: "esm",
    entry: "entry.js",
    files: {
      "entry.js": `class Target { method() { return "TS_PURE_NEW_DROP_a7153b"; } }\n/*#__PURE__*/ new Target();\nexport function run() { return 71; }`,
    },
    expect: { value: 71, absent: ["TS_PURE_NEW_DROP_a7153b"] },
    provenance: provenance("esbuild", "bun", "parcel", "rolldown", "rollup", "webpack", "rspack"),
  }),
  defineCase({
    id: "annotations/pure-call-spread-effects",
    title: "PURE call preserves spread iteration",
    category: "annotations",
    description: "Drops pure call/new bodies but consumes each spread argument in source order.",
    module: "esm",
    entry: "entry.js",
    files: {
      "entry.js": `let iterations = 0;\nconst iterable = { [Symbol.iterator]() { iterations++; return [][Symbol.iterator](); } };\nfunction target() {}\nclass Target {}\n/*#__PURE__*/ target(...iterable);\n/*#__PURE__*/ new Target(...iterable);\nexport function run() { return iterations; }`,
    },
    expect: { value: 2, absent: [] },
    provenance: provenance("esbuild", "bun", "rolldown", "rspack"),
  }),
  defineCase({
    id: "annotations/no-side-effects-function",
    title: "NO_SIDE_EFFECTS function annotation",
    category: "annotations",
    description: "Uses a declaration annotation to remove an otherwise opaque unused call.",
    module: "esm",
    entry: "entry.js",
    files: {
      "entry.js": `/*#__NO_SIDE_EFFECTS__*/ function annotated() { return "TS_NO_SIDE_EFFECTS_DROP_01ac48"; }\nannotated();\nexport function run() { return 73; }`,
    },
    expect: { value: 73, absent: ["TS_NO_SIDE_EFFECTS_DROP_01ac48"] },
    provenance: provenance("esbuild", "bun", "rolldown", "webpack", "rspack"),
  }),
  defineCase({
    id: "annotations/direct-eval-bailout",
    title: "Direct eval scope bailout",
    category: "annotations",
    description: "Keeps a local binding that is only referenced by direct eval.",
    module: "esm",
    entry: "entry.js",
    files: {
      "entry.js": `export function run() { const hidden = "TS_DIRECT_EVAL_KEEP_232b09"; return eval("hidden"); }`,
    },
    expect: {
      value: "TS_DIRECT_EVAL_KEEP_232b09",
      absent: [],
      present: ["TS_DIRECT_EVAL_KEEP_232b09"],
    },
    provenance: provenance("esbuild", "bun", "parcel", "turbopack", "rolldown", "rollup", "webpack", "rspack"),
  }),
];
